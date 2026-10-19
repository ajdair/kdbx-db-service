import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { ErrorNote } from "@/components/ErrorNote";
import { createTable, type CreateTableBody, type TableColumn } from "@/lib/api";
import { useAppState } from "@/lib/app-state";
import { splitList } from "@/lib/format";

const TABLE_TYPES = ["partitioned", "splayed", "splayed_mem", "basic"];
const COLUMN_TYPES = [
  "boolean",
  "guid",
  "byte",
  "short",
  "int",
  "long",
  "real",
  "float",
  "char",
  "symbol",
  "string",
  "timestamp",
  "month",
  "date",
  "datetime",
  "timespan",
  "minute",
  "second",
  "time",
];
const ATTRS = ["none", "sorted", "parted", "grouped", "unique"];
const NAME_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

interface ColumnRow {
  name: string;
  type: string;
  attrMem: string;
  attrOrd: string;
  attrDisk: string;
  foreign: string;
}

const blank = (): ColumnRow => ({
  name: "",
  type: "symbol",
  attrMem: "none",
  attrOrd: "none",
  attrDisk: "none",
  foreign: "",
});

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
}

function Pick({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? options[0])}>
      <SelectTrigger size="sm" className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CreateTableDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (name: string) => void;
}) {
  const { assembly } = useAppState();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("partitioned");
  const [prtnCol, setPrtnCol] = useState("");
  const [primaryKeys, setPrimaryKeys] = useState("");
  const [sortDisk, setSortDisk] = useState("");
  const [sortOrd, setSortOrd] = useState("");
  const [sortMem, setSortMem] = useState("");
  const [blockSize, setBlockSize] = useState("");
  const [cols, setCols] = useState<ColumnRow[]>([
    {
      name: "",
      type: "timestamp",
      attrMem: "none",
      attrOrd: "none",
      attrDisk: "none",
      foreign: "",
    },
    blank(),
  ]);
  const [advanced, setAdvanced] = useState(false);

  const timestampCols = cols
    .filter((c) => c.type === "timestamp" && c.name.trim())
    .map((c) => c.name.trim());
  const partitionCol =
    prtnCol && timestampCols.includes(prtnCol)
      ? prtnCol
      : (timestampCols[0] ?? "");

  const problem = useMemo(() => {
    if (!NAME_RE.test(name))
      return "Table name must start with a letter and use only letters, numbers and underscores.";
    const named = cols.filter((c) => c.name.trim());
    if (!named.length) return "Add at least one column.";
    if (named.some((c) => !NAME_RE.test(c.name.trim())))
      return "Column names must start with a letter and use only letters, numbers and underscores.";
    if (new Set(named.map((c) => c.name.trim())).size !== named.length)
      return "Column names must be unique.";
    if (type === "partitioned" && !partitionCol)
      return "A partitioned table needs a timestamp column to partition by.";
    return null;
  }, [name, cols, type, partitionCol]);

  const body = useMemo<CreateTableBody>(() => {
    const columns: TableColumn[] = cols
      .filter((c) => c.name.trim())
      .map((c) => ({
        name: c.name.trim(),
        type: c.type === "string" ? "string" : c.type,
        ...(c.attrMem !== "none" ? { attrMem: c.attrMem } : {}),
        ...(c.attrOrd !== "none" ? { attrOrd: c.attrOrd } : {}),
        ...(c.attrDisk !== "none" ? { attrDisk: c.attrDisk } : {}),
        ...(c.foreign.trim() ? { foreign: c.foreign.trim() } : {}),
      }));
    const list = (t: string) => {
      const v = splitList(t);
      return v.length ? v : undefined;
    };
    return {
      type,
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(type === "partitioned" ? { prtnCol: partitionCol } : {}),
      ...(blockSize && Number(blockSize) > 0
        ? { blockSize: Number(blockSize) }
        : {}),
      ...(list(primaryKeys) ? { primaryKeys: list(primaryKeys) } : {}),
      ...(list(sortMem) ? { sortColsMem: list(sortMem) } : {}),
      ...(list(sortOrd) ? { sortColsOrd: list(sortOrd) } : {}),
      ...(list(sortDisk) ? { sortColsDisk: list(sortDisk) } : {}),
      columns,
    };
  }, [
    cols,
    type,
    description,
    partitionCol,
    blockSize,
    primaryKeys,
    sortMem,
    sortOrd,
    sortDisk,
  ]);

  const create = useMutation({
    mutationFn: () => createTable(name, body, assembly || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tables"] });
      qc.invalidateQueries({ queryKey: ["status"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["config"] });
      onCreated(name);
      onOpenChange(false);
      setName("");
    },
  });

  const setCol = (i: number, patch: Partial<ColumnRow>) =>
    setCols((p) => p.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>New table</DialogTitle>
          <DialogDescription>
            Creates the table schema in the running database. Clustered
            deployments define tables in the assembly YAML instead, and reject
            this call.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-3">
          <Field label="Name">
            <Input
              id="t-name"
              className="w-56 font-mono"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="trades"
            />
          </Field>
          <Field label="Type">
            <Pick
              value={type}
              onChange={setType}
              options={TABLE_TYPES}
              className="w-40"
            />
          </Field>
          {type === "partitioned" ? (
            <Field label="Partition column (timestamp)">
              <Pick
                value={partitionCol}
                onChange={setPrtnCol}
                options={timestampCols.length ? timestampCols : [""]}
                className="w-48"
              />
            </Field>
          ) : null}
          <Field label="Description (optional)">
            <Input
              id="t-desc"
              className="w-72"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Columns</Label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="size-3.5 accent-primary"
                checked={advanced}
                onChange={(e) => setAdvanced(e.target.checked)}
              />
              Attributes and foreign keys
            </label>
          </div>
          {cols.map((c, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Input
                aria-label={`Column ${i + 1} name`}
                className="w-44 font-mono"
                placeholder="name"
                value={c.name}
                onChange={(e) => setCol(i, { name: e.target.value })}
              />
              <Pick
                value={c.type}
                onChange={(v) => setCol(i, { type: v })}
                options={COLUMN_TYPES}
                className="w-32"
              />
              {advanced ? (
                <>
                  <Pick
                    value={c.attrMem}
                    onChange={(v) => setCol(i, { attrMem: v })}
                    options={ATTRS}
                    className="w-28"
                  />
                  <Pick
                    value={c.attrOrd}
                    onChange={(v) => setCol(i, { attrOrd: v })}
                    options={ATTRS}
                    className="w-28"
                  />
                  <Pick
                    value={c.attrDisk}
                    onChange={(v) => setCol(i, { attrDisk: v })}
                    options={ATTRS}
                    className="w-28"
                  />
                  <Input
                    aria-label={`Column ${i + 1} foreign key`}
                    className="w-40 font-mono"
                    placeholder="table.column"
                    value={c.foreign}
                    onChange={(e) => setCol(i, { foreign: e.target.value })}
                  />
                </>
              ) : null}
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Remove column ${i + 1}`}
                disabled={cols.length === 1}
                onClick={() => setCols((p) => p.filter((_, j) => j !== i))}
              >
                <Trash2Icon />
              </Button>
            </div>
          ))}
          {advanced ? (
            <p className="text-xs text-muted-foreground">
              Attribute order: memory, intraday (ordinal), disk. The foreign key
              column must have the same type as the column it points at.
            </p>
          ) : null}
          <div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCols((p) => [...p, blank()])}
            >
              <PlusIcon /> Add column
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Field
            label="Primary keys (comma separated)"
            hint="Keyed tables update rows with matching keys."
          >
            <Input
              id="t-pk"
              className="w-56 font-mono"
              value={primaryKeys}
              onChange={(e) => setPrimaryKeys(e.target.value)}
            />
          </Field>
          <Field label="Sort columns, disk">
            <Input
              id="t-sort-disk"
              className="w-44 font-mono"
              placeholder="sym"
              value={sortDisk}
              onChange={(e) => setSortDisk(e.target.value)}
            />
          </Field>
          <Field label="Sort columns, intraday">
            <Input
              id="t-sort-ord"
              className="w-44 font-mono"
              placeholder="sym"
              value={sortOrd}
              onChange={(e) => setSortOrd(e.target.value)}
            />
          </Field>
          <Field label="Sort columns, memory">
            <Input
              id="t-sort-mem"
              className="w-44 font-mono"
              value={sortMem}
              onChange={(e) => setSortMem(e.target.value)}
            />
          </Field>
          {type === "partitioned" ? (
            <Field label="Block size (optional)">
              <Input
                id="t-block"
                className="num w-28"
                placeholder="10000"
                value={blockSize}
                onChange={(e) => setBlockSize(e.target.value)}
              />
            </Field>
          ) : null}
        </div>

        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground select-none">
            Request that will be sent
          </summary>
          <pre className="mt-2 max-h-56 overflow-auto rounded-lg border bg-muted p-3 font-mono">
            POST /api/v0/tables/{name || "<name>"}
            {JSON.stringify(body, null, 2)}
          </pre>
        </details>

        {problem && name ? (
          <p className="text-sm text-muted-foreground">{problem}</p>
        ) : null}
        <ErrorNote error={create.error} title="Table was not created" />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!!problem || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Creating" : "Create table"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
