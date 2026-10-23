// SOLO PRUEBAS: cliente de Supabase en memoria con lo que usan billing.ts y trial-billing.ts (select, insert, update, upsert,
// filtros eq/neq/in/lt/lte/gt/gte/is/or, order, limit, single, maybeSingle). Los UPDATE con filtros son atómicos dentro de
// un proceso de Node, igual que un UPDATE ... WHERE en Postgres: sirve para probar que dos intentos a la vez no cobran dos veces.
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

const get = (r: Row, col: string): unknown => {
  if (!col.includes("->")) return r[col];
  const parts = col.split(/->>?/);
  let v: unknown = r[parts[0]];
  for (const p of parts.slice(1)) v = v && typeof v === "object" ? (v as Row)[p] : undefined;
  return v;
};
const cmp = (a: unknown, b: unknown) => (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b)));

export function fakeDb(seed: Record<string, Row[]> = {}, unique: Record<string, string[]> = {}) {
  const tables: Record<string, Row[]> = Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, v.map((r) => ({ ...r }))]));
  let nextId = 1000;
  const t = (name: string) => (tables[name] ??= []);

  function builder(table: string) {
    const filters: Filter[] = [];
    let op: { kind: "select" } | { kind: "update"; values: Row } | { kind: "insert"; rows: Row[] } | { kind: "upsert"; rows: Row[]; on: string } = { kind: "select" };
    let order: { col: string; asc: boolean } | null = null;
    let limit = Infinity;
    let returning = false;

    const run = (): { data: unknown; error: { message: string; code?: string } | null } => {
      const rows = t(table);
      if (op.kind === "insert" || op.kind === "upsert") {
        const out: Row[] = [];
        const on = op.kind === "upsert" ? op.on : null;
        for (const r of op.rows) {
          if (on) {
            const ex = rows.find((x) => x[on] === r[on]);
            if (ex) { Object.assign(ex, r); out.push(ex); continue; }
          }
          for (const u of unique[table] ?? []) if (rows.some((x) => x[u] === r[u])) return { data: null, error: { message: `duplicate key value violates unique constraint (${u})`, code: "23505" } };
          const row = { id: nextId++, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...r };
          rows.push(row);
          out.push(row);
        }
        return { data: returning ? out.map((x) => ({ ...x })) : null, error: null };
      }
      let hit = rows.filter((r) => filters.every((f) => f(r)));
      if (op.kind === "update") {
        for (const r of hit) Object.assign(r, op.values);
        return { data: returning ? hit.map((x) => ({ ...x })) : null, error: null };
      }
      if (order) { const o = order; hit = [...hit].sort((a, b) => (o.asc ? 1 : -1) * cmp(get(a, o.col), get(b, o.col))); }
      return { data: hit.slice(0, limit).map((x) => ({ ...x })), error: null };
    };

    const q = {
      select: () => { if (op.kind !== "select") returning = true; return q; },
      insert: (v: Row | Row[]) => { op = { kind: "insert", rows: Array.isArray(v) ? v : [v] }; return q; },
      upsert: (v: Row | Row[], o?: { onConflict?: string }) => { op = { kind: "upsert", rows: Array.isArray(v) ? v : [v], on: o?.onConflict ?? "id" }; return q; },
      update: (v: Row) => { op = { kind: "update", values: v }; return q; },
      eq: (c: string, v: unknown) => { filters.push((r) => get(r, c) === v); return q; },
      neq: (c: string, v: unknown) => { filters.push((r) => get(r, c) !== v); return q; },
      in: (c: string, v: unknown[]) => { filters.push((r) => v.includes(get(r, c))); return q; },
      lt: (c: string, v: unknown) => { filters.push((r) => get(r, c) != null && cmp(get(r, c), v) < 0); return q; },
      lte: (c: string, v: unknown) => { filters.push((r) => get(r, c) != null && cmp(get(r, c), v) <= 0); return q; },
      gt: (c: string, v: unknown) => { filters.push((r) => get(r, c) != null && cmp(get(r, c), v) > 0); return q; },
      gte: (c: string, v: unknown) => { filters.push((r) => get(r, c) != null && cmp(get(r, c), v) >= 0); return q; },
      is: (c: string, v: null) => { filters.push((r) => (get(r, c) ?? null) === v); return q; },
      or: (expr: string) => {
        const parts = expr.split(",").map((p) => p.split("."));
        filters.push((r) => parts.some(([c, o, ...rest]) => {
          const val = rest.join(".");
          const x = get(r, c);
          if (o === "is" && val === "null") return x == null;
          if (o === "lt") return x != null && Number(x) < Number(val);
          if (o === "eq") return String(x) === val;
          return false;
        }));
        return q;
      },
      order: (c: string, o?: { ascending?: boolean }) => { order = { col: c, asc: o?.ascending !== false }; return q; },
      limit: (n: number) => { limit = n; return q; },
      maybeSingle: async () => { const r = run(); const d = r.data as Row[] | null; return { data: d?.[0] ?? null, error: r.error }; },
      single: async () => { const r = run(); const d = r.data as Row[] | null; return r.error ? { data: null, error: r.error } : d?.[0] ? { data: d[0], error: null } : { data: null, error: { message: "no rows" } }; },
      then: (ok: (v: ReturnType<typeof run>) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve().then(run).then(ok, bad),
    };
    return q;
  }

  const rpcCalls: { fn: string; args: unknown }[] = [];
  const db = { from: (name: string) => builder(name), rpc: async (fn: string, args: unknown) => { rpcCalls.push({ fn, args }); return { data: true, error: null }; } };
  return { db: db as unknown as SupabaseClient, tables, rpcCalls };
}
