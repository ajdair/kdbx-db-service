import { useQuery } from "@tanstack/react-query";
import { parse } from "yaml";
import { exportAssembly } from "@/lib/api";
import { useAppState } from "@/lib/app-state";

export interface Tier {
  name: string;
  mount: string;
  kind?: string;
  location?: string;
  partition?: string;
  schedule?: string;
  retain?: string;
}

export interface AssemblySummary {
  name?: string;
  labels: Record<string, string>;
  tiers: Tier[];
  tableCount: number;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
const text = (v: unknown): string | undefined =>
  v === undefined || v === null || v === "" ? undefined : String(v);
const flat = (v: unknown): string | undefined => {
  const o = obj(v);
  const parts = Object.entries(o).map(([k, val]) => `${k} ${val}`);
  return parts.length ? parts.join(", ") : undefined;
};

// Reads only the parts the home page shows. Anything unexpected is skipped, since the
// assembly format varies between deployments (clustered ones have more sections).
export function summariseAssembly(yamlText: string): AssemblySummary {
  const doc = obj(parse(yamlText));
  const mounts = obj(doc.mounts);
  const tiers = (
    Array.isArray(obj(obj(doc.elements).sm).tiers)
      ? (obj(obj(doc.elements).sm).tiers as unknown[])
      : []
  ).map((t) => {
    const tier = obj(t);
    const mountName = text(tier.mount) ?? "";
    const mount = obj(mounts[mountName]);
    return {
      name: text(tier.name) ?? mountName,
      mount: mountName,
      kind: text(mount.type),
      location:
        text(mount.baseURI) === "none" ? undefined : text(mount.baseURI),
      partition:
        text(mount.partition) === "none" ? undefined : text(mount.partition),
      schedule: flat(tier.schedule),
      retain: flat(tier.retain),
    };
  });
  const labels: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj(doc.labels))) labels[k] = String(v);
  return {
    name: text(doc.name),
    labels,
    tiers,
    tableCount: Object.keys(obj(doc.tables)).length,
  };
}

export function useAssemblySummary() {
  const { assembly } = useAppState();
  return useQuery({
    queryKey: ["config", assembly],
    queryFn: () => exportAssembly(assembly || undefined),
    select: summariseAssembly,
  });
}
