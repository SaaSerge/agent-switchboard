import type { CapabilityPlugin, PluginContext, ValidationResult, DryRunResult, ExecutionResult } from "../types";
import type { PlanStep } from "@agent-switchboard/shared";
import { randomUUID } from "crypto";

export const echoPlugin: CapabilityPlugin = {
  id: "builtin:echo",
  displayName: "Echo (Test Plugin)",
  version: "1.0.0",
  capabilityType: "echo",

  validateRequest(input: Record<string, unknown>): ValidationResult {
    if (!input.message || typeof input.message !== "string") {
      return { valid: false, errors: ["message is required and must be a string"], normalizedRequest: {} };
    }
    return { valid: true, errors: [], normalizedRequest: { message: input.message } };
  },

  async dryRun(_ctx: PluginContext, normalizedRequest: Record<string, unknown>): Promise<DryRunResult> {
    const step: PlanStep = {
      stepId: randomUUID(),
      type: "FS_READ",
      description: `Echo: ${normalizedRequest.message}`,
      inputs: normalizedRequest,
      preview: `Will echo: "${normalizedRequest.message}"`,
      riskFlags: [],
      riskScore: 0,
    };
    return { steps: [step], riskScore: 0 };
  },

  async execute(_ctx: PluginContext, approvedPlan: PlanStep[]): Promise<ExecutionResult[]> {
    return approvedPlan.map(step => ({
      stepId: step.stepId,
      status: "success" as const,
      output: step.inputs.message,
      timestamp: new Date(),
    }));
  },

  getDefaultConfig() {
    return {};
  },

  uiHints: {
    icon: "message-circle",
    color: "blue",
  },
};
