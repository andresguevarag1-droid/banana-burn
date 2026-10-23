import { NextResponse } from "next/server";
import { runReminders } from "@/lib/notify-run";
import { sweepChallenges } from "@/lib/challenges-server";
import { bearerOk } from "@/lib/security";
import { errInfo } from "@/lib/security/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const authorized = (req: Request) => bearerOk(req.headers.get("authorization"), process.env.CRON_SECRET);

/**
 * Vercel Cron (diario por defecto; cada hora con NOTIFY_CRON_MODE=hourly en Pro). Protegido con `Authorization: Bearer CRON_SECRET`.
 * Además de los avisos, acredita el día anterior de los retos automáticos y cierra los retos decididos.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ ok: true, skipped: "CRON_SECRET no configurado (modo demo)" });
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  const stats = await runReminders();
  const retos = await sweepChallenges().catch((e) => { console.error("[cron:retos]", errInfo(e)); return null; });
  return NextResponse.json({ ...stats, retos }, { status: stats.ok ? 200 : 500 });
}
