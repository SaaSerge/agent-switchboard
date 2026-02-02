import type { CapabilityPlugin, PluginContext, ValidationResult, DryRunResult, ExecutionResult } from "../types";
import type { PlanStep } from "@shared/schema";
import { calculateStepRiskScore } from "../risk-scoring";
import crypto from "crypto";

export const networkPlugin: CapabilityPlugin = {
  id: "network",
  displayName: "Network Egress",
  version: "1.0.0",
  capabilityType: "network",

  validateRequest(input) {
    const errors: string[] = [];
    
    if (!input.params?.domains || !Array.isArray(input.params.domains)) {
      errors.push("Missing required parameter: domains (array)");
    }

    return {
      valid: errors.length === 0,
      errors,
      normalizedRequest: {
        domains: input.params?.domains || [],
      }
    };
  },

  async dryRun(ctx: PluginContext, req: Record<string, any>): Promise<DryRunResult> {
    const steps: PlanStep[] = [];
    const { domains } = req;

    const step: PlanStep = {
      stepId: crypto.randomUUID(),
      type: "NET_ALLOW",
      description: `Allow outbound traffic to: ${domains.join(", ")}`,
      inputs: { domains },
      preview: `Requesting access to ${domains.length} domain(s)`,
      riskFlags: [],
    };
    
    const { score, flags } = calculateStepRiskScore(step);
    step.riskFlags = [...flags];
    (step as any).riskScore = score;

    steps.push(step);

    return { steps, riskScore: score };
  },

  async execute(ctx: PluginContext, approvedPlan: PlanStep[]): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    
    for (const step of approvedPlan) {
      const result: ExecutionResult = {
        stepId: step.stepId,
        status: "success",
        timestamp: new Date(),
        output: `Network access logged for domains: ${step.inputs.domains.join(", ")}`,
      };

      results.push(result);
    }

    return results;
  },

  getDefaultConfig() {
    return {
      blockedTlds: [".ru", ".cn", ".top", ".xyz"],
    };
  },

  uiHints: {
    icon: "globe",
    color: "green",
    warnings: ["Network requests are simulated in MVP"],
  }
};
