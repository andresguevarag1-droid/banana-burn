import "server-only";
// Condominios afiliados (0053), del lado del servidor y siempre con service_role (las tablas no tienen escritura por la API).
//   - joinCondo: vincula una cuenta al condominio del enlace y le da su cortesía (source 'condominio').
//   - joinCondoFromCookie: lo mismo al crear la cuenta, con la cookie que dejó /c/<código>/activar.
//   - sweepCondos: barrido diario (cron) que pasa a los residentes al plan que paga el condominio y avisa 3 días antes
//     de que termine el mes gratis cuando el condominio todavía no eligió plan.
// Nunca lanza hacia el registro: si algo falla, la cuenta se crea igual y el residente puede volver a abrir el enlace.
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import { hasLivePaidSubscription } from "@/lib/trial-billing";
import { CONDO_COOKIE, decideJoin, endingNoticeDue, joinMessage, normalizeCondoCode, syncGrant, type CondoGrant, type CondoRow, type JoinDecision } from "@/lib/condos";
import { errCode, logError } from "@/lib/log";

const MISSING = new Set(["42P01", "PGRST205", "42703", "PGRST204"]);
const CONDO_COLS = "id,code,name,status,free_starts_at,free_ends_at,paid_plan,paid_until";

export async function condoByCode(db: SupabaseClient, code: string): Promise<CondoRow | null> {
  const { data, error } = await db.from("condos").select(CONDO_COLS).eq("code", code).maybeSingle();
  if (error) { if (!MISSING.has(error.code ?? "")) logError("condominios", "lookup_failed", { code: error.code }); return null; }
  return (data as CondoRow | null) ?? null;
}

export type JoinResult = { kind: JoinDecision["kind"] | "sin_config"; condo: Pick<CondoRow, "name" | "code"> | null };

/** Vincula la cuenta al condominio del código. Idempotente: volver a abrir el enlace no da otro mes. */
export async function joinCondo(userId: string, rawCode: string, now = new Date()): Promise<JoinResult> {
  const code = normalizeCondoCode(rawCode);
  const db = adminClient();
  if (!db) return { kind: "sin_config", condo: null };
  const condo = code ? await condoByCode(db, code) : null;
  const [{ data: member }, { data: grants }, paid] = await Promise.all([
    db.from("condo_members").select("condo_id").eq("user_id", userId).maybeSingle(),
    db.from("comp_grants").select("id").eq("user_id", userId).eq("source", "condominio").limit(1),
    hasLivePaidSubscription(db, userId).catch(() => false),
  ]);
  const d = decideJoin({ condo, memberOf: (member as { condo_id: number } | null)?.condo_id ?? null, hadCondoGrant: (grants?.length ?? 0) > 0, hasPaidPlan: paid, now });
  const out = (kind: JoinResult["kind"]): JoinResult => ({ kind, condo: condo ? { name: condo.name, code: condo.code } : null });
  if (d.kind !== "join" || !condo) return out(d.kind);

  const at = now.toISOString();
  const { data: g, error: gErr } = await db.from("comp_grants").insert({
    user_id: userId, plan: d.plan, reason: `Condominio ${condo.name}`, starts_at: at, expires_at: d.expiresAt, source: "condominio",
  }).select("id").single();
  if (gErr || !g) {
    // 23505: otra pestaña ganó la carrera (índice único por cuenta). Se responde como si ya estuviera vinculada.
    if (gErr?.code === "23505") return out("ya_vinculado");
    logError("condominios", "grant_failed", { code: gErr?.code ?? "sin_fila" });
    return out("inactivo");
  }
  const { error: mErr } = await db.from("condo_members").insert({ condo_id: condo.id, user_id: userId, grant_id: (g as { id: number }).id, joined_at: at });
  if (mErr) {
    // Sin vínculo no se deja la cortesía suelta: se borra y la persona puede volver a abrir el enlace.
    logError("condominios", "member_failed", { code: mErr.code });
    await db.from("comp_grants").delete().eq("id", (g as { id: number }).id);
    return out(mErr.code === "23505" ? "ya_vinculado" : "inactivo");
  }
  // Un cobro programado de su prueba individual ya no aplica: el condominio le da el acceso y nadie le cobra al terminar.
  await db.from("trial_charges").update({ status: "superseded", next_attempt_at: null, updated_at: at }).eq("user_id", userId).in("status", ["scheduled", "retry_scheduled"]);
  const msg = joinMessage("join", condo.name);
  const { notifyInApp } = await import("@/lib/email");
  await notifyInApp(userId, { kind: "condominio", title: msg.title, body: msg.body, url: "/app" }).catch(() => false);
  return out("join");
}

/** Al crear la cuenta: si llegó desde el enlace de un condominio (cookie de /c/<código>/activar), la vincula. */
export async function joinCondoFromCookie(userId: string): Promise<JoinResult["kind"] | "sin_cookie"> {
  try {
    const code = normalizeCondoCode((await cookies()).get(CONDO_COOKIE)?.value);
    if (!code) return "sin_cookie";
    return (await joinCondo(userId, code)).kind;
  } catch (e) {
    logError("condominios", "join_cookie_failed", { kind: errCode(e) });
    return "sin_config";
  }
}

