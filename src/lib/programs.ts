// Programas: retos Premium que toman el control de la app mientras duran (entreno del día, Hoy, nutrición y tema).
// Módulo PURO (sin base de datos ni biblioteca de ejercicios) para poder probarlo y usarlo en el cliente del panel.
// Lo que toca la base vive en programs-server.ts; la siembra de los programas, en program-seed.ts.
//
// Modelo:
//   - challenges_catalog.kind = 'programa' y challenges_catalog.program (meta pública: fases, días por semana, para quién,
//     resultado, nutrición opcional, ejercicios clave).
//   - program_sessions: una sesión por (fase, día). Cada semana de una fase repite sus sesiones; las cargas suben solas con
//     la doble progresión del motor (prescribe) y el historial de cada ejercicio. Una fase con `deload` usa la descarga.
//   - user_programs: estado de la persona (activo, pausado, abandonado, completado), inicio y días en pausa.
//   - Sesiones hechas = entrenos guardados con la plantilla `p:<slug>:<semana>.<día>` (programTemplate).

import { EX, estimateMinutes, forEquipment, type Equipment, type ExerciseId, type PlannedDay, type PlannedExercise, type ProgramPlannedExercise } from "./engine";

export type ProgramLevel = "principiante" | "intermedio" | "avanzado" | "todos";
export type ProgramMode = "acelerada" | "recomp" | "fuerza";
export type ProgramStatus = "activo" | "pausado" | "abandonado" | "completado";

export type ProgramExercise = {
  /** Ejercicio del motor ("squat") o de la biblioteca ("ds:0739"). */
  id: string;
  sets: number; lo: number; hi: number;
  /** Descanso entre series, en segundos. */
  rest: number;
  /** "s" = segundos (planchas), "m" = metros (paseos). Sin unidad = repeticiones. */
  unit?: "s" | "m";
  /** Tempo bajada-pausa-subida, por ejemplo "3-1-1". */
  tempo?: string;
  note?: string;
  /** Alternativa para casa o sin equipo cuando el ejercicio necesita gimnasio. */
  home?: string;
};
export type ProgramSession = { phase: number; day: number; title: string; focus: string; optional?: boolean; exercises: ProgramExercise[] };
export type ProgramPhase = { name: string; weeks: number; deload?: boolean; focus?: string };
export type ProgramNutrition = { mode?: ProgramMode; proteinPerKg?: number; note?: string };
export type ProgramMeta = {
  phases: ProgramPhase[];
  /** Sesiones por semana (incluye las opcionales). */
  daysPerWeek: number;
  /**
   * Duración exacta en días cuando no son semanas completas (reto de 30 días: 5 semanas, la última de 2 días).
   * Entre (semanas - 1) x 7 + 1 y semanas x 7. Sin esto, dura semanas x 7.
   */
  days?: number;
  sessionMinutes: number;
  level: ProgramLevel;
  /** Equipo, en texto para la persona ("Gimnasio, con versión para casa"). */
  equipment: string;
  /** ¿Adapta los ejercicios al equipo de la persona (gimnasio, casa, sin equipo)? */
  adapt: boolean;
  who: string;
  result: string;
  outcomes: string[];
  /** Ejercicios cuya fuerza se compara al inicio y al final. */
  keyLifts: string[];
  nutrition: ProgramNutrition | null;
  /** Ejercicio con la animación de técnica en la página del programa. */
  previewExercise?: string;
  /** Cómo cambia la app mientras el programa está activo (0027). Sin esto, la app usa los textos genéricos. */
  experience?: ProgramExperience;
};

// ───────────── Experiencia: lo que el programa cambia en la app ─────────────

/**
 * Hábitos diarios del programa. Los automáticos se marcan solos con lo que la persona ya registra en Hoy:
 * pasos, agua (vasos), sueño (horas), proteína (g, contra su meta) y entreno (sesión del programa hecha hoy).
 * `check` es un hábito que la persona marca a mano (se guarda en daily_logs.program_checks).
 */
