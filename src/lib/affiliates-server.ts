import "server-only";
// Programa de referidores en el servidor (0051). Reglas puras en affiliates.ts.
//   - Clics y cookie: /api/ref (desde cualquier página con ?ref=CÓDIGO). La cookie dura `cookie_days` y el último clic gana.
//   - Atribución: attributeAffiliate() justo al crear la cuenta (mismos lugares que los referidos de amigos). Si la cuenta
//     queda atribuida a un referidor, NO se atribuye a "Invita y gana": nunca hay doble recompensa por la misma persona.
//   - Comisiones: affiliateOnPaid() desde notifyPaid() en billing.ts, que es el único punto por donde pasa todo pago
//     verificado (ONVO webhook, primer mes con 50 %, Tilopay, renovaciones y anuales). Idempotente por pago.
//   - Barrido diario (cron): en espera → disponible, acceso gratis del nivel máximo y avisos.
//   - Pagos: runPayouts() arma el pago del mes por referidor (saldo disponible ≥ mínimo y con método de pago) y el dueño los
//     marca como pagados con la referencia del SINPE o la transferencia.
// Nunca lanza hacia los pagos: un error aquí queda en el registro y no frena un cobro ni un webhook.
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { adminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/env";
import { expectedAmountMinor } from "@/lib/onvo";
import type { Billing, PlanId } from "@/lib/plans";
import {
  AFF_COOKIE, DEFAULT_SETTINGS, INVITE_DAYS, availableAt, cleanUtm, commissionLine, normInviteEmail, normalizeAffCode, parseAffCookie,
  payoutDue, perkTarget, periodOf, sanitizeTiers, tierFor, type AffSettings, type Provider,
} from "@/lib/affiliates";

const log = (msg: string, meta?: Record<string, unknown>) => console.info(JSON.stringify({ scope: "referidores", msg, ...meta }));
const warn = (msg: string, meta?: Record<string, unknown>) => console.warn(JSON.stringify({ scope: "referidores", msg, ...meta }));
const MISSING = new Set(["PGRST202", "PGRST205", "42883", "42P01"]);
export const AFF_UTM_COOKIE = "bb_aff_utm";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export async function getAffSettings(db: SupabaseClient): Promise<AffSettings> {
  const { data, error } = await db.from("affiliate_settings").select("*").eq("id", 1).maybeSingle();
  if (error || !data) return DEFAULT_SETTINGS;
  const d = data as Record<string, unknown>;
  const n = (k: keyof AffSettings) => (d[k] == null ? (DEFAULT_SETTINGS[k] as number) : Number(d[k]));
  return {
    onvo_fee_pct: n("onvo_fee_pct"), onvo_fee_fixed_minor: n("onvo_fee_fixed_minor"),
    tilopay_fee_pct: n("tilopay_fee_pct"), tilopay_fee_fixed_minor: n("tilopay_fee_fixed_minor"),
    tax_pct: n("tax_pct"), hold_days: n("hold_days"), min_payout_minor: n("min_payout_minor"), cookie_days: n("cookie_days"),
    tiers: sanitizeTiers(d.tiers), perk_min: n("perk_min"),
  };
}

/**
 * Referidos que están PAGANDO hoy: suscripción pagada vigente, o en pago fallido dentro de 3 días de gracia. La prueba
 * gratis, las cortesías y los retos no cuentan; el primer mes con 50 % sí. (Misma regla que affiliate_active_count en 0051.)
 */
export async function activeCount(db: SupabaseClient, affiliateId: string, now = new Date()): Promise<number> {
  const { data: refs } = await db.from("affiliate_referrals").select("user_id").eq("affiliate_id", affiliateId);
  const ids = ((refs as { user_id: string }[] | null) ?? []).map((r) => r.user_id);
  if (!ids.length) return 0;
  const { data: subs } = await db.from("subscriptions").select("user_id,plan,status,current_period_end").in("user_id", ids).in("status", ["active", "past_due"]);
  const t = now.getTime();
  const live = new Set<string>();
  for (const s of (subs as { user_id: string; plan: string | null; status: string; current_period_end: string | null }[] | null) ?? []) {
    if (s.plan !== "entreno" && s.plan !== "completo") continue;
    const end = s.current_period_end ? Date.parse(s.current_period_end) : t + 1;
    if ((s.status === "active" && end > t) || (s.status === "past_due" && end > t - 3 * 864e5)) live.add(s.user_id);
  }
  return live.size;
}

// ───────────────────────── Comisiones ─────────────────────────

export type PaidInput = { userId: string; provider: Provider; reference: string; amountMinor: number | null; currency: string | null; plan: PlanId | null; billing: Billing | null };

/** ¿El referido pagó con una tarjeta que también usa su propio referidor? (autorreferido con otra cuenta). */
async function sameCard(db: SupabaseClient, a: string, b: string): Promise<boolean> {
  const { data, error } = await db.from("card_fingerprints").select("user_id,fingerprint").in("user_id", [a, b]);
  if (error) return false;
  const rows = (data as { user_id: string; fingerprint: string }[] | null) ?? [];
  const mine = new Set(rows.filter((r) => r.user_id === a).map((r) => r.fingerprint));
  return rows.some((r) => r.user_id === b && mine.has(r.fingerprint));
}

/**
 * Línea del libro por un pago YA verificado. Idempotente por pago (`payment_ref` único). Nunca lanza.
 * Resultado: "creada" | "duplicada" | "sin_referidor" | "inactivo" | "misma_tarjeta" | "moneda" | "sin_monto" | "error".
 */
export async function affiliateOnPaid(db: SupabaseClient, p: PaidInput, now = new Date()): Promise<string> {
  try {
    const { data: ref, error: refErr } = await db.from("affiliate_referrals").select("affiliate_id").eq("user_id", p.userId).maybeSingle();
    if (refErr) return MISSING.has(refErr.code ?? "") ? "sin_referidor" : "error";
    if (!ref) return "sin_referidor";
    const affId = (ref as { affiliate_id: string }).affiliate_id;
    const { data: aff } = await db.from("affiliates").select("user_id,active").eq("user_id", affId).maybeSingle();
    if (!aff || !(aff as { active: boolean }).active) return "inactivo";
    if (p.currency && p.currency.toUpperCase() !== "USD") { warn("pago en otra moneda: sin comisión", { userId: p.userId }); return "moneda"; }
    const gross = p.amountMinor ?? (p.plan && p.billing ? expectedAmountMinor(p.plan, p.billing) : null);
    if (!gross || gross <= 0) return "sin_monto";
    if (await sameCard(db, affId, p.userId)) { warn("autorreferido con la misma tarjeta: sin comisión", { affiliateId: affId }); return "misma_tarjeta"; }
    const s = await getAffSettings(db);
    const count = await activeCount(db, affId, now);
    const line = commissionLine({ grossMinor: gross, provider: p.provider, activeCount: count, settings: s });
    const { error } = await db.from("affiliate_commissions").insert({
      affiliate_id: affId, referred_user: p.userId, payment_ref: `${p.provider}:${p.reference}`, kind: "pago", provider: p.provider,
      plan: p.plan, billing: p.billing, gross_minor: gross, currency: "USD", fee_minor: line.fee, tax_minor: line.tax, net_minor: line.net,
      active_count: count, rate_pct: line.rate, commission_minor: line.commission, status: "pending", available_at: availableAt(now, s.hold_days).toISOString(),
    });
    if (error) {
      if (error.code === "23505" || /duplicate/i.test(error.message)) return "duplicada";
      if (MISSING.has(error.code ?? "")) return "sin_referidor";
      warn("no se pudo anotar la comisión", { code: error.code ?? null });
      return "error";
    }
    log("comisión anotada", { affiliateId: affId, rate: line.rate, commission: line.commission });
    return "creada";
  } catch (e) {
    warn("comisión falló", { error: e instanceof Error ? e.name : "?" });
    return "error";
  }
}

/**
 * Revierte una línea (reembolso o contracargo). En espera o disponible y sin pagar: queda revertida. Ya pagada: se crea un
 * ajuste negativo que se descuenta del próximo pago. Idempotente.
 */
export async function reverseCommission(db: SupabaseClient, lineId: number, reason: string, actor: string | null, now = new Date()): Promise<"revertida" | "ajuste" | "ya" | "no_existe"> {
  const { data } = await db.from("affiliate_commissions").select("id,affiliate_id,referred_user,status,commission_minor,kind,payout_id").eq("id", lineId).maybeSingle();
  const l = data as { id: number; affiliate_id: string; referred_user: string | null; status: string; commission_minor: number; kind: string; payout_id: number | null } | null;
  if (!l) return "no_existe";
  if (l.status === "reversed") return "ya";
  if (l.status !== "paid") {
    const { data: done } = await db.from("affiliate_commissions").update({ status: "reversed", reversed_at: now.toISOString(), note: reason.slice(0, 300), payout_id: null }).eq("id", l.id).neq("status", "paid").select("id");
    if (done?.length) return "revertida";
  }
  const { error } = await db.from("affiliate_commissions").insert({
    affiliate_id: l.affiliate_id, referred_user: l.referred_user, payment_ref: `ajuste:reverso:${l.id}`, kind: "ajuste",
    commission_minor: -Math.abs(l.commission_minor), status: "available", available_at: now.toISOString(), note: reason.slice(0, 300), created_by: actor,
  });
  return error && (error.code === "23505" || /duplicate/i.test(error.message)) ? "ya" : "ajuste";
}

/** Ajuste manual (positivo o negativo) con motivo. Disponible de una vez. */
export async function addAdjustment(db: SupabaseClient, affiliateId: string, amountMinor: number, reason: string, actor: string, now = new Date()) {
  if (!Number.isInteger(amountMinor) || amountMinor === 0 || Math.abs(amountMinor) > 1_000_000) throw new Error("Monto inválido.");
  const { error } = await db.from("affiliate_commissions").insert({
    affiliate_id: affiliateId, payment_ref: `ajuste:manual:${affiliateId}:${now.getTime()}:${randomBytes(3).toString("hex")}`, kind: "ajuste",
    commission_minor: amountMinor, status: "available", available_at: now.toISOString(), note: reason.slice(0, 300), created_by: actor,
  });
  if (error) throw new Error(error.message);
}

// ───────────────────────── Clics y atribución ─────────────────────────

/** Anota un clic (sin datos personales) y devuelve si el código existe y está activo. */
export async function recordClick(code: string, path: string | null, utm: Record<string, string>, ipHash: string | null): Promise<boolean> {
  const db = adminClient();
  if (!db) return false;
  const { data: aff } = await db.from("affiliates").select("user_id").eq("code", code).eq("active", true).maybeSingle();
  if (!aff) return false;
  const affId = (aff as { user_id: string }).user_id;
  // Un clic por red cada 30 minutos (recargar o volver no infla el conteo).
  if (ipHash) {
    const since = new Date(Date.now() - 30 * 60_000).toISOString();
    const { data: dup } = await db.from("affiliate_clicks").select("id").eq("affiliate_id", affId).eq("ip_hash", ipHash).gte("created_at", since).limit(1);
    if (dup?.length) return true;
  }
  await db.from("affiliate_clicks").insert({ affiliate_id: affId, ip_hash: ipHash, path: path ? path.slice(0, 200) : null, utm });
  return true;
}

/**
 * Atribuye una cuenta recién creada al referidor de la cookie. "atribuida" si quedó del referidor (entonces no se usa
 * "Invita y gana"); cualquier otro resultado deja seguir con los referidos de amigos. Nunca lanza.
 */
export async function attributeAffiliate(userId: string): Promise<string> {
  try {
    const store = await cookies();
    const c = parseAffCookie(store.get(AFF_COOKIE)?.value, Date.now(), 365);
    if (!c) return "sin_cookie";
    const db = adminClient();
    if (!db) return "sin_config";
    const s = await getAffSettings(db);
    if (Date.now() - Date.parse(c.clickedAt) > s.cookie_days * 864e5) return "vencida";
    let utm: Record<string, string> = {};
    try { utm = cleanUtm(JSON.parse(store.get(AFF_UTM_COOKIE)?.value ?? "{}")); } catch { /* sin UTM */ }
    const { data, error } = await db.rpc("affiliate_attribute", { p_user: userId, p_code: c.code, p_utm: utm, p_clicked_at: c.clickedAt });
    if (error) { if (!MISSING.has(error.code ?? "")) warn("atribución falló", { code: error.code ?? null }); return "error"; }
    const r = String(data);
    if (r === "atribuida") {
      try { store.delete(AFF_COOKIE); store.delete(AFF_UTM_COOKIE); } catch { /* componente de servidor: vence sola */ }
    }
    log("atribución", { result: r });
    return r;
  } catch {
    return "error";
  }
}

// ───────────────────────── Referidores: alta, invitación y código ─────────────────────────

/** Código sugerido a partir del nombre ("andres-4821"), único. */
export async function freeCode(db: SupabaseClient, name: string): Promise<string> {
  const base = (name || "banana").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 12) || "banana";
  for (let i = 0; i < 8; i++) {
    const code = normalizeAffCode(`${base.length >= 3 ? base : `${base}bb`}-${Math.floor(1000 + Math.random() * 9000)}`);
    if (!code) continue;
    const { data } = await db.from("affiliates").select("user_id").eq("code", code).maybeSingle();
    if (!data) return code;
  }
  return `bb-${randomBytes(4).toString("hex")}`;
}

