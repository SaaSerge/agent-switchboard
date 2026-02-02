import type { CapabilityPlugin, PluginContext, ValidationResult, DryRunResult, ExecutionResult } from "../types";
import type { PlanStep } from "@shared/schema";
import { calculateStepRiskScore } from "../risk-scoring";
import path from "path";
import crypto from "crypto";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

function isPathAllowed(requestedPath: string, allowedRoots: string[]): boolean {
  const resolved = path.resolve(requestedPath);
  return allowedRoots.some(root => {
    const resolvedRoot = path.resolve(root);
    return resolved.startsWith(resolvedRoot);
  });
}

function isCommandAllowed(fullCmd: string, allowList: string[]): boolean {
  if (allowList.length === 0) return false;
  return allowList.some(pattern => {
    try {
      return new RegExp(pattern).test(fullCmd);
    } catch {
      return fullCmd.startsWith(pattern);
    }
  });
}

const SAFE_MODE_READONLY_COMMANDS = ["ls", "cat", "head", "tail", "echo", "pwd", "whoami", "date"];

export const shellPlugin: CapabilityPlugin = {
  id: "shell",
  displayName: "Shell Commands",
  version: "1.0.0",
  capabilityType: "shell",

  validateRequest(input) {
    const errors: string[] = [];
    
    if (!input.params?.command) {
      errors.push("Missing required parameter: command");
    }

    return {
      valid: errors.length === 0,
      errors,
      normalizedRequest: {
        command: input.params?.command,
        args: input.params?.args || [],
        cwd: input.params?.cwd || process.cwd(),
      }
    };
  },

  async dryRun(ctx: PluginContext, req: Record<string, any>): Promise<DryRunResult> {
    const steps: PlanStep[] = [];
    const { command, args, cwd } = req;
    const resolvedCwd = path.resolve(cwd);

    if (!isPathAllowed(resolvedCwd, ctx.allowedRoots)) {
      throw new Error(`CWD ${resolvedCwd} is outside allowed roots.`);
    }

    const fullCmd = `${command} ${args.join(" ")}`.trim();
    const isAllowed = isCommandAllowed(fullCmd, ctx.shellAllowList);
    
    const step: PlanStep = {
      stepId: crypto.randomUUID(),
      type: "SHELL_RUN",
      description: `Run: ${fullCmd}`,
      inputs: { command, args, cwd: resolvedCwd },
      preview: `Execute in ${resolvedCwd}`,
      riskFlags: [],
    };
    
    const { score, flags } = calculateStepRiskScore(step);
    step.riskFlags = [...flags];
    (step as any).riskScore = score;

    if (!isAllowed) {
      step.riskFlags.push("would_be_blocked");
      (step as any).riskScore = 100;
    }

    if (ctx.safeModeEnabled) {
      const baseCmd = command.split("/").pop() || command;
      if (!SAFE_MODE_READONLY_COMMANDS.includes(baseCmd)) {
        step.riskFlags.push("blocked_by_safe_mode");
      }
    }

    steps.push(step);

    return { steps, riskScore: (step as any).riskScore };
  },

  async execute(ctx: PluginContext, approvedPlan: PlanStep[]): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    
    for (const step of approvedPlan) {
      const result: ExecutionResult = {
        stepId: step.stepId,
        status: "success",
        timestamp: new Date(),
      };

      try {
        const fullCmd = `${step.inputs.command} ${step.inputs.args.join(" ")}`.trim();
        
        if (!isCommandAllowed(fullCmd, ctx.shellAllowList)) {
          result.status = "blocked";
          result.error = "Command not in allowlist";
          results.push(result);
          continue;
        }

        if (ctx.safeModeEnabled) {
          const baseCmd = step.inputs.command.split("/").pop() || step.inputs.command;
          if (!SAFE_MODE_READONLY_COMMANDS.includes(baseCmd)) {
            result.status = "blocked";
            result.error = "Blocked by Safe Mode - only read-only commands allowed";
            results.push(result);
            continue;
          }
        }

        const { stdout, stderr } = await execAsync(fullCmd, { cwd: step.inputs.cwd, timeout: 30000 });
        result.stdout = stdout;
        result.stderr = stderr;
        result.output = stdout.substring(0, 1000);
      } catch (e: any) {
        result.status = "failed";
        result.error = e.message;
        result.stderr = e.stderr;
      }

      results.push(result);
    }

    return results;
  },

  getDefaultConfig() {
    return {
      timeout: 30000,
    };
  },

  uiHints: {
    icon: "terminal",
    color: "orange",
    warnings: ["Shell commands can be dangerous. Review carefully before approval."],
  }
};
