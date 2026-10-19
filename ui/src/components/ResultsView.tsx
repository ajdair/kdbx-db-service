import { useMemo, useState } from "react";
import { CheckIcon, CopyIcon, DownloadIcon } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Row } from "@/lib/api";
import { cell, columnsOf, download, toCsv } from "@/lib/format";

const SHOWN_ROWS = 500;

export function DataTable({
  rows,
  max = SHOWN_ROWS,
}: {
  rows: Row[];
  max?: number;
}) {
  const cols = useMemo(() => columnsOf(rows), [rows]);
  if (!rows.length)
    return <p className="text-sm text-muted-foreground">No rows returned.</p>;
  return (
    <div className="max-h-[28rem] overflow-auto rounded-lg border">
      <Table>
        <TableHeader className="sticky top-0 bg-card">
          <TableRow>
            {cols.map((c) => (
              <TableHead key={c} className="whitespace-nowrap">
                {c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, max).map((row, i) => (
            <TableRow key={i}>
              {cols.map((c) => (
                <TableCell
                  key={c}
                  className="num whitespace-nowrap font-mono text-xs"
                >
                  {cell(row[c])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function numeric(rows: Row[], col: string): boolean {
  const sample = rows
    .slice(0, 20)
    .map((r) => r[col])
    .filter((v) => v !== null && v !== undefined);
  return sample.length > 0 && sample.every((v) => typeof v === "number");
}

function ResultChart({ rows }: { rows: Row[] }) {
  const cols = useMemo(() => columnsOf(rows), [rows]);
  const ys = useMemo(() => cols.filter((c) => numeric(rows, c)), [rows, cols]);
  const [x, setX] = useState(cols[0] ?? "");
  const [y, setY] = useState(ys[0] ?? "");
  const yKey = ys.includes(y) ? y : (ys[0] ?? "");
  if (!ys.length)
    return (
      <p className="text-sm text-muted-foreground">
        No numeric column to chart.
      </p>
    );

  const config: ChartConfig = {
    [yKey]: { label: yKey, color: "var(--chart-1)" },
  };
  const data = rows.slice(0, 2000);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted-foreground">X</span>
        <Select value={x} onValueChange={(v) => setX(v ?? "")}>
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {cols.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">Y</span>
        <Select value={yKey} onValueChange={(v) => setY(v ?? "")}>
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ys.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ChartContainer config={config} className="h-72 w-full">
        <LineChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey={x}
            tickLine={false}
            axisLine={false}
            minTickGap={32}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={64}
            domain={["auto", "auto"]}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            dataKey={yKey}
            type="linear"
            stroke={`var(--color-${yKey})`}
            strokeWidth={2}
            dot={data.length <= 60}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}

// The response header carries ids and node names that help when asking for support.
function QueryInfo({ header }: { header: Record<string, unknown> }) {
  const [copied, setCopied] = useState(false);
  const corr = typeof header.corr === "string" ? header.corr : "";
  const rows: [string, unknown][] = [
    ["Correlation id", corr],
    ["API", header.api],
    ["Received", header.rcvTS],
    ["Gateway node", header.gwNode],
    ["Route controller", header.rcNode],
    ["Aggregator", header.aggNode],
    ["Return code", header.rc],
  ];
  async function copy() {
    try {
      await navigator.clipboard.writeText(corr);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: the id is still selectable text */
    }
  }
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none">Query info</summary>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {rows
          .filter(([, v]) => v !== undefined && v !== "")
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt>{k}</dt>
              <dd className="flex items-center gap-2 font-mono text-foreground">
                {String(v)}
                {k === "Correlation id" && corr ? (
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Copy correlation id"
                    onClick={copy}
                  >
                    {copied ? <CheckIcon /> : <CopyIcon />}
                  </Button>
                ) : null}
              </dd>
            </div>
          ))}
      </dl>
    </details>
  );
}

export function ResultsView({
  rows,
  header,
  name,
}: {
  rows: Row[];
  header?: Record<string, unknown>;
  name: string;
}) {
  const truncated = rows.length > SHOWN_ROWS;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="num">
          {rows.length.toLocaleString()} row{rows.length === 1 ? "" : "s"}
          {truncated ? `, showing the first ${SHOWN_ROWS}` : ""}
          {header?.limitApplied ? ", server limit applied" : ""}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={!rows.length}
          onClick={() => download(`${name}.csv`, toCsv(rows), "text/csv")}
        >
          <DownloadIcon /> CSV
        </Button>
      </div>
      {header ? <QueryInfo header={header} /> : null}
      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="chart">Chart</TabsTrigger>
        </TabsList>
        <TabsContent value="table">
          <DataTable rows={rows} />
        </TabsContent>
        <TabsContent value="chart">
          <ResultChart rows={rows} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
