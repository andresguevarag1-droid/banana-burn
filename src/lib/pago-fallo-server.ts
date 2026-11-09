import "server-only";
// Registro de cada pago que no se completó (#296): una fila "app.payment_failed" en payment_events (la lee /admin/pagos) y
// una línea en el log. Solo proveedor, etapa y código: nunca datos de la tarjeta, tokens ni textos del procesador.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Billing, PlanId } from "@/lib/plans";
import { logWarn } from "@/lib/log";
import { PAYMENT_FAILED, failKind, failNote, safeCode, type FailKind, type FailProvider, type FailStage } from "@/lib/pago-fallo";

export type PaymentFailure = {
  userId: string; provider: FailProvider; stage: FailStage; code: unknown; hint?: string | null;
  subId?: string | null; plan?: PlanId | null; billing?: Billing | null;
};

/**
 * Guarda el motivo. Idempotente: el mismo fallo de la misma suscripción (o de la misma persona en 10 minutos) es una fila.
 * Nunca lanza: un registro que falla no rompe el pago.
 */
export async function recordPaymentFailed(db: SupabaseClient | null, f: PaymentFailure, now = new Date()): Promise<FailKind> {
  const code = safeCode(f.code) ?? "desconocido";
  const kind = failKind(code, f.hint);
  logWarn("pagos", "payment_failed", { provider: f.provider, stage: f.stage, failCode: code, kind });
  if (!db) return kind;
  const scope = f.subId ? `s:${f.subId}` : `u:${f.userId}:${Math.floor(now.getTime() / 600_000)}`;
  try {
    const { error } = await db.from("payment_events").insert({
      provider: f.provider, event_key: `${PAYMENT_FAILED}:${scope}:${f.stage}:${code}`, type: PAYMENT_FAILED, user_id: f.userId,
      provider_subscription_id: f.subId ?? null, status: "processed", note: failNote(f.provider, f.stage, code, kind),
      payload: { provider: f.provider, stage: f.stage, code, kind, plan: f.plan ?? null, billing: f.billing ?? null }, processed_at: now.toISOString(),
    });
    if (error && !/duplicate|unique/i.test(error.message)) logWarn("pagos", "payment_failed_not_saved", { code: error.code ?? "error" });
  } catch {
    /* sin registro en la base: queda la línea del log */
  }
  return kind;
}