export type HabitKind = "pasos" | "agua" | "sueno" | "proteina" | "entreno" | "check";
export type ProgramHabit = { key: string; label: string; kind: HabitKind; target?: number };
export type ProgramExperience = {
  /** Nombre del modo que toma la app: "Modo glúteo". */
  mode: string;
  /** Mensaje del primer día. */
  welcome: string;
  /** Hábitos de cada día (máximo 4). */
  habits: ProgramHabit[];
  /** Consejo de Coach Banana por semana; el último se repite si el programa dura más. */
  tips: string[];
  /** Qué prioriza Coach Banana al responder mientras dura el programa. */
  coachFocus: string;
  /** Qué hacer en los días sin sesión. */
  restDay: string;
  /** Cómo comer en este programa (máximo 4 líneas). Se muestra en Nutrición y en Hoy. */
  food: string[];
  /** Quién acompaña el programa: Coach Banana (por defecto) o Coach Platanita (programas de chicas). */
  coach?: CoachId;
};
export type CoachId = "banana" | "platanita";
export const COACH_IDS: CoachId[] = ["banana", "platanita"];
export const HABIT_KINDS: HabitKind[] = ["pasos", "agua", "sueno", "proteina", "entreno", "check"];
export const HABIT_KIND_LABEL: Record<HabitKind, string> = { pasos: "Pasos", agua: "Vasos de agua", sueno: "Horas de sueño", proteina: "Proteína del día", entreno: "Sesión del programa", check: "Lo marca la persona" };
export const HABIT_KEY = /^[a-z0-9-]{1,24}$/;
const HABIT_DEFAULT: Partial<Record<HabitKind, number>> = { pasos: 8000, agua: 8, sueno: 7 };
const HABIT_RANGE: Partial<Record<HabitKind, [number, number]>> = { pasos: [1000, 30000], agua: [1, 20], sueno: [4, 12] };
export const MAX_HABITS = 4;
export const MAX_TIPS = 12;
export type ProgramDef = { slug: string; title: string; meta: ProgramMeta; sessions: ProgramSession[] };
export type ProgramState = { slug: string; status: ProgramStatus; startedOn: string; pausedOn: string | null; pausedDays: number; completedAt: string | null };
/** Sesión hecha: semana, día y la fecha del entreno. */
export type DoneSession = { week: number; day: number; on: string };

export const MAX_WEEKS = 52;
export const MAX_DAYS_PER_WEEK = 6;
export const MAX_EXERCISES = 12;
export const MAX_PHASES = 8;
export const LEVEL_LABEL: Record<ProgramLevel, string> = { principiante: "Principiante", intermedio: "Intermedio", avanzado: "Avanzado", todos: "Todos los niveles" };
export const MODE_LABEL: Record<ProgramMode, string> = { acelerada: "Déficit para bajar grasa", recomp: "Recomposición (déficit pequeño)", fuerza: "Superávit pequeño para ganar músculo" };

// ───────────── Saneado (lo que llega de la base o del panel) ─────────────

const clampN = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const int = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? Math.round(x) : typeof x === "string" && /^\d+$/.test(x) ? Number(x) : d);
const txt = (x: unknown, max: number) => (typeof x === "string" ? x.trim().replace(/\s+/g, " ").slice(0, max) : "");
const LEVELS: ProgramLevel[] = ["principiante", "intermedio", "avanzado", "todos"];
const MODES: ProgramMode[] = ["acelerada", "recomp", "fuerza"];
/** Id de ejercicio aceptado (mismo formato que guarda el reproductor). */
export const PROGRAM_EXERCISE_ID = /^(ds:\d{4}|[a-z][a-zA-Z0-9_]{1,30})$/;
export const TEMPO_RE = /^\d-\d-\d$/;

export function parseExercise(x: unknown): ProgramExercise | null {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  if (!PROGRAM_EXERCISE_ID.test(id)) return null;
  const unit = o.unit === "s" || o.unit === "m" ? o.unit : undefined;
  const top = unit === "m" ? 400 : unit === "s" ? 600 : 100;
  const lo = clampN(int(o.lo, 8), 1, top), hi = clampN(int(o.hi, lo), lo, top);
  const tempo = txt(o.tempo, 7), note = txt(o.note, 160), home = typeof o.home === "string" && PROGRAM_EXERCISE_ID.test(o.home.trim()) ? o.home.trim() : undefined;
  return {
    id, sets: clampN(int(o.sets, 3), 1, 10), lo, hi, rest: clampN(int(o.rest, 90), 0, 600),
    ...(unit ? { unit } : {}), ...(TEMPO_RE.test(tempo) ? { tempo } : {}), ...(note ? { note } : {}), ...(home && home !== id ? { home } : {}),
  };
}

export function parseSession(x: unknown): ProgramSession | null {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const phase = int(o.phase, 0), day = int(o.day, 0);
  if (phase < 1 || phase > MAX_PHASES || day < 1 || day > MAX_DAYS_PER_WEEK) return null;
  const exercises = (Array.isArray(o.exercises) ? o.exercises : []).slice(0, MAX_EXERCISES).map(parseExercise).filter((e): e is ProgramExercise => !!e);
  return { phase, day, title: txt(o.title, 60) || `Día ${day}`, focus: txt(o.focus, 120), ...(o.optional === true ? { optional: true } : {}), exercises };
}

/** `days` válido para esas fases (o nada si son semanas completas). */
function daysField(phases: ProgramPhase[], v: unknown): { days?: number } {
  const w = clampN(phases.reduce((a, p) => a + p.weeks, 0), 1, MAX_WEEKS);
  const d = int(v, 0);
  return d > (w - 1) * 7 && d < w * 7 ? { days: d } : {};
}

