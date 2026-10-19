// Single REST wrapper for the DB Service (API v0).

export type Row = Record<string, unknown>;
export type Json = unknown;

export class ApiError extends Error {
  status: number;
  hint?: string;
  constructor(message: string, status: number, hint?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.hint = hint;
  }
}

export interface TableColumn {
  name: string;
  type: string;
  description?: string;
  attrMem?: string;
  attrOrd?: string;
  attrDisk?: string;
  foreign?: string;
}

export interface TableSpec {
  name: string;
  description?: string;
  type?: string;
  blockSize?: number;
  prtnCol?: string;
  sortColsMem?: string[];
  sortColsOrd?: string[];
  sortColsDisk?: string[];
  primaryKeys?: string[];
  columns: TableColumn[];
}

export type JobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "errored"
  | "canceled";

export interface Job {
  jobId: string;
  jobType?: "import" | "delete";
  status: JobStatus;
  affectedTables?: string[];
  processedPartitions?: string[];
  progress?: {
    currentPartition?: string;
    partitionIndex?: number;
    partitionTotal?: number;
    currentTable?: string;
    tableIndex?: number;
    tableTotal?: number;
  };
  error?: string | null;
  warnings?: string[];
  updated?: string;
}

export interface QueryResult {
  header: Record<string, unknown>;
  payload: Row[];
}

const TIMEOUT_MS = 30_000;

// JSON.parse reviver that keeps integers beyond 2^53 as their exact source text
// (q longs would otherwise silently lose precision). Needs `context.source`.
function reviver(_key: string, value: unknown, context?: { source?: string }) {
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    !Number.isSafeInteger(value)
  ) {
    return context?.source ?? value;
  }
  return value;
}

function parse(text: string): Json {
  if (!text) return null;
  return (JSON.parse as (t: string, r: typeof reviver) => Json)(text, reviver);
}

// Specs and the running service disagree on envelopes: accept a bare value or {data, meta}.
function unwrap<T>(value: unknown): T {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "data" in value &&
    "meta" in value
  ) {
    return (value as { data: T }).data;
  }
  return value as T;
}

// Three error shapes exist: {errors:[{title,detail}]}, {error}, and {header:{ai}} on query errors.
function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (Array.isArray(b.errors) && b.errors.length) {
      const e = b.errors[0] as Record<string, unknown>;
      return [e.title, e.detail].filter(Boolean).join(": ") || fallback;
    }
    if (typeof b.error === "string") return b.error;
    if (b.header && typeof b.header === "object") {
      const ai = (b.header as Record<string, unknown>).ai;
      if (typeof ai === "string" && ai) return ai;
    }
    if (typeof b.error === "object" && b.error) return JSON.stringify(b.error);
    if (typeof b.status === "string" && typeof b.error === "string")
      return b.error;
  }
  return fallback;
}

function hintFor(message: string, status: number): string | undefined {
  if (/assembly must be specified/i.test(message)) {
    return "More than one assembly is configured. Set the assembly in the header bar.";
  }
  if (/no aggregator available|agg restarted/i.test(message)) {
    return "The aggregator was likely killed by a large result. Restart it with: docker compose restart kx-db-agg";
  }
  if (/not licensed/i.test(message))
    return "The DB Service reports it is not licensed. Check KDB_LICENSE_B64 in .env.";
  if (status === 503)
    return "The service is not ready yet. It can take about 15 seconds after startup.";
  return undefined;
}

interface RequestOptions {
  body?: unknown;
  assembly?: string;
  accept?: string;
  signal?: AbortSignal;
}

async function request<T>(
  method: string,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const url = new URL(`/api/v0${path}`, window.location.origin);
  if (opts.assembly) url.searchParams.set("assembly", opts.assembly);

  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  opts.signal?.addEventListener("abort", () => ctrl.abort());

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Accept: opts.accept ?? "application/json",
        ...(opts.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
    });
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    throw new ApiError(
      aborted
        ? "The request timed out after 30 seconds."
        : "Cannot reach the DB Service.",
      0,
      aborted
        ? undefined
        : "Check that the stack is running: docker compose ps",
    );
  } finally {
    window.clearTimeout(timer);
  }

  const text = await res.text();
  if (opts.accept === "application/yaml") {
    if (!res.ok) throw new ApiError(text || res.statusText, res.status);
    return text as T;
  }

  let body: Json = null;
  try {
    body = parse(text);
  } catch {
    body = text;
  }

  if (!res.ok) {
    // A failed job is returned with HTTP 400 but the body is still a job object.
    if (body && typeof body === "object" && "jobId" in body && "status" in body)
      return body as T;
    const message = errorMessage(
      body,
      typeof body === "string" && body
        ? body
        : `${res.status} ${res.statusText}`,
    );
    throw new ApiError(message, res.status, hintFor(message, res.status));
  }
  return body as T;
}

