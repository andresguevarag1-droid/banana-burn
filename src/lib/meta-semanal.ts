// Hábito semanal (#288): quien entrena 3 veces por semana en su prueba se queda y paga. Reglas puras (meta-semanal.test.ts),
// sin base ni red; Hoy, el cierre del entreno y el cron de recordatorios (notify-run.ts) las usan con sus datos.
//
// - Meta: los días que eligió en la bienvenida (profiles.train_days), con un máximo de 3 en una semana que toca la prueba
//   de 7 días, y nunca más días de los que quedaban la semana en que se registró. La semana va de lunes a domingo, en su
//   zona horaria. Cuenta cada día con un entreno guardado (workouts.day, que ya es su día local), no cada entreno.
// - Racha semanal: semanas seguidas cumpliendo la meta. La semana en curso suma cuando ya se cumplió; si todavía no, no
//   la corta (descansar no castiga).
// - Recordatorio: un correo y un push, como máximo uno por semana (notification_log, kind meta_semanal), el día en que
//   todavía llega a su meta pero va atrás: le quedan, contando hoy, los días justos que le faltan o uno más.
//
// Embudo: se mide con weekly_goal_view y weekly_goal_done en funnel_events y la columna "3 entrenos en la prueba" de
// /admin/embudo.
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { dayName } from "@/lib/i18n/names";
import { translate } from "@/lib/i18n/t";
import { ES_LANG, wFmt, type Lang } from "@/components/workout/lang";
import { localClock } from "./notify";

/** Tipo en notification_log y en las etiquetas de Resend. */
export const WEEKLY_KIND = "meta_semanal";
/** Llave de idempotencia de Resend: una por cuenta y semana (lunes local). */
export const weeklyIdemKey = (userId: string, monday: string) => `${WEEKLY_KIND}/${userId}/${monday}`;
/** Meta máxima en una semana que toca la prueba: alcanzable. */
export const TRIAL_GOAL_MAX = 3;
/** Días de la prueba desde el registro. */
export const TRIAL_GOAL_DAYS = 7;
/** Entrenos en la prueba que cuentan en el embudo ("3 entrenos en la prueba"). */
export const TRIAL_HABIT = 3;

const DAY_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const DAY_MS = 864e5;
const noon = (iso: string) => Date.parse(iso + "T12:00:00Z");
export const addDaysIso = (iso: string, n: number) => new Date(noon(iso) + n * DAY_MS).toISOString().slice(0, 10);
/** Día de la semana (0 domingo a 6 sábado) de una fecha local 'YYYY-MM-DD'. */
export const dowOf = (iso: string) => new Date(noon(iso)).getUTCDay();
/** Posición en la semana de lunes a domingo (0 lunes a 6 domingo). */
const weekPos = (iso: string) => (dowOf(iso) + 6) % 7;
/** Lunes de la semana local de `iso`. */
export const weekMonday = (iso: string) => addDaysIso(iso, -weekPos(iso));

/** Día local (YYYY-MM-DD) de un instante en una zona IANA (zona inválida: Costa Rica). */
export const localDayOf = (at: string | Date, tz: string) => localClock(typeof at === "string" ? new Date(at) : at, tz).iso;

/** Día local del registro, o null. */
export function registrationDay(createdAt: string | null | undefined, tz: string): string | null {
  return createdAt && Number.isFinite(Date.parse(createdAt)) ? localDayOf(createdAt, tz) : null;
}

/**
 * Meta de entrenos de la semana que empieza el lunes `monday`. `trainDays`: los días de la bienvenida. `regDay`: día local
 * del registro (sin él, sin tope de prueba). Máximo 3 si la semana toca la prueba; la semana del registro, como mucho los
 * días que quedaban desde ese día hasta el domingo.
 */
export function weeklyGoal({ trainDays, regDay, monday }: { trainDays: number | null | undefined; regDay: string | null; monday: string }): number {
  let goal = Math.max(1, Math.min(7, Math.round(Number(trainDays) || 3)));
  if (regDay && monday < addDaysIso(regDay, TRIAL_GOAL_DAYS)) goal = Math.min(goal, TRIAL_GOAL_MAX);
  if (regDay && weekMonday(regDay) === monday) goal = Math.min(goal, 7 - weekPos(regDay));
  return Math.max(1, goal);
}

/** Días distintos con entreno en la semana de `today`, hasta hoy. `days`: fechas locales de workouts.day. */
export function weekCount(days: Iterable<string>, today: string): number {
  const mon = weekMonday(today);
  return new Set([...days].filter((d) => d >= mon && d <= today)).size;
}

/**
 * Semanas seguidas cumpliendo la meta. La semana en curso suma si ya se cumplió; si no, se cuenta desde la anterior.
 * Antes de la semana del registro no hay meta: ahí termina. `goalOf(monday)` da la meta de cada semana.
 */
export function weeklyStreak(days: Iterable<string>, today: string, goalOf: (monday: string) => number, regDay: string | null = null): number {
  const all = [...days];
  const met = (mon: string) => new Set(all.filter((d) => d >= mon && d <= addDaysIso(mon, 6))).size >= goalOf(mon);
  let mon = weekMonday(today);
  let n = 0;
  if (met(mon)) n++;
  const stop = regDay ? weekMonday(regDay) : null;
  for (let i = 0; i < 104; i++) {
    mon = addDaysIso(mon, -7);
    if (stop && mon < stop) break;
    if (!met(mon)) break;
    n++;
  }
  return n;
}

