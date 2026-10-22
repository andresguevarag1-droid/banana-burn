import { DEFAULT_WEEK, EX, EXPRESS_POOL, SLOTS, TPL, forEquipment, type Equipment, type ExerciseId, type Level, type SlotCfg, type TemplateId } from "./data";

export * from "./data";

export type Sex = "m" | "f";
export type Mode = "acelerada" | "recomp";
export type SetLog = { kg: number | null; reps: number; rir?: number | null };

export function ageOn(dob: string, on = new Date()): number {
  const d = new Date(dob + "T00:00:00");
  let a = on.getFullYear() - d.getFullYear();
  if (on < new Date(on.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
}

/** Mifflin-St Jeor × 1.55 (actividad moderada: 4–6 entrenos + 8–12k pasos). */
export function energy({ kg, heightCm, age, sex = "m" }: { kg: number; heightCm: number; age: number; sex?: Sex }) {
  const bmr = 10 * kg + 6.25 * heightCm - 5 * age + (sex === "m" ? 5 : -161);
  return { bmr: Math.round(bmr), tdee: Math.round(bmr * 1.55) };
}

export function targets(p: { kg: number; heightCm: number; age: number; sex?: Sex; mode?: Mode }) {
  const { bmr, tdee } = energy(p);
  const deficit = p.mode === "recomp" ? 200 : 500;
  const kcal = Math.round((tdee - deficit) / 50) * 50;
  const protein = Math.round((2.0 * p.kg) / 5) * 5; // 1.6–2.2 g/kg → 2.0 centro
  const fat = Math.round((0.75 * p.kg) / 5) * 5;
  const carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);
  return { kcal, protein, fat, carbs, steps: 10000, sleep: 8, bmr, tdee };
}

export const e1rm = (kg: number, reps: number) => Math.round(kg * (1 + reps / 30) * 10) / 10;

const roundTo = (kg: number, step: number) => Math.round(kg / step) * step;

export type Prescription = { sets: number; kg: number | null; reps: number[]; type: "cal" | "up" | "reps" | "reset" | "deload"; note: string };

/** Doble progresión + reinicio −10 % tras 2 sesiones flojas + descarga. `history` = sesiones previas (antigua→reciente). */
export function prescribe(id: ExerciseId | string, cfg: SlotCfg, history: SetLog[][], opts: { deload?: boolean; inc?: number } = {}): Prescription {
  const ex = { inc: opts.inc ?? EX[id as ExerciseId]?.inc ?? 0 };
  const step = ex.inc >= 2.5 ? 2.5 : ex.inc || 1;
  const sets = opts.deload ? Math.max(2, cfg.sets - 1) : cfg.sets;
  // Intervalos (exprés): trabajo por tiempo con descanso corto; no hay reps que anotar.
  if (cfg.unit === "s" && cfg.rest <= 30) return { sets, kg: null, reps: Array(sets).fill(cfg.hi), type: "reps", note: `Intervalos: ${cfg.hi} s de trabajo y ${cfg.rest} s de descanso. Ritmo firme y técnica limpia; si se rompe la forma, baja la velocidad.` };
  if (!history.length) return { sets, kg: null, reps: Array(sets).fill(cfg.lo), type: "cal", note: ex.inc ? `Calibración: elige un peso con el que llegues a ${cfg.lo}–${cfg.hi} reps dejando 2 en reserva.` : `Calibración: haz ${cfg.lo}–${cfg.hi} ${cfg.unit === "s" ? "segundos" : cfg.unit === "m" ? "metros" : "reps"} limpias dejando 1–2 en reserva. Anota lo que hiciste en cada serie.` };
  const last = history[history.length - 1];
  const prev = history.length > 1 ? history[history.length - 2] : null;
  const kg = Math.max(...last.map((s) => s.kg || 0));
  const work = last.filter((s) => (s.kg || 0) === kg);
  const allTop = work.length >= Math.min(cfg.sets, last.length) && work.every((s) => s.reps >= cfg.hi);
  const easy = work.some((s) => (s.rir ?? 2) >= 4) && work.every((s) => s.reps >= cfg.lo);
  const lowN = last.filter((s) => s.reps < cfg.lo).length;
  const prevLow = prev ? prev.filter((s) => s.reps < cfg.lo).length >= 2 : false;
  if (opts.deload) return { sets, kg: roundTo(kg * 0.9, step), reps: Array(sets).fill(cfg.lo), type: "deload", note: "Semana de descarga: −10 % de carga, una serie menos, 3 reps en reserva." };
  if ((allTop || easy) && !ex.inc) { const r = Math.round(cfg.hi * 1.1); return { sets, kg, reps: Array(sets).fill(r), type: "up", note: `Dominaste el rango: busca ${r} reps hoy.` }; }
  if (allTop || easy) { const nk = roundTo(kg + ex.inc, step); return { sets, kg: nk, reps: Array(sets).fill(cfg.lo), type: "up", note: `Llegaste a ${cfg.hi} reps: sube a ${nk} kg y vuelve a ${cfg.lo}.` }; }
  if (lowN >= 2 && prevLow) { const nk = roundTo(kg * 0.9, step); return { sets, kg: nk, reps: Array(sets).fill(cfg.lo + 1), type: "reset", note: `Dos sesiones bajo ${cfg.lo} reps: reinicia a ${nk} kg (−10 %).` }; }
  const reps = Array.from({ length: sets }, (_, i) => { const s = last[i] || last[last.length - 1]; return Math.min(cfg.hi, Math.max(cfg.lo, (s.reps || cfg.lo) + 1)); });
  return { sets, kg, reps, type: "reps", note: "Mismo peso, +1 rep por serie." };
}

/** Pendiente semanal (kg/sem) por regresión lineal de ≥4 pesajes en ≥6 días. */
export function weeklyTrend(weights: { d: string; kg: number }[]): number | null {
  const ws = [...weights].sort((a, b) => (a.d < b.d ? -1 : 1));
  if (ws.length < 4) return null;
  const day = (s: string) => new Date(s + "T00:00:00").getTime() / 864e5;
  const x0 = day(ws[0].d);
  const xs = ws.map((w) => day(w.d) - x0), ys = ws.map((w) => w.kg);
  if (xs[xs.length - 1] < 6) return null;
  const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  let num = 0, den = 0;
  xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
  return den ? Math.round((num / den) * 7 * 100) / 100 : null;
}

/** Ajuste calórico semanal según tendencia vs ritmo necesario. */
export function kcalAdjustment(rate: number | null, needPerWeek: number): number {
  if (rate == null) return 0;
  const lost = -rate;
  if (lost < needPerWeek * 0.6) return -150;
  if (lost < needPerWeek * 0.85) return -75; // un poco por debajo: ajuste suave
  if (lost > Math.max(1.2, needPerWeek * 1.6)) return +150;
  return 0;
}

export function weekIndex(startMonday: string, on: Date): number {
  const s = new Date(startMonday + "T00:00:00").getTime();
  return Math.max(0, Math.floor((on.getTime() - s) / (7 * 864e5)));
}

export const isDeloadWeek = (week: number) => week > 0 && (week + 1) % 6 === 0;

export type PlannedExercise = { id: ExerciseId; name: string; muscle: string; cfg: SlotCfg };
export type PlannedDay = { dow: number; tpl: TemplateId | null; name: string; tag: string; emoji: string; exercises: PlannedExercise[]; cardio?: string; mins?: number };

/** Rutina de un día: las variantes rotan cada semana, así nada se repite. */
export type PlanOpts = { equipment?: Equipment; level?: Level; minutes?: number };

/** Minutos estimados de una sesión: ~40 s por serie + descansos + 5 min de calentamiento. */
export function estimateMinutes(ex: { cfg: SlotCfg }[]) {
  const secs = ex.reduce((a, e) => a + e.cfg.sets * (40 + e.cfg.rest), 0);
  return Math.round(secs / 60 + 5);
}

/** Ajusta volumen por nivel y recorta para caber en los minutos disponibles. */
export function personalize(exs: PlannedExercise[], level: Level = "intermedio", minutes?: number): PlannedExercise[] {
  let out = exs.map((e, i) => {
    const c = { ...e.cfg };
    if (level === "principiante") { c.sets = Math.max(2, c.sets - 1); if (!c.unit) { c.lo += 2; c.hi += 2; } c.rest = Math.min(c.rest, 150); }
    if (level === "avanzado" && i < 2) c.sets += 1;
    return { ...e, cfg: c };
  });
  if (minutes) {
    // 1) recorta descansos largos, 2) quita series de accesorios, 3) quita el último ejercicio (mínimo 2)
    if (estimateMinutes(out) > minutes) out = out.map((e) => ({ ...e, cfg: { ...e.cfg, rest: Math.min(e.cfg.rest, 90) } }));
    let guard = 0;
    while (estimateMinutes(out) > minutes && guard++ < 30) {
      const j = [...out].reverse().findIndex((e) => e.cfg.sets > 2);
      if (j >= 0) { const k = out.length - 1 - j; out = out.map((e, i) => (i === k ? { ...e, cfg: { ...e.cfg, sets: e.cfg.sets - 1 } } : e)); }
      else if (out.length > 2) out = out.slice(0, -1);
      else break;
    }
  }
  return out;
}

export function planDay(dow: number, week: number, schedule = DEFAULT_WEEK, opts: PlanOpts | Equipment = {}): PlannedDay {
  const o: PlanOpts = typeof opts === "string" ? { equipment: opts } : opts;
  const tplId = schedule[dow];
  if (!tplId) return { dow, tpl: null, name: "Descanso activo", tag: "Recuperación", emoji: "🌴", exercises: [], cardio: "Camina 8–12k pasos y estira 10 min" };
  const t = TPL[tplId];
  const raw = t.ex.map((cfg) => {
    const base = (cfg.id ?? SLOTS[cfg.slot!][week % SLOTS[cfg.slot!].length]) as ExerciseId;
    const id = forEquipment(base, o.equipment ?? "gym", o.level ?? "intermedio");
    return { id, name: EX[id].n, muscle: EX[id].m, cfg };
  });
  // evita repetir el mismo ejercicio dentro del día tras los reemplazos
  const seen = new Set<string>();
  const exercises = personalize(raw.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true))), o.level, o.minutes);
  const mins = estimateMinutes(exercises) + (t.cardio ? 10 : 0);
  return { dow, tpl: tplId, name: t.n, tag: t.tag, emoji: t.emoji, exercises, cardio: t.cardio, mins };
}

