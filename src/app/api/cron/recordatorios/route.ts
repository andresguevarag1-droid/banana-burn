import { NextResponse } from "next/server";
import { runReminders } from "@/lib/notify-run";
import { sweepChallenges } from "@/lib/challenges-server";
import { sweepAffiliates } from "@/lib/affiliates-server";
import { sweepCondos } from "@/lib/condos-server";
import { deliverPendingGifts } from "@/lib/gifts-server";
import { deliverTesterNotices } from "@/lib/testers-server";
import { deliverSupportNotices } from "@/lib/support-server";
import { sweepTrialCharges } from "@/lib/trial-billing";
import { sweepTilopayRenewals } from "@/lib/tilopay-billing";
import { sweepOnvoIntro } from "@/lib/onvo-intro";
import { purgeIdentityFiles } from "@/lib/identity-server";
import { nudgeUnseenNews } from "@/lib/novedades-server";
import { purgeHousekeeping } from "@/lib/housekeeping";
import { bearerOk } from "@/lib/security";
import { errCode, logError } from "@/lib/log";
import { beat, runMonitorMaintenance } from "@/lib/monitor/server";
import { cronFailed } from "@/lib/monitor/alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const authorized = (req: Request) => bearerOk(req.headers.get("authorization"), process.env.CRON_SECRET);

