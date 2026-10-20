import { UTCDate } from "@date-fns/utc";
import {
  addDays,
  format,
  formatDistanceToNowStrict,
  isSameDay,
  isSameMonth,
  isSameYear,
  isValid,
  parseISO,
} from "date-fns";
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

const MIDNIGHT = "yyyy-MM-dd'T'00:00:00";

export function isoMidnight(offsetDays: number): string {
  return format(addDays(new UTCDate(), offsetDays), MIDNIGHT);
}

// q timestamps arrive as "2026-03-02T00:00:00.000000000", and job times as "2026-10-20T13:27:03.183652678". Both are UTC with no zone marker. Date only has millisecond precision, which is enough here.
export function parseTs(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = parseISO(`${value.slice(0, 23)}Z`);
  return isValid(d) ? d : null;
}

export function dayStart(d: Date, offsetDays = 0): string {
  return format(addDays(new UTCDate(d), offsetDays), MIDNIGHT);
}

// "2026-03-02T00:00:00" -> "2026.03.02D00:00:00" for q literals.
export function qTimestamp(iso: string): string {
  return iso.replace(/-/g, ".").replace("T", "D");
}

export function ago(d: Date): string {
  if (Math.abs(Date.now() - d.getTime()) < 90_000) return "just now";
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

// "3 Mar 2026, 23:59 UTC"
export function utcMinute(d: Date): string {
  return `${format(new UTCDate(d), "d MMM yyyy, HH:mm")} UTC`;
}

// A short date range in UTC: "3 Mar 2026", "2-3 Mar 2026", "2 Mar to 3 Apr 2026", "2 Mar 2025 to 3 Apr 2026".
export function formatRange(first: Date, last: Date): string {
  const a = new UTCDate(first);
  const b = new UTCDate(last);
  if (isSameDay(a, b)) return format(a, "d MMM yyyy");
  if (isSameMonth(a, b)) return `${format(a, "d")}-${format(b, "d MMM yyyy")}`;
  if (isSameYear(a, b))
    return `${format(a, "d MMM")} to ${format(b, "d MMM yyyy")}`;
  return `${format(a, "d MMM yyyy")} to ${format(b, "d MMM yyyy")}`;
}

// A time the browser shows in the viewer's own timezone: "20 Oct 2026, 14:07:56".
export function localTime(d: Date): string {
  return format(d, "d MMM yyyy, HH:mm:ss");
}

export function splitList(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
