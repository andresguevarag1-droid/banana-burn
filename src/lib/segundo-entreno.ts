// Segundo entreno (#286): quien entrena 2 o 3 veces en sus 7 días gratis es quien paga. Reglas puras
// (segundo-entreno.test.ts); el correo lo manda sendSecondWorkoutEmails en notify-run.ts, dentro del cron de recordatorios.
//
// - Correo "Tu segundo entreno está listo" (docs/emails/segundo-entreno.md): de 48 a 72 h después de terminar el primer
//   entreno (workouts.finished_at), si no terminó otro. En las dos modalidades del cron sale en la primera corrida de esa
//   ventana fuera de las horas de silencio; si la ventana se cierra, ya no sale.
// - Una sola vez por cuenta (notification_log, kind segundo_entreno), dentro de la prueba de 7 días desde el registro.
// - Mismas exclusiones que la secuencia de la prueba (inTrialAudience en trial-sequence.ts) y respeto de email_reminders.
//
// Embudo: primer entreno → segundo entreno. Se mide con la columna "Segundo entreno" de /admin/embudo (2 o más workouts
// con finished_at en los primeros 7 días), cruzada con notification_log (kind segundo_entreno).
import { inQuietHours, localClock } from "./notify";
import { DAY_MS } from "./trial";
import { inTrialAudience, type TrialSequenceInput } from "./trial-sequence";

/** Tipo en notification_log y en las etiquetas de Resend. */
export const SECOND_KIND = "segundo_entreno";
/** Llave de idempotencia de Resend: una por cuenta. */
export const secondIdemKey = (userId: string) => `${SECOND_KIND}/${userId}`;

const HOUR_MS = 36e5;
/** Ventana del correo, en horas desde el primer entreno terminado: [desde, hasta). */
export const SECOND_WINDOW: [number, number] = [48, 72];
/** Días de la prueba: después ya no se empuja el segundo entreno. */
export const TRIAL_DAYS = 7;

/** Entrenos terminados (finished_at) dentro de los primeros 7 días desde `createdAt`. */
export function finishedInTrial(createdAt: string | null | undefined, finished: (string | null)[]): number {
  const c = Date.parse(createdAt ?? "");
  if (!Number.isFinite(c)) return 0;
  return finished.filter((f) => { const t = Date.parse(f ?? ""); return Number.isFinite(t) && t >= c && t < c + TRIAL_DAYS * DAY_MS; }).length;
}

export type SecondWorkoutInput = TrialSequenceInput & {
  now: Date;
  /** finished_at de todos los entrenos terminados de la cuenta. */
  finished: string[];
  timezone: string;
  quietStart: string | null;
  quietEnd: string | null;
  /** Ya se reclamó el correo para esta cuenta (cualquier día). */
  sent: boolean;
};

/** ¿Hay que mandar el correo del segundo entreno en esta corrida? No mira los otros correos del día (emailedToday). */
export function secondWorkoutEmailDue(i: SecondWorkoutInput): boolean {
  if (i.sent || i.finished.length !== 1) return false;
  const first = Date.parse(i.finished[0]), created = Date.parse(i.createdAt ?? "");
  if (!Number.isFinite(first) || !Number.isFinite(created)) return false;
  const h = (i.now.getTime() - first) / HOUR_MS;
  if (h < SECOND_WINDOW[0] || h >= SECOND_WINDOW[1]) return false;
  if (i.now.getTime() - created >= TRIAL_DAYS * DAY_MS) return false;
  if (inQuietHours(localClock(i.now, i.timezone), i.quietStart, i.quietEnd)) return false;
  return inTrialAudience(i);
}
