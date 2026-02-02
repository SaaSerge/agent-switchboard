import type { CapabilityPlugin, PluginContext, DryRunResult, ExecutionResult } from "../types";
import type { PlanStep } from "@shared/schema";
import crypto from "crypto";

export const echoPlugin: CapabilityPlugin = {
  id: "echo",
  displayName: "Echo (Test Plugin)",
  version: "1.0.0",
  capabilityType: "echo",

  validateRequest(input) {
    return {
      valid: true,
      errors: [],
      normalizedRequest: {
        message: input.params?.message || "Hello from Echo Plugin!",
      }
    };
  },

  async dryRun(ctx: PluginContext, req: Record<string, any>): Promise<DryRunResult> {
    const step: PlanStep = {
      stepId: crypto.randomUUID(),
      type: "FS_READ" as any, // Using existing type, but this is just for demo
      description: `Echo: "${req.message}"`,
      inputs: { message: req.message },
      preview: `Will echo back: ${req.message}`,
      riskFlags: [],
    };
    
    (step as any).riskScore = 0;

    return { steps: [step], riskScore: 0 };
  },

  async execute(ctx: PluginContext, approvedPlan: PlanStep[]): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    
    for (const step of approvedPlan) {
      results.push({
        stepId: step.stepId,
        status: "success",
        output: `Echo: ${step.inputs.message}`,
        timestamp: new Date(),
      });
    }

    return results;
  },

  getDefaultConfig() {
    return {
      prefix: "Echo: ",
    };
  },

  uiHints: {
    icon: "message-circle",
    color: "purple",
    warnings: [],
  }
};