/** Crea o reactiva a un referidor. Devuelve su código. */
export async function grantAffiliate(db: SupabaseClient, userId: string, actor: string | null, code?: string | null): Promise<string> {
  const { data: prev } = await db.from("affiliates").select("user_id,code,active").eq("user_id", userId).maybeSingle();
  const now = new Date().toISOString();
  if (prev) {
    const p = prev as { code: string; active: boolean };
    const next = code ? normalizeAffCode(code) ?? p.code : p.code;
    await db.from("affiliates").update({ active: true, revoked_at: null, revoked_by: null, code: next, updated_at: now }).eq("user_id", userId);
    return next;
  }
  const { data: prof } = await db.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  const wanted = code ? normalizeAffCode(code) : null;
  const final = wanted ?? (await freeCode(db, ((prof as { full_name?: string } | null)?.full_name ?? "").split(" ")[0]));
  const { error } = await db.from("affiliates").insert({ user_id: userId, code: final, active: true, created_by: actor });
  if (error) throw new Error(error.code === "23505" ? "Ese código ya lo usa otro referidor." : error.message);
  return final;
}

export const hashInviteToken = (t: string) => sha(`aff-invite|${t}`);

/** Invitación de un solo uso para un correo. Devuelve el enlace (se muestra una sola vez). */
export async function createInvite(db: SupabaseClient, email: string, code: string | null, actor: string): Promise<{ link: string; expiresAt: string }> {
  const e = normInviteEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error("Correo inválido.");
  const c = code ? normalizeAffCode(code) : null;
  if (code && !c) throw new Error("El código debe tener de 3 a 20 letras minúsculas, números o guiones.");
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 864e5).toISOString();
  const { error } = await db.from("affiliate_invites").insert({ email_norm: e, token_hash: hashInviteToken(token), code: c, created_by: actor, expires_at: expiresAt });
  if (error) throw new Error(error.message);
  return { link: `${SITE_URL.replace(/\/$/, "")}/referidor/invitacion?t=${encodeURIComponent(token)}`, expiresAt };
}