/** Entreno exprés de 10/20/30 min sin equipo: series por tiempo, descansos cortos, cuerpo completo. */
export function expressDay(minutes: number, seed = 0): PlannedDay {
  const m = [10, 20, 30].includes(minutes) ? minutes : 20;
  const nEx = m === 10 ? 4 : m === 20 ? 5 : 6;
  const kinds = ["piernas", "empuje", "core", "cardio", "tiron", "piernas", "empuje", "core"];
  const picked: ExerciseId[] = [];
  for (let i = 0; picked.length < nEx && i < 40; i++) {
    const kind = kinds[i % kinds.length];
    const pool = EXPRESS_POOL.filter((x) => x.kind === kind && !picked.includes(x.id));
    if (pool.length) picked.push(pool[(seed + i) % pool.length].id);
  }
  const work = 40, rest = 20;
  const sets = Math.max(2, Math.floor(((m - 2) * 60) / (nEx * (work + rest))));
  const exercises = picked.map((id) => ({ id, name: EX[id].n, muscle: EX[id].m, cfg: { id, sets, lo: work - 10, hi: work, rest, unit: "s" as const } }));
  return { dow: -1, tpl: null, name: `Exprés ${m} min`, tag: "Sin equipo", emoji: "⚡", exercises, mins: m, cardio: undefined };
}

export function planWeek(week: number, schedule = DEFAULT_WEEK, opts: PlanOpts | Equipment = {}): PlannedDay[] {
  return [1, 2, 3, 4, 5, 6, 0].map((d) => planDay(d, week, schedule, opts));
}

/** Semana según días disponibles (3–6). Nunca repite plantilla en días seguidos. */
export function scheduleFor(days: number): Record<number, TemplateId | null> {
  const n = Math.max(3, Math.min(6, Math.round(days || 6)));
  if (n === 6) return DEFAULT_WEEK;
  if (n === 5) return { 0: null, 1: "pushA", 2: "pullA", 3: "core", 4: "pushB", 5: "pullB", 6: null };
  if (n === 4) return { 0: null, 1: "pushA", 2: "pullA", 3: null, 4: "pushB", 5: "pullB", 6: null };
  return { 0: null, 1: "pushA", 2: null, 3: "pullA", 4: null, 5: "pushB", 6: null };
}
