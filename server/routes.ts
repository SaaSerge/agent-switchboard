import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { hashPassword, comparePassword, generateApiKey, hashApiKey, validateApiKey } from "./auth";
import { pluginRegistry, loadBuiltinPlugins } from "./plugins/registry";
import { calculatePlanRiskScore } from "./plugins/risk-scoring";
import type { PluginContext } from "./plugins/types";
import crypto from "crypto";
import session from "express-session";
import MemoryStore from "memorystore";
import fs from "fs/promises";
import path from "path";

const MemStore = MemoryStore(session);

declare module "express-session" {
  interface SessionData {
    userId?: number;
    username?: string;
  }
}

function canonicalJson(obj: any): string {
  if (obj === null || obj === undefined) return JSON.stringify(obj);
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalJson).join(",") + "]";
  }
  const sortedKeys = Object.keys(obj).sort();
  const parts = sortedKeys.map(k => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return "{" + parts.join(",") + "}";
}

function computeHash(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function createAuditEvent(eventType: string, data: any): Promise<void> {
  const lastEvent = await storage.getLastAuditEvent();
  const prevHash = lastEvent?.eventHash || "GENESIS";
  const eventData = { eventType, data, timestamp: new Date().toISOString() };
  const eventHash = computeHash(prevHash + canonicalJson(eventData));
  
  await storage.createAuditEvent({
    prevHash,
    eventHash,
    eventType,
    data: eventData,
    createdAt: new Date(),
  });
}

async function getPluginContext(agentId: number, requestId: number): Promise<PluginContext> {
  const roots = await storage.getSetting("allowed_roots");
  const shell = await storage.getSetting("shell_allowlist");
  const safeMode = await storage.getSetting("safe_mode");
  
  return {
    allowedRoots: Array.isArray(roots) ? roots : ["./sandbox"],
    shellAllowList: Array.isArray(shell) ? shell : [],
    safeModeEnabled: safeMode === true || safeMode === "true",
    agentId,
    requestId,
  };
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

async function authenticateAgent(req: Request): Promise<number | null> {
  const apiKey = req.headers["x-agent-key"] as string;
  if (!apiKey) return null;

  const allAgents = await storage.getAgents();
  for (const agent of allAgents) {
    if (validateApiKey(apiKey, agent.apiKeyHash)) {
      await storage.updateAgentLastSeen(agent.id);
      return agent.id;
    }
  }
  return null;
}

async function initializeDefaults(): Promise<void> {
  const existingAdmin = await storage.getUserByUsername("admin");
  if (!existingAdmin) {
    const hashedPassword = await hashPassword("admin123");
    await storage.createUser({ username: "admin", password: hashedPassword });
    console.log("[init] Created default admin user (admin/admin123)");
  }

  const allowedRoots = await storage.getSetting("allowed_roots");
  if (!allowedRoots) {
    const sandboxPath = path.resolve("./sandbox");
    await storage.updateSetting("allowed_roots", [sandboxPath]);
    try {
      await fs.mkdir(sandboxPath, { recursive: true });
    } catch {}
    console.log("[init] Created default allowed_roots setting");
  }

  const shellAllowlist = await storage.getSetting("shell_allowlist");
  if (!shellAllowlist) {
    await storage.updateSetting("shell_allowlist", ["^ls", "^cat", "^echo", "^pwd"]);
    console.log("[init] Created default shell_allowlist setting");
  }

  const safeMode = await storage.getSetting("safe_mode");
  if (safeMode === undefined) {
    await storage.updateSetting("safe_mode", false);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await loadBuiltinPlugins();
  await initializeDefaults();

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "switchboard-secret-key",
      resave: false,
      saveUninitialized: false,
      store: new MemStore({ checkPeriod: 86400000 }),
      cookie: { maxAge: 86400000, httpOnly: true },
    })
  );

  app.post(api.admin.login.path, async (req, res) => {
    try {
      const { username, password } = api.admin.login.input.parse(req.body);
      const user = await storage.getUserByUsername(username);
      
      if (!user || !(await comparePassword(password, user.password))) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.userId = user.id;
      req.session.username = user.username;

      await createAuditEvent("ADMIN_LOGIN", { userId: user.id, username: user.username });

      res.json({ message: "Login successful", user: { id: user.id, username: user.username } });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get(api.admin.me.path, requireAdmin, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    res.json({ id: user.id, username: user.username });
  });

  app.post(api.admin.logout.path, (req, res) => {
    req.session.destroy(() => {});
    res.json({ message: "Logged out" });
  });

  app.get(api.agents.list.path, requireAdmin, async (req, res) => {
    const agents = await storage.getAgents();
    res.json(agents);
  });

  app.post(api.agents.create.path, requireAdmin, async (req, res) => {
    try {
      const { name } = api.agents.create.input.parse(req.body);
      
      const existing = await storage.getAgentByName(name);
      if (existing) {
        return res.status(409).json({ message: "Agent with this name already exists" });
      }

      const apiKey = generateApiKey();
      const apiKeyHash = hashApiKey(apiKey);

      const agent = await storage.createAgent({ name, apiKeyHash });

      await createAuditEvent("AGENT_CREATED", { agentId: agent.id, name });

      res.status(201).json({ agent, apiKey });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post(api.agents.rotateKey.path, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const agent = await storage.getAgent(id);
    
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    await storage.updateAgentKey(id, apiKeyHash);

    await createAuditEvent("AGENT_KEY_ROTATED", { agentId: id });

    res.json({ apiKey });
  });

  app.patch(api.agents.toggleCapability.path, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const type = req.params.type as string;
      const { enabled, config } = api.agents.toggleCapability.input.parse(req.body);

      const capability = await storage.upsertCapability(id, type, enabled, config);

      await createAuditEvent("CAPABILITY_TOGGLED", { agentId: id, type, enabled });

      res.json(capability);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get(api.settings.list.path, requireAdmin, async (req, res) => {
    const allSettings = await storage.getSettings();
    res.json(allSettings);
  });

  app.put(api.settings.update.path, requireAdmin, async (req, res) => {
    try {
      const key = req.params.key as string;
      const { value } = api.settings.update.input.parse(req.body);
      await storage.updateSetting(key, value);

      await createAuditEvent("SETTING_UPDATED", { key });

      res.json({ key, value });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get(api.safeMode.get.path, requireAdmin, async (req, res) => {
    const safeMode = await storage.getSetting("safe_mode");
    res.json({ enabled: safeMode === true || safeMode === "true" });
  });

  app.post(api.safeMode.set.path, requireAdmin, async (req, res) => {
    try {
      const { enabled } = api.safeMode.set.input.parse(req.body);
      await storage.updateSetting("safe_mode", enabled);

      await createAuditEvent(enabled ? "SAFE_MODE_ENABLED" : "SAFE_MODE_DISABLED", {
        userId: req.session.userId,
      });

      res.json({ message: `Safe Mode ${enabled ? "enabled" : "disabled"}`, enabled });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post(api.safeMode.lockdown.path, requireAdmin, async (req, res) => {
    await storage.updateSetting("safe_mode", true);

    const agents = await storage.getAgents();
    for (const agent of agents) {
      const newKey = generateApiKey();
      await storage.updateAgentKey(agent.id, hashApiKey(newKey));
    }

    await createAuditEvent("LOCKDOWN_TRIGGERED", {
      userId: req.session.userId,
      agentsAffected: agents.length,
    });

    res.json({ message: "Emergency lockdown activated. All agent API keys have been rotated." });
  });

  app.get(api.plugins.list.path, requireAdmin, async (req, res) => {
    const plugins = pluginRegistry.getAllPlugins().map(p => ({
      id: p.id,
      displayName: p.displayName,
      version: p.version,
      capabilityType: p.capabilityType,
      uiHints: p.uiHints,
    }));
    res.json(plugins);
  });

  app.get(api.requests.list.path, requireAdmin, async (req, res) => {
    const status = req.query.status as string | undefined;
    const requests = await storage.getRequests(status);
    
    const enriched = await Promise.all(requests.map(async r => {
      const agent = await storage.getAgent(r.agentId);
      return { ...r, agentName: agent?.name || "Unknown" };
    }));

    res.json(enriched);
  });

  app.get(api.requests.get.path, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const request = await storage.getRequest(id);
    
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    const plans = await storage.getPlansByRequestId(id);
    const agent = await storage.getAgent(request.agentId);

    res.json({ ...request, plans, agentName: agent?.name || "Unknown" });
  });

  app.post(api.plans.approve.path, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { decision } = api.plans.approve.input.parse(req.body);
      
      const plan = await storage.getPlan(id);
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }

      const request = await storage.getRequest(plan.requestId);

      await storage.createApproval({
        planId: id,
        approvedBy: req.session.userId!,
        decision,
        createdAt: new Date(),
      });

      const newStatus = decision === "approved" ? "approved" : "rejected";
      await storage.updateRequestStatus(plan.requestId, newStatus);

      if (request) {
        const metricField = decision === "approved" ? 'requestsApproved' : 'requestsRejected';
        await storage.incrementMetric(request.agentId, metricField, plan.riskScore || undefined);
      }

      await createAuditEvent("PLAN_" + decision.toUpperCase(), {
        planId: id,
        approvedBy: req.session.userId,
      });

      res.json({ message: `Plan ${decision}` });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get(api.audit.list.path, requireAdmin, async (req, res) => {
    const events = await storage.getAuditEvents();
    res.json(events);
  });

  // === METRICS ROUTES ===
  app.get(api.metrics.list.path, requireAdmin, async (req, res) => {
    const days = parseInt(req.query.days as string) || 30;
    const metrics = await storage.getAllAgentMetrics(days);
    res.json(metrics);
  });

  app.get(api.metrics.byAgent.path, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const days = parseInt(req.query.days as string) || 30;
    const metrics = await storage.getAgentMetrics(id, days);
    res.json(metrics);
  });

  app.get(api.metrics.summary.path, requireAdmin, async (req, res) => {
    const allAgents = await storage.getAgents();
    const metrics = await storage.getAllAgentMetrics(30);
    
    let totalRequests = 0, totalApproved = 0, totalExecuted = 0, totalFailed = 0;
    let riskScoreSum = 0, riskScoreCount = 0;
    
    const byAgentMap = new Map<number, { total: number; approved: number; executed: number; failed: number; riskSum: number; riskCount: number }>();
    
    for (const m of metrics) {
      totalRequests += m.requestsTotal || 0;
      totalApproved += m.requestsApproved || 0;
      totalExecuted += m.requestsExecuted || 0;
      totalFailed += m.requestsFailed || 0;
      if (m.avgRiskScore && m.requestsTotal) {
        riskScoreSum += m.avgRiskScore * m.requestsTotal;
        riskScoreCount += m.requestsTotal;
      }
      
      const existing = byAgentMap.get(m.agentId) || { total: 0, approved: 0, executed: 0, failed: 0, riskSum: 0, riskCount: 0 };
      existing.total += m.requestsTotal || 0;
      existing.approved += m.requestsApproved || 0;
      existing.executed += m.requestsExecuted || 0;
      existing.failed += m.requestsFailed || 0;
      if (m.avgRiskScore && m.requestsTotal) {
        existing.riskSum += m.avgRiskScore * m.requestsTotal;
        existing.riskCount += m.requestsTotal;
      }
      byAgentMap.set(m.agentId, existing);
    }
    
    const byAgent = allAgents.map(agent => {
      const data = byAgentMap.get(agent.id) || { total: 0, approved: 0, executed: 0, failed: 0, riskSum: 0, riskCount: 0 };
      return {
        agentId: agent.id,
        agentName: agent.name,
        totalRequests: data.total,
        approvalRate: data.total > 0 ? Math.round((data.approved / data.total) * 100) : 0,
        successRate: data.executed + data.failed > 0 ? Math.round((data.executed / (data.executed + data.failed)) * 100) : 0,
        avgRiskScore: data.riskCount > 0 ? Math.round(data.riskSum / data.riskCount) : 0,
      };
    });
    
    res.json({
      totalRequests,
      approvalRate: totalRequests > 0 ? Math.round((totalApproved / totalRequests) * 100) : 0,
      executionSuccessRate: totalExecuted + totalFailed > 0 ? Math.round((totalExecuted / (totalExecuted + totalFailed)) * 100) : 0,
      avgRiskScore: riskScoreCount > 0 ? Math.round(riskScoreSum / riskScoreCount) : 0,
      byAgent,
    });
  });

  // === RATE LIMIT ROUTES ===
  app.get(api.rateLimits.get.path, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const limit = await storage.getRateLimit(id);
    
    if (!limit) {
      return res.json({
        agentId: id,
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000,
        enabled: false,
      });
    }
    
    res.json(limit);
  });

  app.put(api.rateLimits.set.path, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const updates = api.rateLimits.set.input.parse(req.body);
      
      const limit = await storage.upsertRateLimit(id, updates);
      
      await createAuditEvent("RATE_LIMIT_UPDATED", { agentId: id, ...updates });
      
      res.json(limit);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // === MCP (Model Context Protocol) ROUTES ===
  app.post(api.mcp.listTools.path, async (req, res) => {
    const agentId = await authenticateAgent(req);
    if (!agentId) {
      return res.status(401).json({ message: "Invalid or missing API key" });
    }

    const capabilities = await storage.getCapabilities(agentId);
    const enabledTypes = capabilities.filter(c => c.enabled).map(c => c.type);
    
    const tools = pluginRegistry.getAllPlugins()
      .filter(p => enabledTypes.includes(p.capabilityType))
      .map(p => ({
        name: `switchboard.${p.capabilityType}.${p.id.replace(/:/g, '-')}`,
        description: `${p.displayName} - Plugin capability for ${p.capabilityType}`,
        inputSchema: {
          type: 'object' as const,
          properties: {
            operation: { type: 'string', description: 'The operation to perform' },
            params: { type: 'object', description: 'Operation parameters' },
            reasoning: { 
              type: 'object',
              description: 'Optional reasoning trace explaining why this action is needed',
              properties: {
                goal: { type: 'string' },
                steps: { type: 'array', items: { type: 'object' } },
                confidence: { type: 'number' },
              },
            },
          },
          required: ['operation', 'params'],
        },
      }));
    
    res.json({ tools });
  });

  app.post(api.mcp.callTool.path, async (req, res) => {
    const agentId = await authenticateAgent(req);
    if (!agentId) {
      return res.status(401).json({ 
        content: [{ type: 'text', text: 'Unauthorized: Invalid or missing API key' }],
        isError: true,
      });
    }

    try {
      const { name, arguments: args } = api.mcp.callTool.input.parse(req.body);
      
      const rateLimitCheck = await storage.checkRateLimit(agentId);
      if (!rateLimitCheck.allowed) {
        return res.status(429).json({
          content: [{ type: 'text', text: `Rate limit exceeded. Remaining: minute=${rateLimitCheck.remaining.minute}, hour=${rateLimitCheck.remaining.hour}, day=${rateLimitCheck.remaining.day}` }],
          isError: true,
        });
      }
      
      const nameParts = name.split('.');
      const capType = nameParts.length >= 2 ? nameParts[1] : name;
      
      const capabilities = await storage.getCapabilities(agentId);
      const cap = capabilities.find(c => c.type === capType);
      if (!cap || !cap.enabled) {
        return res.json({
          content: [{ type: 'text', text: `Capability '${capType}' is not enabled for this agent` }],
          isError: true,
        });
      }

      const request = await storage.createRequest({
        agentId,
        status: "pending",
        summary: `MCP:${name}:${args.operation}`,
        input: { type: capType, operation: args.operation, params: args.params },
        reasoningTrace: args.reasoning || null,
        createdAt: new Date(),
      });

      await storage.incrementMetric(agentId, 'requestsTotal');
      await storage.incrementRateLimitUsage(agentId);

      await createAuditEvent("MCP_REQUEST_CREATED", { 
        requestId: request.id, 
        agentId, 
        tool: name,
        hasReasoning: !!args.reasoning,
      });

      res.json({
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ 
            requestId: request.id, 
            status: 'pending',
            message: 'Action request created. Use dry-run endpoint to generate plan, then await approval before execution.',
          }),
        }],
      });
    } catch (e: any) {
      res.json({
        content: [{ type: 'text', text: `Error: ${e.message}` }],
        isError: true,
      });
    }
  });

  app.post(api.agentApi.createRequest.path, async (req, res) => {
    const agentId = await authenticateAgent(req);
    if (!agentId) {
      return res.status(401).json({ message: "Invalid or missing API key" });
    }

    try {
      const input = api.agentApi.createRequest.input.parse(req.body);
      
      const rateLimitCheck = await storage.checkRateLimit(agentId);
      if (!rateLimitCheck.allowed) {
        return res.status(429).json({ 
          message: `Rate limit exceeded. Remaining: minute=${rateLimitCheck.remaining.minute}, hour=${rateLimitCheck.remaining.hour}, day=${rateLimitCheck.remaining.day}` 
        });
      }
      
      const capabilities = await storage.getCapabilities(agentId);
      const cap = capabilities.find(c => c.type === input.type);
      if (!cap || !cap.enabled) {
        return res.status(403).json({ message: `Capability '${input.type}' is not enabled for this agent` });
      }

      const request = await storage.createRequest({
        agentId,
        status: "pending",
        summary: `${input.type}:${input.operation}`,
        input: input,
        reasoningTrace: input.reasoning || null,
        createdAt: new Date(),
      });

      await storage.incrementMetric(agentId, 'requestsTotal');
      await storage.incrementRateLimitUsage(agentId);

      await createAuditEvent("REQUEST_CREATED", { 
        requestId: request.id, 
        agentId, 
        type: input.type,
        hasReasoning: !!input.reasoning,
      });

      res.status(201).json({ requestId: request.id, status: "pending" });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post(api.agentApi.dryRun.path, async (req, res) => {
    const agentId = await authenticateAgent(req);
    if (!agentId) {
      return res.status(401).json({ message: "Invalid or missing API key" });
    }

    const requestId = Number(req.params.id);
    const request = await storage.getRequest(requestId);

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.agentId !== agentId) {
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      const input = request.input as any;
      const plugin = pluginRegistry.getPlugin(input.type);
      
      if (!plugin) {
        return res.status(400).json({ message: `No plugin for capability type: ${input.type}` });
      }

      const validation = plugin.validateRequest(input);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.errors.join(", ") });
      }

      const ctx = await getPluginContext(agentId, requestId);
      const dryRunResult = await plugin.dryRun(ctx, validation.normalizedRequest);

      const riskSummary = calculatePlanRiskScore(dryRunResult.steps);
      
      const planData = {
        requestId,
        steps: dryRunResult.steps,
        planHash: computeHash(canonicalJson(dryRunResult.steps)),
        riskScore: riskSummary.totalRiskScore,
        createdAt: new Date(),
      };

      const plan = await storage.createPlan(planData);
      await storage.updateRequestStatus(requestId, "planned");

      await createAuditEvent("DRY_RUN_GENERATED", {
        requestId,
        planId: plan.id,
        riskScore: riskSummary.totalRiskScore,
      });

      res.json({
        planId: plan.id,
        steps: dryRunResult.steps,
        riskScore: riskSummary.totalRiskScore,
        riskSummary,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post(api.agentApi.execute.path, async (req, res) => {
    const agentId = await authenticateAgent(req);
    if (!agentId) {
      return res.status(401).json({ message: "Invalid or missing API key" });
    }

    const planId = Number(req.params.id);
    const plan = await storage.getPlan(planId);

    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    const request = await storage.getRequest(plan.requestId);
    if (!request || request.agentId !== agentId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (request.status !== "approved") {
      return res.status(400).json({ message: "Plan must be approved before execution" });
    }

    const currentHash = computeHash(canonicalJson(plan.steps));
    if (currentHash !== plan.planHash) {
      return res.status(400).json({ message: "Plan hash mismatch - plan may have been tampered" });
    }

    try {
      const input = request.input as any;
      const plugin = pluginRegistry.getPlugin(input.type);
      
      if (!plugin) {
        return res.status(400).json({ message: `No plugin for capability type: ${input.type}` });
      }

      const ctx = await getPluginContext(agentId, request.id);
      const results = await plugin.execute(ctx, plan.steps);

      const hasFailure = results.some(r => r.status === "failed");

      const receipt = await storage.createExecutionReceipt({
        planId,
        status: hasFailure ? "failure" : "success",
        logs: results,
        executedAt: new Date(),
      });

      await storage.updateRequestStatus(request.id, hasFailure ? "failed" : "executed");
      
      const metricField = hasFailure ? 'requestsFailed' : 'requestsExecuted';
      await storage.incrementMetric(agentId, metricField);

      await createAuditEvent("PLAN_EXECUTED", {
        planId,
        receiptId: receipt.id,
        status: hasFailure ? "failure" : "success",
      });

      res.json({
        receiptId: receipt.id,
        status: hasFailure ? "failure" : "success",
        logs: results,
      });
    } catch (e: any) {
      const receipt = await storage.createExecutionReceipt({
        planId,
        status: "failure",
        logs: [{ error: e.message }],
        executedAt: new Date(),
      });

      await storage.updateRequestStatus(request.id, "failed");
      await storage.incrementMetric(agentId, 'requestsFailed');

      res.status(500).json({
        receiptId: receipt.id,
        status: "failure",
        logs: [{ error: e.message }],
      });
    }
  });

  return httpServer;
}
