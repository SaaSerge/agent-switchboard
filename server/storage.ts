import { db } from "./db";
import {
  users, agents, agentCapabilities, settings, actionRequests, plans, approvals, executionReceipts, auditEvents,
  agentMetrics, rateLimits, rateLimitUsage,
  type User, type Agent, type AgentCapability, type ActionRequest, type Plan, type ExecutionReceipt, type AuditEvent,
  type InsertUser, type CreateAgentRequest, type AgentMetric, type RateLimit, type RateLimitUsage
} from "@shared/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";

export interface IStorage {
  // User/Admin
  getUserByUsername(username: string): Promise<User | undefined>;
  getUser(id: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Agents
  getAgents(): Promise<(Agent & { capabilities: AgentCapability[] })[]>;
  getAgent(id: number): Promise<Agent | undefined>;
  getAgentByName(name: string): Promise<Agent | undefined>;
  createAgent(agent: CreateAgentRequest & { apiKeyHash: string }): Promise<Agent>;
  updateAgentLastSeen(id: number): Promise<void>;
  updateAgentKey(id: number, hash: string): Promise<void>;

  // Capabilities
  getCapabilities(agentId: number): Promise<AgentCapability[]>;
  upsertCapability(agentId: number, type: string, enabled: boolean, config?: Record<string, any>): Promise<AgentCapability>;

  // Settings
  getSettings(): Promise<any[]>;
  getSetting(key: string): Promise<any>;
  updateSetting(key: string, value: any): Promise<void>;

  // Requests & Plans
  createRequest(request: Partial<ActionRequest>): Promise<ActionRequest>;
  getRequests(status?: string): Promise<ActionRequest[]>;
  getRequest(id: number): Promise<ActionRequest | undefined>;
  updateRequestStatus(id: number, status: string): Promise<void>;
  
  createPlan(plan: Partial<Plan>): Promise<Plan>;
  getPlansByRequestId(requestId: number): Promise<Plan[]>;
  getPlan(id: number): Promise<Plan | undefined>;

  createApproval(approval: Partial<typeof approvals.$inferSelect>): Promise<void>;
  
  createExecutionReceipt(receipt: Partial<ExecutionReceipt>): Promise<ExecutionReceipt>;
  
  // Audit
  createAuditEvent(event: Partial<AuditEvent>): Promise<void>;
  getAuditEvents(): Promise<AuditEvent[]>;
  getLastAuditEvent(): Promise<AuditEvent | undefined>;

  // Agent Metrics
  getAgentMetrics(agentId: number, days?: number): Promise<AgentMetric[]>;
  getAllAgentMetrics(days?: number): Promise<AgentMetric[]>;
  incrementMetric(agentId: number, field: 'requestsTotal' | 'requestsApproved' | 'requestsRejected' | 'requestsExecuted' | 'requestsFailed', riskScore?: number): Promise<void>;

  // Rate Limits
  getRateLimit(agentId: number): Promise<RateLimit | undefined>;
  upsertRateLimit(agentId: number, limits: Partial<RateLimit>): Promise<RateLimit>;
  checkRateLimit(agentId: number): Promise<{ allowed: boolean; remaining: { minute: number; hour: number; day: number } }>;
  incrementRateLimitUsage(agentId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getAgents(): Promise<(Agent & { capabilities: AgentCapability[] })[]> {
    const allAgents = await db.select().from(agents);
    const results = [];
    for (const agent of allAgents) {
      const caps = await db.select().from(agentCapabilities).where(eq(agentCapabilities.agentId, agent.id));
      results.push({ ...agent, capabilities: caps });
    }
    return results;
  }

  async getAgent(id: number): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent;
  }

  async getAgentByName(name: string): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.name, name));
    return agent;
  }

  async createAgent(data: CreateAgentRequest & { apiKeyHash: string }): Promise<Agent> {
    const [agent] = await db.insert(agents).values({
      name: data.name,
      apiKeyHash: data.apiKeyHash,
      createdAt: new Date(),
    }).returning();
    return agent;
  }

  async updateAgentLastSeen(id: number): Promise<void> {
    await db.update(agents).set({ lastSeenAt: new Date() }).where(eq(agents.id, id));
  }

  async updateAgentKey(id: number, hash: string): Promise<void> {
    await db.update(agents).set({ apiKeyHash: hash }).where(eq(agents.id, id));
  }

  async getCapabilities(agentId: number): Promise<AgentCapability[]> {
    return db.select().from(agentCapabilities).where(eq(agentCapabilities.agentId, agentId));
  }

  async upsertCapability(agentId: number, type: string, enabled: boolean, config?: Record<string, any>): Promise<AgentCapability> {
    const existing = await db.select().from(agentCapabilities)
      .where(and(eq(agentCapabilities.agentId, agentId), eq(agentCapabilities.type, type)));
    
    if (existing.length > 0) {
      const [updated] = await db.update(agentCapabilities)
        .set({ enabled, config: config || existing[0].config })
        .where(eq(agentCapabilities.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(agentCapabilities)
        .values({ agentId, type, enabled, config: config || {} })
        .returning();
      return created;
    }
  }

  async getSettings(): Promise<any[]> {
    return db.select().from(settings);
  }

  async getSetting(key: string): Promise<any> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting?.value;
  }

  async updateSetting(key: string, value: any): Promise<void> {
    // Upsert
    const existing = await this.getSetting(key);
    if (existing !== undefined) {
      await db.update(settings).set({ value }).where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value });
    }
  }

  async createRequest(request: Partial<ActionRequest>): Promise<ActionRequest> {
    const [req] = await db.insert(actionRequests).values(request as any).returning();
    return req;
  }

  async getRequests(status?: string): Promise<ActionRequest[]> {
    if (status) {
      return db.select().from(actionRequests).where(eq(actionRequests.status, status)).orderBy(desc(actionRequests.createdAt));
    }
    return db.select().from(actionRequests).orderBy(desc(actionRequests.createdAt));
  }

  async getRequest(id: number): Promise<ActionRequest | undefined> {
    const [req] = await db.select().from(actionRequests).where(eq(actionRequests.id, id));
    return req;
  }

  async updateRequestStatus(id: number, status: string): Promise<void> {
    await db.update(actionRequests).set({ status }).where(eq(actionRequests.id, id));
  }

  async createPlan(plan: Partial<Plan>): Promise<Plan> {
    const [p] = await db.insert(plans).values(plan as any).returning();
    return p;
  }

  async getPlansByRequestId(requestId: number): Promise<Plan[]> {
    return db.select().from(plans).where(eq(plans.requestId, requestId));
  }
  
  async getPlan(id: number): Promise<Plan | undefined> {
    const [p] = await db.select().from(plans).where(eq(plans.id, id));
    return p;
  }

  async createApproval(approval: Partial<typeof approvals.$inferSelect>): Promise<void> {
    await db.insert(approvals).values(approval as any);
  }

  async createExecutionReceipt(receipt: Partial<ExecutionReceipt>): Promise<ExecutionReceipt> {
    const [r] = await db.insert(executionReceipts).values(receipt as any).returning();
    return r;
  }

  async createAuditEvent(event: Partial<AuditEvent>): Promise<void> {
    await db.insert(auditEvents).values(event as any);
  }

  async getAuditEvents(): Promise<AuditEvent[]> {
    return db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt));
  }

  async getLastAuditEvent(): Promise<AuditEvent | undefined> {
    const [last] = await db.select().from(auditEvents).orderBy(desc(auditEvents.id)).limit(1);
    return last;
  }

  // Agent Metrics
  async getAgentMetrics(agentId: number, days: number = 30): Promise<AgentMetric[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    
    return db.select().from(agentMetrics)
      .where(and(eq(agentMetrics.agentId, agentId), gte(agentMetrics.date, cutoffStr)))
      .orderBy(desc(agentMetrics.date));
  }

  async getAllAgentMetrics(days: number = 30): Promise<AgentMetric[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    
    return db.select().from(agentMetrics)
      .where(gte(agentMetrics.date, cutoffStr))
      .orderBy(desc(agentMetrics.date));
  }

  async incrementMetric(
    agentId: number, 
    field: 'requestsTotal' | 'requestsApproved' | 'requestsRejected' | 'requestsExecuted' | 'requestsFailed',
    riskScore?: number
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    const [existing] = await db.select().from(agentMetrics)
      .where(and(eq(agentMetrics.agentId, agentId), eq(agentMetrics.date, today)));
    
    if (existing) {
      const updates: any = {};
      updates[field] = (existing as any)[field] + 1;
      
      if (riskScore !== undefined && field === 'requestsTotal') {
        const total = existing.requestsTotal || 0;
        const currentAvg = existing.avgRiskScore || 0;
        updates.avgRiskScore = Math.round((currentAvg * total + riskScore) / (total + 1));
      }
      
      await db.update(agentMetrics).set(updates).where(eq(agentMetrics.id, existing.id));
    } else {
      const newMetric: any = {
        agentId,
        date: today,
        requestsTotal: 0,
        requestsApproved: 0,
        requestsRejected: 0,
        requestsExecuted: 0,
        requestsFailed: 0,
        avgRiskScore: riskScore || 0,
      };
      newMetric[field] = 1;
      await db.insert(agentMetrics).values(newMetric);
    }
  }

  // Rate Limits
  async getRateLimit(agentId: number): Promise<RateLimit | undefined> {
    const [limit] = await db.select().from(rateLimits).where(eq(rateLimits.agentId, agentId));
    return limit;
  }

  async upsertRateLimit(agentId: number, limits: Partial<RateLimit>): Promise<RateLimit> {
    const existing = await this.getRateLimit(agentId);
    
    if (existing) {
      const [updated] = await db.update(rateLimits)
        .set(limits)
        .where(eq(rateLimits.agentId, agentId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(rateLimits)
        .values({ agentId, ...limits })
        .returning();
      return created;
    }
  }

  async checkRateLimit(agentId: number): Promise<{ allowed: boolean; remaining: { minute: number; hour: number; day: number } }> {
    const limit = await this.getRateLimit(agentId);
    
    if (!limit || !limit.enabled) {
      return { allowed: true, remaining: { minute: -1, hour: -1, day: -1 } };
    }
    
    const now = new Date();
    const minuteStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
    const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const usages = await db.select().from(rateLimitUsage)
      .where(eq(rateLimitUsage.agentId, agentId));
    
    let minuteCount = 0, hourCount = 0, dayCount = 0;
    
    for (const usage of usages) {
      const windowStart = new Date(usage.windowStart);
      if (usage.windowType === 'minute' && windowStart >= minuteStart) minuteCount = usage.count || 0;
      if (usage.windowType === 'hour' && windowStart >= hourStart) hourCount = usage.count || 0;
      if (usage.windowType === 'day' && windowStart >= dayStart) dayCount = usage.count || 0;
    }
    
    const minuteRemaining = (limit.requestsPerMinute || 60) - minuteCount;
    const hourRemaining = (limit.requestsPerHour || 1000) - hourCount;
    const dayRemaining = (limit.requestsPerDay || 10000) - dayCount;
    
    const allowed = minuteRemaining > 0 && hourRemaining > 0 && dayRemaining > 0;
    
    return { allowed, remaining: { minute: minuteRemaining, hour: hourRemaining, day: dayRemaining } };
  }

  async incrementRateLimitUsage(agentId: number): Promise<void> {
    const now = new Date();
    const minuteStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
    const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    for (const [windowType, windowStart] of [['minute', minuteStart], ['hour', hourStart], ['day', dayStart]] as const) {
      const [existing] = await db.select().from(rateLimitUsage)
        .where(and(
          eq(rateLimitUsage.agentId, agentId),
          eq(rateLimitUsage.windowType, windowType),
          eq(rateLimitUsage.windowStart, windowStart)
        ));
      
      if (existing) {
        await db.update(rateLimitUsage)
          .set({ count: (existing.count || 0) + 1 })
          .where(eq(rateLimitUsage.id, existing.id));
      } else {
        await db.insert(rateLimitUsage).values({
          agentId,
          windowType,
          windowStart,
          count: 1,
        });
      }
    }
  }
}

export const storage = new DatabaseStorage();
