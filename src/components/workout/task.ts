// Lo que la persona tiene que hacer AHORA, en palabras simples y sin huecos: "12 repeticiones", "con 10 kg",
// "30 segundos por lado", "Intervalo 3 de 6: 40 s fuerte". Lógica pura (sin React) para poder probar todas las formas.
import { kgFmt, num, restLabel } from "./logic";
import { SWITCH_SECONDS } from "./sides";

export type TaskInput = {
  /** Unidad del ejercicio: sin unidad = repeticiones, "s" = segundos, "m" = metros. */
  unit?: string;
  /** Valor anotado en la serie (reps, segundos o metros). Puede venir vacío: se usa el rango del plan. */
  reps: string | number;
  /** Peso anotado (kg). Vacío o 0 = sin peso. */
  kg?: string | number;
  lo: number; hi: number;
  /** Peso corporal: el peso, si lo hay, es lastre extra. */
  bw: boolean;
  /** El ejercicio necesita un peso que aún no se eligió. */
  needsKg?: boolean;
  perSide?: boolean;
  /** Primer día con este ejercicio: se pide el rango completo, no un número. */
  calibration?: boolean;
  /** Trabajo por intervalos (exprés): `setNo` es el intervalo. */
  interval?: boolean;
  setNo: number; sets: number;
  /** Lado que se trabaja ahora en una serie por lado (1 = derecho). */
  side?: 1 | 2;
};

export type Task = {
  /** El número grande ("12", "8 a 12", "30"). */
  value: string;
  /** Lo que mide, en palabras ("repeticiones", "segundos por lado"). */
  unit: string;
  /** La meta en una línea: "12 repeticiones", "30 segundos por lado". */
  line: string;
  /** Peso de la serie: "con 10 kg", "con 5 kg extra", o cómo elegirlo si falta. */
  load: string | null;
  /** Explicación del rango en palabras simples, solo cuando la meta es un rango. */
  range: string | null;
  /** "Serie 2 de 4", "Intervalo 3 de 6", "Última serie". */
  step: string;
  /** Para leer en voz alta o en el lector de pantalla. */
  say: string;
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const whole = (v: string | number | undefined) => Math.max(0, Math.round(num(v ?? "")));

/** Unidad en palabras según el valor ("1 segundo", "8 repeticiones"). */
function unitWords(unit: string | undefined, n: number, perSide?: boolean) {
  const base = unit === "s" ? plural(n, "segundo", "segundos") : unit === "m" ? plural(n, "metro", "metros") : plural(n, "repetición", "repeticiones");
  return perSide ? `${base} por lado` : base;
}

/**
 * La meta de una serie para el bloque "qué hacer ahora". Nunca devuelve un hueco: si la serie no trae valor,
 * usa el rango del plan (y si tampoco hay, 10 repeticiones o 30 segundos).
 */
export function formatExerciseTask(o: TaskInput): Task {
  const lo = Math.max(0, Math.round(o.lo || 0));
  const hi = Math.max(lo, Math.round(o.hi || 0));
  const fallback = o.unit === "s" ? hi || lo || 30 : o.unit === "m" ? hi || lo || 20 : lo || hi || 10;
  const n = whole(o.reps) || fallback;
  const kg = num(o.kg ?? "");
  const last = o.sets > 1 && o.setNo >= o.sets;

  if (o.interval) {
    const secs = n;
    const line = `${secs} s fuerte${o.perSide ? " por lado" : ""}`;
    return {
      value: String(secs), unit: o.perSide ? "segundos por lado" : "segundos", line, load: null, range: null,
      step: `Intervalo ${o.setNo} de ${o.sets}`,
      say: `Intervalo ${o.setNo} de ${o.sets}: ${secs} segundos${o.perSide ? " por lado" : ""} a buen ritmo.`,
    };
  }

  // Rango solo en repeticiones de calibración: "8 a 12". Por tiempo o metros se da un número (es más fácil de seguir).
  const isRange = !!o.calibration && !o.unit && lo > 0 && hi > lo;
  const value = isRange ? `${lo} a ${hi}` : String(n);
  const unit = unitWords(o.unit, isRange ? hi : n, o.perSide);
  const line = `${value} ${unit}`;
  const range = isRange
    ? `Haz entre ${lo} y ${hi}. Para cuando te cueste mantener la técnica.`
    : !o.unit && lo > 0 && hi > lo && n >= lo && n <= hi ? `Tu rango es de ${lo} a ${hi}. Hoy la meta es ${n}.`
    : null;

  let load: string | null = null;
  if (kg > 0 && !(o.unit === "s" && o.bw)) load = `con ${kgFmt(kg)} kg${o.bw ? " extra" : ""}`;
  else if (o.needsKg) load = `Elige un peso que puedas mover ${isRange ? hi : n} veces con buena técnica`;

  const step = last ? "Última serie" : `Serie ${o.setNo} de ${o.sets}`;
  const sideSay = o.side ? `, empieza con el lado ${o.side === 1 ? "derecho" : "izquierdo"}` : "";
  const say = `${step}: ${line}${load ? ` ${load.startsWith("con") ? load.replace("kg", "kilos") : `. ${load}`}` : ""}${sideSay}.`;
  return { value, unit, line, load, range, step, say };
}

/* ---------- Músculos en palabras simples ---------- */
const MUSCLE_WORDS: [RegExp, string][] = [
  [/cu[aá]driceps/i, "muslos"],
  [/isquio|femoral/i, "parte de atrás del muslo"],
  [/aductor/i, "entrepierna"],
  [/abductor|gl[uú]teo/i, "glúteos"],
  [/gemelo|pantorrilla|s[oó]leo|tr[ií]ceps sural/i, "pantorrillas"],
  [/pectoral|pecho/i, "pecho"],
  [/deltoid|hombro/i, "hombros"],
  [/trapecio|romboid/i, "parte alta de la espalda"],
  [/dorsal|espalda|lumbar|erector/i, "espalda"],
  [/b[ií]ceps|braquial/i, "bíceps"],
  [/tr[ií]ceps/i, "tríceps"],
  [/antebrazo|mu[ñn]eca|agarre/i, "antebrazos"],
  [/oblicuo/i, "cintura"],
  [/core|abdom|recto/i, "abdomen"],
  [/cadera|flexor/i, "cadera"],
  [/tobillo|tibial/i, "tobillos"],
  [/cuerpo completo|todo el cuerpo/i, "todo el cuerpo"],
];

/** "Cuádriceps, glúteos, aductores, core" → "muslos, glúteos y entrepierna" (máximo 3, sin repetir). */
export function plainMuscles(mus: string | null | undefined, fallback?: string): string | null {
  const parts = String(mus || fallback || "").split(/[,;/]| y /).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    const hit = MUSCLE_WORDS.find(([re]) => re.test(p));
    const w = hit ? hit[1] : p.toLowerCase();
    if (w && !out.includes(w)) out.push(w);
    if (out.length === 3) break;
  }
  if (!out.length) return null;
  return out.length > 1 ? `${out.slice(0, -1).join(", ")} y ${out.at(-1)}` : out[0];
}