/** Canje de una invitación por la persona con sesión iniciada (el correo debe coincidir). */
export async function redeemInvite(userId: string, email: string, token: string): Promise<{ ok: true; code: string } | { ok: false; reason: "invalida" | "vencida" | "usada" | "otro_correo" | "sin_config" }> {
  const db = adminClient();
  if (!db) return { ok: false, reason: "sin_config" };
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return { ok: false, reason: "invalida" };
  const { data } = await db.from("affiliate_invites").select("id,email_norm,code,expires_at,used_at,used_by,canceled_at").eq("token_hash", hashInviteToken(token)).maybeSingle();
  const inv = data as { id: number; email_norm: string; code: string | null; expires_at: string; used_at: string | null; used_by: string | null; canceled_at: string | null } | null;
  if (!inv || inv.canceled_at) return { ok: false, reason: "invalida" };
  if (inv.used_at) {
    if (inv.used_by === userId) { const { data: a } = await db.from("affiliates").select("code").eq("user_id", userId).maybeSingle(); if (a) return { ok: true, code: (a as { code: string }).code }; }
    return { ok: false, reason: "usada" };
  }
  if (Date.parse(inv.expires_at) < Date.now()) return { ok: false, reason: "vencida" };
  if (normInviteEmail(email) !== inv.email_norm) return { ok: false, reason: "otro_correo" };
  const { data: claimed } = await db.from("affiliate_invites").update({ used_at: new Date().toISOString(), used_by: userId }).eq("id", inv.id).is("used_at", null).select("id");
  if (!claimed?.length) return { ok: false, reason: "usada" };
  const code = await grantAffiliate(db, userId, null, inv.code);
  await db.from("audit_log").insert({ actor: userId, action: "referidor.invitacion_aceptada", target: userId, meta: { invite: inv.id, code } });
  return { ok: true, code };
}

