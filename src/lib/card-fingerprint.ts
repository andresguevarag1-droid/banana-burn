import "server-only";
// Huella de la tarjeta (0045) para que la promoción del 50 % del primer mes sea una vez por TARJETA, no por cuenta: una
// cuenta nueva con la misma tarjeta no la vuelve a ganar si esa tarjeta ya la recibió o ya pagó en otra cuenta.
// Guardar la tarjeta nunca se bloquea por esto: solo se pierde la promoción. Solo service_role lee y escribe la tabla.
//
//   ONVO: la huella del procesador si la devuelve (no está documentada); si no, sha256 de marca + últimos 4 + vencimiento.
//   Tilopay: no devuelve datos de la tarjeta fiables en la vuelta; se usa el token (si Tilopay da el mismo token a la misma
//   tarjeta, se detecta; si no, no se pierde nada).
// Riesgo aceptado: dos tarjetas distintas con la misma marca, últimos 4 y vencimiento comparten huella (poco probable); en
// ese caso la segunda cuenta solo pierde la promoción.
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PayProvider } from "@/lib/pay-provider";

const MISSING = new Set(["PGRST202", "PGRST205", "42883", "42P01"]);
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export type FingerprintInput = { provider: PayProvider; paymentMethodId: string; brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null; providerFingerprint?: string | null };

/** Huella de la tarjeta (sha256 en hex) o null si no hay datos suficientes. Pura. */
export function cardFingerprint(c: FingerprintInput): string | null {
  if (c.providerFingerprint && /^[A-Za-z0-9_-]{6,200}$/.test(c.providerFingerprint)) return sha(`${c.provider}|fp|${c.providerFingerprint}`);
  if (c.provider === "tilopay") return c.paymentMethodId ? sha(`tilopay|tok|${c.paymentMethodId}`) : null;
  if (!c.brand || !c.last4 || !c.expMonth || !c.expYear) return null;
  return sha(`onvo|${c.brand}|${c.last4}|${c.expMonth}|${c.expYear}`);
}

const keyOf = (fp: string, userId: string) => `${fp}:${userId}`;

/** ¿Esta tarjeta ya recibió la promoción o ya pagó en OTRA cuenta? Sin la tabla (sin 0045): false. */
export async function promoUsedByCard(db: SupabaseClient, userId: string, fp: string | null): Promise<boolean> {
  if (!fp) return false;
  const { data, error } = await db.from("card_fingerprints").select("user_id,promo,paid").eq("fingerprint", fp).limit(50);
  if (error) return false;
  return ((data as { user_id: string | null; promo: boolean; paid: boolean }[] | null) ?? []).some((r) => r.user_id !== userId && (r.promo || r.paid));
}

/** Anota la tarjeta de esta cuenta (y si ganó la promoción). Nunca falla hacia afuera. */
export async function recordCardFingerprint(db: SupabaseClient, userId: string, fp: string | null, provider: PayProvider, promo: boolean): Promise<void> {
  if (!fp) return;
  const at = new Date().toISOString();
  const row: Record<string, unknown> = { key: keyOf(fp, userId), fingerprint: fp, user_id: userId, provider, updated_at: at };
  if (promo) row.promo = true;
  const { error } = await db.from("card_fingerprints").upsert(row, { onConflict: "key" });
  if (error && !MISSING.has(error.code ?? "")) console.warn(JSON.stringify({ scope: "pagos", msg: "no se pudo anotar la huella de la tarjeta", code: error.code ?? null }));
}

/** La cuenta pagó un plan: sus tarjetas quedan marcadas como "ya pagó" (la promoción no vuelve en otra cuenta). */
export async function markCardsPaid(db: SupabaseClient, userId: string): Promise<void> {
  const { error } = await db.from("card_fingerprints").update({ paid: true, updated_at: new Date().toISOString() }).eq("user_id", userId);
  if (error && !MISSING.has(error.code ?? "")) console.warn(JSON.stringify({ scope: "pagos", msg: "no se pudo marcar la tarjeta como pagada", code: error.code ?? null }));
}
