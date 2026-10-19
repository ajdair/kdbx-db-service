import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, SearchCodeIcon, Trash2Icon, XIcon } from "lucide-react";
import { useSearchParams } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErrorNote } from "@/components/ErrorNote";
import { LinkButton } from "@/components/LinkButton";
import { DataTable } from "@/components/ResultsView";
import {
  describeTable,
  dropTable,
  listTables,
  queryPreview,
  type TableSpec,
} from "@/lib/api";
import { useAppState } from "@/lib/app-state";
import { cn } from "@/lib/utils";
import { CreateTableDialog } from "./CreateTableDialog";

function Schema({ spec }: { spec: TableSpec }) {
  const meta = [
    ["Type", spec.type],
    ["Partition column", spec.prtnCol],
    ["Sort (disk)", spec.sortColsDisk?.join(", ")],
    ["Sort (order)", spec.sortColsOrd?.join(", ")],
    ["Sort (memory)", spec.sortColsMem?.join(", ")],
    ["Primary keys", spec.primaryKeys?.join(", ")],
  ].filter(([, v]) => v);
  return (
    <div className="flex flex-col gap-4">
      {spec.description ? (
        <p className="text-sm text-muted-foreground">{spec.description}</p>
      ) : null}
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {meta.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted-foreground uppercase">{k}</dt>
            <dd className="font-mono">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Column</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Attributes</TableHead>
              <TableHead>Foreign key</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {spec.columns.map((c) => (
              <TableRow key={c.name}>
                <TableCell className="font-mono text-xs">{c.name}</TableCell>
                <TableCell className="font-mono text-xs">{c.type}</TableCell>
                <TableCell className="flex gap-1">
                  {c.attrMem ? (
                    <Badge variant="outline">mem: {c.attrMem}</Badge>
                  ) : null}
                  {c.attrOrd ? (
                    <Badge variant="outline">ord: {c.attrOrd}</Badge>
                  ) : null}
                  {c.attrDisk ? (
                    <Badge variant="outline">disk: {c.attrDisk}</Badge>
                  ) : null}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {c.foreign ?? ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function TablesPage() {
  const { assembly } = useAppState();
  const asm = assembly || undefined;
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const selected = params.get("table") ?? "";
  const select = (t: string) =>
    setParams(t ? { table: t } : {}, { replace: true });

  const [createOpen, setCreateOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [rows, setRows] = useState("20");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);

  const tables = useQuery({
    queryKey: ["tables", assembly],
    queryFn: () => listTables(asm),
    retry: false,
  });
  const current =
    selected && tables.data?.includes(selected)
      ? selected
      : (tables.data?.[0] ?? "");

  const spec = useQuery({
    queryKey: ["table", assembly, current],
    queryFn: () => describeTable(current, asm),
    enabled: !!current,
    retry: false,
  });

  const preview = useMutation({
    mutationFn: () =>
      queryPreview(
        current,
        {
          limit: Math.max(1, Number(rows) || 20),
          ...(from ? { startTS: from } : {}),
          ...(to ? { endTS: to } : {}),
        },
        asm,
      ),
  });

  // a preview belongs to one table, clear it when the selection changes.
  const { reset } = preview;
  useEffect(() => reset(), [current, reset]);

  // Show the result as soon as it arrives
  useEffect(() => {
    if (preview.isSuccess)
      previewRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
  }, [preview.isSuccess, preview.data]);

  const drop = useMutation({
    mutationFn: () => dropTable(current, asm),
    onSuccess: () => {
      setDropOpen(false);
      setConfirmText("");
      select("");
      for (const k of ["tables", "status", "summary", "config"])
        qc.invalidateQueries({ queryKey: [k] });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl">Tables</h1>
      <ErrorNote error={tables.error} title="Could not list tables" />
      <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>
              {tables.data ? `${tables.data.length} tables` : "Tables"}
            </CardTitle>
            <CardAction>
              <Button
                size="xs"
                variant="outline"
                onClick={() => setCreateOpen(true)}
              >
                <PlusIcon /> New
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {tables.isPending ? <Skeleton className="h-24" /> : null}
            {tables.data?.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tables yet. Create one, or ingest data to create it.
              </p>
            ) : null}
            {tables.data?.map((t) => (
              <button
                key={t}
                onClick={() => select(t)}
                className={cn(
                  "rounded-md px-2 py-1.5 text-left font-mono text-sm hover:bg-accent",
                  t === current && "bg-accent font-medium",
                )}
              >
                {t}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="font-mono">
              {current || "Select a table"}
            </CardTitle>
            {current ? (
              <CardAction className="flex flex-wrap justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={preview.isPending}
                  onClick={() => preview.mutate()}
                >
                  {preview.isPending
                    ? "Loading"
                    : `Preview ${Math.max(1, Number(rows) || 20)} rows`}
                </Button>
                <LinkButton to={`/query?table=${encodeURIComponent(current)}`}>
                  <SearchCodeIcon /> Query
                </LinkButton>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setDropOpen(true)}
                >
                  <Trash2Icon /> Drop
                </Button>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {current ? (
              <div className="flex flex-wrap items-end gap-3 text-sm">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="p-rows">Rows</Label>
                  <Input
                    id="p-rows"
                    className="num h-7 w-20"
                    value={rows}
                    onChange={(e) => setRows(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="p-from">From (midnight UTC, optional)</Label>
                  <Input
                    id="p-from"
                    className="h-7 w-48 font-mono"
                    placeholder="2026-03-02T00:00:00"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="p-to">To (exclusive, optional)</Label>
                  <Input
                    id="p-to"
                    className="h-7 w-48 font-mono"
                    placeholder="2026-03-03T00:00:00"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            <div ref={previewRef} className="scroll-mt-4">
              <ErrorNote error={preview.error} title="Preview failed" />
              {preview.data ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm">Preview</h2>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label="Close preview"
                      onClick={() => preview.reset()}
                    >
                      <XIcon />
                    </Button>
                  </div>
                  <DataTable rows={preview.data.payload} />
                </div>
              ) : null}
            </div>

            {spec.isPending && current ? <Skeleton className="h-40" /> : null}
            <ErrorNote error={spec.error} title="Could not describe table" />
            {spec.data ? <Schema spec={spec.data} /> : null}
          </CardContent>
        </Card>
      </div>

      <CreateTableDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={select}
      />

      <Dialog
        open={dropOpen}
        onOpenChange={(o) => {
          setDropOpen(o);
          if (!o) drop.reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Drop {current}?</DialogTitle>
            <DialogDescription>
              This removes the table and all of its data permanently. A table
              that another table points at with a foreign key cannot be dropped
              until that table is dropped first. Type the table name to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            id="drop-confirm"
            className="font-mono"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={current}
          />
          <ErrorNote error={drop.error} title="Table was not dropped" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDropOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== current || drop.isPending}
              onClick={() => drop.mutate()}
            >
              {drop.isPending ? "Dropping" : "Drop permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