// ───────────────────────── Barrido diario ─────────────────────────

export type AffSweep = { available: number; perkOn: number; perkNotices: number; clicksPurged: number; errors: number };

/** En espera → disponible, acceso gratis del nivel máximo (dar, extender, avisar) y limpieza de clics. Nunca lanza. */
export async function sweepAffiliates(now = new Date(), opts: { deadline?: number } = {}): Promise<AffSweep> {
  const out: AffSweep = { available: 0, perkOn: 0, perkNotices: 0, clicksPurged: 0, errors: 0 };
  const db = adminClient();
  if (!db) return out;
  const time = () => !opts.deadline || Date.now() < opts.deadline;
  try {
    const { data: due, error } = await db.from("affiliate_commissions").update({ status: "available" }).eq("status", "pending").lte("available_at", now.toISOString()).select("id");
    if (error) { if (MISSING.has(error.code ?? "")) return out; out.errors++; }
    out.available = due?.length ?? 0;
    const s = await getAffSettings(db);
    const { data: affs } = await db.from("affiliates").select("user_id,active,perk_since,perk_notice_at").eq("active", true).limit(2000);
    for (const a of (affs as { user_id: string; perk_since: string | null; perk_notice_at: string | null }[] | null) ?? []) {
      if (!time()) break;
      try {
        const r = await syncPerk(db, a, s, now);
        if (r === "on") out.perkOn++;
        if (r === "notice") out.perkNotices++;
      } catch { out.errors++; }
    }
    const { data: purged } = await db.rpc("affiliate_clicks_purge", { p_days: 180 });
    out.clicksPurged = typeof purged === "number" ? purged : 0;
  } catch {
    out.errors++;
  }
  if (out.available || out.perkOn || out.perkNotices) log("barrido", out);
  return out;
}

