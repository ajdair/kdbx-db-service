import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { HelpTip } from "@/components/HelpTip";
import { FILTER_HELP } from "@/lib/help";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNote } from "@/components/ErrorNote";
import { JobsPanel } from "@/components/JobsPanel";
import { deleteRows, describeTable, listTables, querySimple } from "@/lib/api";
import { useAppState } from "@/lib/app-state";
import { isoMidnight } from "@/lib/format";
import { latestWindow, useTableSummary } from "@/lib/summary";

function Field({
  label,
  children,
  help,
}: {
  label: string;
  children: React.ReactNode;
  help?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}
        {help ? <HelpTip>{help}</HelpTip> : null}
      </Label>
      {children}
    </div>
  );
}

function parseFilter(text: string): unknown[] {
  const v = JSON.parse(text.trim() || "[]");
  if (!Array.isArray(v))
    throw new Error(
      'Filter must be a JSON array, for example [["=","sym","EURUSD"]]',
    );
  return v;
}

export function DeletePage() {
  const { assembly, trackJob } = useAppState();
  const asm = assembly || undefined;
  const tables = useQuery({
    queryKey: ["tables", assembly],
    queryFn: () => listTables(asm),
  });
  const [table, setTable] = useState("");
  // null means "not edited", so the window follows the table's latest day of data
  const [startEdit, setStart] = useState<string | null>(null);
  const [endEdit, setEnd] = useState<string | null>(null);
  const [filter, setFilter] = useState("[]");
  const [confirmText, setConfirmText] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [count, setCount] = useState<number | null>(null);

  const chosen = table || tables.data?.[0] || "";
  const win = latestWindow(useTableSummary(chosen).data);
  const start = startEdit ?? win?.start ?? isoMidnight(-1);
  const end = endEdit ?? win?.end ?? isoMidnight(0);

  // Delete requires a window and a filter. The count is a bounded structured query on the first column.
  const countRows = useMutation({
    mutationFn: async () => {
      const spec = await describeTable(chosen, asm);
      const col = spec.columns[0]?.name;
      if (!col) throw new Error("Table has no columns.");
      const f = parseFilter(filter);
      const res = await querySimple(
        {
          table: chosen,
          startTS: start,
          endTS: end,
          agg: [["n", "count", col]],
          ...(f.length ? { filter: f } : {}),
        },
        asm,
      );
      return Number(res.payload[0]?.n ?? 0);
    },
    onSuccess: (n) => {
      setError(null);
      setCount(n);
    },
    onError: (e) => {
      setCount(null);
      setError(e);
    },
  });

  const del = useMutation({
    mutationFn: () =>
      deleteRows(
        {
          table: chosen,
          startTS: start,
          endTS: end,
          filter: parseFilter(filter),
        },
        asm,
      ),
    onSuccess: (job) => {
      setError(null);
      setOpen(false);
      setConfirmText("");
      setCount(null);
      if (job?.jobId)
        trackJob({
          id: job.jobId,
          kind: "delete",
          table: chosen,
          createdAt: new Date().toISOString(),
          assembly: asm,
        });
    },
    onError: (e) => {
      setOpen(false);
      setError(e);
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl">Delete rows</h1>
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertDescription>
          Deletion is permanent and cannot be rolled back. An empty filter deletes every row in the window. The service rejects
          windows that overlap an object-storage tier. Be sure to count the affected rows first.
        </AlertDescription>
      </Alert>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <Field label="Table">
              <Select
                value={chosen}
                onValueChange={(v) => {
                  setTable(v ?? "");
                  setStart(null);
                  setEnd(null);
                  setCount(null);
                }}
              >
                <SelectTrigger className="min-w-44">
                  <SelectValue placeholder="Select a table" />
                </SelectTrigger>
                <SelectContent>
                  {tables.data?.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Start (inclusive, UTC)">
              <Input
                id="x-start"
                className="w-56 font-mono"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  setCount(null);
                }}
              />
            </Field>
            <Field label="End (exclusive, UTC)">
              <Input
                id="x-end"
                className="w-56 font-mono"
                value={end}
                onChange={(e) => {
                  setEnd(e.target.value);
                  setCount(null);
                }}
              />
            </Field>
          </div>
          <Field
            label="Filter (JSON, required; [] matches every row in the window)"
            help={FILTER_HELP}
          >
            <Textarea
              id="x-filter"
              className="font-mono text-xs"
              rows={3}
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setCount(null);
              }}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              disabled={!chosen || countRows.isPending}
              onClick={() => countRows.mutate()}
            >
              {countRows.isPending ? "Counting" : "Count matching rows"}
            </Button>
            {count !== null ? (
              <span className="num text-sm">
                {count.toLocaleString()} rows match
              </span>
            ) : null}
            <Button
              variant="destructive"
              disabled={!chosen || count === null}
              onClick={() => setOpen(true)}
            >
              Delete these rows
            </Button>
          </div>
        </CardContent>
      </Card>

      <ErrorNote error={error} title="Delete failed" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {count?.toLocaleString()} rows from {chosen}?
            </DialogTitle>
            <DialogDescription>
              Window {start} to {end}, filter {filter.trim() || "[]"}. This
              cannot be undone. Type the table name to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            id="x-confirm"
            className="font-mono"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={chosen}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== chosen || del.isPending}
              onClick={() => del.mutate()}
            >
              {del.isPending ? "Deleting" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <JobsPanel kind="delete" />
    </div>
  );
}