// tables

export const listTables = (assembly?: string) =>
  request<unknown>("GET", "/tables", { assembly }).then((v) => {
    const t = unwrap<unknown>(v);
    return (
      Array.isArray(t) ? t : ((t as { tables?: string[] })?.tables ?? [])
    ) as string[];
  });

export const describeTable = (table: string, assembly?: string) =>
  request<unknown>("GET", `/tables/${encodeURIComponent(table)}`, {
    assembly,
  }).then((v) => unwrap<TableSpec>(v));

export interface CreateTableBody {
  type: string;
  description?: string;
  prtnCol?: string;
  blockSize?: number;
  primaryKeys?: string[];
  sortColsMem?: string[];
  sortColsOrd?: string[];
  sortColsDisk?: string[];
  columns: TableColumn[];
}

// Create and drop are synchronous. A failed schema change can come back as a job object - surface it as an error
function schemaChange(job: Job & { table?: string }): Job & { table?: string } {
  if (job?.status === "errored")
    throw new ApiError(job.error || "The schema change failed.", 400);
  return job;
}

export const createTable = (
  name: string,
  body: CreateTableBody,
  assembly?: string,
) =>
  request<Job & { table?: string }>(
    "POST",
    `/tables/${encodeURIComponent(name)}`,
    { body, assembly },
  ).then(schemaChange);

export const dropTable = (name: string, assembly?: string) =>
  request<Job & { table?: string }>(
    "DELETE",
    `/tables/${encodeURIComponent(name)}`,
    { assembly },
  ).then(schemaChange);

// queries

function scoped(body: Record<string, unknown>, assembly?: string) {
  return assembly ? { ...body, scope: { assembly } } : body;
}

async function query(
  path: string,
  body: Record<string, unknown>,
  assembly?: string,
): Promise<QueryResult> {
  const res = await request<QueryResult>("POST", `/query/${path}`, {
    body: scoped(body, assembly),
  });
  return {
    header: res?.header ?? {},
    payload: Array.isArray(res?.payload) ? res.payload : [],
  };
}

// startTS and endTS are optional and must be midnight - the range covers whole days
export const queryPreview = (
  table: string,
  opts: { limit: number; startTS?: string; endTS?: string },
  assembly?: string,
) => query("preview", { table, ...opts }, assembly);
export const querySimple = (body: Record<string, unknown>, assembly?: string) =>
  query("simple", body, assembly);
export const querySql = (sql: string, assembly?: string) =>
  query("sql", { query: sql }, assembly);
export const queryQ = (q: string, agg: string | undefined, assembly?: string) =>
  query("q", agg ? { query: q, agg } : { query: q }, assembly);

// imports

export interface ImportFilesBody {
  table: string;
  path: string;
  format?: "csv" | "parquet" | "qbinary";
  mode?: "merge" | "overwrite";
  createTable?: boolean;
  delimiter?: string;
  decimal?: string;
  header?: string[];
  headerRowIndex?: number;
  include?: string[];
  types?: string;
  postparse?: Record<string, string>;
}

export const importFiles = (body: ImportFilesBody, assembly?: string) =>
  request<Job>("POST", "/imports/files", { body, assembly });

export const importData = (
  body: {
    table: string;
    data: unknown[];
    createTable?: boolean;
    mode?: "merge" | "overwrite";
    columnNames?: string[];
    types?: string;
  },
  assembly?: string,
) => request<Job>("POST", "/imports/data", { body, assembly });

export const importKdb = (
  body: { path: string; mode?: "merge" | "overwrite"; createTable?: boolean },
  assembly?: string,
) => request<Job>("POST", "/imports/kdb", { body, assembly });

export const getImport = (jobId: string, assembly?: string) =>
  request<Job>("GET", `/imports/${jobId}`, { assembly });
export const cancelImport = (jobId: string, assembly?: string) =>
  request<unknown>("DELETE", `/imports/${jobId}`, { assembly });

// deletes

export const deleteRows = (
  body: { table: string; filter: unknown[]; startTS?: string; endTS?: string },
  assembly?: string,
) => request<Job>("POST", "/deletes", { body, assembly });

export const getDelete = (jobId: string, assembly?: string) =>
  request<Job>("GET", `/deletes/${jobId}`, { assembly });
export const cancelDelete = (jobId: string, assembly?: string) =>
  request<unknown>("DELETE", `/deletes/${jobId}`, { assembly });

// config

export const exportAssembly = (assembly?: string) =>
  request<string>("GET", "/config/assembly", {
    assembly,
    accept: "application/yaml",
  });
