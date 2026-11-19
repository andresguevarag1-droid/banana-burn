import "server-only";
// Lecturas de los cobros del día a día (#330), con service_role: próximos 7 días para /admin/pagos (después de
// requireSection), resumen por correo del cron de cobros y aviso si ese cron no corrió. Reglas en cobros-diarios.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import { crDayRange } from "@/lib/admin-avisos-server";
import { sendEmail } from "@/lib/email/send";
import { FEES, listPrice, type Processor } from "@/lib/embudo-plata";
import { errCode, logError } from "@/lib/log";
import { aliasOf, buildResumen, resumenEmail, resumenKey, upcomingWindow, type CobrosResumen, type DayCharge, type UpcomingCharge } from "@/lib/cobros-diarios";

/** Buzón que recibe el resumen diario de cobros. */
export const RESUMEN_TO = "hola@bananaburn.app";

const proc = (p: string | null | undefined): Processor => (p === "tilopay" ? "tilopay" : "onvo");
/** Solo las suscripciones que cobra un procesador: las de condominio, regaladas o de prueba no se renuevan con tarjeta. */
const PROCESSORS = Object.keys(FEES) as Processor[];

type ChargeRow = { user_id: string; plan: string | null; billing: string | null; amount_minor: number; next_attempt_at: string; status: string; attempts: number };
type SubRow = { user_id: string; provider: string | null; plan: string | null; billing: string | null; current_period_end: string; renewal_attempts: number | null };

/**
 * Cobros programados de hoy y los 6 días siguientes (hora de Costa Rica): primeros cobros y reintentos (trial_charges) y
 * renovaciones de suscripciones que no se cancelan. null si no se pudo leer (el panel dice "sin dato", nunca "0").
 */
export async function loadUpcoming(now = new Date(), db: SupabaseClient | null = adminClient()): Promise<UpcomingCharge[] | null> {
  if (!db) return null;
  const { end } = upcomingWindow(now);
  const [tc, subs] = await Promise.all([
    db.from("trial_charges").select("user_id,plan,billing,amount_minor,next_attempt_at,status,attempts").in("status", ["scheduled", "retry_scheduled"]).lt("next_attempt_at", end).order("next_attempt_at").limit(2000),
    db.from("subscriptions").select("user_id,provider,plan,billing,current_period_end,renewal_attempts").in("status", ["active", "past_due"]).in("provider", PROCESSORS).eq("cancel_at_period_end", false)
      .gte("current_period_end", upcomingWindow(now).start).lt("current_period_end", end).order("current_period_end").limit(2000),
  ]);
  if (tc.error || subs.error) { logError("admin:pagos", "upcoming_failed", { kind: tc.error?.code ?? subs.error?.code ?? "error" }); return null; }
  const charges = (tc.data ?? []) as ChargeRow[];
  const renewals = (subs.data ?? []) as SubRow[];
  const ids = [...new Set([...charges, ...renewals].map((r) => r.user_id))];
  const [profs, methods] = ids.length
    ? await Promise.all([
      db.from("profiles").select("id,username,full_name").in("id", ids),
      db.from("payment_methods").select("user_id,provider,status").in("user_id", ids).eq("status", "active"),
    ])
    : [{ data: [] }, { data: [] }];
  const alias = new Map(((profs.data ?? []) as { id: string; username: string | null; full_name: string | null }[]).map((p) => [p.id, aliasOf(p)]));
  const method = new Map(((methods.data ?? []) as { user_id: string; provider: string | null }[]).map((m) => [m.user_id, proc(m.provider)]));
  return [
    ...charges.map((c): UpcomingCharge => ({
      at: c.next_attempt_at, userId: c.user_id, alias: alias.get(c.user_id) ?? "Sin nombre", plan: c.plan, billing: c.billing, amountMinor: c.amount_minor,
      processor: method.get(c.user_id) ?? "onvo", attempt: c.attempts + 1, kind: c.status === "retry_scheduled" ? "reintento" : "primer_cobro",
    })),
    ...renewals.map((s): UpcomingCharge => ({
      at: s.current_period_end, userId: s.user_id, alias: alias.get(s.user_id) ?? "Sin nombre", plan: s.plan, billing: s.billing, amountMinor: listPrice(s.plan, s.billing) ?? 0,
      processor: proc(s.provider), attempt: (s.renewal_attempts ?? 0) + 1, kind: "renovacion",
    })),
  ];
}