export function parseMeta(x: unknown): ProgramMeta | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const phases = (Array.isArray(o.phases) ? o.phases : []).slice(0, MAX_PHASES).map((p) => {
    const q = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
    return { name: txt(q.name, 40) || "Fase", weeks: clampN(int(q.weeks, 1), 1, MAX_WEEKS), ...(q.deload === true ? { deload: true } : {}), ...(txt(q.focus, 160) ? { focus: txt(q.focus, 160) } : {}) };
  });
  if (!phases.length) return null;
  const n = (o.nutrition && typeof o.nutrition === "object" ? o.nutrition : null) as Record<string, unknown> | null;
  const mode = n && MODES.includes(n.mode as ProgramMode) ? (n.mode as ProgramMode) : undefined;
  const ppk = n && typeof n.proteinPerKg === "number" && Number.isFinite(n.proteinPerKg) ? Math.round(clampN(n.proteinPerKg, 1.2, 2.4) * 10) / 10 : undefined;
  const nutrition = mode || ppk ? { ...(mode ? { mode } : {}), ...(ppk ? { proteinPerKg: ppk } : {}), ...(n && txt(n.note, 240) ? { note: txt(n.note, 240) } : {}) } : null;
  const experience = parseExperience(o.experience);
  const list = (v: unknown, max: number, len: number) => (Array.isArray(v) ? v : []).map((s) => txt(s, len)).filter(Boolean).slice(0, max);
  return {
    phases, daysPerWeek: clampN(int(o.daysPerWeek, 3), 1, MAX_DAYS_PER_WEEK), ...daysField(phases, o.days), sessionMinutes: clampN(int(o.sessionMinutes, 45), 5, 180),
    level: LEVELS.includes(o.level as ProgramLevel) ? (o.level as ProgramLevel) : "todos", equipment: txt(o.equipment, 80) || "Gimnasio", adapt: o.adapt !== false,
    who: txt(o.who, 400), result: txt(o.result, 400), outcomes: list(o.outcomes, 8, 160),
    keyLifts: (Array.isArray(o.keyLifts) ? o.keyLifts : []).filter((s): s is string => typeof s === "string" && PROGRAM_EXERCISE_ID.test(s)).slice(0, 4),
    nutrition, ...(typeof o.previewExercise === "string" && PROGRAM_EXERCISE_ID.test(o.previewExercise) ? { previewExercise: o.previewExercise } : {}),
    ...(experience ? { experience } : {}),
  };
}

export function parseExperience(x: unknown): ProgramExperience | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const mode = txt(o.mode, 40);
  if (!mode) return null;
  const seen = new Set<string>();
  const habits: ProgramHabit[] = [];
  for (const h of Array.isArray(o.habits) ? o.habits : []) {
    const q = (h && typeof h === "object" ? h : {}) as Record<string, unknown>;
    const key = typeof q.key === "string" ? q.key.trim() : "", label = txt(q.label, 60);
    const kind = HABIT_KINDS.includes(q.kind as HabitKind) ? (q.kind as HabitKind) : null;
    if (!HABIT_KEY.test(key) || !label || !kind || seen.has(key)) continue;
    seen.add(key);
    const r = HABIT_RANGE[kind];
    const target = r ? clampN(int(q.target, HABIT_DEFAULT[kind]!), r[0], r[1]) : undefined;
    habits.push({ key, label, kind, ...(target !== undefined ? { target } : {}) });
    if (habits.length >= MAX_HABITS) break;
  }
  const tips = (Array.isArray(o.tips) ? o.tips : []).map((t) => txt(t, 220)).filter(Boolean).slice(0, MAX_TIPS);
  const food = (Array.isArray(o.food) ? o.food : []).map((t) => txt(t, 200)).filter(Boolean).slice(0, 4);
  const coach = o.coach === "platanita" ? ({ coach: "platanita" } as const) : {};
  return { mode, welcome: txt(o.welcome, 280), habits, tips, coachFocus: txt(o.coachFocus, 300), restDay: txt(o.restDay, 140), food, ...coach };
}

/** Consejo de la semana (1-based); el último se repite. */
export const tipFor = (x: Pick<ProgramExperience, "tips"> | null | undefined, week: number) => (x?.tips.length ? x.tips[clampN(week, 1, x.tips.length) - 1] : null);

export type HabitView = { key: string; label: string; kind: HabitKind; done: boolean; auto: boolean; detail: string | null; pct: number };
/**
 * Estado de los hábitos de hoy. Pura. `proteinTarget` solo llega con nutrición: sin ella, el hábito de proteína se
 * marca a mano. El de entreno, en un día sin sesión, se convierte en el descanso activo (a mano).
 */
