// Correos transaccionales listos para llamar desde otros módulos (auth, onboarding, pagos ONVO).
import "server-only";
// Todas las funciones son seguras sin variables de entorno: devuelven { ok:false, skipped:true } y no lanzan.
import { adminClient } from "@/lib/supabase/admin";
import { ONCE_DAY } from "@/lib/notify";
import { sendEmail, type SendResult } from "./send";
import * as T from "./templates";

export { sendEmail, unsubscribeUrl, isEmailConfigured } from "./send";
export * as templates from "./templates";

/** Destinatario: pasa `userId` (se busca correo y nombre con service_role) y/o `to` + `name` directos. */
export type Recipient = { userId?: string; to?: string; name?: string };

async function resolve(r: Recipient): Promise<{ to: string; name: string; userId?: string } | null> {
  let to = r.to ?? "", name = r.name ?? "";
  if ((!to || !name) && r.userId) {
    const admin = adminClient();
    if (admin) {
      if (!to) { const { data } = await admin.auth.admin.getUserById(r.userId); to = data.user?.email ?? ""; }
      if (!name) { const { data } = await admin.from("profiles").select("full_name").eq("id", r.userId).maybeSingle(); name = (data?.full_name as string) ?? ""; }
    }
  }
  if (!to) return null;
  return { to, name: name || to.split("@")[0], userId: r.userId };
}

/** Reclama un envío único (bienvenida, plan listo). false si ya se había mandado. */
async function claimOnce(userId: string | undefined, kind: string): Promise<boolean> {
  const admin = userId ? adminClient() : null;
  if (!admin || !userId) return true;
  const { data, error } = await admin.from("notification_log")
    .upsert({ user_id: userId, kind, local_day: ONCE_DAY, channels: ["email"] }, { onConflict: "user_id,kind,local_day", ignoreDuplicates: true })
    .select("id");
  if (error) return true; // si la tabla aún no existe, no bloqueamos el correo (la idempotencia de Resend cubre reintentos)
  return (data?.length ?? 0) > 0;
}

/** Inserta un aviso en la campanita (service_role). */
export async function notifyInApp(userId: string, n: { kind: string; title: string; body?: string; url?: string }) {
  const admin = adminClient();
  if (!admin) return false;
  const { error } = await admin.from("notifications").insert({ user_id: userId, kind: n.kind, title: n.title, body: n.body ?? null, url: n.url ?? null });
  return !error;
}

const skip = (error = "sin destinatario"): SendResult => ({ ok: false, skipped: true, error });

/** Al crear la cuenta (primer login). Se manda una sola vez por usuario. */
export async function sendWelcomeEmail(r: Recipient): Promise<SendResult> {
  const to = await resolve(r);
  if (!to) return skip();
  if (!(await claimOnce(to.userId, "bienvenida"))) return skip("ya enviado");
  return sendEmail(to.to, T.bienvenida({ name: to.name }), { idempotencyKey: `bienvenida/${to.userId ?? to.to}`, tags: { kind: "bienvenida" } });
}

/** Al terminar el onboarding (/bienvenida). Una sola vez por usuario. */
export async function sendPlanReadyEmail(r: Recipient & Omit<Parameters<typeof T.planListo>[0], "name">): Promise<SendResult> {
  const to = await resolve(r);
  if (!to) return skip();
  if (!(await claimOnce(to.userId, "plan_listo"))) return skip("ya enviado");
  const { userId: _u, to: _t, name: _n, ...plan } = r;
  void _u; void _t; void _n;
  return sendEmail(to.to, T.planListo({ name: to.name, ...plan }), { idempotencyKey: `plan_listo/${to.userId ?? to.to}`, tags: { kind: "plan_listo" } });
}

type Pay = Omit<T.PaymentData, "name">;

/** Webhook ONVO: pago exitoso. `reference` (id del cargo) hace el envío idempotente. */
export async function sendPaymentReceipt(r: Recipient & Pay): Promise<SendResult> {
  const to = await resolve(r);
  if (!to) return skip();
  return sendEmail(to.to, T.reciboPago({ ...r, name: to.name }), { idempotencyKey: r.reference ? `recibo/${r.reference}` : undefined, tags: { kind: "recibo" } });
}

/** Webhook ONVO: cobro rechazado. También deja un aviso en la campanita. */
export async function sendPaymentFailed(r: Recipient & Pay & { retryDate?: string | null; updateUrl?: string; paused?: boolean }): Promise<SendResult> {
  const to = await resolve(r);
  if (!to) return skip();
  if (to.userId) await notifyInApp(to.userId, r.paused
    ? { kind: "pago_fallido", title: "No pudimos cobrar tu plan", body: "Cambia tu tarjeta para seguir. Tu progreso sigue guardado.", url: r.updateUrl?.startsWith("/") ? r.updateUrl : "/app/suscripcion" }
    : { kind: "pago_fallido", title: "Tu pago no pasó", body: "Actualiza tu método de pago para seguir sin pausa.", url: r.updateUrl?.startsWith("/") ? r.updateUrl : "/app/perfil" });
  return sendEmail(to.to, T.pagoFallido({ ...r, name: to.name }), { idempotencyKey: r.reference ? `pago_fallido/${r.reference}` : undefined, tags: { kind: "pago_fallido" } });
}

