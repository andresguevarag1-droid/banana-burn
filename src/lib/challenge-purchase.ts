// Compra de retos Premium con ONVO (pago único en USD). SOLO SERVIDOR.
// Regla de oro (igual que los planes): el acceso a un reto de pago SOLO lo otorga el webhook al confirmar el pago
// (grantChallengePurchase) o el staff con una cortesía auditada (admin_grant_challenge). Nunca el cliente.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import type { Viewer } from "@/lib/supabase/server";
import { createPaymentIntent, getPaymentIntent, isOnvoOneTimeReady } from "@/lib/onvo";
import { BillingError, getOrCreateCustomer } from "@/lib/billing";
import { fromCatalogRow, openState, priceMinor, type CatalogRow } from "@/lib/challenges";
import { levelOf, perksAt } from "@/lib/gamify";
import { todayFor } from "@/lib/today";
import { sumXp } from "@/lib/xp-total";

const STORE_COLS = "slug,title,description,days,rules,status,price_usd,difficulty,minutes,cover,icon,verify,grace,xp,steps_goal,badge,reward_title,start_mode,start_date,featured,coming_soon,safety_note,sort";
const log = (msg: string, meta?: Record<string, unknown>) => console.info(JSON.stringify({ scope: "pagos-retos", msg, ...meta }));

export type PurchaseRow = { id: number; user_id: string; challenge_slug: string; status: string; amount_minor: number; currency: string; provider_payment_intent_id: string | null; created_at: string };

/**
 * ¿El cobro que informa ONVO paga la compra? Pura y testeada.
 * Moneda distinta de USD o monto menor al guardado al iniciar la compra: no se otorga. Mayor: se otorga con nota.
 */
export function checkChallengeAmount(expectedMinor: number, amountMinor: number | null, currency: string | null): { ok: boolean; note?: string } {
  if (amountMinor === null) return { ok: false, note: "ONVO no informó el monto" };
  if (currency && currency.toUpperCase() !== "USD") return { ok: false, note: `moneda ${currency} (se esperaba USD)` };
  if (amountMinor < expectedMinor) return { ok: false, note: `monto ${amountMinor} < ${expectedMinor} centavos USD` };
  if (amountMinor > expectedMinor) return { ok: true, note: `monto ${amountMinor} > ${expectedMinor} centavos USD` };
  return { ok: true };
}

/** Inicia la compra: crea el PaymentIntent en ONVO con el precio del servidor y guarda la compra pendiente. */
export async function startChallengeCheckout(v: Viewer, slug: string): Promise<{ url: string }> {
  const db = adminClient();
  if (!db) throw new BillingError("Pagos no configurados: falta SUPABASE_SERVICE_ROLE_KEY.", 503);
  if (!isOnvoOneTimeReady()) throw new BillingError("Los pagos aún no están activos. Intenta más tarde.", 503);
  const { data: row } = await db.from("challenges_catalog").select(STORE_COLS).eq("slug", slug).maybeSingle();
  const c = row ? fromCatalogRow(row as CatalogRow) : null;
  if (!c || c.status !== "publicado") throw new BillingError("Este reto ya no está disponible.", 404);
  if (c.priceUsd <= 0) throw new BillingError("Este reto es gratis: únete directamente.", 400);
  if (openState(c, todayFor(v).iso) === "cerrado") throw new BillingError("Este reto ya cerró inscripciones.", 409);

  const { data: owned } = await db.from("challenge_entitlements").select("challenge_slug").eq("user_id", v.id).eq("challenge_slug", slug).maybeSingle();
  if (owned) throw new BillingError("Ya tienes este reto.", 409);

  // Paginado: con más de 1000 eventos una sola lectura daría un nivel (y un descuento) menor al real.
  const xp = await sumXp(db, v.id).catch(() => 0);
  const discount = perksAt(levelOf(xp).idx).discountPct;
  const listMinor = priceMinor(c.priceUsd, 0);
  const amount = priceMinor(c.priceUsd, discount);

  // Doble clic o volver atrás: reutiliza la compra pendiente reciente con el mismo monto.
  const hourAgo = new Date(Date.now() - 3600e3).toISOString();
  const { data: pend } = await db.from("challenge_purchases").select("provider_payment_intent_id,amount_minor").eq("user_id", v.id).eq("challenge_slug", slug).eq("status", "pendiente").gte("created_at", hourAgo).order("created_at", { ascending: false }).limit(1);
  const reuse = (pend ?? [])[0] as { provider_payment_intent_id: string | null; amount_minor: number } | undefined;
  if (reuse?.provider_payment_intent_id && reuse.amount_minor === amount) return { url: `/pago/reto?pi=${encodeURIComponent(reuse.provider_payment_intent_id)}` };

  const customerId = await getOrCreateCustomer(db, v);
  const pi = await createPaymentIntent({ amountMinor: amount, customerId, description: `Banana Burn: reto ${c.title}`, metadata: { userId: v.id, challenge: slug } });
  if (!pi?.id) throw new BillingError("ONVO no devolvió el cobro.", 502);
  const { error } = await db.from("challenge_purchases").insert({
    user_id: v.id, challenge_slug: slug, status: "pendiente", amount_minor: amount, list_price_minor: listMinor, discount_pct: discount,
    currency: "USD", provider_payment_intent_id: pi.id, provider_customer_id: customerId,
  });
  if (error) { log("no se pudo guardar la compra pendiente", { userId: v.id, pi: pi.id, error: error.message }); throw new BillingError("No se pudo iniciar el pago. Intenta de nuevo.", 500); }
  log("compra de reto iniciada", { userId: v.id, slug, amount, discount });
  return { url: `/pago/reto?pi=${encodeURIComponent(pi.id)}` };
}

