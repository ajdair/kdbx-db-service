import { useQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNote } from "@/components/ErrorNote";
import { exportAssembly } from "@/lib/api";
import { useAppState } from "@/lib/app-state";
import { download } from "@/lib/format";

export function ConfigPage() {
  const { assembly } = useAppState();
  const q = useQuery({
    queryKey: ["config", assembly],
    queryFn: () => exportAssembly(assembly || undefined),
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl">Assembly config</h1>
      <ErrorNote error={q.error} title="Could not export the assembly" />
      <Card>
        <CardHeader>
          <CardTitle>assembly.yaml</CardTitle>
          <CardAction>
            <Button
              size="sm"
              variant="outline"
              disabled={!q.data}
              onClick={() =>
                q.data && download("assembly.yaml", q.data, "application/yaml")
              }
            >
              <DownloadIcon /> Download
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {q.isPending ? <Skeleton className="h-48" /> : null}
          {q.data ? (
            <pre className="max-h-[32rem] overflow-auto rounded-lg border bg-muted p-3 font-mono text-xs">
              {q.data}
            </pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
