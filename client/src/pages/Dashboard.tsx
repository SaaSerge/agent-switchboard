import { Layout } from "@/components/Layout";
import { useAgents } from "@/hooks/use-agents";
import { useRequests } from "@/hooks/use-requests";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowRight, Activity, Clock, Server, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SafeModeToggle } from "@/components/SafeModeToggle";

export default function Dashboard() {
  const { agents } = useAgents();
  const { requests: pendingRequests } = useRequests("pending");
  const { requests: recentRequests } = useRequests();

  const activeAgents = agents?.filter(a => a.lastSeenAt).length || 0;
  const pendingCount = pendingRequests?.length || 0;

  return (
    <Layout>
      <div className="flex flex-col gap-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Overview</h1>
            <p className="text-muted-foreground">System status and pending actions</p>
          </div>
          <SafeModeToggle showLockdown />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Agents</CardTitle>
              <Server className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{activeAgents} / {agents?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Online now</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approvals</CardTitle>
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-yellow-500">{pendingCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Action required</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">24h Executions</CardTitle>
              <Activity className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">24</div>
              <p className="text-xs text-muted-foreground mt-1">+12% from yesterday</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">System Load</CardTitle>
              <Clock className="w-4 h-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">0.0%</div>
              <p className="text-xs text-muted-foreground mt-1">Operational</p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Actions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Pending Approvals</h2>
            <Link href="/requests?status=pending">
              <span className="text-sm text-primary hover:underline cursor-pointer flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          </div>
          
          {pendingRequests && pendingRequests.length > 0 ? (
            <div className="grid gap-4">
              {pendingRequests.slice(0, 3).map((req) => (
                <Link key={req.id} href={`/requests/${req.id}`}>
                  <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:bg-accent/50 hover:border-primary/30 transition-all cursor-pointer group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                        <AlertTriangle className="w-5 h-5 text-yellow-500" />
                      </div>
                      <div>
                        <div className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {req.summary}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-white/5">{req.agentName}</span>
                          <span>•</span>
                          <span className="text-xs">{new Date(req.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="hidden sm:flex">
                      Review Plan
                    </Button>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-card/30 border border-border border-dashed rounded-xl p-12 text-center text-muted-foreground">
              No pending requests. The system is all clear.
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Recent Activity</h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {recentRequests?.slice(0, 5).map((req) => (
                    <tr key={req.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{req.id}</td>
                      <td className="px-4 py-3 font-medium">{req.agentName}</td>
                      <td className="px-4 py-3">{req.summary}</td>
                      <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(req.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/requests/${req.id}`}>
                          <span className="text-primary hover:underline cursor-pointer text-xs">View</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
