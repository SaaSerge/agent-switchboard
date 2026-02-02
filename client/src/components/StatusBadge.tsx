import { cn } from "@/lib/utils";

type Status = 'pending' | 'planned' | 'approved' | 'rejected' | 'executed' | 'failed' | 'success';

export function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    planned: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    approved: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    executed: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    success: "bg-green-500/10 text-green-500 border-green-500/20",
    failed: "bg-red-500/10 text-red-500 border-red-500/20",
    rejected: "bg-red-900/10 text-red-700 border-red-900/20",
  };

  const normalizedStatus = status.toLowerCase();
  
  return (
    <span className={cn(
      "px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border uppercase tracking-wider",
      variants[normalizedStatus] || "bg-gray-500/10 text-gray-500 border-gray-500/20"
    )}>
      {status}
    </span>
  );
}