/** Acceso gratis del nivel máximo para un referidor. */
export async function syncPerk(db: SupabaseClient, a: { user_id: string; perk_since: string | null; perk_notice_at: string | null }, s: AffSettings, now = new Date()): Promise<"on" | "off" | "notice" | "none"> {
  const count = await activeCount(db, a.user_id, now);
  const at = now.toISOString();
  const { data: grants } = await db.from("comp_grants").select("id,expires_at").eq("user_id", a.user_id).eq("source", "afiliado").is("revoked_at", null).gt("expires_at", at).order("expires_at", { ascending: false }).limit(1);
  const live = (grants as { id: number; expires_at: string }[] | null)?.[0] ?? null;
  if (count >= s.perk_min) {
    const target = perkTarget(now).toISOString();
    if (!live) await db.from("comp_grants").insert({ user_id: a.user_id, plan: "completo", reason: "Referidor en el nivel máximo", starts_at: at, expires_at: target, source: "afiliado" });
    else if (live.expires_at < target) await db.from("comp_grants").update({ expires_at: target }).eq("id", live.id);
    if (!a.perk_since) {
      await db.from("affiliates").update({ perk_since: at, perk_notice_at: null, updated_at: at }).eq("user_id", a.user_id);
      await stopOwnCharges(db, a.user_id);
      const { sendAffiliateEmail, notifyInApp } = await import("@/lib/email");
      await notifyInApp(a.user_id, { kind: "referidor", title: "Llegaste al nivel máximo", body: "Ganas el 40 % y Banana Burn ya no te cobra.", url: "/app/afiliados" }).catch(() => false);
      await sendAffiliateEmail({ userId: a.user_id, key: `perk-on/${a.user_id}/${periodOf(now)}`, kind: "nivel_maximo" }).catch(() => null);
      return "on";
    }
    if (a.perk_notice_at) await db.from("affiliates").update({ perk_notice_at: null, updated_at: at }).eq("user_id", a.user_id);
    return "none";
  }
  if (!a.perk_since) return "none";
  if (!live) {
    await db.from("affiliates").update({ perk_since: null, perk_notice_at: null, updated_at: at }).eq("user_id", a.user_id);
    return "off";
  }
  if (!a.perk_notice_at && Date.parse(live.expires_at) - now.getTime() <= 7 * 864e5) {
    await db.from("affiliates").update({ perk_notice_at: at, updated_at: at }).eq("user_id", a.user_id);
    const { sendAffiliateEmail, notifyInApp } = await import("@/lib/email");
    await notifyInApp(a.user_id, { kind: "referidor", title: "Tu acceso gratis vence pronto", body: `Bajaste de ${s.perk_min} referidos pagando. Si no vuelves al nivel máximo, tu acceso gratis termina a fin de mes.`, url: "/app/suscripcion" }).catch(() => false);
    await sendAffiliateEmail({ userId: a.user_id, key: `perk-off/${a.user_id}/${live.expires_at.slice(0, 10)}`, kind: "nivel_baja", until: live.expires_at, min: s.perk_min }).catch(() => null);
    return "notice";
  }
  return "none";
}

