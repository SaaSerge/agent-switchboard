import { Layout } from "@/components/Layout";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { Save, Plus, X, ShieldAlert } from "lucide-react";
import { Label } from "@/components/ui/label";
import { SafeModeToggle } from "@/components/SafeModeToggle";

export default function Settings() {
  const { settings, updateSetting } = useSettings();
  
  // Local state for form handling
  const [roots, setRoots] = useState<string[]>([]);
  const [shellPatterns, setShellPatterns] = useState<string[]>([]);
  const [newRoot, setNewRoot] = useState("");
  const [newPattern, setNewPattern] = useState("");

  // Hydrate state from API
  useEffect(() => {
    if (settings) {
      const rootSetting = settings.find(s => s.key === 'allowed_roots');
      const shellSetting = settings.find(s => s.key === 'shell_allowlist');
      if (rootSetting) setRoots(rootSetting.value as string[]);
      if (shellSetting) setShellPatterns(shellSetting.value as string[]);
    }
  }, [settings]);

  const addRoot = () => {
    if (newRoot && !roots.includes(newRoot)) {
      setRoots([...roots, newRoot]);
      setNewRoot("");
    }
  };

  const removeRoot = (root: string) => {
    setRoots(roots.filter(r => r !== root));
  };

  const addPattern = () => {
    if (newPattern && !shellPatterns.includes(newPattern)) {
      setShellPatterns([...shellPatterns, newPattern]);
      setNewPattern("");
    }
  };

  const removePattern = (pattern: string) => {
    setShellPatterns(shellPatterns.filter(p => p !== pattern));
  };

  const handleSave = (key: string, value: any) => {
    updateSetting.mutate({ key, value });
  };

  return (
    <Layout>
      <div className="max-w-3xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Global security configuration for all agents</p>
        </div>

        {/* Safe Mode */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-yellow-500" />
              Safe Mode
            </CardTitle>
            <CardDescription>
              When enabled, all agents operate in read-only mode. Destructive operations (write, delete, move) and shell commands are blocked.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SafeModeToggle showLockdown />
          </CardContent>
        </Card>

        {/* Filesystem Security */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Filesystem Access</CardTitle>
            <CardDescription>
              Define which directories agents are allowed to access. Paths outside these roots will be blocked.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input 
                value={newRoot} 
                onChange={(e) => setNewRoot(e.target.value)} 
                placeholder="/var/www/html"
                className="font-mono bg-background"
              />
              <Button onClick={addRoot} variant="secondary">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-2">
              {roots.map((root) => (
                <div key={root} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border group">
                  <code className="text-sm">{root}</code>
                  <button 
                    onClick={() => removeRoot(root)}
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {roots.length === 0 && (
                <div className="text-sm text-muted-foreground italic p-2">No allowed roots defined. FS access is effectively disabled.</div>
              )}
            </div>

            <Button 
              className="mt-4"
              onClick={() => handleSave('allowed_roots', roots)}
              disabled={updateSetting.isPending}
            >
              <Save className="w-4 h-4 mr-2" /> Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Shell Allowlist */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Shell Command Allowlist</CardTitle>
            <CardDescription>
              Regex patterns for allowed shell commands. Commands not matching these patterns will be rejected.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input 
                value={newPattern} 
                onChange={(e) => setNewPattern(e.target.value)} 
                placeholder="^git status$"
                className="font-mono bg-background"
              />
              <Button onClick={addPattern} variant="secondary">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-2">
              {shellPatterns.map((pattern) => (
                <div key={pattern} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border group">
                  <code className="text-sm text-blue-400">{pattern}</code>
                  <button 
                    onClick={() => removePattern(pattern)}
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <Button 
              className="mt-4"
              onClick={() => handleSave('shell_allowlist', shellPatterns)}
              disabled={updateSetting.isPending}
            >
              <Save className="w-4 h-4 mr-2" /> Save Changes
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
