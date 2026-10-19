import type { Row } from "@/lib/api";

export function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function columnsOf(rows: Row[]): string[] {
  const seen = new Set<string>();
  for (const row of rows.slice(0, 50))
    for (const k of Object.keys(row)) seen.add(k);
  return [...seen];
}

export function toCsv(rows: Row[]): string {
  const cols = columnsOf(rows);
  const esc = (s: string) =>
    /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  return [
    cols.map(esc).join(","),
    ...rows.map((r) => cols.map((c) => esc(cell(r[c]))).join(",")),
  ].join("\n");
}

export function download(filename: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function isoMidnight(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return `${d.toISOString().slice(0, 10)}T00:00:00`;
}

// q timestamps arrive as "2026-03-02T00:00:00.000000000". Date only has millisecond precision, which is enough here.
export function parseTs(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(`${value.slice(0, 23)}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dayStart(d: Date, offsetDays = 0): string {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + offsetDays);
  return `${x.toISOString().slice(0, 10)}T00:00:00`;
}

// "2026-03-02T00:00:00" -> "2026.03.02D00:00:00" for q literals.
export function qTimestamp(iso: string): string {
  return iso.replace(/-/g, ".").replace("T", "D");
}

export function ago(d: Date): string {
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 90) return "just now";
  const units: [number, string][] = [
    [60, "minute"],
    [3600, "hour"],
    [86400, "day"],
    [86400 * 30, "month"],
    [86400 * 365, "year"],
  ];
  let best: [number, string] = [1, "second"];
  for (const u of units) if (s >= u[0]) best = u;
  const n = Math.floor(s / best[0]);
  return `${n} ${best[1]}${n === 1 ? "" : "s"} ago`;
}

export function splitList(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
