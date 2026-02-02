import type { CapabilityPlugin, PluginContext, ValidationResult, DryRunResult, ExecutionResult } from "../types";
import type { PlanStep } from "@agent-switchboard/shared";
import { randomUUID } from "crypto";
import { execSync } from "child_process";
import { calculateStepRiskScore } from "../risk-scoring";

export const shellPlugin: CapabilityPlugin = {
  id: "builtin:shell",
  displayName: "Shell Commands",
  version: "1.0.0",
  capabilityType: "shell",

  validateRequest(input: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    if (!input.command || typeof input.command !== "string") {
      errors.push("command is required and must be a string");
    }

    return {
      valid: errors.length === 0,
      errors,
      normalizedRequest: {
        command: input.command,
        args: Array.isArray(input.args) ? input.args : [],
        cwd: input.cwd || process.cwd(),
      },
    };
  },

  async dryRun(ctx: PluginContext, normalizedRequest: Record<string, unknown>): Promise<DryRunResult> {
    const { command, args, cwd } = normalizedRequest as {
      command: string;
      args: string[];
      cwd: string;
    };

    const fullCommand = [command, ...args].join(" ");

    if (ctx.safeModeEnabled) {
      const step: PlanStep = {
        stepId: randomUUID(),
        type: "SHELL_RUN",
        description: `BLOCKED (Safe Mode): ${command}`,
        inputs: normalizedRequest,
        preview: "Shell commands are blocked in Safe Mode",
        riskFlags: ["safe_mode_blocked"],
        riskScore: 0,
      };
      return { steps: [step], riskScore: 0 };
    }

    const isAllowed = ctx.shellAllowList.some(pattern => {
      try {
        const regex = new RegExp(pattern);
        return regex.test(fullCommand);
      } catch {
        return false;
      }
    });

    if (!isAllowed && ctx.shellAllowList.length > 0) {
      const step: PlanStep = {
        stepId: randomUUID(),
        type: "SHELL_RUN",
        description: `Command not in allowlist: ${command}`,
        inputs: normalizedRequest,
        preview: `Command "${fullCommand}" is not in the shell allowlist`,
        riskFlags: ["command_not_allowed"],
        riskScore: 80,
      };
      return { steps: [step], riskScore: 80 };
    }

    const step: PlanStep = {
      stepId: randomUUID(),
      type: "SHELL_RUN",
      description: `Execute: ${fullCommand}`,
      inputs: normalizedRequest,
      preview: `Will run: ${fullCommand}\nWorking directory: ${cwd}`,
      riskFlags: [],
    };

    const { score, flags } = calculateStepRiskScore(step);
    step.riskScore = score;
    step.riskFlags = flags;

    return { steps: [step], riskScore: score };
  },

  async execute(ctx: PluginContext, approvedPlan: PlanStep[]): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    for (const step of approvedPlan) {
      if (ctx.safeModeEnabled) {
        results.push({
          stepId: step.stepId,
          status: "blocked",
          error: "Safe Mode enabled - shell commands blocked",
          timestamp: new Date(),
        });
        continue;
      }

      const { command, args, cwd } = step.inputs as {
        command: string;
        args: string[];
        cwd: string;
      };

      try {
        const fullCommand = [command, ...args].join(" ");
        const output = execSync(fullCommand, {
          cwd,
          encoding: "utf-8",
          timeout: 30000,
          maxBuffer: 1024 * 1024,
        });

        results.push({
          stepId: step.stepId,
          status: "success",
          stdout: output,
          timestamp: new Date(),
        });
      } catch (error) {
        const err = error as { message: string; stdout?: string; stderr?: string };
        results.push({
          stepId: step.stepId,
          status: "failed",
          error: err.message,
          stdout: err.stdout,
          stderr: err.stderr,
          timestamp: new Date(),
        });
      }
    }

    return results;
  },

  getDefaultConfig() {
    return { allowlist: ["^git status$", "^ls "] };
  },

  uiHints: {
    icon: "terminal",
    color: "orange",
    warnings: ["Shell commands can execute arbitrary code. Use allowlist patterns carefully."],
    configLabels: { allowlist: "Command Patterns (Regex)" },
  },
};
