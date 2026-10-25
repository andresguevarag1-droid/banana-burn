// Compra y canje de temporadas. SOLO SERVIDOR.
// Regla de oro (igual que planes y retos): una temporada se otorga SOLO con un pago confirmado servidor a servidor
// (webhook de ONVO con grantChallengePurchase, o la consulta de la orden en Tilopay) o con el canje del plan anual
// verificado aquí con la suscripción guardada. Nunca con datos del navegador. El precio es el de public.seasons.
import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import type { Viewer } from "@/lib/supabase/server";
import { BillingError, getOrCreateCustomer } from "@/lib/billing";
import { createPaymentIntent, isOnvoOneTimeReady } from "@/lib/onvo";
import { consultOrder, createPaymentUrl, isTilopayConfigured } from "@/lib/tilopay";
import { getEntitlements } from "@/lib/entitlements";
import { todayFor } from "@/lib/today";
import { canEnroll, canRedeemAnnual, purchaseBlock, type AnnualSub, type SeasonInfo } from "@/lib/seasons";
import { getSeason } from "@/lib/seasons-server";

const log = (msg: string, meta?: Record<string, unknown>) => console.info(JSON.stringify({ scope: "pagos-temporadas", msg, ...meta }));

function admin(): SupabaseClient {
  const a = adminClient();
  if (!a) throw new BillingError("Pagos no configurados: falta SUPABASE_SERVICE_ROLE_KEY.", 503);
  return a;
}

const owns = async (db: SupabaseClient, userId: string, slug: string) =>
  !!(await db.from("challenge_entitlements").select("challenge_slug").eq("user_id", userId).eq("challenge_slug", slug).maybeSingle()).data;

/** Revisa que se pueda comprar: temporada vigente, inscripciones abiertas, sin repetir y con plan o prueba. */
async function checkBuyable(db: SupabaseClient, v: Viewer, slug: string): Promise<SeasonInfo> {
  const s = await getSeason(false, slug);
  if (!s) throw new BillingError("Esta temporada no existe.", 404);
  const ent = await getEntitlements(v);
  const block = purchaseBlock(s, { owned: await owns(db, v.id, slug), today: todayFor(v).iso, hasAccess: ent.app });
  if (block) throw new BillingError(block, 409);
  return s;
}

// ───────────── ONVO: pago único con el SDK (la misma página que los retos) ─────────────

export async function startSeasonOnvo(v: Viewer, slug: string): Promise<{ url: string }> {
  const db = admin();
  if (!isOnvoOneTimeReady()) throw new BillingError("Los pagos aún no están activos. Intenta más tarde.", 503);
  const s = await checkBuyable(db, v, slug);
  const hourAgo = new Date(Date.now() - 3600e3).toISOString();
  const { data: pend } = await db.from("challenge_purchases").select("provider_payment_intent_id,amount_minor,provider").eq("user_id", v.id).eq("challenge_slug", slug).eq("status", "pendiente").eq("provider", "onvo").gte("created_at", hourAgo).order("created_at", { ascending: false }).limit(1);
  const reuse = (pend ?? [])[0] as { provider_payment_intent_id: string | null; amount_minor: number } | undefined;
  if (reuse?.provider_payment_intent_id && reuse.amount_minor === s.priceMinor) return { url: `/pago/temporada?pi=${encodeURIComponent(reuse.provider_payment_intent_id)}` };
  const customerId = await getOrCreateCustomer(db, v);
  const pi = await createPaymentIntent({ amountMinor: s.priceMinor, customerId, description: `Banana Burn: ${s.title}`, metadata: { userId: v.id, challenge: slug } });
  if (!pi?.id) throw new BillingError("ONVO no devolvió el cobro.", 502);
  const { error } = await db.from("challenge_purchases").insert({
    user_id: v.id, challenge_slug: slug, status: "pendiente", amount_minor: s.priceMinor, list_price_minor: s.priceMinor, discount_pct: 0,
    currency: "USD", provider: "onvo", provider_payment_intent_id: pi.id, provider_customer_id: customerId,
  });
  if (error) throw new BillingError("No se pudo iniciar el pago. Intenta de nuevo.", 500);
  log("compra de temporada iniciada (ONVO)", { userId: v.id, slug, amount: s.priceMinor });
  return { url: `/pago/temporada?pi=${encodeURIComponent(pi.id)}` };
}

