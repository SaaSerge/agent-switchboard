export interface PlanStep {
  stepId: string;
  type: 'FS_READ' | 'FS_WRITE' | 'FS_DELETE' | 'FS_LIST' | 'FS_MOVE' | 'SHELL_RUN' | 'NET_ALLOW';
  description: string;
  inputs: Record<string, unknown>;
  preview?: string;
  diff?: string;
  riskFlags: string[];
  riskScore?: number;
}

export interface Agent {
  id: number;
  name: string;
  apiKeyHash: string;
  createdAt: Date | null;
  lastSeenAt: Date | null;
}

export interface AgentCapability {
  id: number;
  agentId: number;
  type: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: Date | null;
}

export interface ActionRequest {
  id: number;
  agentId: number;
  status: string;
  summary: string;
  input: unknown;
  createdAt: Date | null;
}

export interface Plan {
  id: number;
  requestId: number;
  planHash: string;
  steps: PlanStep[];
  riskScore: number | null;
  createdAt: Date | null;
}

export interface ExecutionReceipt {
  id: number;
  planId: number;
  status: string;
  logs: unknown[];
  executedAt: Date | null;
}

export interface AuditEvent {
  id: number;
  prevHash: string;
  eventHash: string;
  eventType: string;
  data: unknown;
  createdAt: Date | null;
}

export interface Setting {
  key: string;
  value: unknown;
}

export interface User {
  id: number;
  username: string;
  password: string;
  createdAt: Date | null;
}

export interface RiskSummary {
  totalRiskScore: number;
  high: number;
  medium: number;
  low: number;
  flagsTop: string[];
}

export interface PluginInfo {
  id: string;
  displayName: string;
  version: string;
  capabilityType: string;
  uiHints?: Record<string, unknown>;
}

export type CapabilityType = 'filesystem' | 'shell' | 'network' | 'echo';
export type OperationType = string;
