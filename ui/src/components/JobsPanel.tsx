import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  cancelDelete,
  cancelImport,
  getDelete,
  getImport,
  type Job,
} from "@/lib/api";
import { useAppState, type TrackedJob } from "@/lib/app-state";

const FINAL = new Set(["completed", "errored", "canceled"]);

function tone(
  status?: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed") return "default";
  if (status === "errored") return "destructive";
  return "secondary";
}

// partitionIndex is zero based, so the partition being worked on is index + 1 of total.
function progressOf(job?: Job): { done: number; total: number } | null {
  const p = job?.progress;
  if (!p || typeof p.partitionTotal !== "number" || p.partitionTotal <= 0)
    return null;
  const done =
    job?.status === "completed"
      ? p.partitionTotal
      : Math.min(p.partitionIndex ?? 0, p.partitionTotal);
  return { done, total: p.partitionTotal };
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function JobDetails({ job, tracked }: { job: Job; tracked: TrackedJob }) {
  const parts = job.processedPartitions ?? [];
  return (
    <dl className="flex flex-col gap-1 border-t pt-2 text-xs">
      <Detail label="Job id">
        <span className="font-mono">{tracked.id}</span>
      </Detail>
      <Detail label="Started">
        {new Date(tracked.createdAt).toLocaleString()}
      </Detail>
      {job.updated ? (
        <Detail label="Last update">
          {new Date(job.updated).toLocaleString()}
        </Detail>
      ) : null}
      {job.affectedTables?.length ? (
        <Detail label="Tables">{job.affectedTables.join(", ")}</Detail>
      ) : null}
      {parts.length ? (
        <Detail label="Partitions">
          <span className="num">{parts.length}</span>
          <span className="font-mono text-muted-foreground">
            {" "}
            ({parts.slice(0, 4).join(", ")}
            {parts.length > 4 ? ", ..." : ""})
          </span>
        </Detail>
      ) : null}
      {job.progress?.currentTable ? (
        <Detail label="Working on">
          {job.progress.currentTable}
          {job.progress.currentPartition
            ? ` in ${job.progress.currentPartition}`
            : ""}
        </Detail>
      ) : null}
      {job.warnings?.length ? (
        <Detail label="Warnings">
          <ul className="list-disc pl-4">
            {job.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Detail>
      ) : null}
      {job.error ? (
        <Detail label="Error">
          <span className="text-destructive">{job.error}</span>
        </Detail>
      ) : null}
    </dl>
  );
}

// Job ids are tracked in this browser only, since the API cannot list jobs.
export function JobsPanel({
  kind,
  limit,
  title = "Jobs from this browser",
}: {
  kind: TrackedJob["kind"] | "all";
  limit?: number;
  title?: string;
}) {
  const { jobs, forgetJob } = useAppState();
  const qc = useQueryClient();
  const mine = jobs
    .filter((j) => kind === "all" || j.kind === kind)
    .slice(0, limit);

  const results = useQueries({
    queries: mine.map((j) => ({
      queryKey: ["job", j.kind, j.id],
      queryFn: async () => {
        const job = await (j.kind === "import"
          ? getImport(j.id, j.assembly)
          : getDelete(j.id, j.assembly));
        // Finished jobs change what tables hold, so refresh the cached summaries.
        if (FINAL.has(job.status))
          qc.invalidateQueries({ queryKey: ["summary"] });
        return job;
      },
      refetchInterval: (q: { state: { data?: Job } }) =>
        q.state.data && FINAL.has(q.state.data.status) ? false : 1500,
      retry: false,
    })),
  });

  async function cancel(j: TrackedJob) {
    try {
      await (j.kind === "import"
        ? cancelImport(j.id, j.assembly)
        : cancelDelete(j.id, j.assembly));
    } finally {
      qc.invalidateQueries({ queryKey: ["job", j.kind, j.id] });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No jobs yet. The service has no job list, so jobs you start here are
            remembered by id in this browser.
          </p>
        ) : null}
        {mine.map((j, i) => {
          const q = results[i];
          const job = q?.data;
          const final = job ? FINAL.has(job.status) : false;
          const progress = progressOf(job);
          return (
            <details key={j.id} className="group rounded-lg border p-2 text-sm">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 marker:content-none">
                <Badge variant={tone(job?.status)}>
                  {job?.status ?? (q?.isError ? "unknown" : "loading")}
                </Badge>
                {kind === "all" ? (
                  <span className="text-xs text-muted-foreground uppercase">
                    {j.kind}
                  </span>
                ) : null}
                <span className="font-medium">{j.table}</span>
                {progress ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={progress.total}
                      aria-valuenow={progress.done}
                    >
                      <span
                        className="block h-full bg-primary"
                        style={{
                          width: `${(progress.done / progress.total) * 100}%`,
                        }}
                      />
                    </span>
                    <span className="num text-xs text-muted-foreground">
                      {progress.done}/{progress.total} partitions
                    </span>
                  </span>
                ) : null}
                {job?.error ? (
                  <span className="max-w-md truncate text-destructive">
                    {job.error}
                  </span>
                ) : null}
                {q?.isError ? (
                  <span className="text-muted-foreground">
                    Job no longer known to the service.
                  </span>
                ) : null}
                {job?.warnings?.length ? (
                  <span className="text-muted-foreground">
                    {job.warnings.length} warning(s)
                  </span>
                ) : null}
                <span
                  className="ml-auto flex gap-2"
                  onClick={(e) => e.preventDefault()}
                >
                  {!final && !q?.isError ? (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => cancel(j)}
                    >
                      Cancel
                    </Button>
                  ) : null}
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => forgetJob(j.id)}
                  >
                    Forget
                  </Button>
                </span>
              </summary>
              {job ? (
                <div className="mt-2">
                  <JobDetails job={job} tracked={j} />
                </div>
              ) : null}
            </details>
          );
        })}
      </CardContent>
    </Card>
  );
}