/** Para el panel: residentes vinculados y cuántos entrenaron en los últimos 7 días, por condominio. Solo conteos. */
export async function condoStats(db: SupabaseClient, ids: number[], now = new Date()): Promise<Map<number, { members: number; activeWeek: number }>> {
  const out = new Map<number, { members: number; activeWeek: number }>(ids.map((id) => [id, { members: 0, activeWeek: 0 }]));
  if (!ids.length) return out;
  const { data: members } = await db.from("condo_members").select("condo_id,user_id").in("condo_id", ids).limit(50000);
  const rows = (members as { condo_id: number; user_id: string }[] | null) ?? [];
  const byUser = new Map(rows.map((m) => [m.user_id, m.condo_id]));
  for (const m of rows) out.get(m.condo_id)!.members++;
  if (!rows.length) return out;
  const since = new Date(now.getTime() - 7 * 864e5).toISOString().slice(0, 10);
  const active = new Set<string>();
  const users = [...byUser.keys()];
  for (let i = 0; i < users.length; i += 500) {
    const { data } = await db.from("workouts").select("user_id").in("user_id", users.slice(i, i + 500)).gte("day", since).limit(50000);
    for (const w of (data as { user_id: string }[] | null) ?? []) active.add(w.user_id);
  }
  for (const u of active) { const c = byUser.get(u); if (c != null) out.get(c)!.activeWeek++; }
  return out;
}

export type CondoSweep = { condos: number; synced: number; notices: number; errors: number };

/** Residentes de un condominio: plan del condominio activo y aviso de fin del mes gratis. Lo usan el cron y el panel. */
export async function syncCondoMembers(db: SupabaseClient, c: CondoRow, now = new Date(), time: () => boolean = () => true): Promise<Omit<CondoSweep, "condos">> {
  const out = { synced: 0, notices: 0, errors: 0 };
  const { data: members } = await db.from("condo_members").select("id,user_id,grant_id,ending_notified_at").eq("condo_id", c.id).limit(5000);
  const ms = (members as { id: number; user_id: string; grant_id: number | null; ending_notified_at: string | null }[] | null) ?? [];
  const grantIds = ms.map((m) => m.grant_id).filter((x): x is number => x != null);
  const grants = new Map<number, CondoGrant>();
  for (let i = 0; i < grantIds.length; i += 500) {
    const { data } = await db.from("comp_grants").select("id,plan,starts_at,expires_at,revoked_at").in("id", grantIds.slice(i, i + 500));
    for (const g of (data as CondoGrant[] | null) ?? []) grants.set(g.id, g);
  }
  for (const m of ms) {
    if (!time()) break;
    const g = m.grant_id != null ? grants.get(m.grant_id) : undefined;
    if (!g) continue;
    try {
      const next = syncGrant(c, g);
      if (next) {
        const { error: uErr } = await db.from("comp_grants").update(next).eq("id", g.id).is("revoked_at", null);
        if (uErr) out.errors++;
        else { out.synced++; if (m.ending_notified_at) await db.from("condo_members").update({ ending_notified_at: null }).eq("id", m.id); }
        continue;
      }
      if (endingNoticeDue(c, g, m.ending_notified_at, now)) {
        const { data: claimed } = await db.from("condo_members").update({ ending_notified_at: now.toISOString() }).eq("id", m.id).is("ending_notified_at", null).select("id");
        if (!claimed?.length) continue;
        const { sendCondoEndingEmail, notifyInApp } = await import("@/lib/email");
        await notifyInApp(m.user_id, { kind: "condominio", title: "Tu mes gratis del condominio termina pronto", body: "Si quieres seguir, elige tu plan individual.", url: "/app/suscripcion" }).catch(() => false);
        await sendCondoEndingEmail({ userId: m.user_id, condo: c.name, until: g.expires_at, key: `${g.id}/${g.expires_at.slice(0, 10)}` }).catch(() => null);
        out.notices++;
      }
    } catch { out.errors++; }
  }
  return out;
}

/** Barrido diario de los condominios en mes gratis o activos. */
export async function sweepCondos(now = new Date(), opts: { deadline?: number } = {}): Promise<CondoSweep> {
  const out: CondoSweep = { condos: 0, synced: 0, notices: 0, errors: 0 };
  const db = adminClient();
  if (!db) return out;
  const time = () => !opts.deadline || Date.now() < opts.deadline;
  const { data: condos, error } = await db.from("condos").select(CONDO_COLS).in("status", ["mes_gratis", "activo"]).limit(1000);
  if (error) { if (!MISSING.has(error.code ?? "")) out.errors++; return out; }
  for (const c of (condos as CondoRow[] | null) ?? []) {
    if (!time()) break;
    out.condos++;
    const r = await syncCondoMembers(db, c, now, time).catch(() => ({ synced: 0, notices: 0, errors: 1 }));
    out.synced += r.synced; out.notices += r.notices; out.errors += r.errors;
  }
  return out;
}
