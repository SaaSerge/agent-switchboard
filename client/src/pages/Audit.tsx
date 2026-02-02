import { Layout } from "@/components/Layout";
import { useAudit } from "@/hooks/use-audit";
import { CodeBlock } from "@/components/CodeBlock";
import { useState } from "react";
import { ChevronRight, ChevronDown, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Audit() {
  const { logs, isLoading } = useAudit();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground mt-1">Immutable record of all system events</p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 p-4 border-b border-border bg-muted/30 font-medium text-sm text-muted-foreground">
          <div>Event Details</div>
          <div className="hidden md:block">Hash Chain</div>
          <div className="text-right">Timestamp</div>
        </div>

        <div className="divide-y divide-border/50">
          {logs?.map((log) => (
            <div key={log.id} className="group">
              <div 
                className={cn(
                  "p-4 hover:bg-white/5 cursor-pointer transition-colors grid grid-cols-[1fr_auto_auto] gap-4 items-center",
                  expandedId === log.id && "bg-white/5"
                )}
                onClick={() => toggleExpand(log.id)}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="text-muted-foreground">
                    {expandedId === log.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="font-mono text-sm text-primary font-bold">{log.eventType}</div>
                    <div className="text-xs text-muted-foreground truncate font-mono mt-0.5">
                      ID: {log.id}
                    </div>
                  </div>
                </div>

                <div className="hidden md:flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <Hash className="w-3 h-3" />
                  <span className="opacity-50">{log.prevHash.substring(0, 8)}...</span>
                  <span>→</span>
                  <span className="text-foreground">{log.eventHash.substring(0, 8)}...</span>
                </div>

                <div className="text-xs text-muted-foreground text-right whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString()}
                </div>
              </div>

              {expandedId === log.id && (
                <div className="p-4 bg-black/20 border-t border-border/50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Event Data</h4>
                      <CodeBlock code={log.data} />
                    </div>
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Event Hash</h4>
                        <div className="font-mono text-xs bg-background p-2 rounded border border-border text-green-500 break-all">
                          {log.eventHash}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Previous Hash</h4>
                        <div className="font-mono text-xs bg-background p-2 rounded border border-border text-muted-foreground break-all">
                          {log.prevHash}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!isLoading && logs?.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">No audit events recorded.</div>
          )}
        </div>
      </div>
    </Layout>
  );
}
