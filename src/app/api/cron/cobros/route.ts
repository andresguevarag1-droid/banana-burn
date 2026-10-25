import { NextResponse } from "next/server";
import { sweepTrialCharges } from "@/lib/trial-billing";
import { sweepTilopayRenewals } from "@/lib/tilopay-billing";
import { sweepOnvoIntro } from "@/lib/onvo-intro";
import { bearerOk } from "@/lib/security";
import { errCode, logError } from "@/lib/log";
import { beat } from "@/lib/monitor/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Segundo cron diario, SOLO de cobros (vercel.json: 00:20 hora de Costa Rica, justo después de que vencen los cobros de
 * medianoche). El de las 7:00 (/api/cron/recordatorios) también cobra, pero primero manda los avisos y le quedan unos
 * 10 segundos para cobrar. Este dedica toda la función a cobrar, con 4 cobros a la vez: el 8 de noviembre vencen juntas
 * todas las cuentas de la beta que dejaron tarjeta. Lo que no alcance lo toma la corrida de las 7:00, la del día
 * siguiente o la visita de la persona a la app (que cobra en el momento). Nunca cobra dos veces: cada fila se reclama.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ ok: true, skipped: "CRON_SECRET no configurado (modo demo)" });
  if (!bearerOk(req.headers.get("authorization"), process.env.CRON_SECRET)) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  const t0 = Date.now();
  // Cobros nuevos solo hasta el segundo 40 (uno puede tardar 20 s y la función se corta a los 60).
  const chargeBy = t0 + 40_000;
  const cobros = await sweepTrialCharges(new Date(), { deadline: t0 + 50_000, chargeBy, concurrency: 4, skipReminders: true, limit: 400 }).catch((e) => { logError("cron:cobros", "run_failed", { kind: errCode(e) }); return null; });
  const primerMes = await sweepOnvoIntro(new Date(), { deadline: t0 + 54_000, chargeBy }).catch((e) => { logError("cron:cobros", "intro_failed", { kind: errCode(e) }); return null; });
  const renovaciones = await sweepTilopayRenewals(new Date(), { deadline: t0 + 57_000, chargeBy }).catch((e) => { logError("cron:cobros", "renewals_failed", { kind: errCode(e) }); return null; });
  const ok = cobros !== null;
  await beat("cron:cobros", ok, Date.now() - t0, { intentados: cobros?.attempted ?? 0, enviados: cobros?.sent ?? 0, errores: cobros?.errors ?? 0 }).catch(() => {});
  return NextResponse.json({ ok, cobros, primerMes, renovaciones }, { status: ok ? 200 : 500 });
}