// ───────────── Tilopay: página de pago y consulta de la orden ─────────────

const STATE_MAX_AGE_MS = 2 * 3600_000;
function secret(env: NodeJS.ProcessEnv = process.env) {
  const s = env.TILOPAY_STATE_SECRET?.trim() || env.TILOPAY_API_PASSWORD?.trim();
  return s ? `bb-temporada-vuelta:${s}` : null;
}
export type SeasonReturnState = { u: string; s: string; o: string; t: number };
export function signSeasonState(x: Omit<SeasonReturnState, "t">, now = Date.now(), env: NodeJS.ProcessEnv = process.env) {
  const k = secret(env);
  if (!k) throw new BillingError("Tilopay no está configurado.", 503);
  const payload = Buffer.from(JSON.stringify({ ...x, t: Math.floor(now / 1000) })).toString("base64url");
  return `${payload}.${createHmac("sha256", k).update(payload).digest("base64url")}`;
}
export function verifySeasonState(token: string | null | undefined, now = Date.now(), env: NodeJS.ProcessEnv = process.env): SeasonReturnState | null {
  const k = secret(env);
  if (!k || !token || token.length > 600) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const want = createHmac("sha256", k).update(payload).digest();
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const x = JSON.parse(Buffer.from(payload, "base64url").toString()) as SeasonReturnState;
    if (typeof x.u !== "string" || typeof x.s !== "string" || !/^bbs-[a-z0-9]{8,32}$/.test(x.o) || typeof x.t !== "number") return null;
    if (now - x.t * 1000 > STATE_MAX_AGE_MS || x.t * 1000 - now > 60_000) return null;
    return x;
  } catch {
    return null;
  }
}

export async function startSeasonTilopay(v: Viewer, slug: string, origin: string, country: string | null): Promise<{ url: string }> {
  const db = admin();
  if (!isTilopayConfigured()) throw new BillingError("Los pagos aún no están activos. Intenta más tarde.", 503);
  const s = await checkBuyable(db, v, slug);
  const order = `bbs-${randomBytes(9).toString("hex")}`;
  const state = signSeasonState({ u: v.id, s: slug, o: order });
  const { error } = await db.from("challenge_purchases").insert({
    user_id: v.id, challenge_slug: slug, status: "pendiente", amount_minor: s.priceMinor, list_price_minor: s.priceMinor, discount_pct: 0,
    currency: "USD", provider: "tilopay", provider_payment_intent_id: order,
  });
  if (error) throw new BillingError("No se pudo iniciar el pago. Intenta de nuevo.", 500);
  const url = await createPaymentUrl({ redirect: `${origin}/api/temporadas/tilopay/vuelta?s=${encodeURIComponent(state)}`, email: v.email, name: v.name, amountMinor: s.priceMinor, orderNumber: order, country, returnData: Buffer.from(slug).toString("base64url") });
  log("compra de temporada iniciada (Tilopay)", { userId: v.id, slug, amount: s.priceMinor });
  return { url };
}

/** ¿El cobro confirmado paga la compra? Moneda USD y monto no menor al guardado. Pura y probada. */
export function checkSeasonAmount(expected: number, amount: number | null, currency: string | null): boolean {
  if (amount === null) return false;
  if (currency && currency.toUpperCase() !== "USD") return false;
  return amount >= expected;
}

export type SeasonReturn = "pagada" | "confirmando" | "rechazada";