export function habitsToday(x: ProgramExperience, log: { steps: number; water: number; sleep: number; protein: number }, o: { checks: string[]; proteinTarget: number | null; trainedToday: boolean; sessionDay: boolean }): HabitView[] {
  const fmt = (n: number) => n.toLocaleString("es-419");
  const checked = new Set(o.checks);
  return x.habits.map((h) => {
    const manual = (label = h.label): HabitView => ({ key: h.key, label, kind: h.kind, done: checked.has(h.key), auto: false, detail: null, pct: checked.has(h.key) ? 1 : 0 });
    const auto = (have: number, goal: number, unit: string): HabitView => ({ key: h.key, label: h.label, kind: h.kind, done: have >= goal, auto: true, detail: `${fmt(have)} de ${fmt(goal)} ${unit}`, pct: goal ? Math.min(1, have / goal) : 0 });
    switch (h.kind) {
      case "pasos": return auto(log.steps, h.target ?? 8000, "pasos");
      case "agua": return auto(log.water, h.target ?? 8, "vasos");
      case "sueno": return auto(log.sleep, h.target ?? 7, "h");
      case "proteina": return o.proteinTarget ? auto(log.protein, o.proteinTarget, "g") : manual();
      case "entreno":
        if (o.trainedToday) return { key: h.key, label: h.label, kind: h.kind, done: true, auto: true, detail: "Sesión hecha", pct: 1 };
        return o.sessionDay ? { key: h.key, label: h.label, kind: h.kind, done: false, auto: true, detail: "Te toca hoy", pct: 0 } : manual(x.restDay || "Descanso activo: camina y estira 10 minutos");
      default: return manual();
    }
  });
}

// ───────────── Calendario ─────────────