type ChargeMail = Omit<T.ChargeMailData, "name">;

/** Al guardar la tarjeta (prueba de 7 días o fin de la beta). Una vez por cobro programado (`chargeId`). */
export async function sendTrialStarted(r: Recipient & ChargeMail & { chargeId: number }): Promise<SendResult> {
  const to = await resolve(r);
  if (!to) return skip();
  const { userId: _u, to: _t, name: _n, chargeId, ...d } = r;
  void _u; void _t; void _n;
  return sendEmail(to.to, T.pruebaIniciada({ ...d, name: to.name }), { idempotencyKey: `prueba_iniciada/${chargeId}`, tags: { kind: "prueba_iniciada" } });
}

/** Día 5: "En 2 días se cobra tu plan". Idempotente por cobro (`chargeId`); el cron además lo reclama con reminder_sent_at. */
export async function sendChargeReminder(r: Recipient & ChargeMail & { chargeId: number }): Promise<SendResult> {
  const to = await resolve(r);
  if (!to) return skip();
  const { userId: _u, to: _t, name: _n, chargeId, ...d } = r;
  void _u; void _t; void _n;
  return sendEmail(to.to, T.recordatorioCobro({ ...d, name: to.name }), { idempotencyKey: `recordatorio_cobro/${chargeId}/${String(d.chargeAt).slice(0, 10)}`, tags: { kind: "recordatorio_cobro" } });
}

/** Canceló el cobro programado antes de que llegara. */
export async function sendChargeCanceled(r: Recipient & { plan: string; accessUntil?: string | null; cardKept: boolean; chargeId: number }): Promise<SendResult> {
  const to = await resolve(r);
  if (!to) return skip();
  return sendEmail(to.to, T.cobroCancelado({ name: to.name, plan: r.plan, accessUntil: r.accessUntil, cardKept: r.cardKept }), { idempotencyKey: `cobro_cancelado/${r.chargeId}`, tags: { kind: "cobro_cancelado" } });
}

/** Webhook ONVO / cancelación desde la app. */
export async function sendSubscriptionCanceled(r: Recipient & { plan: string; accessUntil?: string | null; subscriptionId?: string }): Promise<SendResult> {
  const to = await resolve(r);
  if (!to) return skip();
  return sendEmail(to.to, T.suscripcionCancelada({ name: to.name, plan: r.plan, accessUntil: r.accessUntil }), { idempotencyKey: r.subscriptionId ? `cancelada/${r.subscriptionId}` : undefined, tags: { kind: "cancelada" } });
}

/** Regalo de meses o recompensa por referidos. Idempotente por regalo (`grantId`). Transaccional. */
export async function sendGiftEmail(r: Recipient & Omit<Parameters<typeof T.regalo>[0], "name"> & { grantId: number }): Promise<SendResult> {
  const to = await resolve(r);
  if (!to) return skip();
  const { userId: _u, to: _t, name: _n, grantId, ...g } = r;
  void _u; void _t; void _n;
  return sendEmail(to.to, T.regalo({ ...g, name: to.name }), { idempotencyKey: `regalo/${grantId}`, tags: { kind: g.source } });
}

/** Te hicieron tester (o se renovó). Idempotente por asignación (`grantId`). Transaccional. */
export async function sendTesterEmail(r: Recipient & { grantId: number; expiresAt: string; renewal?: boolean; charge?: { amount: number; chargeAt: string } | null }): Promise<SendResult> {
  const to = await resolve(r);
  if (!to) return skip();
  return sendEmail(to.to, T.testerAsignado({ name: to.name, expiresAt: r.expiresAt, renewal: r.renewal, charge: r.charge }), { idempotencyKey: `tester/${r.grantId}`, tags: { kind: "tester" } });
}

/** Terminó el mes de tester: agradecimiento y qué pasa ahora. Idempotente por asignación. */
export async function sendTesterEndedEmail(r: Recipient & { grantId: number; endedAt: string }): Promise<SendResult> {
  const to = await resolve(r);
  if (!to) return skip();
  return sendEmail(to.to, T.testerTerminado({ name: to.name, endedAt: r.endedAt }), { idempotencyKey: `tester_fin/${r.grantId}`, tags: { kind: "tester_fin" } });
}

/** Aviso al equipo de un reporte nuevo desde la app (FEEDBACK_EMAIL o el correo de ayuda). Idempotente por reporte. */
export async function sendFeedbackToTeam(d: Omit<Parameters<typeof T.reporteEquipo>[0], "adminUrl"> & { reportId: number; userId: string }): Promise<SendResult> {
  const to = (process.env.FEEDBACK_EMAIL || "hola@bananaburn.app").trim();
  const { reportId, userId, ...rest } = d;
  return sendEmail(to, T.reporteEquipo({ ...rest, adminUrl: `/admin/usuarios/${userId}#s-tester` }), { idempotencyKey: `reporte/${reportId}`, tags: { kind: "reporte" } });
}