/** Vuelta de Tilopay: consulta la orden (servidor a servidor) y, si está aprobada con el monto correcto, otorga. Idempotente. */
export async function confirmSeasonTilopay(v: Viewer, st: SeasonReturnState): Promise<SeasonReturn> {
  const db = admin();
  if (st.u !== v.id) return "rechazada";
  const { data: row } = await db.from("challenge_purchases").select("id,user_id,challenge_slug,status,amount_minor").eq("provider_payment_intent_id", st.o).eq("user_id", v.id).maybeSingle();
  if (!row || row.challenge_slug !== st.s) return "rechazada";
  if (row.status === "pagado") return "pagada";
  const c = await consultOrder(st.o);
  if (c.state === "unknown") return "confirmando";
  if (c.state === "declined") {
    await db.from("challenge_purchases").update({ status: "fallido", note: "Tilopay: rechazada" }).eq("id", row.id).eq("status", "pendiente");
    return "rechazada";
  }
  if (!checkSeasonAmount(row.amount_minor as number, c.amountMinor, c.currency)) {
    console.error(JSON.stringify({ scope: "pagos-temporadas", msg: "ALERTA monto inválido: no se otorga", userId: v.id, order: st.o }));
    await db.from("challenge_purchases").update({ note: "NO OTORGADO: monto o moneda no coinciden" }).eq("id", row.id);
    return "rechazada";
  }
  await db.from("challenge_purchases").update({ status: "pagado", paid_at: new Date().toISOString() }).eq("id", row.id).eq("status", "pendiente");
  const { error } = await db.from("challenge_entitlements").upsert({ user_id: v.id, challenge_slug: st.s, source: "compra", purchase_id: row.id }, { onConflict: "user_id,challenge_slug", ignoreDuplicates: true });
  if (error) throw new Error(`challenge_entitlements: ${error.message}`);
  log("temporada otorgada (Tilopay)", { userId: v.id, slug: st.s });
  return "pagada";
}

// ───────────── Plan anual: 1 temporada incluida por periodo pagado ─────────────

export type RedeemResult = { ok: true; slug: string } | { ok: false; error: string; status: number };

/**
 * Canje de la temporada incluida en el plan anual. Verifica en la base: suscripción anual activa y pagada (no en prueba),
 * sin canje en este periodo, temporada abierta y sin repetir. La fila de season_redemptions (única por periodo) frena
 * dos canjes simultáneos. Si después el plan se cancela o se reembolsa, la temporada canjeada sigue sus 8 semanas.
 */
export async function redeemAnnualSeason(v: Viewer, slug: string): Promise<RedeemResult> {
  const db = admin();
  const s = await getSeason(false, slug);
  if (!s) return { ok: false, error: "Esta temporada no existe.", status: 404 };
  if (!canEnroll(s, todayFor(v).iso)) return { ok: false, error: "Las inscripciones de esta temporada cerraron.", status: 409 };
  if (await owns(db, v.id, slug)) return { ok: false, error: "Ya tienes esta temporada.", status: 409 };
  const [{ data: subs }, { data: reds }] = await Promise.all([
    db.from("subscriptions").select("id,billing,status,current_period_start,current_period_end,plan").eq("user_id", v.id),
    db.from("season_redemptions").select("sub_id,period_start").eq("user_id", v.id),
  ]);
  const k = canRedeemAnnual((subs ?? []) as AnnualSub[], (reds ?? []) as { sub_id: string; period_start: string }[]);
  if (!k) return { ok: false, error: "Tu plan anual ya incluyó una temporada en este periodo, o todavía no tienes un plan anual pagado.", status: 409 };
  const { data: red, error } = await db.from("season_redemptions").insert({ user_id: v.id, slug, sub_id: k.subId, period_start: k.periodStart }).select("id").single();
  if (error || !red) return { ok: false, error: "Ya usaste la temporada incluida en tu plan anual.", status: 409 };
  const { error: entErr } = await db.from("challenge_entitlements").upsert({ user_id: v.id, challenge_slug: slug, source: "anual", reason: `Plan anual ${k.subId} desde ${k.periodStart}` }, { onConflict: "user_id,challenge_slug", ignoreDuplicates: true });
  if (entErr) {
    await db.from("season_redemptions").delete().eq("id", red.id);
    return { ok: false, error: "No pudimos activar tu temporada. Intenta de nuevo.", status: 500 };
  }
  log("temporada canjeada con el plan anual", { userId: v.id, slug, sub: k.subId });
  return { ok: true, slug };
}
