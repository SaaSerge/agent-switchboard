import type { CapabilityPlugin, PluginContext, ValidationResult, DryRunResult, ExecutionResult } from "../types";
import type { PlanStep } from "@shared/schema";
import { calculateStepRiskScore } from "../risk-scoring";
import fs from "fs/promises";
import path from "path";
import { diffLines } from "diff";
import crypto from "crypto";

function isPathAllowed(requestedPath: string, allowedRoots: string[]): boolean {
  const resolved = path.resolve(requestedPath);
  return allowedRoots.some(root => {
    const resolvedRoot = path.resolve(root);
    return resolved.startsWith(resolvedRoot);
  });
}

export const filesystemPlugin: CapabilityPlugin = {
  id: "filesystem",
  displayName: "Filesystem",
  version: "1.0.0",
  capabilityType: "filesystem",

  validateRequest(input) {
    const errors: string[] = [];
    const operation = input.operation;
    
    if (!["read", "write", "list", "delete", "move"].includes(operation)) {
      errors.push(`Invalid operation: ${operation}`);
    }

    if (!input.params?.path && operation !== "move") {
      errors.push("Missing required parameter: path");
    }

    if (operation === "move" && (!input.params?.from || !input.params?.to)) {
      errors.push("Move operation requires 'from' and 'to' paths");
    }

    if (operation === "write" && input.params?.content === undefined) {
      errors.push("Write operation requires 'content' parameter");
    }

    return {
      valid: errors.length === 0,
      errors,
      normalizedRequest: {
        operation,
        path: input.params?.path,
        content: input.params?.content,
        from: input.params?.from,
        to: input.params?.to,
      }
    };
  },

  async dryRun(ctx: PluginContext, req: Record<string, any>): Promise<DryRunResult> {
    const steps: PlanStep[] = [];
    const { operation } = req;
    const targetPath = req.path ? path.resolve(req.path) : null;

    if (targetPath && !isPathAllowed(targetPath, ctx.allowedRoots)) {
      throw new Error(`Path ${targetPath} is outside allowed roots.`);
    }

    const stepId = crypto.randomUUID();

    if (operation === "read") {
      const step: PlanStep = {
        stepId,
        type: "FS_READ",
        description: `Read file: ${targetPath}`,
        inputs: { path: targetPath },
        riskFlags: [],
      };
      const { score, flags } = calculateStepRiskScore(step);
      step.riskFlags = flags;
      (step as any).riskScore = score;
      
      if (ctx.safeModeEnabled) {
        step.riskFlags.push("blocked_by_safe_mode");
      }
      
      steps.push(step);
    } else if (operation === "write") {
      let oldContent = "";
      try {
        oldContent = await fs.readFile(targetPath!, "utf-8");
      } catch (e) {
        // File doesn't exist
      }

      const newContent = req.content || "";
      const diff = diffLines(oldContent, newContent);
      let diffStr = "";
      diff.forEach(part => {
        const prefix = part.added ? "+ " : part.removed ? "- " : "  ";
        diffStr += part.value.split("\n").map(l => l ? prefix + l : l).join("\n");
      });

      const step: PlanStep = {
        stepId,
        type: "FS_WRITE",
        description: `Write to file: ${targetPath}`,
        inputs: { path: targetPath, content: newContent },
        diff: diffStr,
        preview: `Writing ${newContent.length} bytes`,
        riskFlags: [],
      };
      const { score, flags } = calculateStepRiskScore(step);
      step.riskFlags = flags;
      (step as any).riskScore = score;
      
      if (ctx.safeModeEnabled) {
        step.riskFlags.push("blocked_by_safe_mode");
      }
      
      steps.push(step);
    } else if (operation === "list") {
      const step: PlanStep = {
        stepId,
        type: "FS_LIST",
        description: `List directory: ${targetPath}`,
        inputs: { path: targetPath },
        riskFlags: [],
      };
      const { score, flags } = calculateStepRiskScore(step);
      step.riskFlags = flags;
      (step as any).riskScore = score;
      steps.push(step);
    } else if (operation === "delete") {
      const step: PlanStep = {
        stepId,
        type: "FS_DELETE",
        description: `Delete: ${targetPath}`,
        inputs: { path: targetPath },
        riskFlags: [],
      };
      const { score, flags } = calculateStepRiskScore(step);
      step.riskFlags = flags;
      (step as any).riskScore = score;
      
      if (ctx.safeModeEnabled) {
        step.riskFlags.push("blocked_by_safe_mode");
      }
      
      steps.push(step);
    } else if (operation === "move") {
      const fromPath = path.resolve(req.from);
      const toPath = path.resolve(req.to);
      
      if (!isPathAllowed(fromPath, ctx.allowedRoots) || !isPathAllowed(toPath, ctx.allowedRoots)) {
        throw new Error("Move paths must be within allowed roots.");
      }
      
      const step: PlanStep = {
        stepId,
        type: "FS_MOVE",
        description: `Move: ${fromPath} -> ${toPath}`,
        inputs: { from: fromPath, to: toPath },
        riskFlags: [],
      };
      const { score, flags } = calculateStepRiskScore(step);
      step.riskFlags = flags;
      (step as any).riskScore = score;
      
      if (ctx.safeModeEnabled) {
        step.riskFlags.push("blocked_by_safe_mode");
      }
      
      steps.push(step);
    }

    const totalRisk = steps.reduce((acc, s) => acc + ((s as any).riskScore || 0), 0);
    return { steps, riskScore: Math.min(100, totalRisk) };
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
        if (ctx.safeModeEnabled && ["FS_WRITE", "FS_DELETE", "FS_MOVE"].includes(step.type)) {
          result.status = "blocked";
          result.error = "Blocked by Safe Mode";
          results.push(result);
          continue;
        }

        if (step.type === "FS_READ") {
          const content = await fs.readFile(step.inputs.path, "utf-8");
          result.output = content.substring(0, 500) + (content.length > 500 ? "..." : "");
        } else if (step.type === "FS_WRITE") {
          await fs.writeFile(step.inputs.path, step.inputs.content);
          result.output = "Written successfully";
        } else if (step.type === "FS_LIST") {
          const files = await fs.readdir(step.inputs.path);
          result.output = files;
        } else if (step.type === "FS_DELETE") {
          await fs.rm(step.inputs.path, { recursive: true, force: true });
          result.output = "Deleted";
        } else if (step.type === "FS_MOVE") {
          await fs.rename(step.inputs.from, step.inputs.to);
          result.output = "Moved";
        }
      } catch (e: any) {
        result.status = "failed";
        result.error = e.message;
      }

      results.push(result);
    }

    return results;
  },

  getDefaultConfig() {
    return {};
  },

  uiHints: {
    icon: "folder",
    color: "blue",
    warnings: ["Ensure paths are within allowed roots"],
  }
};
