// Correos del cierre de inscripciones de la Temporada 1 (docs/emails/temporada-1-cierre.md): quién recibe cada pieza.
// Reglas puras y testeadas (temporada-cierre.test.ts); el envío lo hace runReminders (notify-run.ts).
//
// - 16 y 21 de noviembre de 2026, fechas de Costa Rica (las del calendario de la temporada), en la corrida del recordatorio.
//   Sin recuperar envíos atrasados: el del 21 dice «mañana», así que solo sale el 21.
// - A quien tiene acceso hoy por plan o prueba activa (el mismo acceso que exige comprar una temporada, purchaseBlock) y
//   no tiene ninguna de las tres Temporada 1 en challenge_entitlements (compra, canje anual o cortesía). Se revalida en
//   cada envío: quien se inscribió después del primer correo no recibe el segundo.
// - Es un aviso comercial: exige el permiso de novedades y promociones (notification_prefs.marketing, apagado por defecto)
//   y su baja es la de "marketing". El staff no lo recibe.
// - Una pieza por cuenta y fecha, y nunca dos correos el mismo día local (lo resuelve runReminders).
//
// Embudo: compra extra de temporada ($14.99, $16.99 o $18.99, seasons.ts) y mensual a anual ($59.99 o $89.99, plans.ts).
// Se mide con notification_log (kind temporada1_cierre_16 y temporada1_cierre_21; channels vacío = pieza omitida) cruzado
// con las inscripciones nuevas a Temporada 1 en challenge_entitlements hasta el 22 de noviembre.
import { SEASONS_T1, canEnroll } from "./seasons";
import { crToday } from "./today";

export type SeasonCloseStep = "temporada1_cierre_16" | "temporada1_cierre_21";
export const SEASON_CLOSE_STEPS: SeasonCloseStep[] = ["temporada1_cierre_16", "temporada1_cierre_21"];
export const isSeasonCloseStep = (k: string): k is SeasonCloseStep => (SEASON_CLOSE_STEPS as string[]).includes(k);

/** Fecha de Costa Rica de cada pieza. */
export const SEASON_CLOSE_DAY: Record<SeasonCloseStep, string> = { temporada1_cierre_16: "2026-11-16", temporada1_cierre_21: "2026-11-21" };

/** Día del mes (16 o 21) de cada pieza, para la plantilla. */
export const seasonCloseDay = (s: SeasonCloseStep) => (s === "temporada1_cierre_16" ? 16 : 21) as 16 | 21;

/** Slugs de las tres Temporada 1: tener cualquiera cuenta como inscrito. */
export const T1_SLUGS = SEASONS_T1.map((s) => s.slug);

/** Llave de idempotencia de Resend: una por cuenta y correo. */
export const seasonCloseIdemKey = (s: SeasonCloseStep, userId: string) => `${s}/${userId}`;

/** Pieza del día según la fecha de Costa Rica, o null. Solo mientras alguna Temporada 1 siga abierta a inscripción. */
export function seasonCloseStepAt(now: Date): SeasonCloseStep | null {
  const today = crToday(now).iso;
  const step = SEASON_CLOSE_STEPS.find((s) => SEASON_CLOSE_DAY[s] === today) ?? null;
  return step && SEASONS_T1.some((s) => canEnroll(s, today)) ? step : null;
}

export type SeasonCloseInput = {
  now: Date;
  /** notification_prefs.marketing: permiso para novedades y promociones (la baja de "marketing" o "todo" lo apaga). */
  marketing: boolean;
  /** Acceso hoy por plan o prueba activa (entitlementsFrom(...).app). */
  access: boolean;
  staff: boolean;
  /** Ya tiene alguna Temporada 1 (T1_SLUGS) en challenge_entitlements. */
  enrolled: boolean;
};

/** Pieza que le toca a la cuenta ahora, o null. */
export function seasonCloseStep(i: SeasonCloseInput): SeasonCloseStep | null {
  if (!i.marketing || !i.access || i.staff || i.enrolled) return null;
  return seasonCloseStepAt(i.now);
}
