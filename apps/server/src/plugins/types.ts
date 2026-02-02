import type { PlanStep } from "@agent-switchboard/shared";

export interface PluginContext {
  allowedRoots: string[];
  shellAllowList: string[];
  safeModeEnabled: boolean;
  agentId: number;
  requestId: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  normalizedRequest: Record<string, unknown>;
}

export interface DryRunResult {
  steps: PlanStep[];
  riskScore: number;
}

export interface ExecutionResult {
  stepId: string;
  status: "success" | "failed" | "blocked";
  output?: unknown;
  error?: string;
  stdout?: string;
  stderr?: string;
  timestamp: Date;
}

export interface CapabilityPlugin {
  id: string;
  displayName: string;
  version: string;
  capabilityType: string;
  
  validateRequest(input: Record<string, unknown>): ValidationResult;
  dryRun(ctx: PluginContext, normalizedRequest: Record<string, unknown>): Promise<DryRunResult>;
  execute(ctx: PluginContext, approvedPlan: PlanStep[]): Promise<ExecutionResult[]>;
  getDefaultConfig(): Record<string, unknown>;
  
  uiHints?: {
    icon?: string;
    color?: string;
    warnings?: string[];
    configLabels?: Record<string, string>;
  };
}

export interface PluginRegistry {
  register(plugin: CapabilityPlugin): void;
  getPlugin(type: string): CapabilityPlugin | undefined;
  getAllPlugins(): CapabilityPlugin[];
  getPluginTypes(): string[];
}
