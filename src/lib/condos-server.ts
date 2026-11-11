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
import { amountMinorFor } from "@/lib/trial";
import type { Billing, PlanId } from "@/lib/plans";
import { CONDO_COOKIE, CONDO_TRY_DAYS, condoForAccount, condoFreeEnd, condoOffer, decideJoin, endingNoticeDue, joinMessage, normalizeCondoCode, syncGrant, type CondoGrant, type CondoRow, type JoinDecision } from "@/lib/condos";
import { errCode, logError } from "@/lib/log";

const MISSING = new Set(["42P01", "PGRST205", "42703", "PGRST204"]);
const BASE_COLS = "id,code,name,status,free_starts_at,free_ends_at,paid_plan,paid_until";
// 0066 (card_required, free_until). Sin la migración se lee sin esas columnas y todo sigue como en 0053.
const CONDO_COLS = `${BASE_COLS},card_required,free_until`;

async function selectCondos<T>(run: (cols: string) => PromiseLike<{ data: T | null; error: { code?: string } | null }>): Promise<{ data: T | null; error: { code?: string } | null }> {
  const r = await run(CONDO_COLS);
  if (r.error && (r.error.code === "42703" || r.error.code === "PGRST204")) return run(BASE_COLS);
  return r;
}

export async function condoByCode(db: SupabaseClient, code: string): Promise<CondoRow | null> {
  const { data, error } = await selectCondos<CondoRow>((cols) => db.from("condos").select(cols).eq("code", code).maybeSingle() as unknown as PromiseLike<{ data: CondoRow | null; error: { code?: string } | null }>);
  if (error) { if (!MISSING.has(error.code ?? "")) logError("condominios", "lookup_failed", { code: error.code }); return null; }
  return (data as CondoRow | null) ?? null;
}

/** #269: alta de la cuenta (profiles.created_at). Desde CARD_REQUIRED_FROM todos los condominios le piden la tarjeta. */
export async function createdAtOf(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await db.from("profiles").select("created_at").eq("id", userId).maybeSingle();
  return (data as { created_at?: string | null } | null)?.created_at ?? null;
}

/** 0066: ¿la cuenta tiene tarjeta activa de ONVO y su primer cobro programado (lo que pide un condominio con tarjeta)? */
export async function condoCardReady(db: SupabaseClient, userId: string): Promise<boolean> {
  const [{ data: pm }, { data: ch }] = await Promise.all([
    db.from("payment_methods").select("status,provider").eq("user_id", userId).maybeSingle(),
    db.from("trial_charges").select("status").eq("user_id", userId).maybeSingle(),
  ]);
  // Tilopay no cuenta: su token viene del navegador sin verificar y daría el acceso gratis sin una tarjeta real.
  const card = pm as { status?: string; provider?: string | null } | null;
  return card?.status === "active" && card.provider !== "tilopay" && (ch as { status?: string } | null)?.status === "scheduled";
}

/**
 * 0066: el primer cobro programado pasa a la fecha en que termina el acceso gratis del condominio, a precio normal (sin el
 * 50 % del primer mes) y con el aviso de 2 días antes listo otra vez. moved_from guarda la fecha original (como 0029).
 * Nunca adelanta un cobro ni toca uno que ya se está procesando (solo filas "scheduled" que caerían antes).
 */
export async function moveChargeToCondoEnd(db: SupabaseClient, userId: string, until: string, now = new Date()): Promise<boolean> {
  const { data } = await db.from("trial_charges").select("id,plan,billing,charge_at,moved_from,status").eq("user_id", userId).maybeSingle();
  const row = data as { id: number; plan: PlanId; billing: Billing; charge_at: string; moved_from?: string | null; status: string } | null;
  if (!row || row.status !== "scheduled") return false;
  // Precio normal siempre (aunque su fecha ya caiga después); la fecha solo se mueve si caería antes del fin del gratis.
  const move = Date.parse(row.charge_at) < Date.parse(until);
  const { data: done } = await db.from("trial_charges").update({
    ...(move ? { moved_from: row.moved_from ?? row.charge_at, charge_at: until, next_attempt_at: until, reminder_sent_at: null } : {}),
    promo: null, amount_minor: amountMinorFor(row.plan, row.billing), updated_at: now.toISOString(),
  }).eq("id", row.id).eq("status", "scheduled").select("id");
  return (done?.length ?? 0) > 0;
}

export type JoinResult = { kind: JoinDecision["kind"] | "sin_config"; condo: Pick<CondoRow, "name" | "code"> | null };