/** Al llegar al nivel máximo: su propio plan deja de renovarse y el cobro programado de la prueba se cancela (nunca cobro y acceso gratis a la vez). */
async function stopOwnCharges(db: SupabaseClient, userId: string) {
  try {
    const { cancelAtPeriodEnd } = await import("@/lib/billing");
    const { data } = await db.from("subscriptions").select("id").eq("user_id", userId).in("status", ["active", "trialing", "past_due"]).eq("cancel_at_period_end", false).limit(1);
    if (data?.length) await cancelAtPeriodEnd({ id: userId } as Parameters<typeof cancelAtPeriodEnd>[0], "referidor en el nivel máximo");
  } catch (e) {
    warn("no se pudo cancelar la renovación del referidor", { error: e instanceof Error ? e.name : "?" });
  }
  await db.from("trial_charges").update({ status: "canceled", canceled_at: new Date().toISOString(), next_attempt_at: null, updated_at: new Date().toISOString() }).eq("user_id", userId).in("status", ["scheduled", "retry_scheduled"]);
}

// ───────────────────────── Pagos mensuales ─────────────────────────

export type PayoutRun = { created: number; skippedLow: number; skippedNoMethod: number; total: number };

/** Arma el pago del mes para cada referidor con saldo disponible ≥ mínimo y método de pago. Idempotente por mes. */
export async function runPayouts(db: SupabaseClient, actor: string, now = new Date()): Promise<PayoutRun> {
  const out: PayoutRun = { created: 0, skippedLow: 0, skippedNoMethod: 0, total: 0 };
  await db.from("affiliate_commissions").update({ status: "available" }).eq("status", "pending").lte("available_at", now.toISOString());
  const s = await getAffSettings(db);
  const period = periodOf(now);
  const { data: lines } = await db.from("affiliate_commissions").select("id,affiliate_id,commission_minor").eq("status", "available").is("payout_id", null).limit(20000);
  const byAff = new Map<string, { ids: number[]; sum: number }>();
  for (const l of (lines as { id: number; affiliate_id: string; commission_minor: number }[] | null) ?? []) {
    const e = byAff.get(l.affiliate_id) ?? { ids: [], sum: 0 };
    e.ids.push(l.id); e.sum += l.commission_minor;
    byAff.set(l.affiliate_id, e);
  }
  for (const [affId, e] of byAff) {
    const { data: m } = await db.from("affiliate_payout_methods").select("kind,sinpe_phone,iban,holder_name,id_number").eq("user_id", affId).maybeSingle();
    if (!payoutDue(e.sum, s.min_payout_minor, !!m)) { if (!m) out.skippedNoMethod++; else out.skippedLow++; continue; }
    const { data: p, error } = await db.from("affiliate_payouts").insert({ affiliate_id: affId, period, amount_minor: e.sum, status: "pendiente", method: m, created_by: actor }).select("id").single();
    if (error || !p) continue; // ya había un pago abierto de este mes
    await db.from("affiliate_commissions").update({ payout_id: (p as { id: number }).id }).in("id", e.ids).eq("status", "available").is("payout_id", null);
    out.created++; out.total += e.sum;
  }
  if (out.created) {
    const { sendTeamAffiliatePayouts } = await import("@/lib/email");
    await sendTeamAffiliatePayouts({ period, count: out.created, totalMinor: out.total }).catch(() => null);
  }
  return out;
}

