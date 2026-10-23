// Banana Burn: lógica pura de notificaciones: quién recibe qué, a qué hora local y por qué canal.
// Sin dependencias de servidor (solo imports relativos) para poder testearla con Vitest.
import { t, type Voice } from "./voice";

export type Kind = "recordatorio" | "racha" | "semanal" | "reactivacion_3" | "reactivacion_7";
export const KINDS: Kind[] = ["recordatorio", "racha", "semanal", "reactivacion_3", "reactivacion_7"];

export type Prefs = {
  email_reminders: boolean;
  push_reminders: boolean;
  /** Hora local 'HH:MM' del recordatorio de entreno. */
  reminder_time: string;
  timezone: string;
  weekly_summary: boolean;
  marketing: boolean;
  /** Horas de silencio locales 'HH:MM' (null = sin silencio). Intervalo [inicio, fin), puede cruzar medianoche. */
  quiet_start: string | null;
  quiet_end: string | null;
};

export const DEFAULT_TZ = "America/Costa_Rica";
export const DEFAULT_PREFS: Prefs = {
  email_reminders: true,
  push_reminders: true,
  reminder_time: "07:00",
  timezone: DEFAULT_TZ,
  weekly_summary: true,
  marketing: false,
  quiet_start: "22:00",
  quiet_end: "07:00",
};

/** Máximo de pushes por usuario y día local (anti-fatiga). */
export const MAX_PUSHES_PER_DAY = 2;
/** Hora local del aviso de racha en peligro. */
export const STREAK_HOUR = 20;
/** Lunes a esta hora local sale el resumen semanal. */
export const WEEKLY_HOUR = 7;
/** Días mínimos de racha para avisar que está en peligro. */
export const STREAK_MIN = 2;
/** `local_day` centinela en notification_log para correos que se mandan una sola vez en la vida. */
export const ONCE_DAY = "1970-01-01";

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const isHHMM = (s: unknown): s is string => typeof s === "string" && HHMM.test(s);
export const toMinutes = (s: string) => { const m = HHMM.exec(s); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };

