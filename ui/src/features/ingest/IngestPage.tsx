import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { UploadIcon } from "lucide-react";
import { HelpTip } from "@/components/HelpTip";
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
import { JobsPanel } from "@/components/JobsPanel";
import {
  importData,
  importFiles,
  importKdb,
  type ImportFilesBody,
  type Job,
} from "@/lib/api";
import { useAppState } from "@/lib/app-state";
import { splitList } from "@/lib/format";
import { INGEST } from "@/lib/help";

function Field({
  label,
  help,
  href,
  children,
}: {
  label: string;
  help?: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}
        {help ? <HelpTip href={href}>{help}</HelpTip> : null}
      </Label>
      {children}
    </div>
  );
}

function Check({
  id,
  label,
  help,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  help?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor={id} className="flex items-center gap-2">
        <input
          id={id}
          type="checkbox"
          className="size-4 accent-primary"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>
      {help ? <HelpTip>{help}</HelpTip> : null}
    </div>
  );
}

function Mode({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label="Mode" help={INGEST.mode}>
      <Select value={value} onValueChange={(v) => onChange(v ?? "merge")}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="merge">merge</SelectItem>
          <SelectItem value="overwrite">overwrite</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

export function IngestPage() {
  const { assembly, trackJob } = useAppState();
  const asm = assembly || undefined;
  const [error, setError] = useState<unknown>(null);
  const [last, setLast] = useState<Job | null>(null);

  // Files
  const [fTable, setFTable] = useState("");
  const [fPath, setFPath] = useState("");
  const [fFormat, setFFormat] = useState<"csv" | "parquet" | "qbinary">("csv");
  const [fMode, setFMode] = useState("merge");
  const [fCreate, setFCreate] = useState(true);
  const [fDelim, setFDelim] = useState(",");
  const [fDecimal, setFDecimal] = useState("");
  const [fHeader, setFHeader] = useState("");
  const [fHeaderRow, setFHeaderRow] = useState("");
  const [fInclude, setFInclude] = useState("");
  const [fTypes, setFTypes] = useState("");
  const [fPost, setFPost] = useState("");

  // Inline data
  const [dTable, setDTable] = useState("");
  const [dJson, setDJson] = useState(
    '[\n  {"sym": "EURUSD", "bid": 1.0851}\n]',
  );
  const [dMode, setDMode] = useState("merge");
  const [dCreate, setDCreate] = useState(false);
  const [dColumns, setDColumns] = useState("");
  const [dTypes, setDTypes] = useState("");
  const [dAdvanced, setDAdvanced] = useState(false);

  // kdb HDB
  const [kPath, setKPath] = useState("");
  const [kMode, setKMode] = useState("merge");
  const [kCreate, setKCreate] = useState(true);

  function started(job: Job, kind: "import", table: string) {
    setError(null);
    setLast(job);
    if (job?.jobId)
      trackJob({
        id: job.jobId,
        kind,
        table,
        createdAt: new Date().toISOString(),
        assembly: asm,
      });
  }

  const files = useMutation({
    mutationFn: () => {
      const body: ImportFilesBody = {
        table: fTable,
        path: fPath,
        format: fFormat,
        mode: fMode as "merge",
        createTable: fCreate,
      };
      if (fFormat === "csv") {
        if (fDelim) body.delimiter = fDelim;
        if (fDecimal) body.decimal = fDecimal;
        if (fHeader.trim()) body.header = splitList(fHeader);
        if (fHeaderRow.trim() !== "") body.headerRowIndex = Number(fHeaderRow);
        if (fTypes.trim()) body.types = fTypes.trim();
      }
      if (fInclude.trim()) body.include = splitList(fInclude);
      if (fPost.trim()) {
        const post = JSON.parse(fPost);
        if (!post || typeof post !== "object" || Array.isArray(post))
          throw new Error(
            "Post-parse must be a JSON object of column to q expression.",
          );
        body.postparse = post;
      }
      return importFiles(body, asm);
    },
    onSuccess: (j) => started(j, "import", fTable),
    onError: setError,
  });

  const data = useMutation({
    mutationFn: () => {
      const parsed = JSON.parse(dJson);
      if (!Array.isArray(parsed))
        throw new Error(
          "Data must be a JSON array of objects, or of arrays when you give column names.",
        );
      const names = splitList(dColumns);
      return importData(
        {
          table: dTable,
          data: parsed,
          mode: dMode as "merge",
          createTable: dCreate,
          ...(names.length ? { columnNames: names } : {}),
          ...(dTypes.trim() ? { types: dTypes.trim() } : {}),
        },
        asm,
      );
    },
    onSuccess: (j) => started(j, "import", dTable),
    onError: setError,
  });

  const kdb = useMutation({
    mutationFn: () =>
      importKdb(
        { path: kPath, mode: kMode as "merge", createTable: kCreate },
        asm,
      ),
    onSuccess: (j) => started(j, "import", kPath),
    onError: setError,
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl">Ingest</h1>
      <p className="text-sm text-muted-foreground">
        File paths are read by the service from its import directory
        (data/imports on the host), so copy files there first. The API has no
        upload endpoint.
      </p>
      <Card>
        <CardContent>
          <Tabs defaultValue="data">
            <TabsList>
              <TabsTrigger value="data">Inline data</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="kdb">kdb HDB</TabsTrigger>
            </TabsList>

            <TabsContent value="data" className="flex flex-col gap-4 pt-3">
              <div className="flex flex-wrap gap-3">
                <Field label="Table">
                  <Input
                    id="d-table"
                    className="w-48 font-mono"
                    value={dTable}
                    onChange={(e) => setDTable(e.target.value)}
                  />
                </Field>
                <Mode value={dMode} onChange={setDMode} />
              </div>
              <Field label="Rows" help={INGEST.rows}>
                <Textarea
                  id="d-json"
                  className="font-mono text-xs"
                  rows={8}
                  value={dJson}
                  onChange={(e) => setDJson(e.target.value)}
                />
              </Field>
              <Check
                id="d-create"
                label="Create the table if it does not exist"
                help={INGEST.createInline}
                checked={dCreate}
                onChange={(v) => {
                  setDCreate(v);
                  if (v) setDAdvanced(true);
                }}
              />
              <details
                className="rounded-lg border p-3"
                open={dAdvanced}
                onToggle={(e) => setDAdvanced(e.currentTarget.open)}
              >
                <summary className="cursor-pointer text-sm select-none">
                  Advanced options
                </summary>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Field label="Column names" help={INGEST.columnNamesInline}>
                    <Input
                      id="d-columns"
                      className="w-64 font-mono"
                      placeholder="sym,bid,ask"
                      value={dColumns}
                      onChange={(e) => setDColumns(e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Types"
                    help={INGEST.typesInline}
                    href="https://code.kx.com/q/ref/cast/"
                  >
                    <Input
                      id="d-types"
                      className="w-40 font-mono"
                      placeholder="sff"
                      value={dTypes}
                      onChange={(e) => setDTypes(e.target.value)}
                    />
                  </Field>
                </div>
              </details>
              <div>
                <Button
                  disabled={!dTable || data.isPending}
                  onClick={() => data.mutate()}
                >
                  <UploadIcon /> Start import
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="files" className="flex flex-col gap-4 pt-3">
              <div className="flex flex-wrap gap-3">
                <Field label="Table">
                  <Input
                    id="f-table"
                    className="w-48 font-mono"
                    value={fTable}
                    onChange={(e) => setFTable(e.target.value)}
                  />
                </Field>
                <Field label="Path" help={INGEST.path}>
                  <Input
                    id="f-path"
                    className="w-72 font-mono"
                    placeholder="fxquote.csv.gz"
                    value={fPath}
                    onChange={(e) => setFPath(e.target.value)}
                  />
                </Field>
                <Field label="Format">
                  <Select
                    value={fFormat}
                    onValueChange={(v) =>
                      setFFormat((v ?? "csv") as typeof fFormat)
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">csv</SelectItem>
                      <SelectItem value="parquet">parquet</SelectItem>
                      <SelectItem value="qbinary">qbinary</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Mode value={fMode} onChange={setFMode} />
                {fFormat === "csv" ? (
                  <Field label="Delimiter">
                    <Input
                      id="f-delim"
                      className="w-20 font-mono"
                      value={fDelim}
                      onChange={(e) => setFDelim(e.target.value)}
                    />
                  </Field>
                ) : null}
              </div>
              <Check
                id="f-create"
                label="Create the table if it does not exist"
                help={INGEST.createFile}
                checked={fCreate}
                onChange={setFCreate}
              />
              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm select-none">
                  Advanced options
                </summary>
                <div className="mt-3 flex flex-col gap-3">
                  <div className="flex flex-wrap gap-3">
                    {fFormat === "csv" ? (
                      <>
                        <Field
                          label="Column names"
                          help={INGEST.columnNamesFile}
                        >
                          <Input
                            id="f-header"
                            className="w-64 font-mono"
                            value={fHeader}
                            onChange={(e) => setFHeader(e.target.value)}
                          />
                        </Field>
                        <Field label="Header row" help={INGEST.headerRow}>
                          <Input
                            id="f-headerrow"
                            className="num w-24"
                            placeholder="0"
                            value={fHeaderRow}
                            onChange={(e) => setFHeaderRow(e.target.value)}
                          />
                        </Field>
                        <Field label="Decimal separator">
                          <Input
                            id="f-decimal"
                            className="w-20 font-mono"
                            placeholder="."
                            value={fDecimal}
                            onChange={(e) => setFDecimal(e.target.value)}
                          />
                        </Field>
                        <Field
                          label="Types"
                          help={INGEST.typesFile}
                          href="https://code.kx.com/q/ref/tok/"
                        >
                          <Input
                            id="f-types"
                            placeholder="SFF"
                            className="w-40 font-mono"
                            value={fTypes}
                            onChange={(e) => setFTypes(e.target.value)}
                          />
                        </Field>
                      </>
                    ) : null}
                    <Field label="Keep columns" help={INGEST.include}>
                      <Input
                        id="f-include"
                        className="w-64 font-mono"
                        value={fInclude}
                        onChange={(e) => setFInclude(e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="Post-parse transforms" help={INGEST.postparse}>
                    <Textarea
                      id="f-post"
                      className="font-mono text-xs"
                      rows={2}
                      placeholder={'{"sym": "`$sym"}'}
                      value={fPost}
                      onChange={(e) => setFPost(e.target.value)}
                    />
                  </Field>
                </div>
              </details>
              <div>
                <Button
                  disabled={!fTable || !fPath || files.isPending}
                  onClick={() => files.mutate()}
                >
                  <UploadIcon /> Start import
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="kdb" className="flex flex-col gap-4 pt-3">
              <div className="flex flex-wrap gap-3">
                <Field label="HDB path" help={INGEST.hdbPath}>
                  <Input
                    id="k-path"
                    className="w-72 font-mono"
                    placeholder="fxquote-hdb"
                    value={kPath}
                    onChange={(e) => setKPath(e.target.value)}
                  />
                </Field>
                <Mode value={kMode} onChange={setKMode} />
              </div>
              <Check
                id="k-create"
                label="Create tables if they do not exist"
                help={INGEST.createKdb}
                checked={kCreate}
                onChange={setKCreate}
              />
              <div>
                <Button
                  disabled={!kPath || kdb.isPending}
                  onClick={() => kdb.mutate()}
                >
                  <UploadIcon /> Start import
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <ErrorNote error={error} title="Import was not accepted" />
      {last && last.status === "errored" ? (
        <ErrorNote
          error={new Error(last.error ?? "Import errored")}
          title="Import errored"
        />
      ) : null}
      <JobsPanel kind="import" />
    </div>
  );
}
