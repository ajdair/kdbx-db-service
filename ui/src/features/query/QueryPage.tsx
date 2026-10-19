import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { PlayIcon, TriangleAlertIcon } from "lucide-react";
import { useSearchParams } from "react-router";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNote } from "@/components/ErrorNote";
import { ResultsView } from "@/components/ResultsView";
import {
  listTables,
  queryQ,
  querySimple,
  querySql,
  type QueryResult,
} from "@/lib/api";
import { useAppState } from "@/lib/app-state";
import { isoMidnight, qTimestamp, splitList } from "@/lib/format";
import { latestWindow, useTableSummary } from "@/lib/summary";

const AGG_FNS = [
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "first",
  "last",
  "dev",
  "var",
  "distinct",
];

function Field({
  label,
  children,
  grow,
}: {
  label: string;
  children: React.ReactNode;
  grow?: boolean;
}) {
  return (
    <div
      className={
        grow ? "flex min-w-48 flex-1 flex-col gap-1.5" : "flex flex-col gap-1.5"
      }
    >
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function parseFilter(text: string): unknown[] | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const v = JSON.parse(t);
  if (!Array.isArray(v))
    throw new Error(
      'Filter must be a JSON array, for example [["=","sym","EURUSD"]]',
    );
  return v;
}

// "out,fn,col" per line -> [out, fn, col]; a bare "col" selects the column.
function parseAgg(text: string): unknown[] | undefined {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return undefined;
  return lines.map((l) => {
    const p = l.split(",").map((s) => s.trim());
    return p.length === 1 ? p[0] : p;
  });
}

const TIMEZONES: string[] =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : [];

// key=value per line -> {key: value}
function parseLabels(text: string): Record<string, string> | undefined {
  const pairs = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split("=").map((x) => x.trim()));
  if (!pairs.length) return undefined;
  if (pairs.some((p) => p.length !== 2 || !p[0] || !p[1]))
    throw new Error("Labels must be one key=value pair per line.");
  return Object.fromEntries(pairs);
}

interface TabProps {
  table: string;
  tables: string[];
  onTable: (t: string) => void;
  onResult: (r: QueryResult) => void;
  onError: (e: unknown) => void;
}