export function isValidTimeZone(tz: string): boolean {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

/** Modo del cron de avisos: "daily" (Vercel Hobby, una corrida al día) u "hourly" (Pro). Fuente: NOTIFY_CRON_MODE. */
export const cronModeFrom = (v: string | undefined): "hourly" | "daily" => (v === "hourly" ? "hourly" : "daily");

/** Nombre amigable de una zona horaria: "Costa Rica (GMT-6)" en vez de "America/Costa_Rica". */
export function tzLabel(tz: string, now = new Date()): string {
  const zone = tz && isValidTimeZone(tz) ? tz : DEFAULT_TZ;
  const city = zone.split("/").pop()!.replace(/_/g, " ");
  let off = "";
  try { off = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" }).formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? ""; } catch { /* */ }
  return off && off !== city ? `${city} (${off})` : city;
}

export type LocalClock = { iso: string; hour: number; minute: number; dow: number };

/** Fecha/hora local en una zona IANA. Si la zona es inválida, usa Costa Rica. */
export function localClock(now: Date, tz: string): LocalClock {
  const zone = tz && isValidTimeZone(tz) ? tz : DEFAULT_TZ;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" })
      .formatToParts(now).map((p) => [p.type, p.value]),
  );
  const dows: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { iso: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24, minute: Number(parts.minute), dow: dows[parts.weekday] ?? 0 };
}

/** ¿La hora local cae en horas de silencio? Intervalo [inicio, fin) que puede cruzar medianoche. */
export function inQuietHours(clock: { hour: number; minute: number }, start: string | null, end: string | null): boolean {
  if (!start || !end || !isHHMM(start) || !isHHMM(end)) return false;
  const s = toMinutes(start), e = toMinutes(end), t = clock.hour * 60 + clock.minute;
  if (s === e) return false;
  return s < e ? t >= s && t < e : t >= s || t < e;
}

export const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((Date.parse(toIso + "T12:00:00Z") - Date.parse(fromIso + "T12:00:00Z")) / 864e5);

export type DecideInput = {
  now: Date;
  prefs: Prefs;
  /** "hourly" (Vercel Pro: cron cada hora) o "daily" (Hobby: una corrida diaria a hora fija). */
  mode?: "hourly" | "daily";
  trainingDay: boolean;
  trainedToday: boolean;
  /** Cualquier actividad hoy (entreno, check-in o pesaje). */
  activeToday: boolean;
  streak: number;
  /** Días desde la última actividad (null = nunca ha registrado nada). */
  daysInactive: number | null;
  /** Tipos ya enviados hoy (día local) según notification_log. */
  sentToday: string[];
  pushesToday: number;
  hasPushSubscription: boolean;
  hasEmail: boolean;
};

export type Decision = { kind: Kind; push: boolean; email: boolean; inapp: boolean };

/** ¿Vale la pena revisar a este usuario en esta corrida? (filtro barato antes de consultar su actividad). */
export function isRelevantHour(now: Date, prefs: Prefs, mode: "hourly" | "daily" = "hourly"): boolean {
  if (mode === "daily") return true;
  const c = localClock(now, prefs.timezone);
  const remindHour = isHHMM(prefs.reminder_time) ? Math.floor(toMinutes(prefs.reminder_time) / 60) : 7;
  return c.hour === remindHour || c.hour === STREAK_HOUR || (c.dow === 1 && c.hour === WEEKLY_HOUR);
}

/**
 * Decide qué mandar ahora. Reglas:
 * - Lunes 07:00 local -> resumen semanal (correo + in-app) si weekly_summary.
 * - Hora del recordatorio, 3 o 7 días sin actividad -> reactivación (reemplaza al recordatorio ese día).
 * - Hora del recordatorio, día de entreno y sin entreno hoy -> "Hoy te toca {rutina}".
 * - 20:00 local, sin actividad hoy y racha ≥ 2 -> racha en peligro.
 * Push solo si push_reminders, hay suscripción, fuera de horas de silencio y bajo el tope diario.
 * Correo solo si email_reminders (o weekly_summary para el resumen). In-app siempre.
 * Cada tipo máximo una vez por día local (dedupe con notification_log).
 * Modo "daily": no hay hora que comparar -> recordatorio/reactivación/semanal (lunes) en la corrida; la racha de las 20:00 se omite.
 */
export function decide(i: DecideInput): Decision[] {
  const mode = i.mode ?? "hourly";
  const p = i.prefs;
  const c = localClock(i.now, p.timezone);
  const remindHour = isHHMM(p.reminder_time) ? Math.floor(toMinutes(p.reminder_time) / 60) : 7;
  const atReminder = mode === "daily" || c.hour === remindHour;
  const sent = new Set(i.sentToday);
  const quiet = inQuietHours(c, p.quiet_start, p.quiet_end);
  let pushes = i.pushesToday;
  const out: Decision[] = [];

  const add = (kind: Kind, wantPush: boolean, wantEmail: boolean) => {
    if (sent.has(kind)) return;
    const push = wantPush && i.hasPushSubscription && !quiet && pushes < MAX_PUSHES_PER_DAY;
    if (push) pushes++;
    out.push({ kind, push, email: wantEmail && i.hasEmail, inapp: true });
  };

  const weeklyTime = mode === "daily" ? c.dow === 1 : c.dow === 1 && c.hour === WEEKLY_HOUR;
  if (weeklyTime && p.weekly_summary) add("semanal", false, true);
  const weeklyEmailNow = out.some((d) => d.kind === "semanal" && d.email);

  let reactivated = false;
  if (atReminder && (i.daysInactive === 3 || i.daysInactive === 7) && !i.activeToday) {
    const kind: Kind = i.daysInactive === 3 ? "reactivacion_3" : "reactivacion_7";
    if (!sent.has(kind)) { add(kind, p.push_reminders, p.email_reminders && !weeklyEmailNow); reactivated = true; }
  }

  if (!reactivated && atReminder && i.trainingDay && !i.trainedToday) {
    // Si el resumen semanal ya va por correo en esta misma corrida, no mandamos un segundo correo.
    add("recordatorio", p.push_reminders, p.email_reminders && !weeklyEmailNow);
  }

  if (mode === "hourly" && c.hour === STREAK_HOUR && !i.activeToday && i.streak >= STREAK_MIN) {
    add("racha", p.push_reminders, p.email_reminders);
  }

  return out;
}

// ───────────── Copy de push / in-app ─────────────
// Motivador, específico, nunca culpa ni vergüenza.

export type CopyCtx = {
  name: string; routine: string; trainingDay?: boolean; mins?: number; streak: number; workouts?: number; kgDelta?: number | null; day: string;
  /** "Cómo te hablo" (0035). Sin dato, intermedio. */
  voice?: Voice;
  /** Línea de Coach Banana del entreno de hoy ("Hoy armas una espalda ancha..."). */
  hook?: string;
  /** Dato real de la última sesión del ejercicio principal de hoy (ver `liftFact`). */
  lift?: LiftFact | null;
};

/** Lo último que hizo la persona en el ejercicio principal de hoy: subió de peso o lo repitió. */
export type LiftFact = { name: string; kg: number; delta: number };

const kgTxt = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 2 });
const lower = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

/**
 * Último progreso en un ejercicio: sesiones (de antigua a reciente) con el mayor peso de cada una.
 * Devuelve el peso de la última y cuánto subió respecto de la anterior (0 si igual o bajó). Sin peso, null.
 */
