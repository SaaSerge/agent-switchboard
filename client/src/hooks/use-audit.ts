import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useAudit() {
  const { data: logs, isLoading } = useQuery({
    queryKey: [api.audit.list.path],
    queryFn: async () => {
      const res = await fetch(api.audit.list.path);
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return api.audit.list.responses[200].parse(await res.json());
    },
  });

  return { logs, isLoading };
}
