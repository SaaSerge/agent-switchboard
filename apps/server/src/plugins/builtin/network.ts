import type { CapabilityPlugin, PluginContext, ValidationResult, DryRunResult, ExecutionResult } from "../types";
import type { PlanStep } from "@agent-switchboard/shared";
import { randomUUID } from "crypto";
import { calculateStepRiskScore } from "../risk-scoring";

export const networkPlugin: CapabilityPlugin = {
  id: "builtin:network",
  displayName: "Network Egress",
  version: "1.0.0",
  capabilityType: "network",

  validateRequest(input: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    if (!input.domains || !Array.isArray(input.domains)) {
      errors.push("domains is required and must be an array");
    }

    return {
      valid: errors.length === 0,
      errors,
      normalizedRequest: {
        domains: input.domains || [],
        purpose: input.purpose || "unspecified",
      },
    };
  },

  async dryRun(_ctx: PluginContext, normalizedRequest: Record<string, unknown>): Promise<DryRunResult> {
    const { domains, purpose } = normalizedRequest as {
      domains: string[];
      purpose: string;
    };

    const step: PlanStep = {
      stepId: randomUUID(),
      type: "NET_ALLOW",
      description: `Allow network access to: ${domains.join(", ")}`,
      inputs: normalizedRequest,
      preview: `Purpose: ${purpose}\nDomains: ${domains.join(", ")}`,
      riskFlags: [],
    };

    const { score, flags } = calculateStepRiskScore(step);
    step.riskScore = score;
    step.riskFlags = flags;

    return { steps: [step], riskScore: score };
  },

  async execute(_ctx: PluginContext, approvedPlan: PlanStep[]): Promise<ExecutionResult[]> {
    return approvedPlan.map(step => ({
      stepId: step.stepId,
      status: "success" as const,
      output: `Network access granted for: ${(step.inputs.domains as string[]).join(", ")}`,
      timestamp: new Date(),
    }));
  },

  getDefaultConfig() {
    return { allowedDomains: [] };
  },

  uiHints: {
    icon: "globe",
    color: "purple",
    warnings: ["Network egress allows agents to communicate with external services"],
    configLabels: { allowedDomains: "Allowed Domains" },
  },
};