/**
 * Hasta 3 pasos de "Cómo hacerlo": la posición inicial, el movimiento y el cierre. Con más pasos en la ficha se toman
 * el primero, el antepenúltimo y el último (la ficha completa sigue a un toque).
 */
export function briefSteps(how: string[] | null | undefined): string[] {
  const h = (how ?? []).map((s) => s.trim()).filter(Boolean);
  if (h.length <= 3) return h;
  const mid = Math.max(1, h.length - 3);
  return [h[0], h[mid], h[h.length - 1]];
}

/** Chips del plan del ejercicio: "4 series", "8 a 12 reps", "Con 20 kg", "Descanso 2 min", "Por lado". */
export function planChips(o: { sets: number; lo: number; hi: number; unit?: string; reps: number; kg?: number; bw: boolean; perSide?: boolean; rest: number; interval?: boolean; calibration?: boolean }): string[] {
  const out: string[] = [];
  out.push(`${o.sets} ${o.interval ? plural(o.sets, "ronda", "rondas") : plural(o.sets, "serie", "series")}`);
  const n = o.reps || (o.unit ? o.hi : o.lo) || 10;
  if (o.interval) out.push(`${n} s de trabajo`);
  else if (!o.unit && o.calibration && o.hi > o.lo) out.push(`${o.lo} a ${o.hi} reps`);
  else out.push(o.unit === "s" ? `${n} s` : o.unit === "m" ? `${n} m` : `${n} reps`);
  if (o.perSide) out.push("Por lado");
  if ((o.kg ?? 0) > 0 && !(o.unit === "s" && o.bw)) out.push(`Con ${kgFmt(o.kg!)} kg${o.bw ? " extra" : ""}`);
  out.push(o.interval ? `${o.rest} s de descanso` : `Descanso ${restLabel(o.rest)}`);
  return out;
}

/* ---------- Cuánto falta ---------- */
export type LeftEx = { unit?: string; rest: number; perSide?: boolean; hi: number };
/** Segundos estimados de trabajo de una serie (repeticiones: ~4 s cada una más el tiempo de acomodarse). */
export function setSeconds(e: LeftEx, reps: number) {
  const n = reps || e.hi || 10;
  if (e.unit === "s") return e.perSide ? n * 2 + SWITCH_SECONDS + 3 : n + 3;
  if (e.unit === "m") return Math.max(25, Math.round(n * 0.8));
  return Math.max(25, n * 4 + 10) * (e.perSide ? 2 : 1);
}

/**
 * Segundos que faltan para terminar: el trabajo de cada serie pendiente y los descansos entre ellas (después de la
 * última no hay descanso). Si hay un descanso en marcha, se suma lo que le queda.
 */
export function secondsLeft(rows: { reps: string; done: boolean }[][], ex: LeftEx[], restLeft = 0) {
  const pending: { e: LeftEx; reps: number }[] = [];
  rows.forEach((r, i) => r.forEach((s) => { if (!s.done && ex[i]) pending.push({ e: ex[i], reps: num(s.reps) }); }));
  let t = Math.max(0, restLeft);
  pending.forEach((p, k) => { t += setSeconds(p.e, p.reps) + (k < pending.length - 1 ? p.e.rest : 0); });
  return Math.round(t);
}

/** "Faltan unos 18 min", "Falta 1 min", "Menos de 1 min". */
export function leftText(sec: number) {
  if (sec <= 0) return "Ya casi";
  if (sec < 60) return "Menos de 1 min";
  const m = Math.round(sec / 60);
  return m === 1 ? "Falta 1 min" : `Faltan unos ${m} min`;
}
