// Regreso (#320): correos que traen de vuelta a quien terminó su primer entreno y no hizo el siguiente. Reglas puras
// (regreso.test.ts); el envío lo hace sendComebackEmails en notify-run.ts, dentro del cron de recordatorios (cada hora).
// Textos y calendario en docs/emails/regreso.md.
//
// - R1: al día siguiente (día local) del primer entreno terminado (workouts.finished_at), desde las 7:00 locales.
// - R2: de 48 a 72 h después del primer entreno (reemplaza al correo segundo_entreno de #286: si ya salió, R2 no sale).
// - R3: el día 4 o 5 (días locales) después del primer entreno, desde las 7:00. Texto plano de Andrés con una pregunta.
// - R4: al día siguiente del segundo entreno, desde las 7:00, si no hizo el tercero.
// - La secuencia se corta apenas entrena: R1 a R3 piden un solo entreno terminado; R4, exactamente dos.
// - Una vez por cuenta y por correo (notification_log, kinds regreso_r1 a regreso_r4), solo en los primeros 14 días desde
//   el registro, con las exclusiones de la secuencia de la prueba (inTrialAudience), email_reminders y fuera de las horas
//   de silencio. Máximo un correo por día: si hoy ya salió otro, se omite (emailedToday); si sale, ese día no sale el
//   recordatorio ni la pieza de la prueba.
//
// Embudo: primer entreno → segundo entreno. Se mide en /admin/embudo ("Correos de regreso"): enviados (notification_log),
// clics (funnel_events email_click con el kind, por el ?e= del botón) y quién entrenó en las 48 h siguientes.
import { inQuietHours, localClock, daysBetween } from "./notify";
import { DAY_MS } from "./trial";
import { inTrialAudience, type TrialSequenceInput } from "./trial-sequence";
import { EX, prescribe, type ExerciseId, type PlannedExercise } from "./engine";
import { COMEBACK_STEPS, comebackKind, type ComebackStep } from "./regreso-kinds";

export { COMEBACK_KINDS, COMEBACK_STEPS, comebackKind, isComebackKind, type ComebackKind, type ComebackStep } from "./regreso-kinds";

/** Llave de idempotencia de Resend: una por cuenta y por correo. */
export const comebackIdemKey = (s: ComebackStep, userId: string) => `${comebackKind(s)}/${userId}`;
/** El correo del segundo entreno de #286: quien ya lo recibió tiene R2 por enviado. */
export const LEGACY_R2_KIND = "segundo_entreno";

/** Días desde el registro en que corre la secuencia. */
export const COMEBACK_DAYS = 14;
/** Hora local desde la que salen R1, R3 y R4. */
export const COMEBACK_HOUR = 7;
/** Ventana de R2, en horas desde el primer entreno: [desde, hasta). */
export const R2_WINDOW: [number, number] = [48, 72];
/** Días locales después del primer entreno en que puede salir R3. */
export const R3_DAYS = [4, 5];

const HOUR_MS = 36e5;

export type ComebackInput = TrialSequenceInput & {
  now: Date;
  mode: "hourly" | "daily";
  /** finished_at de los entrenos terminados de la cuenta. */
  finished: string[];
  timezone: string;
  quietStart: string | null;
  quietEnd: string | null;
  /** Kinds de notification_log ya reclamados para la cuenta (cualquier día). */
  sent: string[];
};

/** Correo de la secuencia que toca en esta corrida, o null. No mira los otros correos del día (emailedToday). */
export function comebackDue(i: ComebackInput): ComebackStep | null {
  const now = i.now.getTime(), created = Date.parse(i.createdAt ?? "");
  if (!Number.isFinite(created) || now < created || now - created >= COMEBACK_DAYS * DAY_MS) return null;
  const done = i.finished.map((f) => Date.parse(f)).filter((t) => Number.isFinite(t) && t <= now).sort((a, b) => a - b);
  if (done.length !== 1 && done.length !== 2) return null;
  const c = localClock(i.now, i.timezone);
  if (inQuietHours(c, i.quietStart, i.quietEnd)) return null;
  const last = done[done.length - 1];
  const days = daysBetween(localClock(new Date(last), i.timezone).iso, c.iso);
  // Cada hora: desde las 7:00 locales. Diario: la corrida del día (07:00 en Costa Rica).
  const morning = i.mode === "daily" || c.hour >= COMEBACK_HOUR;
  let step: ComebackStep | null = null;
  if (done.length === 2) step = days === 1 && morning ? "r4" : null;
  else {
    const h = (now - last) / HOUR_MS;
    if (days === 1 && morning) step = "r1";
    else if (h >= R2_WINDOW[0] && h < R2_WINDOW[1]) step = "r2";
    else if (R3_DAYS.includes(days) && morning) step = "r3";
  }
  if (!step || i.sent.includes(comebackKind(step)) || (step === "r2" && i.sent.includes(LEGACY_R2_KIND))) return null;
  return inTrialAudience(i) ? step : null;
}

