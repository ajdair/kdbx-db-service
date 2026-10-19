import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRightIcon,
  BookOpenIcon,
  DatabaseIcon,
  FileCogIcon,
  RefreshCwIcon,
  SearchCodeIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNote } from "@/components/ErrorNote";
import { JobsPanel } from "@/components/JobsPanel";
import { LinkButton } from "@/components/LinkButton";
import { listTables } from "@/lib/api";
import { useAppState } from "@/lib/app-state";
import { useAssemblySummary } from "@/lib/assembly-config";
import { ago } from "@/lib/format";
import { useStatus } from "@/lib/status";
import { useTableSummaries, type TableSummary } from "@/lib/summary";

// Summaries run one small query per table - cap how many load automatically.
const AUTO_LIMIT = 24;

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground uppercase">{label}</span>
        <span className="num text-2xl font-semibold">{value}</span>
        {hint ? (
          <span className="text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}

function dateOnly(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

function utcMinute(d: Date): string {
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function TableCard({ s }: { s: TableSummary }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="font-mono">{s.name}</CardTitle>
        <CardAction>
          <Badge variant="outline">{s.type ?? "table"}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Rows</dt>
          <dd className="num text-right">{s.rows.toLocaleString()}</dd>
          <dt className="text-muted-foreground">Columns</dt>
          <dd className="num text-right">{s.columns}</dd>
          {s.first && s.last ? (
            <>
              <dt className="text-muted-foreground">Range</dt>
              <dd className="num text-right">
                {dateOnly(s.first)} to {dateOnly(s.last)}
              </dd>
              <dt className="text-muted-foreground">Latest data</dt>
              <dd className="text-right" title={utcMinute(s.last)}>
                {ago(s.last)}
              </dd>
            </>
          ) : null}
        </dl>
        <div className="flex gap-2">
          <LinkButton to={`/tables?table=${encodeURIComponent(s.name)}`}>
            Schema
          </LinkButton>
          <LinkButton to={`/query?table=${encodeURIComponent(s.name)}`}>
            Query
          </LinkButton>
        </div>
      </CardContent>
    </Card>
  );
}

function Tiers() {
  const config = useAssemblySummary();
  const tiers = config.data?.tiers ?? [];
  if (!tiers.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage tiers</CardTitle>
        <CardDescription>
          How data moves through the database, from newest to oldest. From the
          assembly config.
        </CardDescription>
        <CardAction>
          <LinkButton to="/config">Config</LinkButton>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-3 md:flex-row md:items-stretch">
          {tiers.map((t, i) => (
            <li key={t.name + i} className="flex items-center gap-3 md:flex-1">
              <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg border p-3 text-sm">
                <span className="font-medium uppercase">{t.name}</span>
                <span className="text-xs text-muted-foreground">
                  {[t.kind, t.partition ? `${t.partition} partitions` : null]
                    .filter(Boolean)
                    .join(", ") || "in memory"}
                </span>
                {t.location ? (
                  <span className="truncate font-mono text-xs">
                    {t.location}
                  </span>
                ) : null}
                {t.schedule ? (
                  <span className="text-xs">Moves on: {t.schedule}</span>
                ) : null}
                {t.retain ? (
                  <span className="text-xs">Keeps: {t.retain}</span>
                ) : null}
              </div>
              {i < tiers.length - 1 ? (
                <ArrowRightIcon className="size-4 shrink-0 rotate-90 text-muted-foreground md:rotate-0" />
              ) : null}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

const SECTIONS = [
  {
    to: "/tables",
    label: "Tables",
    icon: DatabaseIcon,
    text: "Browse schemas, preview rows, create or drop tables.",
  },
  {
    to: "/query",
    label: "Query",
    icon: SearchCodeIcon,
    text: "Structured builder, SQL, and q, with a chart and CSV export.",
  },
  {
    to: "/ingest",
    label: "Ingest",
    icon: UploadIcon,
    text: "Import files, inline rows, or a kdb database, and follow the job.",
  },
  {
    to: "/delete",
    label: "Delete",
    icon: Trash2Icon,
    text: "Count matching rows, then delete them with a typed confirmation.",
  },
  {
    to: "/config",
    label: "Config",
    icon: FileCogIcon,
    text: "View and download the assembly YAML.",
  },
  {
    to: "/resources",
    label: "Resources",
    icon: BookOpenIcon,
    text: "Open API Spec, how to install the official skill, and documentation.",
  },
];

export function HomePage() {
  const { assembly } = useAppState();
  const status = useStatus();
  const config = useAssemblySummary();
  const tables = useQuery({
    queryKey: ["tables", assembly],
    queryFn: () => listTables(assembly || undefined),
    retry: false,
  });
  const [all, setAll] = useState(false);

  const names = tables.data ?? [];
  const shown = all ? names : names.slice(0, AUTO_LIMIT);
  const summaries = useTableSummaries(shown);
  const loaded = summaries.flatMap((q) => (q.data ? [q.data] : []));
  const pending = summaries.some((q) => q.isPending);
  const failed = summaries.filter((q) => q.isError).length;

  const totalRows = loaded.reduce((n, s) => n + s.rows, 0);
  const firsts = loaded.flatMap((s) => (s.first ? [s.first.getTime()] : []));
  const lasts = loaded.flatMap((s) => (s.last ? [s.last.getTime()] : []));
  const earliest = firsts.length ? new Date(Math.min(...firsts)) : null;
  const latest = lasts.length ? new Date(Math.max(...lasts)) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl">Overview</h1>
        <Badge variant={status.variant}>{status.label}</Badge>
        {config.data?.name ? (
          <Badge variant="outline">assembly: {config.data.name}</Badge>
        ) : null}
        {Object.entries(config.data?.labels ?? {}).map(([k, v]) => (
          <Badge key={k} variant="outline">
            {k}: {v}
          </Badge>
        ))}
        <Button
          className="ml-auto"
          size="sm"
          variant="outline"
          onClick={() => {
            summaries.forEach((q) => q.refetch());
            tables.refetch();
          }}
        >
          <RefreshCwIcon /> Refresh
        </Button>
      </div>

      <ErrorNote error={tables.error} title="Could not list tables" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Tables"
          value={
            tables.isPending ? <Skeleton className="h-8 w-12" /> : names.length
          }
        />
        <Tile
          label="Total rows"
          value={
            pending && !loaded.length ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              totalRows.toLocaleString()
            )
          }
          hint={
            pending
              ? "Counting"
              : failed
                ? `${failed} table(s) could not be counted`
                : undefined
          }
        />
        <Tile
          label="Data range"
          value={
            earliest && latest ? (
              <span className="flex flex-col text-base leading-tight">
                <span>{dateOnly(earliest)}</span>
                <span className="text-muted-foreground">
                  to {dateOnly(latest)}
                </span>
              </span>
            ) : pending ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              "None"
            )
          }
          hint="Partitioned tables, UTC"
        />
        <Tile
          label="Latest data"
          value={
            latest ? (
              <span className="text-base">{ago(latest)}</span>
            ) : pending ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              "None"
            )
          }
          hint={latest ? utcMinute(latest) : undefined}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm">Tables</h2>
        {tables.data?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 text-sm">
              No tables yet.
              <LinkButton to="/ingest">Import data</LinkButton>
              <LinkButton to="/tables">Create a table</LinkButton>
            </CardContent>
          </Card>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((n, i) => {
            const q = summaries[i];
            if (q?.data) return <TableCard key={n} s={q.data} />;
            return (
              <Card key={n} size="sm">
                <CardHeader>
                  <CardTitle className="font-mono">{n}</CardTitle>
                </CardHeader>
                <CardContent>
                  {q?.isError ? (
                    <p className="text-sm text-destructive">
                      {q.error instanceof Error
                        ? q.error.message
                        : "Could not summarise"}
                    </p>
                  ) : (
                    <Skeleton className="h-20" />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        {!all && names.length > AUTO_LIMIT ? (
          <div>
            <Button variant="outline" size="sm" onClick={() => setAll(true)}>
              Summarise all {names.length} tables
            </Button>
          </div>
        ) : null}
      </section>

      <Tiers />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm">Recent activity</h2>
        <JobsPanel kind="all" limit={5} title="Latest jobs from this browser" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm">Go to</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SECTIONS.map(({ to, label, icon: Icon, text }) => (
            <Link
              key={to}
              to={to}
              className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card
                size="sm"
                className="h-full transition-colors group-hover:bg-muted"
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="size-4" /> {label}
                  </CardTitle>
                  <CardDescription>{text}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