export function liftFact(name: string, sessions: number[]): LiftFact | null {
  const s = sessions.filter((x) => Number.isFinite(x) && x > 0);
  if (!s.length) return null;
  const last = s[s.length - 1], prev = s.length > 1 ? s[s.length - 2] : null;
  return { name, kg: last, delta: prev != null && last > prev ? Math.round((last - prev) * 100) / 100 : 0 };
}

/** El dato real dicho en el registro de la persona. */
export function liftLine(v: Voice, f: LiftFact): string {
  const n = lower(f.name);
  if (f.delta > 0) return t(v, {
    basico: `La última vez tu ${n} subió ${kgTxt(f.delta)} kg. Hoy vamos por más.`,
    intermedio: `Tu ${n} subió ${kgTxt(f.delta)} kg la última vez.`,
    tecnico: `${f.name}: +${kgTxt(f.delta)} kg en tu última sesión (${kgTxt(f.kg)} kg).`,
  });
  return t(v, {
    basico: `La última vez hiciste ${n} con ${kgTxt(f.kg)} kg. Hoy intentamos una repetición más.`,
    intermedio: `Última vez: ${n} con ${kgTxt(f.kg)} kg. Hoy toca superarlo.`,
    tecnico: `${f.name}: ${kgTxt(f.kg)} kg en tu última sesión. Objetivo: +1 rep.`,
  });
}
export type Copy = { title: string; body: string; url: string };

const pick = <T,>(list: T[], seed: string) => {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
};

export function copyFor(kind: Kind, x: CopyCtx): Copy {
  const first = x.name.split(" ")[0] || "crack";
  switch (kind) {
    case "recordatorio": {
      // Coach Banana habla: el nombre del entreno de hoy, sus minutos y, si hay, un dato real de la última vez.
      const v = x.voice ?? "intermedio";
      const who = x.name.trim() ? `, ${first}` : "";
      const mins = x.mins ? `${x.mins} min` : "";
      const bodies = x.lift ? [liftLine(v, x.lift)] : [
        t(v, {
          basico: `Yo te digo qué peso usar en cada serie${who}. Tú solo llega.`,
          intermedio: `Tus cargas ya están calculadas${who}. Abre y arrancamos.`,
          tecnico: `Cargas recalculadas con tu última sesión${who}.`,
        }),
        x.streak >= 2
          ? t(v, { basico: `Llevas ${x.streak} días seguidos. Hoy la racha sigue creciendo.`, intermedio: `Vas ${x.streak} días seguidos. Hoy la racha sigue creciendo.`, tecnico: `Racha de ${x.streak} días: la constancia es lo que más progreso da.` })
          : t(v, { basico: "Cada entreno suma. Hoy sumas uno más.", intermedio: "Cada sesión suma. Hoy es un buen día para sumar una más.", tecnico: "Una sesión más de estímulo: así se acumula el progreso." }),
        ...(x.hook ? [`${x.hook}.`] : []),
      ];
      const routine = x.routine.replace(/:.*$/, ""); // "Bombeo Banana: brazos y hombros" → "Bombeo Banana" (sin dos ":" en el título)
      return { title: `Coach Banana: hoy toca ${routine}${mins ? `, ${mins}` : ""}`, body: pick(bodies, x.day + kind), url: "/app/entreno" };
    }
    case "racha":
      return {
        title: `Tu racha de ${x.streak} días sigue viva`,
        body: pick([
          `Con 2 minutos basta: registra tu agua o tu peso y la mantienes.`,
          `Un check-in rápido antes de dormir y mañana vas por el día ${x.streak + 1}.`,
        ], x.day + kind),
        url: "/app",
      };
    case "semanal": {
      const f = (n: number) => n.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      const kg = x.kgDelta == null ? "" : x.kgDelta < 0 ? ` y ${f(x.kgDelta)} kg` : x.kgDelta > 0 ? ` y +${f(x.kgDelta)} kg` : " y peso estable";
      return { title: x.name.trim() ? `${first}, así te fue esta semana` : "Tu semana en Banana Burn", body: `${x.workouts ?? 0} entrenos${kg}. Mira lo que viene esta semana.`, url: "/app/progreso" };
    }
    case "reactivacion_3":
      return { title: `Te guardamos el lugar, ${first}`, body: x.trainingDay === false ? "Volver es más fácil con algo corto: hoy toca caminar y estirar 10 minutos." : `Volver es más fácil con una sesión corta. Hoy: ${x.routine}.`, url: "/app/entreno" };
    case "reactivacion_7":
      return { title: "Empezamos de nuevo, sin presión", body: "Tu plan sigue aquí. Una sesión de 20 minutos hoy y arrancamos otra vez.", url: "/app" };
  }
}
