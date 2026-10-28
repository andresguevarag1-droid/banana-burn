import { NextResponse } from "next/server";
import { bearerOk } from "@/lib/security";
import { errCode, logError } from "@/lib/log";
import { dispatchAdminEvents, sendDailySummary } from "@/lib/admin-avisos-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron diario de avisos al dueño (vercel.json: 02:00 UTC, 20:00 en Costa Rica): manda lo que haya quedado pendiente en
 * la bandeja y el resumen del día (registros, primeros entrenos, pagos, ingresos y cobros rechazados).
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ ok: true, skipped: "CRON_SECRET no configurado (modo demo)" });
  if (!bearerOk(req.headers.get("authorization"), process.env.CRON_SECRET)) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  const pendientes = await dispatchAdminEvents({ limit: 200 }).catch((e) => { logError("cron:avisos", "dispatch_failed", { kind: errCode(e) }); return null; });
  const resumen = await sendDailySummary().catch((e) => { logError("cron:avisos", "summary_failed", { kind: errCode(e) }); return null; });
  return NextResponse.json({ ok: resumen !== null, pendientes, resumen });
}
