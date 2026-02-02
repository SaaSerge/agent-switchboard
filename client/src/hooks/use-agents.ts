import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useAgents() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: agents, isLoading } = useQuery({
    queryKey: [api.agents.list.path],
    queryFn: async () => {
      const res = await fetch(api.agents.list.path);
      if (!res.ok) throw new Error("Failed to fetch agents");
      return api.agents.list.responses[200].parse(await res.json());
    },
  });

  const createAgent = useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await fetch(api.agents.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        if (res.status === 409) throw new Error("Agent name already exists");
        throw new Error("Failed to create agent");
      }
      return api.agents.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.agents.list.path] });
      toast({ title: "Agent Created", description: "New agent successfully registered." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const rotateKey = useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.agents.rotateKey.path, { id });
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) throw new Error("Failed to rotate key");
      return api.agents.rotateKey.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      toast({ title: "API Key Rotated", description: "The old key is now invalid." });
    }
  });

  const toggleCapability = useMutation({
    mutationFn: async ({ id, type, enabled, config }: { id: number; type: string; enabled: boolean; config?: any }) => {
      const url = buildUrl(api.agents.toggleCapability.path, { id, type });
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, config }),
      });
      if (!res.ok) throw new Error("Failed to update capability");
      return api.agents.toggleCapability.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.agents.list.path] });
      toast({ title: "Capability Updated" });
    }
  });

  return { agents, isLoading, createAgent, rotateKey, toggleCapability };
}