export const weeklyStreakLine = (n: number) => `${n} ${n === 1 ? "semana" : "semanas"} cumpliendo tu meta`;

/** "martes", "martes y jueves", "lunes, miércoles y viernes". `dows`: 0 domingo a 6 sábado. */
export function dayList(dows: number[], locale: Locale = DEFAULT_LOCALE): string {
  const names = dows.map((d) => { const i = ((d % 7) + 7) % 7; return locale === DEFAULT_LOCALE ? DAY_ES[i] : dayName(i, locale); });
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")}${translate(locale, " y ")}${names.at(-1)}`;
}

/**
 * Próximos días sugeridos al cerrar un entreno, según los días de entreno de su plan (`sched`, el mismo que usan los
 * recordatorios). `count`: días con entreno esta semana contando el de hoy. Si todavía le faltan y quedan días de entreno
 * esta semana, esos (los que faltan); si ya cumplió o no quedan, los primeros de la semana que viene.
 */
export function suggestDays(sched: Record<number, unknown>, today: string, count: number, goal: number): { week: "esta" | "proxima"; dows: number[] } {
  const training = (pos: number) => !!sched[(pos + 1) % 7];
  const pos = weekPos(today);
  const need = goal - count;
  const rest = [];
  for (let p = pos + 1; p < 7; p++) if (training(p)) rest.push((p + 1) % 7);
  if (need > 0 && rest.length) return { week: "esta", dows: rest.slice(0, need) };
  const next = [];
  for (let p = 0; p < 7; p++) if (training(p)) next.push((p + 1) % 7);
  return { week: "proxima", dows: next.slice(0, goal) };
}

export type WeeklyNudgeInput = {
  /** Día local de hoy. */
  today: string;
  goal: number;
  /** Fechas locales con entreno (workouts.day). */
  days: string[];
  /** Ya se reclamó el recordatorio esta semana (notification_log, kind meta_semanal, desde el lunes local). */
  sentThisWeek: boolean;
};

/**
 * ¿Toca hoy el recordatorio de la meta? Solo si ya entrenó alguna vez (sin entrenos, los correos de activación), hoy
 * no entrenó, le faltan entrenos y todavía llega: le quedan (contando hoy) los días justos o uno más. Una vez por semana.
 */
export function weeklyNudgeDue(i: WeeklyNudgeInput): boolean {
  if (i.sentThisWeek || !i.days.length || i.days.includes(i.today)) return false;
  const need = i.goal - weekCount(i.days, i.today);
  const left = 7 - weekPos(i.today);
  return need > 0 && need <= left && left <= need + 1;
}

/** Texto del recordatorio (push y correo): cifras reales, sin culpa. `mins`: minutos de la sesión de hoy, si se saben. */
export function weeklyNudgeCopy(count: number, goal: number, mins: number | null | undefined): { title: string; body: string } {
  const today = mins && mins > 0 ? `Hoy son ${mins} minutos.` : "El de hoy te acerca.";
  return { title: "Todavía llegas a tu meta", body: `Llevas ${count} de ${goal} entrenos esta semana. ${today} Coach Banana te guía paso a paso.` };
}

// ───────────── Progreso entre entrenos ─────────────

type Set1 = { kg: number | null; reps: number };
/** La mejor serie: más peso y, con el mismo peso, más repeticiones (o segundos). */
const topSet = (sets: Set1[]) => sets.reduce((a, b) => ((b.kg ?? 0) > (a.kg ?? 0) || ((b.kg ?? 0) === (a.kg ?? 0) && b.reps > a.reps) ? b : a));
const setTxt = (s: Set1, unit: string | undefined, L: Lang) => (s.kg ? `${wFmt(s.kg, L)} × ${s.reps}` : unit === "s" ? `${s.reps} s` : unit === "m" ? `${s.reps} m` : `${s.reps} ${L.t(s.reps === 1 ? "repetición" : "repeticiones")}`);

/**
 * Qué cambió en un ejercicio repetido desde la vez pasada, con la mejor serie de cada vez (datos de workout_sets):
 * "La vez pasada: 6 kg × 10. Hoy: 6 kg × 12." `up`: subió el peso o, con el mismo peso, las repeticiones. Sin una de las
 * dos sesiones, null.
 */
export function progressLine(last: Set1[] | null | undefined, today: Set1[], unit?: string, L: Lang = ES_LANG): { line: string; up: boolean } | null {
  const prev = (last ?? []).filter((s) => s.reps > 0), now = today.filter((s) => s.reps > 0);
  if (!prev.length || !now.length) return null;
  const a = topSet(prev), b = topSet(now);
  const up = (b.kg ?? 0) > (a.kg ?? 0) || ((b.kg ?? 0) === (a.kg ?? 0) && b.reps > a.reps);
  return { line: L.t("La vez pasada: {a}. Hoy: {b}.", { a: setTxt(a, unit, L), b: setTxt(b, unit, L) }), up };
}
