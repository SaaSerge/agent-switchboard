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
  reasoningTrace: text("reasoning_trace", { mode: "json" }).$type<ReasoningTrace | null>(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
});

// === 5b. AGENT METRICS ===
export const agentMetrics = sqliteTable("agent_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  agentId: integer("agent_id").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  requestsTotal: integer("requests_total").default(0),
  requestsApproved: integer("requests_approved").default(0),
  requestsRejected: integer("requests_rejected").default(0),
  requestsExecuted: integer("requests_executed").default(0),
  requestsFailed: integer("requests_failed").default(0),
  avgRiskScore: integer("avg_risk_score").default(0),
});

// === 5c. RATE LIMITS ===
export const rateLimits = sqliteTable("rate_limits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  agentId: integer("agent_id").notNull().unique(),
  requestsPerMinute: integer("requests_per_minute").default(60),
  requestsPerHour: integer("requests_per_hour").default(1000),
  requestsPerDay: integer("requests_per_day").default(10000),
  enabled: integer("enabled", { mode: "boolean" }).default(false).notNull(),
});

// === 5d. RATE LIMIT USAGE ===
export const rateLimitUsage = sqliteTable("rate_limit_usage", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  agentId: integer("agent_id").notNull(),
  windowStart: integer("window_start", { mode: "timestamp" }).notNull(),
  windowType: text("window_type").notNull(), // 'minute', 'hour', 'day'
  count: integer("count").default(0),
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

// Reasoning Trace Type (for "show your work" feature)
export interface ReasoningTrace {
  goal: string;
  steps: ReasoningStep[];
  confidence: number; // 0-100
  sources?: string[];
}

export interface ReasoningStep {
  thought: string;
  action?: string;
  observation?: string;
}

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
export const ReasoningTraceSchema = z.object({
  goal: z.string(),
  steps: z.array(z.object({
    thought: z.string(),
    action: z.string().optional(),
    observation: z.string().optional(),
  })),
  confidence: z.number().min(0).max(100),
  sources: z.array(z.string()).optional(),
});

export const AgentActionSchema = z.object({
  type: z.enum(['filesystem', 'shell', 'network', 'echo']),
  operation: z.string(),
  params: z.record(z.any()),
  reasoning: ReasoningTraceSchema.optional(),
});
export type AgentActionPayload = z.infer<typeof AgentActionSchema>;

// Rate Limit Types
export type RateLimit = typeof rateLimits.$inferSelect;
export type RateLimitUsage = typeof rateLimitUsage.$inferSelect;

// Agent Metrics Types
export type AgentMetric = typeof agentMetrics.$inferSelect;

// MCP (Model Context Protocol) Types
export interface MCPCapability {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPToolCallRequest {
  method: 'tools/call';
  params: {
    name: string;
    arguments: Record<string, any>;
  };
}

export interface MCPToolListRequest {
  method: 'tools/list';
}

export interface MCPToolCallResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}
