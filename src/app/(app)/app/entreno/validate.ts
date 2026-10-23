// Validación y cálculos del guardado de un entreno, sin base de datos para poder probarlos.
import { e1rm, type SetLog } from "@/lib/engine";

export type DoneSet = { kg: number | null; reps: number; rir: number | null };
export type Finished = {
  template: string; startedAt: string; fun: number | null; exercises: { id: string; sets: DoneSet[] }[]; total?: number; title?: string; icon?: string; note?: string;
  /** Cuándo terminó (al pasar al resumen). Importa si se guarda más tarde, por ejemplo al volver la señal. */
  finishedAt?: string;
};

const HOUR = 3600_000;
/** Un entreno guardado sin señal puede subirse hasta 3 días después y conservar su fecha. */
export const OFFLINE_WINDOW_MS = 72 * HOUR;
const MAX_SESSION_MS = 6 * HOUR;
const SKEW_MS = 5 * 60_000;

/**
 * Horas del entreno que el servidor acepta. El inicio del navegador vale si es de los últimos 3 días (entreno
 * guardado sin señal); si no, se usa la hora del servidor. La duración nunca pasa de 6 horas.
 * `clientStart` indica si se respetó el inicio del navegador: con él se reconoce un doble envío.
 */
export function workoutTiming(startedAt: string | undefined, finishedAt: string | undefined, now: number) {
  const t0 = Date.parse(String(startedAt ?? ""));
  const clientStart = Number.isFinite(t0) && t0 <= now + SKEW_MS && now - t0 <= OFFLINE_WINDOW_MS;
  const started = clientStart ? Math.min(t0, now) : now;
  const t1 = Date.parse(String(finishedAt ?? ""));
  const finishOk = clientStart && Number.isFinite(t1) && t1 >= started && t1 <= now + SKEW_MS && t1 - started <= MAX_SESSION_MS;
  const finished = finishOk ? Math.min(t1, now) : Math.min(now, started + MAX_SESSION_MS);
  return { started, finished, seconds: Math.max(0, (finished - started) / 1000), clientStart, startIso: new Date(clientStart ? t0 : started).toISOString() };
}

const fin = (x: unknown, lo: number, hi: number) => (typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi);
/** Ejercicios del motor ("squat") y de la biblioteca ("ds:0043"). */
export const EXERCISE_ID = /^(ds:)?[A-Za-z0-9_]{1,40}$/;

/** El navegador manda el entreno: acotamos tamaños y valores antes de tocar la base de datos. */
export function normalizeWorkout(w: Finished): Finished | null {
  if (!w || typeof w !== "object" || !Array.isArray(w.exercises) || w.exercises.length > 30) return null;
  if (typeof w.template !== "string" || !/^[A-Za-z0-9 _.:áéíóúñÁÉÍÓÚÑ+-]{1,80}$/.test(w.template)) return null;
  const exercises: Finished["exercises"] = [];
  for (const e of w.exercises) {
    if (!e || typeof e.id !== "string" || !EXERCISE_ID.test(e.id) || !Array.isArray(e.sets) || e.sets.length > 12) return null;
    const sets: DoneSet[] = [];
    for (const s of e.sets) {
      if (!s || !fin(s.reps, 0, 100) || !(s.kg === null || fin(s.kg, 0, 500)) || !(s.rir === null || s.rir === undefined || fin(s.rir, 0, 10))) return null;
      sets.push({ kg: s.kg === null ? null : Math.round(s.kg * 100) / 100, reps: Math.round(s.reps), rir: s.rir == null ? null : Math.round(s.rir) });
    }
    exercises.push({ id: e.id, sets });
  }
  return {
    template: w.template, startedAt: String(w.startedAt ?? "").slice(0, 40), fun: fin(w.fun, 1, 5) ? Math.round(w.fun as number) : null, exercises,
    total: fin(w.total, 0, 200) ? w.total : undefined,
    title: typeof w.title === "string" ? w.title.slice(0, 60) : undefined, icon: typeof w.icon === "string" ? w.icon : undefined,
    note: typeof w.note === "string" ? w.note : undefined,
    finishedAt: typeof w.finishedAt === "string" && w.finishedAt.length <= 40 ? w.finishedAt : undefined,
  };
}

/**
 * Récords que el servidor reconoce: ejercicios con alguna serie cuyo 1RM estimado supera el mejor del historial guardado.
 * Sin historial no hay récord (la primera vez es calibración). Mismo criterio que el reproductor.
 */
export function serverPrs(exercises: Finished["exercises"], history: Record<string, SetLog[][]>): string[] {
  return exercises.filter((e) => {
    const best = Math.max(0, ...(history[e.id] ?? []).flat().map((s) => (s.kg ? e1rm(s.kg, s.reps) : 0)));
    return best > 0 && e.sets.some((s) => (s.kg ?? 0) > 0 && s.reps > 0 && s.kg! * (1 + s.reps / 30) > best + 0.01);
  }).map((e) => e.id);
}
