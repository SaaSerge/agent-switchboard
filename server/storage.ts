import { db } from "./db";
import {
  users, agents, agentCapabilities, settings, actionRequests, plans, approvals, executionReceipts, auditEvents,
  type User, type Agent, type AgentCapability, type ActionRequest, type Plan, type ExecutionReceipt, type AuditEvent,
  type InsertUser, type CreateAgentRequest
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

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
}

export const storage = new DatabaseStorage();