/** ¿Ya había entrado algún pago real antes de `before`? (un cobro de la prueba que pasó o una suscripción pagada). */
async function paidBefore(db: SupabaseClient, before: string): Promise<boolean> {
  const [tc, subs] = await Promise.all([
    db.from("trial_charges").select("id").eq("status", "succeeded").lt("last_attempt_at", before).limit(1),
    db.from("subscriptions").select("id").in("status", ["active", "past_due", "canceled"]).not("provider_subscription_id", "is", null).lt("created_at", before).limit(1),
  ]);
  if (tc.error || subs.error) throw new Error(tc.error?.message ?? subs.error?.message);
  return (tc.data?.length ?? 0) > 0 || (subs.data?.length ?? 0) > 0;
}

/**
 * Resumen por correo de los cobros del día (lo llama el cron de las 00:20 al terminar): cuántos pasaron, cuántos
 * fallaron y por qué, y el neto. Sin cobros ese día no manda nada. Una llave de idempotencia por día: si Vercel
 * reintenta el cron, Resend no lo manda dos veces. sendEmail respeta la lista de rebotes (0072). Nunca lanza.
 */
export async function sendCobrosResumen(now = new Date(), db: SupabaseClient | null = adminClient()): Promise<{ sent: boolean; resumen: CobrosResumen | null }> {
  if (!db) return { sent: false, resumen: null };
  try {
    const { start, end, label } = crDayRange(now);
    const { data, error } = await db.from("trial_charges").select("user_id,status,amount_minor,last_error").gte("last_attempt_at", start).lt("last_attempt_at", end).limit(2000);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { user_id: string; status: string; amount_minor: number; last_error: string | null }[];
    if (!rows.length) return { sent: false, resumen: null };
    const { data: pm } = await db.from("payment_methods").select("user_id,provider").in("user_id", [...new Set(rows.map((r) => r.user_id))]).eq("status", "active");
    const method = new Map(((pm ?? []) as { user_id: string; provider: string | null }[]).map((m) => [m.user_id, proc(m.provider)]));
    const day: DayCharge[] = rows.map((r) => ({ status: r.status, amountMinor: r.amount_minor, processor: method.get(r.user_id) ?? "onvo", lastError: r.last_error }));
    const resumen = buildResumen(day, label, await paidBefore(db, start));
    if (!resumen) return { sent: false, resumen: null };
    const r = await sendEmail(RESUMEN_TO, resumenEmail(resumen), { idempotencyKey: resumenKey(label), tags: { tipo: "cobros_resumen" } });
    return { sent: r.ok, resumen };
  } catch (e) {
    logError("cron:cobros", "resumen_failed", { kind: errCode(e) });
    return { sent: false, resumen: null };
  }
}

/**
 * ¿El cron de cobros de hoy (00:20) no corrió? Lo pregunta el cron de las 7:00: si el último latido de cron:cobros es de
 * antes de las 00:00 de hoy en Costa Rica (o no hay), no corrió. null si no se pudo leer.
 */
export async function cobrosCronMissed(now = new Date(), db: SupabaseClient | null = adminClient()): Promise<boolean | null> {
  if (!db) return null;
  const { data, error } = await db.from("ops_heartbeats").select("last_at").eq("name", "cron:cobros").maybeSingle();
  if (error) return null;
  const last = (data as { last_at: string | null } | null)?.last_at;
  return !last || Date.parse(last) < Date.parse(crDayRange(now).start);
}
