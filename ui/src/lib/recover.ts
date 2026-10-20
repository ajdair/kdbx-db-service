import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Status } from "@/lib/status";

// The status badge polls every 10 seconds. When the service comes back after being down, refresh everything that may have failed or gone stale during the outage
export function useRecoverWhenReady(status: Status) {
  const qc = useQueryClient();
  const wasDown = useRef(false);
  useEffect(() => {
    if (status.label === "Checking") return;
    if (!status.ready) {
      wasDown.current = true;
      return;
    }
    if (wasDown.current) {
      wasDown.current = false;
      for (const key of ["summary", "tables", "table", "config"])
        qc.invalidateQueries({ queryKey: [key] });
    }
  }, [status.ready, status.label, qc]);
}
