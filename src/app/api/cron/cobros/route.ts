import { NextResponse } from "next/server";
import { plannedOf, runCobros } from "@/lib/cobros-cron";
import { summarize } from "@/lib/cobros-simulacro";
import { bearerOk } from "@/lib/security";
import { beat } from "@/lib/monitor/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Segundo cron diario, SOLO de cobros (vercel.json: 00:20 hora de Costa Rica, justo después de que vencen los cobros de
 * medianoche). El de las 7:00 (/api/cron/recordatorios) también cobra, pero primero manda los avisos y le quedan unos
 * 10 segundos para cobrar. Este dedica toda la función a cobrar, con 4 cobros a la vez: el 8 de noviembre vencen juntas
 * todas las cuentas de la beta que dejaron tarjeta. Lo que no alcance lo toma la corrida de las 7:00, la del día
 * siguiente o la visita de la persona a la app (que cobra en el momento). Nunca cobra dos veces: cada fila se reclama y
 * cada cobro reserva su llave única (0062) antes de llamar al procesador.
 *
 * Simulacro: ?dryRun=1 (con el mismo CRON_SECRET) calcula a quién se cobraría, cuánto y con qué procesador, sin llamar a
 * ONVO ni a Tilopay y sin escribir nada (ni el latido del monitor). &at=<ISO> simula otra fecha (solo con dryRun).
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ ok: true, skipped: "CRON_SECRET no configurado (modo demo)" });
  if (!bearerOk(req.headers.get("authorization"), process.env.CRON_SECRET)) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  if (q.get("dryRun") === "1") {
    const atParam = q.get("at");
    const now = atParam ? new Date(atParam) : new Date();
    if (!Number.isFinite(now.getTime())) return NextResponse.json({ ok: false, error: "Fecha inválida" }, { status: 400 });
    const { planned, errors } = plannedOf(await runCobros(now, { dryRun: true }));
    return NextResponse.json({ ok: errors === 0, dryRun: true, resumen: summarize(planned, now.toISOString()), cobros: planned }, { status: errors === 0 ? 200 : 500 });
  }
  const t0 = Date.now();
  const { cobros, primerMes, renovaciones } = await runCobros(new Date(), { t0 });
  const ok = cobros !== null;
  await beat("cron:cobros", ok, Date.now() - t0, { intentados: cobros?.attempted ?? 0, enviados: cobros?.sent ?? 0, errores: cobros?.errors ?? 0 }).catch(() => {});
  return NextResponse.json({ ok, cobros, primerMes, renovaciones }, { status: ok ? 200 : 500 });
}
