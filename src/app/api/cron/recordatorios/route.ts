import { NextResponse } from "next/server";
import { runReminders } from "@/lib/notify-run";
import { sweepChallenges } from "@/lib/challenges-server";
import { deliverPendingGifts } from "@/lib/gifts-server";
import { deliverTesterNotices } from "@/lib/testers-server";
import { sweepTrialCharges } from "@/lib/trial-billing";
import { bearerOk } from "@/lib/security";
import { errCode, logError } from "@/lib/log";

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
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ ok: true, skipped: "CRON_SECRET no configurado (modo demo)" });
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  // Presupuesto de tiempo por debajo de maxDuration: cada parte se detiene a tiempo y responde con lo que alcanzó.
  const t0 = Date.now();
  const stats = await runReminders(new Date(), undefined, { deadline: t0 + 25_000 }).catch((e) => {
    logError("cron:recordatorios", "run_failed", { kind: errCode(e) });
    return { ok: false, mode: "daily" as const, scanned: 0, candidates: 0, sent: {}, push: 0, email: 0, errors: 1 };
  });
  // Tarjeta guardada (0026): aviso del día 5, cobro del día 7, reintento del día 8 y reconciliación. Idempotente: lo que no
  // alcance hoy lo toma la visita de la persona a la app o la próxima corrida. Cada llamada a ONVO tiene su tiempo límite (15 s).
  const cobros = await sweepTrialCharges(new Date(), { deadline: t0 + 42_000 }).catch((e) => { logError("cron:cobros", "run_failed", { kind: errCode(e) }); return null; });
  const retos = await sweepChallenges(new Date(), { deadline: t0 + 52_000 }).catch((e) => { logError("cron:retos", "run_failed", { kind: errCode(e) }); return null; });
  const regalos = await deliverPendingGifts({ limit: 200 }).catch((e) => { logError("cron:regalos", "run_failed", { kind: errCode(e) }); return null; });
  // Testers (0029): correo y push de asignaciones sin avisar, aviso de 3 días antes del final y agradecimiento al terminar.
  // El acceso no depende de esto: sale de la fecha de vencimiento.
  const testers = await deliverTesterNotices({ limit: 200 }).catch((e) => { logError("cron:testers", "run_failed", { kind: errCode(e) }); return null; });
  return NextResponse.json({ ...stats, retos, regalos, cobros, testers }, { status: stats.ok ? 200 : 500 });
}
