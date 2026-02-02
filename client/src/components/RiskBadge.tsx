import { cn } from "@/lib/utils";
import { ShieldAlert, ShieldCheck, Shield } from "lucide-react";

interface RiskBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

function getRiskLevel(score: number): "low" | "medium" | "high" {
  if (score < 30) return "low";
  if (score < 70) return "medium";
  return "high";
}

export function RiskBadge({ score, size = "md", showLabel = true }: RiskBadgeProps) {
  const level = getRiskLevel(score);

  const colors = {
    low: "bg-green-500/10 text-green-500 border-green-500/20",
    medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    high: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  const icons = {
    low: ShieldCheck,
    medium: Shield,
    high: ShieldAlert,
  };

  const sizes = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-lg px-4 py-2",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const Icon = icons[level];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 font-mono font-bold rounded-full border",
        colors[level],
        sizes[size]
      )}
      data-testid={`risk-badge-${level}`}
    >
      <Icon className={iconSizes[size]} />
      <span>{score}</span>
      {showLabel && <span className="font-normal opacity-70">/ 100</span>}
    </div>
  );
}

interface RiskSummaryProps {
  summary: {
    totalRiskScore: number;
    high: number;
    medium: number;
    low: number;
    flagsTop: string[];
  };
}

export function RiskSummary({ summary }: RiskSummaryProps) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <RiskBadge score={summary.totalRiskScore} size="lg" />
      <div className="flex gap-3 text-sm">
        {summary.high > 0 && (
          <span className="text-red-500">
            {summary.high} high-risk
          </span>
        )}
        {summary.medium > 0 && (
          <span className="text-yellow-500">
            {summary.medium} medium-risk
          </span>
        )}
        {summary.low > 0 && (
          <span className="text-green-500">
            {summary.low} low-risk
          </span>
        )}
      </div>
    </div>
  );
}