function TablePicker({
  table,
  tables,
  onTable,
}: Pick<TabProps, "table" | "tables" | "onTable">) {
  return (
    <Field label="Table">
      <Select value={table} onValueChange={(v) => onTable(v ?? "")}>
        <SelectTrigger className="min-w-44">
          <SelectValue placeholder="Select a table" />
        </SelectTrigger>
        <SelectContent>
          {tables.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function BuilderTab({ table, tables, onTable, onResult, onError }: TabProps) {
  const { assembly } = useAppState();
  const summary = useTableSummary(table);
  const win = latestWindow(summary.data);
  // null means "not edited", so the window follows the table's latest day of data.
  const [startEdit, setStart] = useState<string | null>(null);
  const [endEdit, setEnd] = useState<string | null>(null);
  const start = startEdit ?? win?.start ?? isoMidnight(-1);
  const end = endEdit ?? win?.end ?? isoMidnight(0);
  const [limit, setLimit] = useState("1000");
  const [groupBy, setGroupBy] = useState("");
  const [agg, setAgg] = useState("");
  const [filter, setFilter] = useState("");
  const [fill, setFill] = useState("none");
  const [temporality, setTemporality] = useState("snapshot");
  const [sortCols, setSortCols] = useState("");
  const [inputTZ, setInputTZ] = useState("");
  const [outputTZ, setOutputTZ] = useState("");
  const [outputTZCols, setOutputTZCols] = useState("");
  const [labels, setLabels] = useState("");

  const run = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        table,
        startTS: start,
        endTS: end,
      };
      const gb = splitList(groupBy);
      if (gb.length) body.groupBy = gb;
      const a = parseAgg(agg);
      if (a) body.agg = a;
      const f = parseFilter(filter);
      if (f) body.filter = f;
      const n = Number(limit);
      // A plain integer works; the one-element array form [n] silently returns zero rows.
      if (n > 0) body.limit = n;
      if (fill !== "none") body.fill = fill;
      if (temporality !== "snapshot") body.temporality = temporality;
      const sc = splitList(sortCols);
      if (sc.length) body.sortCols = sc;
      if (inputTZ.trim()) body.inputTZ = inputTZ.trim();
      if (outputTZ.trim()) body.outputTZ = outputTZ.trim();
      // TODO: (check) The spec shows a nested list, but the service takes a flat list of column names.
      const tzCols = splitList(outputTZCols);
      if (tzCols.length) body.outputTZCols = tzCols;
      const l = parseLabels(labels);
      if (l) body.labels = l;
      return querySimple(body, assembly || undefined);
    },
    onSuccess: onResult,
    onError,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <TablePicker
          table={table}
          tables={tables}
          onTable={(t) => {
            setStart(null);
            setEnd(null);
            onTable(t);
          }}
        />
        <Field label={`Start (inclusive, ${inputTZ.trim() || "UTC"})`}>
          <Input
            id="q-start"
            className="w-56 font-mono"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <Field label={`End (exclusive, ${inputTZ.trim() || "UTC"})`}>
          <Input
            id="q-end"
            className="w-56 font-mono"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </Field>
        <Field label="Row limit">
          <Input
            id="q-limit"
            className="num w-24"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </Field>
      </div>
      {win && startEdit === null ? (
        <p className="text-xs text-muted-foreground">
          Defaulted to the latest day with data in {table}. Edit the dates to
          change it.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Field label="Group by (comma separated)" grow>
          <Input
            id="q-groupby"
            className="font-mono"
            placeholder="sym"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
          />
        </Field>
        <Field
          label={`Aggregations, one per line as out,fn,col (${AGG_FNS.slice(0, 5).join(", ")}, ...)`}
          grow
        >
          <Textarea
            id="q-agg"
            className="font-mono text-xs"
            rows={3}
            placeholder={"n,count,sym\navg_bid,avg,bid"}
            value={agg}
            onChange={(e) => setAgg(e.target.value)}
          />
        </Field>
        <Field label="Filter (JSON)" grow>
          <Textarea
            id="q-filter"
            className="font-mono text-xs"
            rows={3}
            placeholder={'[["=","sym","EURUSD"]]'}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        Filters are [operator, column, value] triples. Operators: = &lt;&gt;
        &lt; &gt; &lt;= &gt;= in like within. Nest with and, or, not inside the
        list, for example [["or", ["=","sym","EURUSD"], ["=","sym","USDJPY"]]].
      </p>

      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm select-none">
          More options
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <Field label="Fill nulls">
              <Select value={fill} onValueChange={(v) => setFill(v ?? "none")}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">none</SelectItem>
                  <SelectItem value="forward">forward</SelectItem>
                  <SelectItem value="zero">zero</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Temporality">
              <Select
                value={temporality}
                onValueChange={(v) => setTemporality(v ?? "snapshot")}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="snapshot">snapshot</SelectItem>
                  <SelectItem value="slice">slice</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Sort by (comma separated, after the query)">
              <Input
                id="q-sort"
                className="w-56 font-mono"
                placeholder="bid"
                value={sortCols}
                onChange={(e) => setSortCols(e.target.value)}
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            Snapshot returns one block from start to end. Slice returns the same
            time of day for each date in the range.
          </p>
          <div className="flex flex-wrap gap-3">
            <Field label="Input timezone (for start and end)">
              <Input
                id="q-intz"
                className="w-52"
                list="tz-list"
                placeholder="UTC"
                value={inputTZ}
                onChange={(e) => setInputTZ(e.target.value)}
              />
            </Field>
            <Field label="Output timezone">
              <Input
                id="q-outtz"
                className="w-52"
                list="tz-list"
                placeholder="UTC"
                value={outputTZ}
                onChange={(e) => setOutputTZ(e.target.value)}
              />
            </Field>
            <Field label="Columns to convert (comma separated)">
              <Input
                id="q-outtzcols"
                className="w-56 font-mono"
                placeholder="ts"
                value={outputTZCols}
                onChange={(e) => setOutputTZCols(e.target.value)}
              />
            </Field>
            <datalist id="tz-list">
              {TIMEZONES.map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </div>
          <Field label="Labels (one key=value per line; targets every assembly with these labels)">
            <Textarea
              id="q-labels"
              className="font-mono text-xs"
              rows={2}
              placeholder="assetClass=fx"
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
            />
          </Field>
        </div>
      </details>

      <div>
        <Button disabled={!table || run.isPending} onClick={() => run.mutate()}>
          <PlayIcon /> {run.isPending ? "Running" : "Run query"}
        </Button>
      </div>
    </div>
  );
}

// Examples are built from the chosen table and the latest day of data, so they return rows on any deployment.
function example(
  kind: "sql" | "q",
  table: string,
  prtnCol: string | undefined,
  win: { start: string; end: string } | null,
): string {
  if (!table) return "";
  if (kind === "sql") {
    return prtnCol && win
      ? `SELECT count(*) AS n\nFROM ${table}\nWHERE ${prtnCol} >= TIMESTAMP '${win.start}' AND ${prtnCol} < TIMESTAMP '${win.end}'`
      : `SELECT count(*) AS n\nFROM ${table}`;
  }
  // limit takes a plain integer here. "limit:enlist 100" returns no rows.
  return prtnCol && win
    ? `.kxi.selectTable[([table:\`${table};startTS:${qTimestamp(win.start)};endTS:${qTimestamp(win.end)};limit:100])]`
    : `.kxi.selectTable[([table:\`${table};limit:100])]`;
}

function CodeTab({
  kind,
  table,
  tables,
  onTable,
  onResult,
  onError,
}: TabProps & { kind: "sql" | "q" }) {
  const { assembly, theme } = useAppState();
  const summary = useTableSummary(table);
  const suggested = example(
    kind,
    table,
    summary.data?.prtnCol,
    latestWindow(summary.data),
  );
  // null means "not edited", so the example follows the chosen table until you type.
  const [edited, setEdited] = useState<string | null>(null);
  const code = edited ?? suggested;
  const [agg, setAgg] = useState("");

  const run = useMutation({
    mutationFn: () =>
      kind === "sql"
        ? querySql(code, assembly || undefined)
        : queryQ(code, agg.trim() || undefined, assembly || undefined),
    onSuccess: onResult,
    onError,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <TablePicker
          table={table}
          tables={tables}
          onTable={(t) => {
            setEdited(null);
            onTable(t);
          }}
        />
        {edited !== null && edited !== suggested ? (
          <Button size="sm" variant="outline" onClick={() => setEdited(null)}>
            Reset to example
          </Button>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-lg border">
        <CodeMirror
          value={code}
          height="11rem"
          theme={theme}
          extensions={kind === "sql" ? [sql()] : []}
          onChange={setEdited}
          basicSetup={{ lineNumbers: true, foldGutter: false }}
        />
      </div>
      {kind === "q" ? (
        <>
          <Field label="Merge lambda across tiers (optional)">
            <Input
              id="q-agg-lambda"
              className="font-mono"
              placeholder="{distinct raze x}"
              value={agg}
              onChange={(e) => setAgg(e.target.value)}
            />
          </Field>
          <Alert>
            <TriangleAlertIcon />
            <AlertDescription>
              This runs arbitrary q on the gateway with no authentication. The
              gateway runs your query on each tier (memory, intraday,
              historical) and joins the results, so a plain aggregate such as
              select count i returns one row per tier unless you pass a merge
              lambda. .kxi.selectTable merges for you. Bound the time range.
            </AlertDescription>
          </Alert>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          SELECT only. Use SQL literals such as TIMESTAMP '2026-03-02T00:00:00'.
        </p>
      )}
      <div>
        <Button
          disabled={!code.trim() || run.isPending}
          onClick={() => run.mutate()}
        >
          <PlayIcon /> {run.isPending ? "Running" : "Run query"}
        </Button>
      </div>
    </div>
  );
}

export function QueryPage() {
  const { assembly } = useAppState();
  const [params, setParams] = useSearchParams();
  const tables = useQuery({
    queryKey: ["tables", assembly],
    queryFn: () => listTables(assembly || undefined),
    retry: false,
  });
  const wanted = params.get("table") ?? "";
  const table =
    wanted && tables.data?.includes(wanted) ? wanted : (tables.data?.[0] ?? "");
  const onTable = (t: string) =>
    setParams(t ? { table: t } : {}, { replace: true });
  const shared = { table, tables: tables.data ?? [], onTable };
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState("builder");

  const onResult = (r: QueryResult) => {
    setError(null);
    setResult(r);
  };
  const onError = (e: unknown) => {
    setResult(null);
    setError(e);
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl">Query</h1>
      <Alert>
        <TriangleAlertIcon />
        <AlertDescription>
          Always bound the time range and the row count. A large unaggregated
          result can kill the aggregator (kx-db-agg), and every later query then
          fails until it is restarted. Push aggregations down with group by and
          aggregations.
        </AlertDescription>
      </Alert>
      <Card>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="builder">Builder</TabsTrigger>
              <TabsTrigger value="sql">SQL</TabsTrigger>
              <TabsTrigger value="q">q</TabsTrigger>
            </TabsList>
            <TabsContent value="builder" className="pt-3">
              <BuilderTab {...shared} onResult={onResult} onError={onError} />
            </TabsContent>
            <TabsContent value="sql" className="pt-3">
              <CodeTab
                kind="sql"
                {...shared}
                onResult={onResult}
                onError={onError}
              />
            </TabsContent>
            <TabsContent value="q" className="pt-3">
              <CodeTab
                kind="q"
                {...shared}
                onResult={onResult}
                onError={onError}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <ErrorNote error={error} title="Query failed" />
      {result ? (
        <Card>
          <CardContent>
            <ResultsView
              rows={result.payload}
              header={result.header}
              name={`query-${tab}`}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
