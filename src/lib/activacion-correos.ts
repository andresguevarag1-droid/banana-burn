// Correos de activación A0, A1 y A2 (#225, textos en docs/emails/activacion.md; A2 usa la pieza "A3" del documento) a quien
// no tiene ningún entreno guardado. Reglas puras (activacion-correos.test.ts); el envío lo hace sendActivationEmails en
// notify-run.ts, dentro del cron de recordatorios y antes de los demás avisos del día.
//
// - A0: de 1 a 24 h después del registro (profiles.created_at). Cada hora: en la corrida siguiente. Diario: en la corrida
//   del día siguiente (si ya pasaron 24 h, toca A1 y A0 no sale).
// - A1: de 24 a 48 h. A2: de 72 a 96 h. Cada hora salen a la hora del recordatorio de la persona (como la secuencia de la
//   prueba): así reemplazan al recordatorio del primer entreno de ese día en vez de chocar con él.
// - Una vez por persona y pieza (notification_log, kind activacion_N), nunca una vieja cuando ya toca la siguiente.
// - Con email_reminders, fuera de las horas de silencio (modo cada hora) y solo si hoy no recibió otro correo.
//
// Embudo: registro → primer entreno terminado. Se mide con workout_saved (funnel_events) y el % de registrados que
// terminan su primer entreno en 72 h, cruzado con notification_log (kind activacion_*) para saber quién recibió cada correo.
import { inQuietHours, localClock } from "./notify";

export type ActivationStep = 0 | 1 | 2;
export const ACTIVATION_STEPS: ActivationStep[] = [0, 1, 2];
/** Tipo en notification_log y en las etiquetas de Resend. */
export const activationKind = (step: ActivationStep) => `activacion_${step}` as const;
export const ACTIVATION_KINDS = ACTIVATION_STEPS.map(activationKind);
export const isActivationKind = (kind: string) => (ACTIVATION_KINDS as string[]).includes(kind);
/** Llave de idempotencia de Resend: una por cuenta y por correo. */
export const activationIdemKey = (step: ActivationStep, userId: string) => `${activationKind(step)}/${userId}`;

const HOUR_MS = 36e5;
/** Ventana de cada pieza, en horas desde el registro: [desde, hasta). */
export const ACTIVATION_WINDOWS: Record<ActivationStep, [number, number]> = { 0: [1, 24], 1: [24, 48], 2: [72, 96] };
/** Horas desde el registro en que cierra la última ventana: el cron solo lee cuentas más nuevas. */
export const ACTIVATION_MAX_HOURS = ACTIVATION_WINDOWS[2][1];

/** Pieza cuya ventana está abierta en el instante `at` para una cuenta creada en `createdAt`. */
export function activationStepAt(createdAt: string | null | undefined, at: Date): ActivationStep | null {
  const c = Date.parse(createdAt ?? "");
  if (!Number.isFinite(c)) return null;
  const h = (at.getTime() - c) / HOUR_MS;
  return ACTIVATION_STEPS.find((s) => h >= ACTIVATION_WINDOWS[s][0] && h < ACTIVATION_WINDOWS[s][1]) ?? null;
}

export type ActivationInput = {
  createdAt: string | null | undefined;
  now: Date;
  mode: "hourly" | "daily";
  /** Tiene al menos un entreno guardado (workouts). */
  trained: boolean;
  /** notification_prefs.email_reminders (false = se dio de baja de los recordatorios o de todo). */
  emailReminders: boolean;
  timezone: string;
  quietStart: string | null;
  quietEnd: string | null;
  /** Hora local (0 a 23) del recordatorio de la persona. */
  reminderHour: number;
  /** Instante de hoy (día local) a la hora del recordatorio, en punto (recoveryAt en notify-run.ts). */
  reminderAt: Date;
  /** Piezas de activación que ya se reclamaron para esta cuenta (cualquier día). */
  sent: string[];
};

/** Pieza que hay que mandar en esta corrida, o null. No mira los otros correos del día (emailedToday). */
export function activationDue(i: ActivationInput): ActivationStep | null {
  if (i.trained || !i.emailReminders) return null;
  let step: ActivationStep | null;
  if (i.mode === "daily") step = activationStepAt(i.createdAt, i.now);
  else {
    const c = localClock(i.now, i.timezone);
    if (inQuietHours(c, i.quietStart, i.quietEnd)) return null;
    // A1 y A2: solo a la hora del recordatorio, según la ventana de ese instante del día local. A0: a cualquier hora.
    const later = c.hour === i.reminderHour ? activationStepAt(i.createdAt, i.reminderAt) : null;
    step = later ? later : activationStepAt(i.createdAt, i.now) === 0 ? 0 : null;
  }
  if (step === null || i.sent.includes(activationKind(step))) return null;
  return step;
}

/** Correos únicos e inmediatos que no cuentan para la regla de un correo por día: los manda la app al registrarse. */
const NOT_COUNTED = new Set(["bienvenida", "plan_listo"]);

export type LogEntry = { kind: string; local_day: string; channels?: string[] | null; created_at?: string | null };

/**
 * ¿Ya recibió hoy (día local) otro correo, como el recordatorio, el fin de la beta o una pieza de la prueba? Cuenta las
 * filas con canal de correo del día local y las únicas (ONCE_DAY) creadas hoy. No cuenta la bienvenida ni el plan listo.
 */
export function emailedToday(logs: LogEntry[], now: Date, timezone: string): boolean {
  const today = localClock(now, timezone).iso;
  return logs.some((l) => {
    if (!l.channels?.includes("email") || NOT_COUNTED.has(l.kind)) return false;
    if (l.local_day === today) return true;
    const at = Date.parse(l.created_at ?? "");
    return Number.isFinite(at) && localClock(new Date(at), timezone).iso === today;
  });
}
