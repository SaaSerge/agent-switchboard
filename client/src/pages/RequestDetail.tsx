import { Layout } from "@/components/Layout";
import { useRequestDetail } from "@/hooks/use-requests";
import { useRoute } from "wouter";
import { StatusBadge } from "@/components/StatusBadge";
import { CodeBlock } from "@/components/CodeBlock";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, ShieldAlert, FileText, Play, Terminal, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { RiskBadge } from "@/components/RiskBadge";

export default function RequestDetail() {
  const [, params] = useRoute("/requests/:id");
  const id = parseInt(params?.id || "0");
  const { request, isLoading, approvePlan } = useRequestDetail(id);

  if (isLoading || !request) return <Layout><div className="animate-pulse">Loading...</div></Layout>;

  // Assuming only one plan for now, or the latest one
  const plan = request.plans?.[0]; 
  const isPending = request.status === "pending" || request.status === "planned";

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8 pb-24">
        <Link href="/requests" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Requests
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold font-display">Request #{request.id}</h1>
              <StatusBadge status={request.status} />
            </div>
            <p className="text-lg text-muted-foreground">{request.summary}</p>
          </div>
          <div className="text-right text-sm text-muted-foreground font-mono">
            <div>Agent: {request.agentName || `ID ${request.agentId}`}</div>
            <div>{new Date(request.createdAt).toLocaleString()}</div>
          </div>
        </div>

        {/* Plan Steps */}
        {plan && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Play className="w-5 h-5 text-primary" />
                Execution Plan
              </h2>
              {plan.riskScore !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Risk Score:</span>
                  <RiskBadge score={plan.riskScore} size="lg" />
                </div>
              )}
            </div>
            
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="divide-y divide-border/50">
                {plan.steps.map((step: any, index: number) => (
                  <div key={index} className="p-4 md:p-6 hover:bg-white/5 transition-colors group">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-mono border border-white/10 shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h3 className="font-medium text-foreground">{step.description}</h3>
                          <div className="flex items-center gap-2">
                            {step.riskScore !== undefined && (
                              <RiskBadge score={step.riskScore} size="sm" showLabel={false} />
                            )}
                            <span className={cn(
                              "text-[10px] font-mono uppercase px-2 py-0.5 rounded border",
                              step.riskFlags?.length > 0 
                                ? "bg-red-500/10 text-red-500 border-red-500/20" 
                                : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                            )}>
                              {step.type}
                            </span>
                          </div>
                        </div>

                        {step.riskFlags?.length > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            {step.riskFlags.map((flag: string, i: number) => (
                              <span key={i} className="inline-flex items-center gap-1 text-xs text-red-400 bg-red-950/30 px-2 py-1 rounded border border-red-900/50">
                                <ShieldAlert className="w-3 h-3" /> {flag}
                              </span>
                            ))}
                          </div>
                        )}

                        {step.diff ? (
                          <div className="mt-2 text-xs font-mono bg-black/50 p-3 rounded border border-white/10 overflow-x-auto whitespace-pre">
                            {step.diff}
                          </div>
                        ) : step.preview ? (
                          <div className="mt-2 text-xs font-mono bg-muted/50 p-3 rounded border border-white/5 text-muted-foreground">
                            {step.preview}
                          </div>
                        ) : null}

                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-primary transition-colors select-none">
                            View raw inputs
                          </summary>
                          <div className="mt-2">
                            <CodeBlock code={step.inputs} />
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input Details */}
        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" /> Original Request Input
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock code={request.input} />
          </CardContent>
        </Card>

        {/* Footer Actions - Sticky */}
        {isPending && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border z-10">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div className="text-sm text-muted-foreground hidden md:block">
                Review the plan carefully before approving.
              </div>
              <div className="flex gap-3 ml-auto">
                <Button 
                  variant="outline" 
                  className="border-red-900/30 text-red-500 hover:bg-red-950/30 hover:text-red-400"
                  onClick={() => approvePlan.mutate({ planId: plan.id, decision: 'rejected' })}
                  disabled={approvePlan.isPending}
                >
                  <X className="w-4 h-4 mr-2" /> Reject
                </Button>
                <Button 
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => approvePlan.mutate({ planId: plan.id, decision: 'approved' })}
                  disabled={approvePlan.isPending}
                >
                  <Check className="w-4 h-4 mr-2" /> Approve Execution
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
