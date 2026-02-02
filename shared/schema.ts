import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// === 1. USERS (Admin) ===
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(), // bcrypt hash
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
});

// === 2. AGENTS ===
export const agents = sqliteTable("agents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  apiKeyHash: text("api_key_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
});

// === 3. CAPABILITIES ===
export const agentCapabilities = sqliteTable("agent_capabilities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  agentId: integer("agent_id").notNull(), // References agents.id
  type: text("type").notNull(), // 'filesystem', 'shell', 'network'
  enabled: integer("enabled", { mode: "boolean" }).default(false).notNull(),
  config: text("config", { mode: "json" }).$type<Record<string, any>>().default({}),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
});

// === 4. SETTINGS (Global) ===
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(), // e.g., 'allowed_roots', 'shell_allowlist'
  value: text("value", { mode: "json" }).notNull(),
});

// === 5. ACTION REQUESTS ===
export const actionRequests = sqliteTable("action_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  agentId: integer("agent_id").notNull(),
  status: text("status").notNull().default("pending"), 
  summary: text("summary").notNull(),
  input: text("input", { mode: "json" }).notNull(), 
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
});

// === 6. PLANS (Dry Runs) ===
export const plans = sqliteTable("plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestId: integer("request_id").notNull(),
  planHash: text("plan_hash").notNull(),
  steps: text("steps", { mode: "json" }).notNull().$type<PlanStep[]>(),
  riskScore: integer("risk_score").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
});

// === 7. APPROVALS ===
export const approvals = sqliteTable("approvals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  planId: integer("plan_id").notNull(),
  approvedBy: integer("approved_by").notNull(), 
  decision: text("decision").notNull(), 
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
});

// === 8. EXECUTION RECEIPTS ===
export const executionReceipts = sqliteTable("execution_receipts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  planId: integer("plan_id").notNull(),
  status: text("status").notNull(), 
  logs: text("logs", { mode: "json" }).notNull().$type<any[]>(),
  executedAt: integer("executed_at", { mode: "timestamp" }).default(new Date()),
});

// === 9. AUDIT EVENTS ===
export const auditEvents = sqliteTable("audit_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  prevHash: text("prev_hash").notNull(),
  eventHash: text("event_hash").notNull(),
  eventType: text("event_type").notNull(),
  data: text("data", { mode: "json" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
});

// === RELATIONS ===
export const agentRelations = relations(agents, ({ many }) => ({
  capabilities: many(agentCapabilities),
  requests: many(actionRequests),
}));

export const capabilityRelations = relations(agentCapabilities, ({ one }) => ({
  agent: one(agents, {
    fields: [agentCapabilities.agentId],
    references: [agents.id],
  }),
}));

export const requestRelations = relations(actionRequests, ({ one, many }) => ({
  agent: one(agents, {
    fields: [actionRequests.agentId],
    references: [agents.id],
  }),
  plans: many(plans),
}));

export const planRelations = relations(plans, ({ one, many }) => ({
  request: one(actionRequests, {
    fields: [plans.requestId],
    references: [actionRequests.id],
  }),
  approvals: many(approvals),
  receipts: many(executionReceipts),
}));

// === TYPES & SCHEMAS ===

// Plan Step Type
export interface PlanStep {
  stepId: string;
  type: 'FS_READ' | 'FS_WRITE' | 'FS_DELETE' | 'FS_LIST' | 'FS_MOVE' | 'SHELL_RUN' | 'NET_ALLOW';
  description: string;
  inputs: Record<string, any>;
  preview?: string; // Human readable preview
  diff?: string;    // For text files
  riskFlags: string[];
}

// Zod Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertAgentSchema = createInsertSchema(agents).omit({ id: true, createdAt: true, lastSeenAt: true });
export const insertCapabilitySchema = createInsertSchema(agentCapabilities).omit({ id: true, createdAt: true });
export const insertSettingSchema = createInsertSchema(settings);

// Insert Types
export type InsertUser = z.infer<typeof insertUserSchema>;

// API Types
export type User = typeof users.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type AgentCapability = typeof agentCapabilities.$inferSelect;
export type ActionRequest = typeof actionRequests.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type ExecutionReceipt = typeof executionReceipts.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;

export type CreateAgentRequest = { name: string };
export type UpdateAgentCapabilityRequest = { enabled: boolean; config?: Record<string, any> };

// Agent API Payloads
export const AgentActionSchema = z.object({
  type: z.enum(['filesystem', 'shell', 'network', 'echo']),
  operation: z.string(),
  params: z.record(z.any()),
});
export type AgentActionPayload = z.infer<typeof AgentActionSchema>;
