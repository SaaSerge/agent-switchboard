import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { 
  LoginSchema, 
  CreateAgentSchema, 
  UpdateCapabilitySchema, 
  UpdateSettingSchema,
  ApprovalDecisionSchema,
  SafeModeSchema,
  AgentActionSchema,
  API_ROUTES 
} from "@agent-switchboard/shared";
import { hashPassword, comparePassword, generateApiKey, hashApiKey, validateApiKey } from "./auth";
import { pluginRegistry } from "./plugins/registry";
import { calculatePlanRiskScore, calculateStepRiskScore } from "./plugins/risk-scoring";
import type { PluginContext } from "./plugins/types";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    username?: string;
  }
}

function canonicalJson(obj: unknown): string {
  if (obj === null || obj === undefined) return JSON.stringify(obj);
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalJson).join(",") + "]";
  }
  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const parts = sortedKeys.map(k => `${JSON.stringify(k)}:${canonicalJson((obj as Record<string, unknown>)[k])}`);
  return "{" + parts.join(",") + "}";
}

function computeHash(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function createAuditEvent(eventType: string, data: unknown): Promise<void> {
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
    allowedRoots: Array.isArray(roots) ? roots as string[] : ["./sandbox"],
    shellAllowList: Array.isArray(shell) ? shell as string[] : [],
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
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  
  const apiKey = authHeader.slice(7);
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
    } catch { /* ignore */ }
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

export function registerRoutes(app: Express): void {
  initializeDefaults();

  app.post(API_ROUTES.admin.login, async (req, res) => {
    try {
      const { username, password } = LoginSchema.parse(req.body);
      const user = await storage.getUserByUsername(username);
      
      if (!user || !(await comparePassword(password, user.password))) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.userId = user.id;
      req.session.username = user.username;
      await createAuditEvent("ADMIN_LOGIN", { userId: user.id, username: user.username });
      res.json({ message: "Login successful", user: { id: user.id, username: user.username } });
    } catch (e) {
      res.status(400).json({ message: (e as Error).message });
    }
  });

  app.get(API_ROUTES.admin.me, requireAdmin, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    res.json({ id: user.id, username: user.username });
  });

  app.post(API_ROUTES.admin.logout, (req, res) => {
    req.session.destroy(() => {});
    res.json({ message: "Logged out" });
  });

  app.get(API_ROUTES.admin.agents, requireAdmin, async (_req, res) => {
    const agents = await storage.getAgents();
    res.json(agents);
  });

  app.post(API_ROUTES.admin.agents, requireAdmin, async (req, res) => {
    try {
      const { name } = CreateAgentSchema.parse(req.body);
      const existing = await storage.getAgentByName(name);
      if (existing) {
        return res.status(409).json({ message: "Agent with this name already exists" });
      }

      const apiKey = generateApiKey();
      const apiKeyHash = hashApiKey(apiKey);
      const agent = await storage.createAgent({ name, apiKeyHash });
      await createAuditEvent("AGENT_CREATED", { agentId: agent.id, name });
      res.status(201).json({ agent, apiKey });
    } catch (e) {
      res.status(400).json({ message: (e as Error).message });
    }
  });

  app.post("/api/admin/agents/:id/rotate-key", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const agent = await storage.getAgent(id);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    await storage.updateAgentKey(id, apiKeyHash);
    await createAuditEvent("AGENT_KEY_ROTATED", { agentId: id });
    res.json({ apiKey });
  });

  app.patch("/api/admin/agents/:id/capabilities/:type", requireAdmin, async (req, res) => {
    const agentId = Number(req.params.id);
    const type = req.params.type;
    const { enabled, config } = UpdateCapabilitySchema.parse(req.body);
    
    const capability = await storage.upsertCapability(agentId, type, enabled, config as Record<string, unknown>);
    await createAuditEvent("CAPABILITY_UPDATED", { agentId, type, enabled });
    res.json(capability);
  });

  app.get(API_ROUTES.admin.settings, requireAdmin, async (_req, res) => {
    const settings = await storage.getSettings();
    res.json(settings);
  });

  app.put("/api/admin/settings/:key", requireAdmin, async (req, res) => {
    const { value } = UpdateSettingSchema.parse(req.body);
    await storage.updateSetting(req.params.key, value);
    res.json({ key: req.params.key, value });
  });

  app.get(API_ROUTES.admin.requests, requireAdmin, async (req, res) => {
    const status = req.query.status as string | undefined;
    const requests = await storage.getRequests(status);
    const agents = await storage.getAgents();
    const agentMap = new Map(agents.map(a => [a.id, a.name]));
    
    const result = requests.map(r => ({
      ...r,
      agentName: agentMap.get(r.agentId) || `Agent ${r.agentId}`,
    }));
    res.json(result);
  });

  app.get("/api/admin/action-requests/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const request = await storage.getRequest(id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    const plans = await storage.getPlansByRequestId(id);
    const agents = await storage.getAgents();
    const agent = agents.find(a => a.id === request.agentId);

    res.json({ ...request, agentName: agent?.name, plans });
  });

  app.post("/api/admin/plans/:id/approve", requireAdmin, async (req, res) => {
    const planId = Number(req.params.id);
    const { decision } = ApprovalDecisionSchema.parse(req.body);
    
    const plan = await storage.getPlan(planId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    await storage.createApproval({
      planId,
      approvedBy: req.session.userId!,
      decision,
      createdAt: new Date(),
    });

    const newStatus = decision === "approved" ? "approved" : "rejected";
    await storage.updateRequestStatus(plan.requestId, newStatus);
    await createAuditEvent("PLAN_DECISION", { planId, decision, approvedBy: req.session.userId });

    res.json({ message: `Plan ${decision}` });
  });

  app.get(API_ROUTES.admin.safeMode, requireAdmin, async (_req, res) => {
    const enabled = await storage.getSetting("safe_mode");
    res.json({ enabled: enabled === true });
  });

  app.post(API_ROUTES.admin.safeMode, requireAdmin, async (req, res) => {
    const { enabled } = SafeModeSchema.parse(req.body);
    await storage.updateSetting("safe_mode", enabled);
    await createAuditEvent("SAFE_MODE_CHANGED", { enabled });
    res.json({ message: `Safe mode ${enabled ? "enabled" : "disabled"}`, enabled });
  });

  app.post(API_ROUTES.admin.lockdown, requireAdmin, async (req, res) => {
    await storage.updateSetting("safe_mode", true);
    
    const agents = await storage.getAgents();
    for (const agent of agents) {
      const newKey = generateApiKey();
      await storage.updateAgentKey(agent.id, hashApiKey(newKey));
    }

    await createAuditEvent("EMERGENCY_LOCKDOWN", { 
      triggeredBy: req.session.userId,
      agentsAffected: agents.length,
      severity: "critical"
    });

    res.json({ message: "Emergency lockdown activated. All agent keys rotated." });
  });

  app.get(API_ROUTES.admin.plugins, requireAdmin, async (_req, res) => {
    const plugins = pluginRegistry.getAllPlugins().map(p => ({
      id: p.id,
      displayName: p.displayName,
      version: p.version,
      capabilityType: p.capabilityType,
      uiHints: p.uiHints,
    }));
    res.json(plugins);
  });

  app.get(API_ROUTES.admin.audit, requireAdmin, async (_req, res) => {
    const events = await storage.getAuditEvents();
    res.json(events);
  });

  app.post(API_ROUTES.agent.createRequest, async (req, res) => {
    const agentId = await authenticateAgent(req);
    if (!agentId) return res.status(401).json({ message: "Invalid API key" });

    try {
      const action = AgentActionSchema.parse(req.body);
      const plugin = pluginRegistry.getPlugin(action.type);
      
      if (!plugin) {
        return res.status(400).json({ message: `Unknown capability type: ${action.type}` });
      }

      const caps = await storage.getCapabilities(agentId);
      const cap = caps.find(c => c.type === action.type);
      if (!cap?.enabled) {
        return res.status(403).json({ message: `Capability ${action.type} not enabled for this agent` });
      }

      const validation = plugin.validateRequest(action.params);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.errors.join(", ") });
      }

      const request = await storage.createRequest({
        agentId,
        status: "pending",
        summary: `${action.type}:${action.operation}`,
        input: action,
        createdAt: new Date(),
      });

      await createAuditEvent("REQUEST_CREATED", { requestId: request.id, agentId, type: action.type });
      res.status(201).json({ requestId: request.id, status: "pending" });
    } catch (e) {
      res.status(400).json({ message: (e as Error).message });
    }
  });

  app.post("/api/agent/action-requests/:id/dry-run", async (req, res) => {
    const agentId = await authenticateAgent(req);
    if (!agentId) return res.status(401).json({ message: "Invalid API key" });

    const requestId = Number(req.params.id);
    const request = await storage.getRequest(requestId);
    
    if (!request || request.agentId !== agentId) {
      return res.status(404).json({ message: "Request not found" });
    }

    const action = request.input as { type: string; operation: string; params: Record<string, unknown> };
    const plugin = pluginRegistry.getPlugin(action.type);
    if (!plugin) {
      return res.status(400).json({ message: `Unknown capability type: ${action.type}` });
    }

    const ctx = await getPluginContext(agentId, requestId);
    const validation = plugin.validateRequest(action.params);
    const dryRunResult = await plugin.dryRun(ctx, validation.normalizedRequest);

    for (const step of dryRunResult.steps) {
      const { score, flags } = calculateStepRiskScore(step);
      step.riskScore = score;
      step.riskFlags = flags;
    }

    const riskSummary = calculatePlanRiskScore(dryRunResult.steps);
    const planHash = computeHash(canonicalJson(dryRunResult.steps));

    const plan = await storage.createPlan({
      requestId,
      planHash,
      steps: dryRunResult.steps,
      riskScore: riskSummary.totalRiskScore,
      createdAt: new Date(),
    });

    await storage.updateRequestStatus(requestId, "planned");
    await createAuditEvent("DRY_RUN_COMPLETE", { requestId, planId: plan.id, riskScore: riskSummary.totalRiskScore });

    res.json({
      planId: plan.id,
      steps: dryRunResult.steps,
      riskScore: riskSummary.totalRiskScore,
      riskSummary,
    });
  });

  app.post("/api/agent/plans/:id/execute", async (req, res) => {
    const agentId = await authenticateAgent(req);
    if (!agentId) return res.status(401).json({ message: "Invalid API key" });

    const planId = Number(req.params.id);
    const plan = await storage.getPlan(planId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const request = await storage.getRequest(plan.requestId);
    if (!request || request.agentId !== agentId) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (request.status !== "approved") {
      return res.status(400).json({ message: `Plan not approved. Current status: ${request.status}` });
    }

    const action = request.input as { type: string };
    const plugin = pluginRegistry.getPlugin(action.type);
    if (!plugin) {
      return res.status(400).json({ message: `Unknown capability type: ${action.type}` });
    }

    const currentPlanHash = computeHash(canonicalJson(plan.steps));
    if (currentPlanHash !== plan.planHash) {
      return res.status(400).json({ message: "Plan integrity check failed" });
    }

    const ctx = await getPluginContext(agentId, request.id);
    const results = await plugin.execute(ctx, plan.steps);

    const allSuccess = results.every(r => r.status === "success");
    const receipt = await storage.createExecutionReceipt({
      planId,
      status: allSuccess ? "success" : "partial_failure",
      logs: results,
      executedAt: new Date(),
    });

    await storage.updateRequestStatus(request.id, "executed");
    await createAuditEvent("PLAN_EXECUTED", { planId, receiptId: receipt.id, status: receipt.status });

    res.json({ receiptId: receipt.id, status: receipt.status, logs: results });
  });
}
