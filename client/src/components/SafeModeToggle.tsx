import { useSafeMode } from "@/hooks/use-safe-mode";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Lock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SafeModeToggleProps {
  showLockdown?: boolean;
}

export function SafeModeToggle({ showLockdown = false }: SafeModeToggleProps) {
  const { safeMode, toggleSafeMode, triggerLockdown } = useSafeMode();

  return (
    <div className="flex items-center gap-4">
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors",
          safeMode
            ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
            : "bg-muted text-muted-foreground border-border"
        )}
      >
        <ShieldAlert className="w-4 h-4" />
        <span className="text-sm font-medium">Safe Mode</span>
        <Switch
          checked={safeMode}
          onCheckedChange={(checked) => toggleSafeMode.mutate(checked)}
          disabled={toggleSafeMode.isPending}
          data-testid="switch-safe-mode"
        />
      </div>

      {showLockdown && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-red-900/30 text-red-500 hover:bg-red-950/30"
              data-testid="button-lockdown"
            >
              <Lock className="w-4 h-4 mr-2" />
              Emergency Lockdown
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-red-500">
                <AlertTriangle className="w-5 h-5" />
                Emergency Lockdown
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Enable Safe Mode immediately</li>
                  <li>Rotate ALL agent API keys (invalidating existing connections)</li>
                  <li>Log a high-severity audit event</li>
                </ul>
                <br />
                This action cannot be undone. All agents will need new API keys.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => triggerLockdown.mutate()}
                className="bg-red-600 hover:bg-red-700"
                data-testid="button-confirm-lockdown"
              >
                Confirm Lockdown
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
