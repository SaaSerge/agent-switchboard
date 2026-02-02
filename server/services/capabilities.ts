import fs from "fs/promises";
import path from "path";
import { type PlanStep } from "@shared/schema";
import { storage } from "../storage";
import { diffLines } from "diff";
import crypto from "crypto";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

// === CAPABILITY ENGINE ===

interface CapabilityContext {
  allowedRoots: string[];
  shellAllowList: string[]; // Regex strings
}

async function getContext(): Promise<CapabilityContext> {
  const roots = await storage.getSetting("allowed_roots");
  const shell = await storage.getSetting("shell_allowlist");
  return {
    allowedRoots: Array.isArray(roots) ? roots : [],
    shellAllowList: Array.isArray(shell) ? shell : [],
  };
}

// === FILESYSTEM ===

function isPathAllowed(requestedPath: string, allowedRoots: string[]): boolean {
  const resolved = path.resolve(requestedPath);
  return allowedRoots.some(root => {
    const resolvedRoot = path.resolve(root);
    return resolved.startsWith(resolvedRoot);
  });
}

async function generateFsPlan(op: string, params: any, context: CapabilityContext): Promise<PlanStep[]> {
  const steps: PlanStep[] = [];
  const riskFlags: string[] = [];
  
  const targetPath = params.path ? path.resolve(params.path) : null;

  if (targetPath && !isPathAllowed(targetPath, context.allowedRoots)) {
    throw new Error(`Path ${targetPath} is outside allowed roots.`);
  }

  const stepId = crypto.randomUUID();

  if (op === "read") {
    steps.push({
      stepId,
      type: "FS_READ",
      description: `Read file: ${targetPath}`,
      inputs: { path: targetPath },
      riskFlags: [],
    });
  } else if (op === "write") {
    // Generate Diff
    let oldContent = "";
    try {
      oldContent = await fs.readFile(targetPath!, "utf-8");
    } catch (e) {
      // File doesn't exist
      riskFlags.push("NEW_FILE");
    }

    const newContent = params.content || "";
    const diff = diffLines(oldContent, newContent);
    // Format diff for display
    let diffStr = "";
    diff.forEach(part => {
      const prefix = part.added ? "+ " : part.removed ? "- " : "  ";
      diffStr += part.value.split("\n").map(l => l ? prefix + l : l).join("\n");
    });

    steps.push({
      stepId,
      type: "FS_WRITE",
      description: `Write to file: ${targetPath}`,
      inputs: { path: targetPath, content: newContent },
      diff: diffStr,
      preview: `Writing ${newContent.length} bytes`,
      riskFlags: [...riskFlags, "OVERWRITE"],
    });
  } else if (op === "list") {
     steps.push({
      stepId,
      type: "FS_LIST",
      description: `List directory: ${targetPath}`,
      inputs: { path: targetPath },
      riskFlags: [],
    });
  } else if (op === "delete") {
     steps.push({
      stepId,
      type: "FS_DELETE",
      description: `Delete: ${targetPath}`,
      inputs: { path: targetPath },
      riskFlags: ["DESTRUCTIVE"],
    });
  }

  return steps;
}

// === SHELL ===

async function generateShellPlan(op: string, params: any, context: CapabilityContext): Promise<PlanStep[]> {
  const steps: PlanStep[] = [];
  const cmd = params.command as string;
  const args = params.args as string[] || [];
  const cwd = params.cwd ? path.resolve(params.cwd) : process.cwd();

  if (!isPathAllowed(cwd, context.allowedRoots)) {
    throw new Error(`CWD ${cwd} is outside allowed roots.`);
  }

  // Check allowlist
  const fullCmd = `${cmd} ${args.join(" ")}`;
  const isAllowed = context.shellAllowList.some(pattern => new RegExp(pattern).test(fullCmd));
  
  if (!isAllowed) {
    throw new Error(`Command '${fullCmd}' does not match any allowed patterns.`);
  }

  steps.push({
    stepId: crypto.randomUUID(),
    type: "SHELL_RUN",
    description: `Run: ${fullCmd}`,
    inputs: { command: cmd, args, cwd },
    riskFlags: ["SHELL_EXEC"],
  });

  return steps;
}

// === NETWORK ===

async function generateNetworkPlan(op: string, params: any, context: CapabilityContext): Promise<PlanStep[]> {
  const steps: PlanStep[] = [];
  const domains = params.domains as string[] || [];
  
  steps.push({
    stepId: crypto.randomUUID(),
    type: "NET_ALLOW",
    description: `Allow outbound traffic to: ${domains.join(", ")}`,
    inputs: { domains },
    riskFlags: domains.some(d => d.endsWith(".ru") || d.endsWith(".cn")) ? ["HIGH_RISK_TLD"] : [],
  });

  return steps;
}

// === MAIN ENTRY POINTS ===

export async function generatePlan(type: string, operation: string, params: any): Promise<{ steps: PlanStep[], riskScore: number }> {
  const context = await getContext();
  let steps: PlanStep[] = [];

  if (type === "filesystem") {
    steps = await generateFsPlan(operation, params, context);
  } else if (type === "shell") {
    steps = await generateShellPlan(operation, params, context);
  } else if (type === "network") {
    steps = await generateNetworkPlan(operation, params, context);
  } else {
    throw new Error(`Unknown capability type: ${type}`);
  }

  // Calculate risk score
  const riskScore = steps.reduce((acc, step) => acc + (step.riskFlags.length * 10), 0);
  return { steps, riskScore };
}

export async function executePlan(plan: any): Promise<any[]> {
  const logs: any[] = [];
  
  for (const step of plan.steps as PlanStep[]) {
    try {
      logs.push({ stepId: step.stepId, status: "started", timestamp: new Date() });
      
      if (step.type === "FS_READ") {
        const content = await fs.readFile(step.inputs.path, "utf-8");
        logs.push({ stepId: step.stepId, status: "completed", output: content.substring(0, 100) + "..." });
      } else if (step.type === "FS_WRITE") {
        await fs.writeFile(step.inputs.path, step.inputs.content);
        logs.push({ stepId: step.stepId, status: "completed", output: "Written successfully" });
      } else if (step.type === "FS_LIST") {
        const files = await fs.readdir(step.inputs.path);
        logs.push({ stepId: step.stepId, status: "completed", output: files });
      } else if (step.type === "FS_DELETE") {
        await fs.rm(step.inputs.path, { recursive: true, force: true });
        logs.push({ stepId: step.stepId, status: "completed", output: "Deleted" });
      } else if (step.type === "SHELL_RUN") {
        const { stdout, stderr } = await execAsync(`${step.inputs.command} ${step.inputs.args.join(" ")}`, { cwd: step.inputs.cwd });
        logs.push({ stepId: step.stepId, status: "completed", stdout, stderr });
      } else if (step.type === "NET_ALLOW") {
        logs.push({ stepId: step.stepId, status: "completed", output: "Simulated network allow" });
      }

    } catch (e: any) {
      logs.push({ stepId: step.stepId, status: "failed", error: e.message });
      throw e; // Stop execution
    }
  }

  return logs;
}
