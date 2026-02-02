import type { CapabilityPlugin, PluginContext, ValidationResult, DryRunResult, ExecutionResult } from "../types";
import type { PlanStep } from "@agent-switchboard/shared";
import { randomUUID } from "crypto";
import { readFileSync, writeFileSync, unlinkSync, renameSync, readdirSync, existsSync, statSync } from "fs";
import { resolve, dirname } from "path";
import { createTwoFilesPatch } from "diff";
import { calculateStepRiskScore } from "../risk-scoring";

const VALID_OPERATIONS = ["read", "write", "delete", "list", "move"];
const DESTRUCTIVE_OPERATIONS = ["write", "delete", "move"];

function isPathAllowed(filePath: string, allowedRoots: string[]): boolean {
  const resolved = resolve(filePath);
  return allowedRoots.some(root => resolved.startsWith(resolve(root)));
}

export const filesystemPlugin: CapabilityPlugin = {
  id: "builtin:filesystem",
  displayName: "Filesystem",
  version: "1.0.0",
  capabilityType: "filesystem",

  validateRequest(input: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    if (!input.operation || typeof input.operation !== "string") {
      errors.push("operation is required");
    } else if (!VALID_OPERATIONS.includes(input.operation)) {
      errors.push(`operation must be one of: ${VALID_OPERATIONS.join(", ")}`);
    }

    if (!input.path && input.operation !== "list") {
      errors.push("path is required");
    }

    return {
      valid: errors.length === 0,
      errors,
      normalizedRequest: {
        operation: input.operation,
        path: input.path,
        content: input.content,
        destination: input.destination,
      },
    };
  },

  async dryRun(ctx: PluginContext, normalizedRequest: Record<string, unknown>): Promise<DryRunResult> {
    const { operation, path, content, destination } = normalizedRequest as {
      operation: string;
      path: string;
      content?: string;
      destination?: string;
    };

    if (ctx.safeModeEnabled && DESTRUCTIVE_OPERATIONS.includes(operation)) {
      const step: PlanStep = {
        stepId: randomUUID(),
        type: "FS_WRITE",
        description: `BLOCKED (Safe Mode): ${operation} on ${path}`,
        inputs: normalizedRequest,
        preview: "Operation blocked by Safe Mode",
        riskFlags: ["safe_mode_blocked"],
        riskScore: 0,
      };
      return { steps: [step], riskScore: 0 };
    }

    if (!isPathAllowed(path, ctx.allowedRoots)) {
      const step: PlanStep = {
        stepId: randomUUID(),
        type: "FS_READ",
        description: `Path not allowed: ${path}`,
        inputs: normalizedRequest,
        preview: `Path ${path} is outside allowed roots`,
        riskFlags: ["path_denied"],
        riskScore: 50,
      };
      return { steps: [step], riskScore: 50 };
    }

    const steps: PlanStep[] = [];
    let stepType: PlanStep["type"] = "FS_READ";

    switch (operation) {
      case "read":
        stepType = "FS_READ";
        steps.push({
          stepId: randomUUID(),
          type: stepType,
          description: `Read file: ${path}`,
          inputs: normalizedRequest,
          preview: existsSync(path) ? `File exists (${statSync(path).size} bytes)` : "File does not exist",
          riskFlags: [],
        });
        break;

      case "write":
        stepType = "FS_WRITE";
        const existing = existsSync(path) ? readFileSync(path, "utf-8") : "";
        const diff = createTwoFilesPatch(path, path, existing, (content as string) || "", "before", "after");
        steps.push({
          stepId: randomUUID(),
          type: stepType,
          description: `Write file: ${path}`,
          inputs: normalizedRequest,
          diff,
          riskFlags: [],
        });
        break;

      case "delete":
        stepType = "FS_DELETE";
        steps.push({
          stepId: randomUUID(),
          type: stepType,
          description: `Delete file: ${path}`,
          inputs: normalizedRequest,
          preview: existsSync(path) ? `Will delete ${path}` : "File does not exist",
          riskFlags: [],
        });
        break;

      case "move":
        stepType = "FS_MOVE";
        steps.push({
          stepId: randomUUID(),
          type: stepType,
          description: `Move ${path} to ${destination}`,
          inputs: normalizedRequest,
          preview: `Move from ${path} to ${destination}`,
          riskFlags: [],
        });
        break;

      case "list":
        stepType = "FS_LIST";
        steps.push({
          stepId: randomUUID(),
          type: stepType,
          description: `List directory: ${path}`,
          inputs: normalizedRequest,
          preview: existsSync(path) ? `Directory exists` : "Directory does not exist",
          riskFlags: [],
        });
        break;
    }

    for (const step of steps) {
      const { score, flags } = calculateStepRiskScore(step);
      step.riskScore = score;
      step.riskFlags = flags;
    }

    const totalRisk = steps.reduce((sum, s) => sum + (s.riskScore || 0), 0) / steps.length;
    return { steps, riskScore: Math.round(totalRisk) };
  },

  async execute(ctx: PluginContext, approvedPlan: PlanStep[]): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    for (const step of approvedPlan) {
      const { operation, path, content, destination } = step.inputs as {
        operation: string;
        path: string;
        content?: string;
        destination?: string;
      };

      if (ctx.safeModeEnabled && DESTRUCTIVE_OPERATIONS.includes(operation)) {
        results.push({
          stepId: step.stepId,
          status: "blocked",
          error: "Safe Mode enabled - destructive operations blocked",
          timestamp: new Date(),
        });
        continue;
      }

      try {
        switch (operation) {
          case "read": {
            const data = readFileSync(path, "utf-8");
            results.push({ stepId: step.stepId, status: "success", output: data, timestamp: new Date() });
            break;
          }
          case "write": {
            writeFileSync(path, content || "");
            results.push({ stepId: step.stepId, status: "success", output: "File written", timestamp: new Date() });
            break;
          }
          case "delete": {
            unlinkSync(path);
            results.push({ stepId: step.stepId, status: "success", output: "File deleted", timestamp: new Date() });
            break;
          }
          case "move": {
            renameSync(path, destination!);
            results.push({ stepId: step.stepId, status: "success", output: "File moved", timestamp: new Date() });
            break;
          }
          case "list": {
            const files = readdirSync(path);
            results.push({ stepId: step.stepId, status: "success", output: files, timestamp: new Date() });
            break;
          }
        }
      } catch (error) {
        results.push({
          stepId: step.stepId,
          status: "failed",
          error: (error as Error).message,
          timestamp: new Date(),
        });
      }
    }

    return results;
  },

  getDefaultConfig() {
    return { allowedRoots: ["./sandbox"] };
  },

  uiHints: {
    icon: "folder",
    color: "green",
    warnings: ["File operations can modify or delete data permanently"],
    configLabels: { allowedRoots: "Allowed Directories" },
  },
};
