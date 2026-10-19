import { useQuery } from "@tanstack/react-query";
import { ApiError, listTables } from "@/lib/api";
import { useAppState } from "@/lib/app-state";

export interface Status {
  label: string;
  variant: "default" | "secondary" | "destructive";
  ready: boolean;
}

// a successful table list means the service is ready
export function useStatus(): Status {
  const { assembly } = useAppState();
  const q = useQuery({
    queryKey: ["status", assembly],
    queryFn: () => listTables(assembly || undefined),
    refetchInterval: 10_000,
    retry: false,
  });
  if (q.isPending)
    return { label: "Checking", variant: "secondary", ready: false };
  if (!q.isError) return { label: "Ready", variant: "default", ready: true };
  const e = q.error;
  if (e instanceof ApiError && /assembly/i.test(e.message))
    return { label: "Assembly needed", variant: "secondary", ready: false };
  if (e instanceof ApiError && /not licensed/i.test(e.message))
    return { label: "Not licensed", variant: "destructive", ready: false };
  if (e instanceof ApiError && e.status === 503)
    return { label: "Starting", variant: "secondary", ready: false };
  return { label: "Unreachable", variant: "destructive", ready: false };
}