/** Vincula la cuenta al condominio del código. Idempotente: volver a abrir el enlace no da otro mes. */
export async function joinCondo(userId: string, rawCode: string, now = new Date()): Promise<JoinResult> {
  const code = normalizeCondoCode(rawCode);
  const db = adminClient();
  if (!db) return { kind: "sin_config", condo: null };
  const [found, createdAt] = await Promise.all([code ? condoByCode(db, code) : null, createdAtOf(db, userId).catch(() => null)]);
  // #269: desde el 1 de diciembre de 2026 la cuenta nueva necesita la tarjeta en cualquier condominio.
  const condo = found ? condoForAccount(found, createdAt) : null;
  const [{ data: member }, { data: grants }, paid, cardReady] = await Promise.all([
    db.from("condo_members").select("condo_id,grant_id").eq("user_id", userId).maybeSingle(),
    db.from("comp_grants").select("id").eq("user_id", userId).eq("source", "condominio").limit(1),
    hasLivePaidSubscription(db, userId).catch(() => false),
    condo?.card_required ? condoCardReady(db, userId).catch(() => false) : Promise.resolve(false),
  ]);
  const d = decideJoin({ condo, memberOf: (member as { condo_id: number } | null)?.condo_id ?? null, hadCondoGrant: (grants?.length ?? 0) > 0, hasPaidPlan: paid, cardReady, now });
  const out = (kind: JoinResult["kind"]): JoinResult => ({ kind, condo: condo ? { name: condo.name, code: condo.code } : null });
  // 0066: ya prueba en este condominio y ahora tiene tarjeta: su acceso sigue gratis hasta el fin y el cobro pasa a esa fecha.
  if (d.kind === "ya_vinculado" && condo?.card_required && cardReady) {
    const up = await upgradeCardMember(db, userId, condo, (member as { grant_id: number | null } | null)?.grant_id ?? null, now);
    return out(up ? "join" : "ya_vinculado");
  }
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
  if (d.card && d.pendingCard) {
    // Prueba sin tarjeta (0066): no hay cobro que mover. Al dejar la tarjeta, upgradeCardMember extiende el acceso.
  } else if (d.card) {
    // Con tarjeta (0066): el cobro sigue, pero pasa al final del acceso gratis y a precio normal.
    await moveChargeToCondoEnd(db, userId, d.expiresAt, now);
  } else {
    // Un cobro programado de su prueba individual ya no aplica: el condominio le da el acceso y nadie le cobra al terminar.
    await db.from("trial_charges").update({ status: "superseded", next_attempt_at: null, updated_at: at }).eq("user_id", userId).in("status", ["scheduled", "retry_scheduled"]);
  }
  const msg = joinMessage("join", condo.name, d.card ? (condo.free_until ?? d.freeEnd ?? d.expiresAt) : null, d.pendingCard ? d.expiresAt : null);
  const { notifyInApp } = await import("@/lib/email");
  await notifyInApp(userId, { kind: "condominio", title: msg.title, body: msg.body, url: "/app" }).catch(() => false);
  return out("join");
}

/**
 * 0066: residente que probaba sin tarjeta y ya la dejó lista. Su cortesía del condominio llega hasta el fin del acceso
 * gratis (se reactiva si había vencido) y el primer cobro pasa a esa fecha a precio normal. false: no había nada que extender.
 * `condo` ya viene con la regla de la cuenta (condoForAccount, #269). El fin es free_until (Soho Paradisus) o el fin de su
 * mes gratis (30 días desde que lo activó), nunca 30 días desde hoy.
 */
export async function upgradeCardMember(db: SupabaseClient, userId: string, condo: CondoRow, grantId: number | null, now = new Date()): Promise<boolean> {
  const offer = condoOffer(condo, now);
  if (!offer?.card || grantId == null) return false;
  const { data: g } = await db.from("comp_grants").select("id,starts_at,expires_at,revoked_at").eq("id", grantId).maybeSingle();
  const grant = g as { id: number; starts_at: string; expires_at: string; revoked_at: string | null } | null;
  if (!grant || grant.revoked_at) return false;
  const until = condoFreeEnd(condo, grant.starts_at);
  if (Date.parse(until) <= now.getTime() || Date.parse(grant.expires_at) >= Date.parse(until)) return false;
  const { error } = await db.from("comp_grants").update({ expires_at: until }).eq("id", grant.id).is("revoked_at", null);
  if (error) { logError("condominios", "upgrade_failed", { code: error.code }); return false; }
  await moveChargeToCondoEnd(db, userId, until, now);
  const msg = joinMessage("join", condo.name, until);
  const { notifyInApp } = await import("@/lib/email");
  await notifyInApp(userId, { kind: "condominio", title: msg.title, body: msg.body, url: "/app/suscripcion" }).catch(() => false);
  return true;
}

/**
 * 0066: al cancelar el cobro, el residente de un condominio con tarjeta pierde la extensión: su acceso del condominio vuelve
 * a su prueba (CONDO_TRY_DAYS desde que se unió), o termina hoy si ya pasó. Si deja la tarjeta otra vez, se extiende de nuevo.
 * Devuelve hasta cuándo sigue su acceso (null: no aplicaba).
 */
