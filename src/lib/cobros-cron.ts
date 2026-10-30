import "server-only";
// La lógica del cron de cobros (/api/cron/cobros), aparte de la ruta para que el simulacro (scripts/simular-cobros.ts) corra
// exactamente lo mismo con una fecha fija. dryRun: los tres barridos solo leen y reportan (sin procesador ni escrituras).
import { sweepTrialCharges, type SweepStats } from "@/lib/trial-billing";
import { sweepTilopayRenewals, type RenewalStats } from "@/lib/tilopay-billing";
import { sweepOnvoIntro, type IntroStats } from "@/lib/onvo-intro";
import { errCode, logError } from "@/lib/log";
import type { PlannedCharge } from "@/lib/cobros-simulacro";

export type CobrosRun = { cobros: SweepStats | null; primerMes: IntroStats | null; renovaciones: RenewalStats | null };

export async function runCobros(now: Date, opts: { t0?: number; dryRun?: boolean } = {}): Promise<CobrosRun> {
  if (opts.dryRun) {
    // Sin tiempo límite: el simulacro lista a todas las personas, no solo las que alcanzaría una corrida.
    const cobros = await sweepTrialCharges(now, { dryRun: true }).catch((e) => { logError("cron:cobros", "dry_run_failed", { kind: errCode(e) }); return null; });
    const primerMes = await sweepOnvoIntro(now, { dryRun: true }).catch((e) => { logError("cron:cobros", "dry_intro_failed", { kind: errCode(e) }); return null; });
    const renovaciones = await sweepTilopayRenewals(now, { dryRun: true }).catch((e) => { logError("cron:cobros", "dry_renewals_failed", { kind: errCode(e) }); return null; });
    return { cobros, primerMes, renovaciones };
  }
  const t0 = opts.t0 ?? Date.now();
  // Cobros nuevos solo hasta el segundo 40 (uno puede tardar 20 s y la función se corta a los 60).
  const chargeBy = t0 + 40_000;
  const cobros = await sweepTrialCharges(now, { deadline: t0 + 50_000, chargeBy, concurrency: 4, skipReminders: true, limit: 400 }).catch((e) => { logError("cron:cobros", "run_failed", { kind: errCode(e) }); return null; });
  const primerMes = await sweepOnvoIntro(now, { deadline: t0 + 54_000, chargeBy }).catch((e) => { logError("cron:cobros", "intro_failed", { kind: errCode(e) }); return null; });
  const renovaciones = await sweepTilopayRenewals(now, { deadline: t0 + 57_000, chargeBy }).catch((e) => { logError("cron:cobros", "renewals_failed", { kind: errCode(e) }); return null; });
  return { cobros, primerMes, renovaciones };
}

/**
 * Todos los cobros planeados de una corrida en dryRun, y cuántos barridos fallaron. Un barrido sin lista (sin base o con
 * error) cuenta como falla: un simulacro incompleto nunca se reporta como "0 cobros".
 */
export function plannedOf(run: CobrosRun): { planned: PlannedCharge[]; errors: number } {
  const parts = [run.cobros, run.primerMes, run.renovaciones];
  return {
    planned: parts.flatMap((p) => p?.planned ?? []),
    errors: parts.reduce((n, p) => n + (!p?.planned ? 1 : p.errors), 0),
  };
}
