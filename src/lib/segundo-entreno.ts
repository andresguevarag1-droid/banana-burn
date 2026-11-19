// Segundo entreno (#286): quien entrena 2 o 3 veces en sus 7 días gratis es quien paga. Se mide con la columna "Segundo
// entreno" de /admin/embudo (2 o más workouts con finished_at en los primeros 7 días).
//
// El correo "Tu segundo entreno está listo" de #286 pasó a ser R2 de la secuencia de regreso (#320, regreso.ts y
// docs/emails/regreso.md); quien ya lo recibió (notification_log, kind segundo_entreno) tiene R2 por enviado.
import { DAY_MS } from "./trial";

/** Días de la prueba: el embudo cuenta los entrenos terminados en ellos. */
export const TRIAL_DAYS = 7;

/** Entrenos terminados (finished_at) dentro de los primeros 7 días desde `createdAt`. */
export function finishedInTrial(createdAt: string | null | undefined, finished: (string | null)[]): number {
  const c = Date.parse(createdAt ?? "");
  if (!Number.isFinite(c)) return 0;
  return finished.filter((f) => { const t = Date.parse(f ?? ""); return Number.isFinite(t) && t >= c && t < c + TRIAL_DAYS * DAY_MS; }).length;
}