export async function cutCardCondoGrant(db: SupabaseClient, userId: string, now = new Date()): Promise<string | null> {
  const { data: m } = await db.from("condo_members").select("condo_id,grant_id").eq("user_id", userId).maybeSingle();
  const member = m as { condo_id: number; grant_id: number | null } | null;
  if (!member?.grant_id) return null;
  const { data: c } = await selectCondos<CondoRow>((cols) => db.from("condos").select(cols).eq("id", member.condo_id).maybeSingle() as unknown as PromiseLike<{ data: CondoRow | null; error: { code?: string } | null }>);
  // #269: con la tarjeta obligatoria, cualquier condominio de una cuenta nueva.
  if (!c || !condoForAccount(c as CondoRow, await createdAtOf(db, userId).catch(() => null)).card_required) return null;
  const { data: g } = await db.from("comp_grants").select("id,starts_at,expires_at,revoked_at").eq("id", member.grant_id).maybeSingle();
  const grant = g as { id: number; starts_at: string; expires_at: string; revoked_at: string | null } | null;
  if (!grant || grant.revoked_at) return null;
  const tryEnd = Date.parse(grant.starts_at) + CONDO_TRY_DAYS * 864e5;
  const until = new Date(Math.max(now.getTime(), tryEnd)).toISOString();
  if (Date.parse(grant.expires_at) <= Date.parse(until)) return Date.parse(grant.expires_at) > now.getTime() ? grant.expires_at : null;
  await db.from("comp_grants").update({ expires_at: until }).eq("id", grant.id).is("revoked_at", null);
  return Date.parse(until) > now.getTime() ? until : null;
}

export type PendingCardCondo = { code: string; name: string; freeUntil: string; tryUntil: string | null };

/** 0066: ¿la cuenta prueba sin tarjeta en un condominio con tarjeta (o ya se le acabó la prueba) y todavía puede dejarla? */
export async function pendingCardCondo(db: SupabaseClient, userId: string, now = new Date()): Promise<PendingCardCondo | null> {
  const { data: m, error } = await db.from("condo_members").select("condo_id,grant_id").eq("user_id", userId).maybeSingle();
  const member = m as { condo_id: number; grant_id: number | null } | null;
  if (error || !member) return null;
  const { data: c } = await selectCondos<CondoRow>((cols) => db.from("condos").select(cols).eq("id", member.condo_id).maybeSingle() as unknown as PromiseLike<{ data: CondoRow | null; error: { code?: string } | null }>);
  // #269: con la tarjeta obligatoria, cualquier condominio de una cuenta nueva.
  const condo = c ? condoForAccount(c as CondoRow, await createdAtOf(db, userId).catch(() => null)) : null;
  const offer = condo ? condoOffer(condo, now) : null;
  if (!condo || !offer?.card) return null;
  let tryUntil: string | null = null;
  let freeUntil = offer.expiresAt;
  if (member.grant_id != null) {
    const { data: g } = await db.from("comp_grants").select("starts_at,expires_at,revoked_at").eq("id", member.grant_id).maybeSingle();
    const grant = g as { starts_at?: string; expires_at: string; revoked_at: string | null } | null;
    // Sin fecha fija (#269), su mes gratis cuenta desde que lo activó.
    if (grant?.starts_at) freeUntil = condoFreeEnd(condo, grant.starts_at);
    if (Date.parse(freeUntil) <= now.getTime()) return null; // su mes gratis ya terminó
    if (grant && !grant.revoked_at && Date.parse(grant.expires_at) >= Date.parse(freeUntil)) return null; // ya tiene todo
    tryUntil = grant && !grant.revoked_at && Date.parse(grant.expires_at) > now.getTime() ? grant.expires_at : null;
  }
  return { code: condo.code, name: condo.name, freeUntil, tryUntil };
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
      // Con tarjeta (0066) no hay aviso de "termina tu mes gratis": el aviso del cobro (2 días antes) ya lo explica.
      // #269: tampoco para una cuenta nueva desde el 1 de diciembre (todos los condominios le piden la tarjeta).
      if (!c.card_required && endingNoticeDue(c, g, m.ending_notified_at, now) && !condoForAccount(c, await createdAtOf(db, m.user_id)).card_required) {
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
  const { data: condos, error } = await selectCondos<CondoRow[]>((cols) => db.from("condos").select(cols).in("status", ["mes_gratis", "activo"]).limit(1000) as unknown as PromiseLike<{ data: CondoRow[] | null; error: { code?: string } | null }>);
  if (error) { if (!MISSING.has(error.code ?? "")) out.errors++; return out; }
  for (const c of (condos as CondoRow[] | null) ?? []) {
    if (!time()) break;
    out.condos++;
    const r = await syncCondoMembers(db, c, now, time).catch(() => ({ synced: 0, notices: 0, errors: 1 }));
    out.synced += r.synced; out.notices += r.notices; out.errors += r.errors;
  }
  return out;
}