const DAY_MS = 864e5;
const isoDate = (iso: string) => new Date(iso.slice(0, 10) + "T12:00:00Z").getTime();
export const daysBetween = (a: string, b: string) => Math.round((isoDate(b) - isoDate(a)) / DAY_MS);
export const addDays = (iso: string, n: number) => { const d = new Date(iso.slice(0, 10) + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export const weeksOf = (meta: Pick<ProgramMeta, "phases">) => clampN(meta.phases.reduce((a, p) => a + p.weeks, 0), 1, MAX_WEEKS);
/** Días que dura el programa: `days` si lo trae (reto de 30 días), si no semanas x 7. */
export const daysOf = (meta: Pick<ProgramMeta, "phases" | "days">) => {
  const w = weeksOf(meta);
  return meta.days && meta.days > (w - 1) * 7 && meta.days < w * 7 ? meta.days : w * 7;
};
/** Duración para la persona: "30 días" o "6 semanas". */
export const durationLabel = (meta: Pick<ProgramMeta, "phases" | "days">) => {
  const d = daysOf(meta), w = weeksOf(meta);
  return d !== w * 7 ? `${d} días` : `${w} ${w === 1 ? "semana" : "semanas"}`;
};

/** Días del programa que cubre una semana (1-based): "días 8 a 14", "días 29 y 30" o "día 29" (programas en días). */
export function weekDaysLabel(meta: Pick<ProgramMeta, "phases" | "days">, week: number) {
  const start = (week - 1) * 7 + 1, end = Math.min(daysOf(meta), week * 7);
  return end <= start ? `día ${start}` : end === start + 1 ? `días ${start} y ${end}` : `días ${start} a ${end}`;
}

/** Días que faltan para un hito que cae al final de la semana `week` (programas en días; 0 = hoy es el último día). */
export function daysToWeekEnd(meta: Pick<ProgramMeta, "phases" | "days">, week: number, effectiveDay: number) {
  return Math.max(0, Math.min(daysOf(meta), week * 7) - (effectiveDay + 1));
}

/**
 * Días de entreno dentro de cada semana del programa (0 = el día en que empezó la semana). Reparte las sesiones con
 * descanso entre ellas: 3 días = 0, 2, 4 (lunes, miércoles y viernes si empezaste un lunes).
 */
export const SLOT_OFFSETS: Record<number, number[]> = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };
export const slotsFor = (daysPerWeek: number) => SLOT_OFFSETS[clampN(daysPerWeek, 1, MAX_DAYS_PER_WEEK)];

/** Plantilla con la que se guarda una sesión del programa en workouts.template (máx. 80 caracteres en la base). */
export const programTemplate = (slug: string, week: number, day: number) => `p:${slug}:${week}.${day}`;
export function parseProgramTemplate(t: string): { slug: string; week: number; day: number } | null {
  const m = /^p:([a-z0-9-]{2,60}):(\d{1,2})\.(\d)$/.exec(t);
  return m ? { slug: m[1], week: Number(m[2]), day: Number(m[3]) } : null;
}

/**
 * Días transcurridos dentro del programa (0 = día de inicio). Se congela mientras está en pausa y descuenta los días
 * que pasó en pausas anteriores, así la semana no avanza sin ti.
 */
export function effectiveDay(s: Pick<ProgramState, "status" | "startedOn" | "pausedOn" | "pausedDays">, today: string) {
  const end = s.status === "pausado" && s.pausedOn ? s.pausedOn : today;
  return Math.max(0, daysBetween(s.startedOn, end) - Math.max(0, s.pausedDays));
}

/** Fase de una semana (1-based) y sus semanas de inicio y fin. */
export function phaseAt(meta: Pick<ProgramMeta, "phases">, week: number) {
  let start = 1;
  for (let i = 0; i < meta.phases.length; i++) {
    const p = meta.phases[i], end = start + p.weeks - 1;
    if (week <= end || i === meta.phases.length - 1) return { index: i + 1, phase: p, startWeek: start, endWeek: end };
    start = end + 1;
  }
  return { index: 1, phase: meta.phases[0], startWeek: 1, endWeek: meta.phases[0].weeks };
}

/** Sesiones de una fase, ordenadas por día. */
export const sessionsOfPhase = (sessions: ProgramSession[], phase: number) => sessions.filter((s) => s.phase === phase).sort((a, b) => a.day - b.day);
/**
 * Día del programa (1-based) en que el calendario pone la sesión `day` de la semana `week`: en Pilates 30 días, la
 * sesión 4 de la semana 2 es el día 12. Sirve para nombrar las sesiones de un programa contado en días.
 */
export function programDayOf(def: Pick<ProgramDef, "meta" | "sessions">, week: number, day: number) {
  const list = sessionsOfPhase(def.sessions, phaseAt(def.meta, week).index);
  const k = Math.max(0, list.findIndex((s) => s.day === day));
  return (week - 1) * 7 + (slotsFor(Math.max(1, list.length || def.meta.daysPerWeek))[k] ?? k) + 1;
}
/** Sesiones que cuentan para cumplir la semana (las opcionales suman, pero no se exigen). */
export const requiredPerWeek = (meta: Pick<ProgramMeta, "daysPerWeek">, sessions: ProgramSession[], phase = 1) => {
  const list = sessionsOfPhase(sessions, phase);
  return list.length ? list.filter((s) => !s.optional).length : meta.daysPerWeek;
};

export type TodayKind = "entreno" | "descanso" | "hecho" | "semana-completa" | "pausado" | "terminado";
export type WeekSession = { day: number; session: ProgramSession; done: boolean; optional: boolean };
export type Milestone = { label: string; week: number; left: number; final: boolean };
export type ProgramRun = {
  weeks: number; week: number; dayInWeek: number; effectiveDay: number;
  /** Días totales del programa; `byDays`: se cuenta en días (reto de 30 días) y no en semanas. */
  days: number; byDays: boolean;
  phase: ReturnType<typeof phaseAt>;
  /** Sesiones de esta semana, con las hechas marcadas. */
  weekSessions: WeekSession[];
  /** Próxima sesión de la semana (o null si la semana está completa). */
  next: { week: number; day: number; session: ProgramSession } | null;
  today: TodayKind;
  /** Si hoy toca descanso: fecha de la próxima sesión. */
  nextOn: string | null;
  required: number; sessionsTotal: number; sessionsDone: number; extrasDone: number; sessionsMissed: number; pct: number;
  /** ¿Terminó el calendario del programa (o ya hizo todas las sesiones)? Entonces puede cerrarlo y recibir el certificado. */
  canFinish: boolean;
  milestone: Milestone | null;
};

/**
 * Qué toca hoy en un programa. Pura y probada.
 * - La semana del programa empieza el día en que lo empezaste y no avanza durante una pausa.
 * - Cada semana pide sus sesiones en orden (día 1, 2, 3...). Hoy toca entreno si vas por detrás de los días planeados
 *   (SLOT_OFFSETS) y no hiciste ya una sesión del programa hoy; si no, descansas hasta la próxima fecha planeada.
 * - Las sesiones que no hiciste en una semana pasada cuentan como perdidas (no se arrastran: el calendario manda).
 */
export function resolveProgram(def: Pick<ProgramDef, "meta" | "sessions">, s: Pick<ProgramState, "status" | "startedOn" | "pausedOn" | "pausedDays">, done: DoneSession[], today: string): ProgramRun {
  const weeks = weeksOf(def.meta);
  const eff = effectiveDay(s, today);
  const ended = eff >= daysOf(def.meta);
  const week = clampN(Math.floor(eff / 7) + 1, 1, weeks);
  const dayInWeek = ended ? 6 : eff % 7;
  const phase = phaseAt(def.meta, week);
  // Solo cuenta lo hecho en esta corrida del programa (desde su inicio) y dentro de sus semanas.
  const mine = done.filter((d) => d.on >= s.startedOn && d.week >= 1 && d.week <= weeks);
  const key = (w: number, d: number) => `${w}.${d}`;
  const doneKeys = new Set(mine.map((d) => key(d.week, d.day)));
  const list = sessionsOfPhase(def.sessions, phase.index);
  const weekSessions: WeekSession[] = list.map((x) => ({ day: x.day, session: x, done: doneKeys.has(key(week, x.day)), optional: !!x.optional }));
  // Primero las obligatorias en orden; después las opcionales.
  const pending = [...weekSessions.filter((w) => !w.done && !w.optional), ...weekSessions.filter((w) => !w.done && w.optional)];
  const nextW = pending[0] ?? null;
  const next = nextW && !ended ? { week, day: nextW.day, session: nextW.session } : null;

  let required = 0, sessionsTotal = 0, sessionsDone = 0, extrasDone = 0, sessionsMissed = 0;
  for (let w = 1; w <= weeks; w++) {
    const ph = phaseAt(def.meta, w);
    const ss = sessionsOfPhase(def.sessions, ph.index);
    const req = ss.filter((x) => !x.optional);
    if (w === week) required = req.length;
    sessionsTotal += req.length;
    const reqDone = req.filter((x) => doneKeys.has(key(w, x.day))).length;
    sessionsDone += reqDone;
    extrasDone += ss.filter((x) => x.optional && doneKeys.has(key(w, x.day))).length;
    if (w < week || (ended && w === week)) sessionsMissed += req.length - reqDone;
  }

  const doneThisWeek = weekSessions.filter((w) => w.done).length;
  const slots = slotsFor(Math.max(1, list.length || def.meta.daysPerWeek));
  const plannedByToday = slots.filter((o) => o <= dayInWeek).length;
  const doneToday = mine.some((d) => d.on === today);
  let kind: TodayKind;
  let nextOn: string | null = null;
  if (s.status === "pausado") kind = "pausado";
  else if (ended) kind = "terminado";
  else if (doneToday) kind = "hecho";
  else if (!next) kind = "semana-completa";
  else if (doneThisWeek < plannedByToday) kind = "entreno";
  else kind = "descanso";
  if (kind === "descanso" || kind === "hecho" || kind === "semana-completa") {
    const slot = slots[doneThisWeek];
    if (next && slot !== undefined && slot > dayInWeek) nextOn = addDays(today, slot - dayInWeek);
    else if (next) nextOn = addDays(today, 1);
    else if (week < weeks) nextOn = addDays(today, 7 - dayInWeek);
  }

  // Hitos: fin de cada fase y el certificado al final.
  const marks: { label: string; week: number; final: boolean }[] = [];
  let acc = 0;
  def.meta.phases.forEach((p, i) => { acc += p.weeks; if (i < def.meta.phases.length - 1) marks.push({ label: `Fin de la fase ${i + 1}: ${p.name}`, week: acc, final: false }); });
  marks.push({ label: "Certificado del programa", week: weeks, final: true });
  const m = marks.find((x) => x.week >= week);
  const milestone = m ? { ...m, left: m.week - week } : null;

  return {
    weeks, week, dayInWeek, effectiveDay: eff, days: daysOf(def.meta), byDays: daysOf(def.meta) !== weeks * 7, phase, weekSessions, next, today: kind, nextOn,
    required, sessionsTotal, sessionsDone, extrasDone, sessionsMissed, pct: sessionsTotal ? sessionsDone / sessionsTotal : 0,
    canFinish: s.status === "activo" && (ended || (sessionsTotal > 0 && sessionsDone >= sessionsTotal)), milestone,
  };
}

// ───────────── Reglas de estado ─────────────

/**
 * Un solo programa activo a la vez. Empezar (o reanudar) `slug` con otro activo pide pausarlo primero.
 * Devuelve el programa que estorba (o null) y qué pasa con `slug`: empieza de cero, se reanuda o ya está activo.
 */
export function startPlan(states: Pick<ProgramState, "slug" | "status">[], slug: string): { conflict: string | null; action: "empezar" | "reanudar" | "activo" | "reiniciar" } {
  const conflict = states.find((s) => s.status === "activo" && s.slug !== slug)?.slug ?? null;
  const own = states.find((s) => s.slug === slug);
  const action = !own ? "empezar" : own.status === "activo" ? "activo" : own.status === "pausado" ? "reanudar" : "reiniciar";
  return { conflict, action };
}

/** Días de pausa al reanudar (se suman a los anteriores). */
export const resumePausedDays = (s: Pick<ProgramState, "pausedOn" | "pausedDays">, today: string) => Math.max(0, s.pausedDays) + (s.pausedOn ? Math.max(0, daysBetween(s.pausedOn, today)) : 0);

// ───────────── Nutrición ─────────────

/**
 * Ajuste de nutrición del programa, SOLO si la persona tiene nutrición (`ent.nutrition`). Un programa nunca da nutrición.
 */
export function programNutrition(meta: Pick<ProgramMeta, "nutrition"> | null | undefined, ent: { nutrition: boolean }): ProgramNutrition | null {
  if (!ent.nutrition || !meta?.nutrition) return null;
  return meta.nutrition.mode || meta.nutrition.proteinPerKg ? meta.nutrition : null;
}

/** Aplica la proteína del programa (g por kg) a unas metas ya calculadas, recalculando los carbohidratos. */
export function withProgramProtein<T extends { kcal: number; protein: number; fat: number; carbs: number }>(t: T, n: ProgramNutrition | null, kg: number): T {
  if (!n?.proteinPerKg) return t;
  const protein = Math.round((n.proteinPerKg * kg) / 5) * 5;
  return { ...t, protein, carbs: Math.max(0, Math.round((t.kcal - protein * 4 - t.fat * 9) / 4)) };
}

// ───────────── Validación del panel ─────────────

/**
 * Errores que impiden publicar un programa (vacío = se puede publicar). `known` dice si un id de ejercicio existe.
 */
export function programErrors(meta: ProgramMeta | null, sessions: ProgramSession[], known: (id: string) => boolean): string[] {
  if (!meta) return ["Define al menos una fase con sus semanas."];
  const out: string[] = [];
  if (!meta.phases.length) out.push("Define al menos una fase con sus semanas.");
  const total = meta.phases.reduce((a, p) => a + p.weeks, 0);
  if (total > MAX_WEEKS) out.push(`El programa dura ${total} semanas; el máximo es ${MAX_WEEKS}.`);
  if (!meta.who) out.push("Escribe para quién es el programa.");
  if (!meta.result) out.push("Escribe el resultado que busca el programa.");
  // Programa en días (reto de 30 días): la última semana es corta y lleva solo las sesiones que caben en sus días.
  const shortLast = daysOf(meta) - (weeksOf(meta) - 1) * 7;
  meta.phases.forEach((p, i) => {
    const ss = sessionsOfPhase(sessions, i + 1);
    const last = i === meta.phases.length - 1 && shortLast < 7 && p.weeks === 1;
    if (last && ss.length > shortLast) out.push(`Fase ${i + 1} (${p.name}): solo caben ${shortLast} sesiones en sus ${shortLast} días.`);
    for (let d = 1; d <= (last ? Math.max(1, Math.min(ss.length, shortLast)) : meta.daysPerWeek); d++) {
      const s = ss.find((x) => x.day === d);
      if (!s || !s.exercises.length) out.push(`Fase ${i + 1} (${p.name}), día ${d}: la sesión no tiene ejercicios.`);
    }
    if (ss.length && ss.every((x) => x.optional)) out.push(`Fase ${i + 1}: al menos una sesión debe ser obligatoria.`);
  });
  const bad = [...new Set(sessions.flatMap((s) => s.exercises.flatMap((e) => [e.id, ...(e.home ? [e.home] : [])])).filter((id) => !known(id)))];
  if (bad.length) out.push(`Ejercicios que no existen en la biblioteca: ${bad.slice(0, 5).join(", ")}.`);
  for (const id of meta.keyLifts) if (!sessions.some((s) => s.exercises.some((e) => e.id === id))) out.push(`El ejercicio clave ${id} no está en ninguna sesión.`);
  return out;
}

/** "3 a 4 días por semana" cuando hay sesiones opcionales; si no, "3 días por semana". */
export function daysLabel(meta: Pick<ProgramMeta, "daysPerWeek">, sessions: ProgramSession[]) {
  const req = requiredPerWeek(meta, sessions);
  return req < meta.daysPerWeek ? `${req} a ${meta.daysPerWeek} días por semana` : `${meta.daysPerWeek} ${meta.daysPerWeek === 1 ? "día" : "días"} por semana`;
}

/** Texto de una prescripción: "3 × 8-12", "3 × 30-45 s". */
export const setsLabel = (e: Pick<ProgramExercise, "sets" | "lo" | "hi"> & { unit?: string }) => `${e.sets} × ${e.lo === e.hi ? e.lo : `${e.lo}-${e.hi}`}${e.unit === "s" ? " s" : e.unit === "m" ? " m" : ""}`;
export const restLabel = (s: number) => (s >= 120 ? `${(s / 60).toLocaleString("es-419")} min` : `${s} s`);

// ───────────── Del programa a la rutina del día ─────────────

/** Nombre, músculo y equipo de un ejercicio (lo resuelve el servidor con la biblioteca). */
export type ExInfo = { name: string; muscle: string; eq?: string };
const HOME_EQ = new Set(["body weight", "dumbbell", "band", "resistance band", "kettlebell", "stability ball", "medicine ball", "rope", "roller", "wheel roller"]);
const isEngine = (id: string): id is ExerciseId => Object.hasOwn(EX, id);

/**
 * Ejercicio que hace la persona según su equipo. Solo si el programa se adapta (`meta.adapt`): los del motor usan sus
 * equivalentes de casa o sin equipo (forEquipment); los de la biblioteca, su alternativa `home` cuando su equipo no
 * está en casa. Nunca cambia por nivel: el programa ya define sus variantes.
 */
export function adaptId(e: Pick<ProgramExercise, "id" | "home">, eq: Equipment, adapt: boolean, info: (id: string) => ExInfo | null): string {
  if (!adapt || eq === "gym" || eq === "mixto") return e.id;
  if (isEngine(e.id)) return forEquipment(e.id, eq, "intermedio");
  const lib = info(e.id);
  const fits = lib?.eq ? (eq === "ninguno" ? lib.eq === "body weight" : HOME_EQ.has(lib.eq)) : true;
  if (fits || !e.home) return e.id;
  return isEngine(e.home) ? forEquipment(e.home, eq, "intermedio") : e.home;
}

/**
 * Sesión del programa como día del motor (Hoy, Entrenar, coach). `exercises` lleva los mismos ejercicios para quien solo
 * lee nombre y series; el reproductor usa `program.exercises`, que admite ids de la biblioteca.
 */
export function plannedFromSession(def: Pick<ProgramDef, "slug" | "title" | "meta">, icon: string, session: ProgramSession, week: number, dow: number, eq: Equipment, info: (id: string) => ExInfo | null): PlannedDay {
  const ph = phaseAt(def.meta, week);
  const seen = new Set<string>();
  const exercises: ProgramPlannedExercise[] = [];
  for (const e of session.exercises) {
    const id = adaptId(e, eq, def.meta.adapt, info);
    if (seen.has(id)) continue; // dos alternativas de casa iguales en la misma sesión: se queda la primera
    seen.add(id);
    const i = info(id);
    exercises.push({ id: id as ProgramPlannedExercise["id"], name: i?.name ?? id, muscle: i?.muscle ?? "", cfg: { sets: e.sets, lo: e.lo, hi: e.hi, rest: e.rest, ...(e.unit ? { unit: e.unit } : {}) }, ...(e.tempo ? { tempo: e.tempo } : {}), ...(e.note ? { note: e.note } : {}) });
  }
  return {
    dow, tpl: null, key: programTemplate(def.slug, week, session.day), name: session.title, tag: ph.phase.deload ? "Descarga" : ph.phase.name, icon,
    exercises: exercises as unknown as PlannedExercise[], mins: estimateMinutes(exercises),
    program: { slug: def.slug, title: def.title, week, day: session.day, weeks: weeksOf(def.meta), deload: !!ph.phase.deload, exercises },
  };
}

/** Día de descanso dentro del programa. */
export const restDay = (dow: number, text = "Camina 8-12k pasos y estira 10 min"): PlannedDay => ({ dow, tpl: null, name: "Descanso", tag: "Recuperación", icon: "palm", exercises: [], cardio: text });

/**
 * Sesión que el calendario del programa pone en una fecha (sin contar recuperaciones). Sirve para dibujar la semana:
 * qué días tocan entreno y cuál. Null si ese día no toca, si es antes del inicio o después del final, o en pausa.
 */
export function calendarSlot(def: Pick<ProgramDef, "meta" | "sessions">, s: Pick<ProgramState, "status" | "startedOn" | "pausedOn" | "pausedDays">, today: string, date: string) {
  if (s.status !== "activo") return null;
  const e = effectiveDay(s, today) + daysBetween(today, date);
  if (e < 0 || e >= daysOf(def.meta)) return null;
  const week = Math.floor(e / 7) + 1, off = e % 7;
  const list = sessionsOfPhase(def.sessions, phaseAt(def.meta, week).index);
  const k = slotsFor(Math.max(1, list.length || def.meta.daysPerWeek)).indexOf(off);
  return k >= 0 && list[k] ? { week, day: list[k].day, session: list[k] } : null;
}

/**
 * Orden de los programas en la tienda según quién mira. A un hombre, los programas de Coach Platanita (pensados para
 * chicas: Banana Girl, Pilates en casa) no le salen primero: van al final de la lista, salvo que ya sean suyos
 * (`keep`: comprados o con estado). Para el resto, el orden no cambia. Orden estable.
 */
export function orderProgramsFor<T extends { id: string; program: ProgramMeta | null }>(list: T[], sex: string | null | undefined, keep: Set<string> = new Set()): T[] {
  const girls = (c: T) => c.program?.experience?.coach === "platanita";
  // Para ella, los programas de chicas primero (en su orden); para él, al final salvo los que ya tiene.
  if (sex === "f") return [...list.filter(girls), ...list.filter((c) => !girls(c))];
  if (sex !== "m") return list;
  const forHer = (c: T) => girls(c) && !keep.has(c.id);
  return [...list.filter((c) => !forHer(c)), ...list.filter(forHer)];
}