export type GrantResult = { status: "processed" | "ignored"; note: string; userId: string };

/**
 * Webhook: si el PaymentIntent corresponde a una compra de reto, la marca pagada y otorga el acceso. Idempotente.
 * Devuelve null si el cobro no es de un reto (el webhook sigue con la lógica de suscripciones).
 * Si el evento no trae el monto, se consulta el PaymentIntent en ONVO (servidor a servidor con la llave secreta).
 */
export async function grantChallengePurchase(
  db: SupabaseClient, paymentIntentId: string, amountMinor: number | null, currency: string | null,
  fetchIntent: (id: string) => Promise<{ status?: string; amount?: number; currency?: string }> = getPaymentIntent,
): Promise<GrantResult | null> {
  const { data } = await db.from("challenge_purchases").select("id,user_id,challenge_slug,status,amount_minor,currency,provider_payment_intent_id,created_at").eq("provider_payment_intent_id", paymentIntentId).maybeSingle();
  const row = data as PurchaseRow | null;
  if (!row) return null;
  if (row.status === "pagado") return { status: "processed", note: `reto ${row.challenge_slug} ya otorgado`, userId: row.user_id };
  let amount = amountMinor, cur = currency;
  if (amount === null) {
    const pi = await fetchIntent(paymentIntentId);
    if ((pi.status ?? "").toLowerCase() !== "succeeded") return { status: "ignored", note: `NO OTORGADO: PaymentIntent en estado ${pi.status ?? "?"}`, userId: row.user_id };
    amount = typeof pi.amount === "number" ? pi.amount : null;
    cur = pi.currency ?? cur;
  }
  const check = checkChallengeAmount(row.amount_minor, amount, cur);
  if (!check.ok) {
    console.error(JSON.stringify({ scope: "pagos-retos", msg: "ALERTA monto inválido: no se otorga", userId: row.user_id, pi: paymentIntentId, note: check.note }));
    await db.from("challenge_purchases").update({ note: `NO OTORGADO: ${check.note}` }).eq("id", row.id);
    return { status: "ignored", note: `NO OTORGADO: ${check.note}`, userId: row.user_id };
  }
  const { error: upErr } = await db.from("challenge_purchases").update({ status: "pagado", paid_at: new Date().toISOString(), note: check.note ?? null }).eq("id", row.id).eq("status", "pendiente");
  if (upErr) throw new Error(`challenge_purchases: ${upErr.message}`);
  const { error: entErr } = await db.from("challenge_entitlements").upsert({ user_id: row.user_id, challenge_slug: row.challenge_slug, source: "compra", purchase_id: row.id }, { onConflict: "user_id,challenge_slug", ignoreDuplicates: true });
  if (entErr) throw new Error(`challenge_entitlements: ${entErr.message}`);
  log("reto otorgado", { userId: row.user_id, slug: row.challenge_slug, pi: paymentIntentId });
  return { status: "processed", note: `reto ${row.challenge_slug} otorgado${check.note ? ` (${check.note})` : ""}`, userId: row.user_id };
}
