// Datos de /admin/salud (solo servidor). Todo se lee con la sesión del admin: la base repite el permiso
// (admin_error_summary y ops_heartbeats exigen is_admin; payment_events, staff de cuentas). Sin 0041: avisa.
import "server-only";
import type { Viewer } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { integrationsFrom, missingFor, type Integrations } from "@/lib/health";
import { isOnvoConfigured, isOnvoOneTimeReady } from "@/lib/onvo";
import { pingSupabase } from "@/lib/health-ping";
import { buildInfo } from "@/lib/version";
import { isDemoMode } from "@/lib/env";
import type { ErrorRow } from "@/lib/monitor/summary";

const MISSING = new Set(["PGRST202", "PGRST205", "42883", "42P01"]);

export type Beat = { name: string; last_at: string; ok: boolean; ms: number | null; detail: Record<string, unknown> };
export type WebhookFail = { type: string; received_at: string; attempts: number };

export type OpsHealth = {
  build: ReturnType<typeof buildInfo>;
  db: { ok: boolean; ms: number | null; via: "db" | "auth" | null };
  demo: boolean;
  integrations: Integrations;
  missing: string[];
  errors24: ErrorRow[] | null;
  errors7d: ErrorRow[] | null;
  beats: Beat[] | null;
  webhookFails: { count: number; recent: WebhookFail[] } | null;
  migrationMissing: boolean;
};

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

function demoData(): Pick<OpsHealth, "errors24" | "errors7d" | "beats" | "webhookFails"> {
  const e24: ErrorRow[] = [
    { source: "boundary", kind: "TypeError", route: "/app/entreno", message: "Cannot read properties of undefined (reading 'sets')", hits: 4, last_at: hoursAgo(1), release: "demo" },
    { source: "server", kind: "pagos", route: "pagos", message: "", hits: 2, last_at: hoursAgo(5), release: "demo" },
    { source: "client", kind: "ChunkLoadError", route: "/app/hoy", message: "Loading chunk [n] failed.", hits: 1, last_at: hoursAgo(9), release: "demo" },
  ];
  return {
    errors24: e24,
    errors7d: [...e24, { source: "server", kind: "page:PGRST301", route: "/app/comunidad", message: "", hits: 7, last_at: hoursAgo(80), release: "demo" }],
    beats: [{ name: "cron:recordatorios", last_at: hoursAgo(6), ok: true, ms: 18_400, detail: { scanned: 120, errors: 0 } }],
    webhookFails: { count: 0, recent: [] },
  };
}

export async function getOpsHealth(v: Viewer): Promise<OpsHealth> {
  const integrations = integrationsFrom(process.env, { full: isOnvoConfigured(), oneTime: isOnvoOneTimeReady() });
  const base = { build: buildInfo(), demo: v.demo || isDemoMode, integrations, missing: missingFor(integrations) };
  if (v.demo) return { ...base, db: { ok: true, ms: null, via: null }, ...demoData(), migrationMissing: false };

  const sb = await createClient();
  const [db, e24, e7, beats, wh] = await Promise.all([
    pingSupabase(),
    sb.rpc("admin_error_summary", { p_hours: 24 }),
    sb.rpc("admin_error_summary", { p_hours: 168 }),
    sb.from("ops_heartbeats").select("name,last_at,ok,ms,detail").order("name"),
    sb.from("payment_events").select("type,received_at,attempts", { count: "exact" }).eq("status", "error").gte("received_at", hoursAgo(168)).order("received_at", { ascending: false }).limit(10),
  ]);
  const missing = MISSING.has(e24.error?.code ?? "") || MISSING.has(beats.error?.code ?? "");
  return {
    ...base,
    db,
    errors24: e24.error ? null : ((e24.data ?? []) as ErrorRow[]),
    errors7d: e7.error ? null : ((e7.data ?? []) as ErrorRow[]),
    beats: beats.error ? null : ((beats.data ?? []) as Beat[]),
    webhookFails: wh.error ? null : { count: wh.count ?? (wh.data ?? []).length, recent: (wh.data ?? []) as WebhookFail[] },
    migrationMissing: missing,
  };
}
