import type { PlanStep, RiskSummary } from "@agent-switchboard/shared";

const SENSITIVE_EXTENSIONS = [".env", ".key", ".pem", ".p12", ".sqlite", ".db", ".secret", ".credentials"];
const SHELL_PROFILES = ["/.zshrc", "/.bashrc", "/.bash_profile", "/.profile", "/.ssh/config", "/.ssh/authorized_keys"];
const SUSPICIOUS_TLDS = [".ru", ".cn", ".top", ".xyz", ".tk", ".pw", ".cc"];

export function calculateStepRiskScore(step: PlanStep): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  switch (step.type) {
    case "FS_READ": {
      score = 5;
      const path = ((step.inputs.path as string) || "").toLowerCase();
      if (SENSITIVE_EXTENSIONS.some(ext => path.endsWith(ext))) {
        score += 40;
        flags.push("potential_secret_file");
      }
      break;
    }

    case "FS_WRITE": {
      score = 20;
      const path = (step.inputs.path as string) || "";
      if (SHELL_PROFILES.some(profile => path.includes(profile))) {
        score += 60;
        flags.push("shell_profile_modification");
      }
      if (path.includes("/.")) {
        score += 15;
        flags.push("dotfile_modification");
      }
      break;
    }

    case "FS_DELETE": {
      score = 55;
      const fileCount = (step.inputs.fileCount as number) || 1;
      if (fileCount > 10) {
        score += 20;
        flags.push("bulk_delete");
      }
      break;
    }

    case "FS_MOVE": {
      score = 25;
      break;
    }

    case "FS_LIST": {
      score = 2;
      break;
    }

    case "SHELL_RUN": {
      score = 35;
      const cmd = ((step.inputs.command as string) + " " + ((step.inputs.args as string[]) || []).join(" ")).toLowerCase();
      
      if (cmd.includes("sudo")) {
        score += 45;
        flags.push("sudo");
      }
      if (/\brm\b/.test(cmd)) {
        score += 30;
        flags.push("rm");
      }
      if (cmd.includes(">") || cmd.includes(">>")) {
        score += 15;
        flags.push("redirection");
      }
      if (cmd.includes("|")) {
        score += 15;
        flags.push("pipe");
      }
      if (/curl.*\|.*sh/.test(cmd) || /wget.*\|.*sh/.test(cmd)) {
        score += 50;
        flags.push("curl_pipe_sh");
      }
      if (cmd.includes("chmod 777")) {
        score += 40;
        flags.push("chmod_risky");
      }
      break;
    }

    case "NET_ALLOW": {
      score = 15;
      const domains = (step.inputs.domains as string[]) || [];
      for (const domain of domains) {
        const d = domain.toLowerCase();
        if (/^\d+\.\d+\.\d+\.\d+/.test(d)) {
          score += 25;
          flags.push("ip_literal");
        }
        if (SUSPICIOUS_TLDS.some(tld => d.endsWith(tld))) {
          score += 20;
          flags.push("suspicious_tld");
        }
      }
      break;
    }

    default:
      score = 10;
  }

  return { score: Math.min(100, score), flags };
}

export function calculatePlanRiskScore(steps: PlanStep[]): RiskSummary {
  if (steps.length === 0) {
    return { totalRiskScore: 0, high: 0, medium: 0, low: 0, flagsTop: [] };
  }

  const stepScores = steps.map(s => {
    const { score, flags } = calculateStepRiskScore(s);
    return { score, flags };
  });

  const allScores = stepScores.map(s => s.score);
  const allFlags = stepScores.flatMap(s => s.flags);

  const maxScore = Math.max(...allScores);
  const avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;

  let totalRiskScore = Math.round(maxScore * 0.6 + avgScore * 0.4);

  if (allFlags.includes("bulk_delete") || allFlags.includes("curl_pipe_sh")) {
    totalRiskScore += 10;
  }

  totalRiskScore = Math.min(100, Math.max(0, totalRiskScore));

  const high = allScores.filter(s => s >= 70).length;
  const medium = allScores.filter(s => s >= 30 && s < 70).length;
  const low = allScores.filter(s => s < 30).length;

  const flagCounts = new Map<string, number>();
  for (const flag of allFlags) {
    flagCounts.set(flag, (flagCounts.get(flag) || 0) + 1);
  }
  const flagsTop = Array.from(flagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([flag]) => flag);

  return { totalRiskScore, high, medium, low, flagsTop };
}

export function getRiskLevel(score: number): "low" | "medium" | "high" {
  if (score < 30) return "low";
  if (score < 70) return "medium";
  return "high";
}
