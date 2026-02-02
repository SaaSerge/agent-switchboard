import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface SafeModeState {
  enabled: boolean;
}

export function useSafeMode() {
  const queryClient = useQueryClient();

  const { data: safeMode, isLoading } = useQuery<SafeModeState>({
    queryKey: ["/api/admin/safe-mode"],
  });

  const toggleSafeMode = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest("POST", "/api/admin/safe-mode", { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/safe-mode"] });
    },
  });

  const triggerLockdown = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/lockdown");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/safe-mode"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/agents"] });
    },
  });

  return {
    safeMode: safeMode?.enabled ?? false,
    isLoading,
    toggleSafeMode,
    triggerLockdown,
  };
}