export type LiftSet = { exercise: string; kg: number | string | null; reps: number | null; rir?: number | null };
/** Dato del último entreno para el correo: el peso más alto de un ejercicio y, si el plan sube, el de hoy. */
export type ComebackLift = { exercise: string; kg: number; next: number | null };

/**
 * "La vez pasada hiciste sentadilla con 20 kg; hoy toca 22.5": el primer ejercicio con peso de la sesión de hoy que la
 * persona hizo en su último entreno, con la carga que le pone el motor (prescribe). Si ninguno coincide, el primer
 * ejercicio con peso de ese entreno, sin la carga de hoy. Sin pesos (en casa, sin equipo), null.
 */
export function comebackLift(exercises: Pick<PlannedExercise, "id" | "name" | "cfg">[], sets: LiftSet[]): ComebackLift | null {
  const by = new Map<string, { kg: number; reps: number; rir: number | null }[]>();
  for (const s of sets) {
    const kg = Number(s.kg);
    if (!Number.isFinite(kg) || kg <= 0 || !Object.hasOwn(EX, s.exercise)) continue;
    by.set(s.exercise, [...(by.get(s.exercise) ?? []), { kg, reps: Number(s.reps) || 0, rir: s.rir ?? null }]);
  }
  const top = (l: { kg: number }[]) => Math.max(...l.map((x) => x.kg));
  for (const e of exercises) {
    const l = by.get(e.id);
    if (!l || !(EX[e.id]?.inc > 0)) continue;
    const kg = top(l), rx = prescribe(e.id, e.cfg, [l]);
    return { exercise: e.name, kg, next: rx.kg != null && rx.kg > kg ? rx.kg : null };
  }
  const [id, l] = [...by.entries()][0] ?? [];
  return id && l ? { exercise: EX[id as ExerciseId].n, kg: top(l), next: null } : null;
}

// ───────────── /admin/embudo: Correos de regreso ─────────────

export type ComebackRow = { step: ComebackStep; sent: number; clicks: number; trained: number };
/** Horas después del envío en que se cuenta el siguiente entreno. */
export const TRAINED_WITHIN_H = 48;

/**
 * Por correo: envíos (filas con canal de correo), cuentas que tocaron el botón (email_click con ese kind) y envíos tras los
 * que la cuenta terminó un entreno en las 48 h siguientes.
 */
export function comebackTable(
  logs: { user_id: string; kind: string; created_at: string; channels?: string[] | null }[],
  clicks: { user_id: string; kind: string | null }[],
  workouts: { user_id: string; finished_at: string | null }[],
): ComebackRow[] {
  const doneBy = new Map<string, number[]>();
  for (const w of workouts) { const t = Date.parse(w.finished_at ?? ""); if (Number.isFinite(t)) doneBy.set(w.user_id, [...(doneBy.get(w.user_id) ?? []), t]); }
  return COMEBACK_STEPS.map((step) => {
    const kind = comebackKind(step);
    const sends = logs.filter((l) => l.kind === kind && l.channels?.includes("email"));
    const trained = sends.filter((l) => {
      const at = Date.parse(l.created_at);
      return (doneBy.get(l.user_id) ?? []).some((t) => t > at && t <= at + TRAINED_WITHIN_H * HOUR_MS);
    }).length;
    return { step, sent: sends.length, clicks: new Set(clicks.filter((c) => c.kind === kind).map((c) => c.user_id)).size, trained };
  });
}