/** Marca un pago como hecho (referencia del SINPE o transferencia). Sus líneas pasan a pagadas. */
export async function markPayoutPaid(db: SupabaseClient, payoutId: number, reference: string, paidAt: string, actor: string) {
  const ref = reference.trim().slice(0, 120);
  if (!ref) throw new Error("Escribe la referencia del pago.");
  const when = Number.isFinite(Date.parse(paidAt)) ? new Date(paidAt).toISOString() : new Date().toISOString();
  const { data } = await db.from("affiliate_payouts").update({ status: "pagado", reference: ref, paid_at: when, paid_by: actor }).eq("id", payoutId).eq("status", "pendiente").select("id,affiliate_id");
  if (!data?.length) throw new Error("Ese pago ya no está pendiente.");
  await db.from("affiliate_commissions").update({ status: "paid", paid_at: when }).eq("payout_id", payoutId).eq("status", "available");
  const affId = (data[0] as { affiliate_id: string }).affiliate_id;
  const { notifyInApp } = await import("@/lib/email");
  await notifyInApp(affId, { kind: "referidor", title: "Te enviamos tu pago de referidos", body: `Referencia ${ref}.`, url: "/app/afiliados" }).catch(() => false);
}

/** Anula un pago pendiente: sus líneas vuelven a quedar disponibles para el próximo mes. */
export async function cancelPayout(db: SupabaseClient, payoutId: number) {
  const { data } = await db.from("affiliate_payouts").update({ status: "anulado" }).eq("id", payoutId).eq("status", "pendiente").select("id");
  if (!data?.length) throw new Error("Ese pago ya no está pendiente.");
  await db.from("affiliate_commissions").update({ payout_id: null }).eq("payout_id", payoutId).eq("status", "available");
}

export { tierFor };
