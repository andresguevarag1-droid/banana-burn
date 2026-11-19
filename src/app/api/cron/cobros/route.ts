import { NextResponse } from "next/server";
import { plannedOf, runCobros } from "@/lib/cobros-cron";
import { summarize } from "@/lib/cobros-simulacro";
import { bearerOk } from "@/lib/security";
import { beat, checkErrorRate } from "@/lib/monitor/server";
import { cronFailed } from "@/lib/monitor/alerts";
import { revalidatePath } from "next/cache";
import { CARD_COPY_PATHS, cardSwitchDay } from "@/lib/card-required";
import { sendCobrosResumen } from "@/lib/cobros-diarios-server";

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
 * Si la corrida real falla o algún cobro terminó con error, deja un aviso de sistema en Admin > Avisos (y en Sentry); también
 * revisa la tasa de errores. Al terminar manda el resumen del día a hola@bananaburn.app (#330), solo si hubo cobros.
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
  // #269: el 23 de noviembre de 2026 las páginas públicas se regeneran ya, sin esperar su hora de caché ("sin tarjeta" sale ese día).
  if (cardSwitchDay()) for (const p of CARD_COPY_PATHS) { try { revalidatePath(p); } catch { /* la caché vence sola en 1 h */ } }
  const { cobros, primerMes, renovaciones } = await runCobros(new Date(), { t0 });
  const ok = cobros !== null;
  await beat("cron:cobros", ok, Date.now() - t0, { intentados: cobros?.attempted ?? 0, enviados: cobros?.sent ?? 0, errores: cobros?.errors ?? 0 }).catch(() => {});
  if (!ok) await cronFailed("cobros", { renovaciones: renovaciones !== null, primerMes: primerMes !== null });
  else {
    // Un error en cualquiera de los tres barridos avisa, aunque los cobros de prueba hayan salido bien.
    // runCobros convierte una excepción de un barrido en null: eso también avisa (no es "cero errores").
    const introErr = primerMes?.errors ?? 0, renewErr = renovaciones?.errors ?? 0;
    const introThrew = primerMes === null, renewThrew = renovaciones === null;
    if (cobros.errors + introErr + renewErr > 0 || introThrew || renewThrew) {
      await cronFailed("cobros", {
        errores: cobros.errors, intentados: cobros.attempted,
        ...(introErr > 0 ? { erroresPrimerMes: introErr } : {}), ...(renewErr > 0 ? { erroresRenovaciones: renewErr } : {}),
        ...(introThrew ? { primerMesFallo: true } : {}), ...(renewThrew ? { renovacionesFallo: true } : {}),
      });
    }
  }
  await sendCobrosResumen().catch(() => {});
  await checkErrorRate().catch(() => {});
  return NextResponse.json({ ok, cobros, primerMes, renovaciones }, { status: ok ? 200 : 500 });
}