/**
 * Vercel Cron (diario por defecto; cada hora con NOTIFY_CRON_MODE=hourly en Pro). Protegido con `Authorization: Bearer CRON_SECRET`.
 * Además de los avisos, acredita el día anterior de los retos automáticos, cierra los retos decididos y manda el correo y
 * el push de regalos y recompensas por referidos que aún no se avisaron (respaldo: el panel y la app ya los mandan) y
 * los cobros con tarjeta guardada: aviso 2 días antes, cobro al terminar la prueba y un reintento al día siguiente.
 * También los avisos de testers de la beta (asignación, 3 días antes del final y agradecimiento).
 * También borra las fotos de verificaciones de identidad ya decididas o vencidas (máximo 30 días, 0030).
 * Y "Hay novedades en Banana Burn" (0036): push y campanita una vez por versión a quien no la vio en 3 días.
 * También el monitoreo (0041): purga de errores viejos, aviso si se dispararon y registro de esta corrida. Si la corrida
 * falla, aviso de sistema en Admin > Avisos (0063) y evento en Sentry.
 * Y la limpieza de tablas que crecen sin fin (0040).
 * Y las renovaciones con Tilopay (0042), que cobramos nosotros con la tarjeta guardada.
 * Y los condominios afiliados (0053): plan del condominio para sus residentes y aviso de fin del mes gratis.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ ok: true, skipped: "CRON_SECRET no configurado (modo demo)" });
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  // Presupuesto de tiempo por debajo de maxDuration: cada parte se detiene a tiempo y responde con lo que alcanzó.
  const t0 = Date.now();
  // Monitoreo (0041), primero porque es corto (2 consultas): borra errores de más de 30 días y avisa al dueño si se
  // dispararon en 24 h. Si falla, sigue lo demás.
  const monitoreo = await runMonitorMaintenance().catch((e) => { logError("cron:monitoreo", "run_failed", { kind: errCode(e) }); return null; });
  // Limpieza (0040): ventanas viejas de límites, tickets del coach y registros de avisos. Por lotes; primero porque es
  // rápida y así corre todos los días aunque lo de abajo use todo el tiempo.
  const limpieza = await purgeHousekeeping();
  const stats = await runReminders(new Date(), undefined, { deadline: t0 + 25_000 }).catch((e) => {
    logError("cron:recordatorios", "run_failed", { kind: errCode(e) });
    return { ok: false, mode: "daily" as const, scanned: 0, candidates: 0, sent: {}, push: 0, email: 0, errors: 1 };
  });
  // Tarjeta guardada (0026): aviso del día 5, cobro del día 7, reintento del día 8 y reconciliación. Idempotente: lo que no
  // alcance hoy lo toma la visita de la persona a la app o la próxima corrida. Cada llamada a ONVO tiene su tiempo límite (15 s).
  // Cobros nuevos solo hasta el segundo 35: un cobro puede tardar 20 s y la función se corta a los 60 (maxDuration). Lo que
  // no alcance lo toma la próxima corrida o la visita de la persona. Las consultas (sin cobro) pueden seguir hasta el límite.
  const chargeBy = t0 + 35_000;
  const cobros = await sweepTrialCharges(new Date(), { deadline: t0 + 42_000, chargeBy }).catch((e) => { logError("cron:cobros", "run_failed", { kind: errCode(e) }); return null; });
  // Tilopay (0042): renovaciones que cobramos nosotros (vence el periodo, se cobra la tarjeta guardada; rechazo = 3 intentos
  // diarios y luego se cancela) y compras directas por confirmar. null si Tilopay no está encendido.
  const renovaciones = await sweepTilopayRenewals(new Date(), { deadline: t0 + 47_000, chargeBy }).catch((e) => { logError("cron:renovaciones", "run_failed", { kind: errCode(e) }); return null; });
  // Primer mes con 50 % en ONVO (0043): al terminar ese mes se crea la suscripción normal a precio completo.
  const primerMes = await sweepOnvoIntro(new Date(), { deadline: t0 + 50_000, chargeBy }).catch((e) => { logError("cron:primer-mes", "run_failed", { kind: errCode(e) }); return null; });
  // Condominios afiliados (0053): plan del condominio activo para sus residentes y aviso de fin del mes gratis.
  const condominios = await sweepCondos(new Date(), { deadline: t0 + 51_500 }).catch((e) => { logError("cron:condominios", "run_failed", { kind: errCode(e) }); return null; });
  const retos = await sweepChallenges(new Date(), { deadline: t0 + 52_000 }).catch((e) => { logError("cron:retos", "run_failed", { kind: errCode(e) }); return null; });
  const regalos = await deliverPendingGifts({ limit: 200 }).catch((e) => { logError("cron:regalos", "run_failed", { kind: errCode(e) }); return null; });
  // Testers (0029): correo y push de asignaciones sin avisar, aviso de 3 días antes del final y agradecimiento al terminar.
  // El acceso no depende de esto: sale de la fecha de vencimiento.
  const testers = await deliverTesterNotices({ limit: 200 }).catch((e) => { logError("cron:testers", "run_failed", { kind: errCode(e) }); return null; });
  // Verificación de identidad (0030): fotos de lo ya decidido o vencido (30 días) fuera de Storage.
  const identidad = await purgeIdentityFiles({ deadline: t0 + 57_000 }).catch((e) => { logError("cron:identidad", "run_failed", { kind: errCode(e) }); return null; });
  // Soporte (0034): correo y push de eventos que no se alcanzaron a avisar al responder (respaldo).
  const soporte = await deliverSupportNotices({ limit: 200 }).catch((e) => { logError("cron:soporte", "run_failed", { kind: errCode(e) }); return null; });
  // Novedades (0036): una vez por versión, entre el día 3 y el 14, a quien no la vio. Reclamado en notification_log.
  const novedades = await nudgeUnseenNews({ limit: 300, deadline: t0 + 58_500 }).catch((e) => { logError("cron:novedades", "run_failed", { kind: errCode(e) }); return null; });
  // Referidores (0051): comisiones en espera → disponibles, acceso gratis del nivel máximo y limpieza de clics.
  const referidores = await sweepAffiliates(new Date(), { deadline: t0 + 59_000 }).catch((e) => { logError("cron:referidores", "run_failed", { kind: errCode(e) }); return null; });
  // Última corrida, para /admin/salud: solo conteos.
  await beat("cron:recordatorios", stats.ok, Date.now() - t0, { scanned: stats.scanned, errors: stats.errors, monitoreo: monitoreo !== null }).catch(() => {});
  // Falla = las consultas de recordatorios fallaron o el cobro de pruebas se cortó con un error (cobros null).
  if (!stats.ok || cobros === null) await cronFailed("recordatorios", { errores: stats.errors, cobros: cobros !== null });
  return NextResponse.json({ ...stats, retos, regalos, cobros, renovaciones, primerMes, testers, identidad, soporte, novedades, referidores, condominios, monitoreo, limpieza }, { status: stats.ok ? 200 : 500 });
}
