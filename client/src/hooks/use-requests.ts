import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useRequests(status?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: requests, isLoading } = useQuery({
    queryKey: [api.requests.list.path, status],
    queryFn: async () => {
      const url = status 
        ? `${api.requests.list.path}?status=${status}` 
        : api.requests.list.path;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch requests");
      return api.requests.list.responses[200].parse(await res.json());
    },
  });

  return { requests, isLoading };
}

export function useRequestDetail(id: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: request, isLoading } = useQuery({
    queryKey: [api.requests.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.requests.get.path, { id });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch request details");
      return api.requests.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });

  const approvePlan = useMutation({
    mutationFn: async ({ planId, decision }: { planId: number; decision: 'approved' | 'rejected' }) => {
      const url = buildUrl(api.plans.approve.path, { id: planId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error("Failed to submit decision");
      return api.plans.approve.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.requests.get.path, id] });
      queryClient.invalidateQueries({ queryKey: [api.requests.list.path] });
      toast({ title: "Decision Submitted", description: "The plan status has been updated." });
    }
  });

  return { request, isLoading, approvePlan };
}
