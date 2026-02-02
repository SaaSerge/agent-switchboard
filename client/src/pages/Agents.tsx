import { Layout } from "@/components/Layout";
import { useAgents } from "@/hooks/use-agents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { Plus, Terminal, RefreshCw, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Agents() {
  const { agents, createAgent, rotateKey, toggleCapability } = useAgents();
  const [newAgentName, setNewAgentName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!newAgentName) return;
    try {
      const result = await createAgent.mutateAsync({ name: newAgentName });
      setCreatedKey(result.apiKey);
      setNewAgentName("");
    } catch (e) {
      // Error handled in hook
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "API Key copied to clipboard" });
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Agents</h1>
          <p className="text-muted-foreground mt-1">Manage agent access and capabilities</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setCreatedKey(null); // Reset when closing
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4" /> New Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle>Register New Agent</DialogTitle>
            </DialogHeader>
            
            {!createdKey ? (
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Agent Name</label>
                  <Input 
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    placeholder="e.g. build-server-01"
                    className="bg-background"
                  />
                </div>
                <Button 
                  onClick={handleCreate} 
                  disabled={createAgent.isPending || !newAgentName}
                  className="w-full"
                >
                  {createAgent.isPending ? "Creating..." : "Create Agent"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4 pt-4">
                <div className="bg-yellow-500/10 text-yellow-500 p-3 rounded-lg text-sm border border-yellow-500/20">
                  <span className="font-bold">Warning:</span> Save this key now. It will not be shown again.
                </div>
                <div className="relative group">
                  <div className="font-mono text-sm bg-black/50 p-4 rounded border border-border break-all">
                    {createdKey}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-white"
                    onClick={() => copyToClipboard(createdKey)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <Button onClick={() => setIsDialogOpen(false)} className="w-full">
                  Done
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Agent Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Capabilities</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents?.map((agent) => {
              const fsCap = agent.capabilities.find(c => c.type === 'filesystem')?.enabled;
              const shellCap = agent.capabilities.find(c => c.type === 'shell')?.enabled;
              const netCap = agent.capabilities.find(c => c.type === 'network')?.enabled;

              return (
                <TableRow key={agent.id} className="hover:bg-white/5">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                        <Terminal className="w-4 h-4" />
                      </div>
                      <div>
                        {agent.name}
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">
                          ID: {agent.id}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {agent.lastSeenAt ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Online
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-500 border border-gray-500/20">
                        Offline
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={!!fsCap} 
                          onCheckedChange={(c) => toggleCapability.mutate({ id: agent.id, type: 'filesystem', enabled: c })}
                          className="data-[state=checked]:bg-primary"
                        />
                        <span className={cn("text-xs font-mono", fsCap ? "text-foreground" : "text-muted-foreground")}>FS</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={!!shellCap} 
                          onCheckedChange={(c) => toggleCapability.mutate({ id: agent.id, type: 'shell', enabled: c })}
                          className="data-[state=checked]:bg-primary"
                        />
                        <span className={cn("text-xs font-mono", shellCap ? "text-foreground" : "text-muted-foreground")}>SH</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={!!netCap} 
                          onCheckedChange={(c) => toggleCapability.mutate({ id: agent.id, type: 'network', enabled: c })}
                          className="data-[state=checked]:bg-primary"
                        />
                        <span className={cn("text-xs font-mono", netCap ? "text-foreground" : "text-muted-foreground")}>NET</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        if (confirm("Rotate API key? The old key will stop working immediately.")) {
                          rotateKey.mutate(agent.id);
                        }
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Rotate Key
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Layout>
  );
}
