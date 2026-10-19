import { useQueries, useQuery } from '@tanstack/react-query'
import { describeTable, querySimple } from '@/lib/api'
import { useAppState } from '@/lib/app-state'
import { dayStart, parseTs } from '@/lib/format'

// A cheap per-table summary built from one describe call and one pushed-down aggregate.
// API has no catalog statistics, so row counts and time ranges need a query.
export interface TableSummary {
  name: string
  type?: string
  prtnCol?: string
  columns: number
  rows: number
  first: Date | null
  last: Date | null
}

async function summarise(name: string, assembly?: string): Promise<TableSummary> {
  const spec = await describeTable(name, assembly)
  const col = spec.prtnCol ?? spec.columns[0]?.name
  if (!col) return { name, type: spec.type, columns: 0, rows: 0, first: null, last: null }
  const body: Record<string, unknown> = spec.prtnCol
    ? {
        table: name,
        startTS: '2000-01-01T00:00:00',
        endTS: '2100-01-01T00:00:00',
        agg: [['rows', 'count', col], ['first', 'min', col], ['last', 'max', col]],
      }
    : { table: name, agg: [['rows', 'count', col]] }
  const res = await querySimple(body, assembly)
  const row = res.payload[0] ?? {}
  return {
    name,
    type: spec.type,
    prtnCol: spec.prtnCol,
    columns: spec.columns.length,
    rows: Number(row.rows ?? 0),
    first: spec.prtnCol ? parseTs(row.first) : null,
    last: spec.prtnCol ? parseTs(row.last) : null,
  }
}

const options = (assembly: string, name: string) => ({
  queryKey: ['summary', assembly, name],
  queryFn: () => summarise(name, assembly || undefined),
  staleTime: 5 * 60_000,
  retry: false,
})

export function useTableSummary(name?: string) {
  const { assembly } = useAppState()
  return useQuery({ ...options(assembly, name ?? ''), enabled: !!name })
}

export function useTableSummaries(names: string[]) {
  const { assembly } = useAppState()
  return useQueries({ queries: names.map((n) => options(assembly, n)) })
}

// The most recent day that holds data, as a one-day window. Defaults that use it return rows
// on any deployment, unlike "yesterday", which is empty for data that is not live.
export function latestWindow(s?: TableSummary): { start: string; end: string } | null {
  if (!s?.last) return null
  return { start: dayStart(s.last), end: dayStart(s.last, 1) }
}
