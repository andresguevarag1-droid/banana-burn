// Lógica pura del reproductor de entreno (sin React ni navegador) para poder probarla.
import { MIN_SET_SECONDS, workoutXp } from "@/lib/gamify";
import { BARBELL } from "@/lib/engine/data";
import { SWITCH_SECONDS } from "./sides";

export type Effort = "f" | "j" | "l";
/** Una serie en pantalla. `eff` es opcional para leer sesiones guardadas antes de que existiera. */
export type Row = { kg: string; reps: string; done: boolean; easy: boolean; eff?: Effort; at?: number; c?: number };

export const num = (s: string | number | null | undefined) => Number(String(s ?? "").replace(",", ".")) || 0;
export const kgFmt = (n: number) => n.toLocaleString("es-419", { maximumFractionDigits: 2 });
export const e1 = (kg: number, r: number) => kg * (1 + r / 30);
export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const clock = (s: number) => { const t = Math.max(0, Math.floor(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
export const unitLbl = (u?: string) => (u === "s" ? "seg" : u === "m" ? "m" : "reps");

/** "2 min", "90 s", "2,5 min": para hablar de descansos en texto corrido. */
export function restLabel(sec: number) {
  if (sec >= 120 || (sec >= 60 && sec % 60 === 0)) return `${(sec / 60).toLocaleString("es-419", { maximumFractionDigits: 1 })} min`;
  return `${sec} s`;
}

/** Paso de los botones + y − según el tipo de ejercicio. */
export function stepFor(field: "kg" | "reps", o: { unit?: string; barbell: boolean; cur: number }) {
  if (field === "reps") return o.unit === "s" || o.unit === "m" ? 5 : 1;
  return o.barbell ? 2.5 : o.cur >= 20 ? 2 : 1;
}
export const bump = (cur: number, d: number) => Math.max(0, Math.round((cur + d) * 100) / 100);

/* ---------- Esfuerzo ---------- */
export const EFFORTS: { id: Effort; label: string; hint: string }[] = [
  { id: "f", label: "Fácil", hint: "Sobraban 4 o más" },
  { id: "j", label: "Justo", hint: "Sobraban 1 o 2" },
  { id: "l", label: "Al límite", hint: "No salía otra" },
];
export const effortPatch = (eff: Effort): Pick<Row, "eff" | "easy"> => ({ eff, easy: eff === "f" });
export const effortOf = (r: Row): Effort | null => r.eff ?? (r.done && r.easy ? "f" : null);
/** Reps en reserva que se guardan: Fácil 4, Justo 2, Al límite 0. Sin respuesta, null (el motor asume 2). */
export const RIR: Record<Effort, number> = { f: 4, j: 2, l: 0 };
export const rirOf = (r: Row): number | null => { const e = effortOf(r); return e ? RIR[e] : null; };

/* ---------- Diversión: una sola escala para el reproductor y Progreso ---------- */
export const FUN_LABELS = ["Aburrido", "Normal", "Bien", "Divertido", "Me encantó"] as const;

/* ---------- XP en vivo: el mismo cálculo que el servidor (anti-trampa incluida) ---------- */
export function liveXp(o: { doneSets: number; totalSets: number; prs: number; seconds: number }) {
  return workoutXp(o);
}
/**
 * XP que aporta la serie recién marcada. 0 si el ritmo es imposible (menos de 25 s por serie en promedio):
 * así la animación de "+10 XP" nunca promete algo que el servidor no va a dar.
 */
export function setXpGain(o: { doneBefore: number; totalSets: number; prsBefore: number; prsAfter: number; seconds: number }) {
  const before = workoutXp({ doneSets: o.doneBefore, totalSets: o.totalSets, prs: o.prsBefore, seconds: o.seconds });
  const after = workoutXp({ doneSets: o.doneBefore + 1, totalSets: o.totalSets, prs: o.prsAfter, seconds: o.seconds });
  if (after.rushed) return 0;
  return Math.max(0, after.xp - (before.rushed ? 0 : before.xp));
}
export const isRushed = (doneSets: number, seconds: number) => doneSets > 0 && seconds < doneSets * MIN_SET_SECONDS;

/**
 * Combo de series a tiempo: sube si la serie llega antes de que pase el descanso más un margen de 2 min.
 * Si te vas a conversar 10 minutos, el combo vuelve a 1. Las series imposiblemente rápidas no suman.
 */
export function nextCombo(prev: number, gapSec: number | null, restSec: number) {
  if (gapSec == null) return 1;
  if (gapSec < MIN_SET_SECONDS * 0.6) return prev; // marcar varias de un golpe no infla el combo
  return gapSec <= restSec + 120 ? prev + 1 : 1;
}

/** Combo, última marca y mejor combo según las series que siguen hechas (para deshacer sin dejar rastros). */
export function comboState(rows: Row[][]) {
  let last: Row | null = null, best = 0;
  for (const r of rows.flat()) {
    if (!r.done) continue;
    best = Math.max(best, r.c ?? 0);
    if (r.at != null && (!last || (last.at ?? 0) < r.at)) last = r;
  }
  return { combo: last?.c ?? 0, lastAt: last?.at, best };
}

/* ---------- Récords: se derivan de las series hechas, nunca se acumulan a mano ---------- */
export const beatsBest = (kg: number, reps: number, best: number) => kg > 0 && reps > 0 && best > 0 && e1(kg, reps) > best + 0.01;
/** Un récord por ejercicio si alguna serie hecha supera su mejor marca guardada. */
export function prsOf(rows: Row[][], exercises: { id: string; name: string; best: number }[]) {
  return exercises.flatMap((e, i) => ((rows[i] ?? []).some((r) => r.done && beatsBest(num(r.kg), num(r.reps), e.best)) ? [{ id: e.id, name: e.name }] : []));
}

/* ---------- Carga inicial (calibración) ---------- */
export type LoadKind = "barbell" | "ez" | "dumbbell" | "kettlebell" | "machine" | "belt";
const LOADS: Record<LoadKind, { start: number; chips: { kg: number; label?: string }[] }> = {
  barbell: { start: 20, chips: [{ kg: 20, label: "Barra sola" }, { kg: 30 }, { kg: 40 }] },
  ez: { start: 10, chips: [{ kg: 10 }, { kg: 15 }, { kg: 20 }] },
  dumbbell: { start: 6, chips: [{ kg: 4 }, { kg: 6 }, { kg: 8 }, { kg: 10 }] },
  kettlebell: { start: 8, chips: [{ kg: 8 }, { kg: 12 }, { kg: 16 }] },
  machine: { start: 15, chips: [{ kg: 10 }, { kg: 15 }, { kg: 20 }, { kg: 25 }] },
  belt: { start: 5, chips: [{ kg: 2.5 }, { kg: 5 }, { kg: 10 }] },
};
export const loadsFor = (k: LoadKind | null | undefined) => (k ? LOADS[k] : null);
const MACHINE = new Set(["lat", "lateralc", "facepull", "facepullp"]);
/** Tipo de carga de un ejercicio del motor (`inc` > 0) o de la biblioteca (por su equipo en inglés). */
export function loadKindOf(id: string, o: { inc: number; eq?: string }): LoadKind | null {
  if (o.inc <= 0) return null;
  if (o.eq != null) {
    if (/barbell|trap bar|smith/.test(o.eq)) return o.eq.startsWith("ez") ? "ez" : "barbell";
    if (o.eq === "dumbbell") return "dumbbell";
    if (o.eq === "kettlebell") return "kettlebell";
    return "machine";
  }
  if (BARBELL.has(id)) return "barbell";
  if (id === "curl") return "ez";
  if (id === "dipsw") return "belt";
  if (MACHINE.has(id)) return "machine";
  return "dumbbell";
}

/* ---------- Siguiente serie ---------- */
export type Target = { ex: number; si: number } | null;
/** Primera serie pendiente desde el ejercicio actual (y luego desde el principio, por si saltaste alguno). */
export function nextPending(rows: Row[][], from: number): Target {
  for (let k = 0; k < rows.length; k++) {
    const i = (from + k) % rows.length;
    const si = rows[i].findIndex((r) => !r.done);
    if (si >= 0) return { ex: i, si };
  }
  return null;
}
export const isLastSet = (rows: Row[][], ex: number) => rows[ex].filter((r) => !r.done).length === 1;

/** "10 kg × 8 reps", "PC × 12 reps", "40 seg", "35 seg por lado" (por tiempo y por lado: el valor es de un lado). */
export function targetText(r: Pick<Row, "kg" | "reps">, o: { unit?: string; bw: boolean; perSide?: boolean }) {
  const u = unitLbl(o.unit) + (o.unit === "s" && o.perSide ? " por lado" : "");
  const kg = num(r.kg);
  if (o.unit === "s" && o.bw) return `${r.reps} ${u}`;
  if (kg > 0) return `${kgFmt(kg)} kg × ${r.reps} ${u}`;
  return o.bw ? `${r.reps} ${u}` : `${r.reps} ${u}`;
}

/**
 * La meta de la serie en una frase que se entiende sin saber de gimnasio: "10 repeticiones con 20 kg",
 * "30 segundos por lado". Con peso corporal y lastre, el peso se dice como extra.
 */
export function plainTarget(r: Pick<Row, "kg" | "reps">, o: { unit?: string; bw: boolean; perSide?: boolean }) {
  const n = num(r.reps), kg = num(r.kg);
  const what = o.unit === "s" ? `${n} ${n === 1 ? "segundo" : "segundos"}${o.perSide ? " por lado" : ""}`
    : o.unit === "m" ? `${n} metros`
    : `${n} ${n === 1 ? "repetición" : "repeticiones"}`;
  if (kg > 0 && !(o.unit === "s" && o.bw)) return `${what} con ${kgFmt(kg)} kg${o.bw ? " extra" : ""}`;
  return what;
}

/* ---------- Calentamiento y vuelta a la calma ---------- */
export type Warm = { kg: number | null; reps: number }[];
/**
 * Series de aproximación antes del primer básico pesado. Con barra: barra sola y luego ~60 %.
 * Con mancuernas o máquina: una serie ligera a la mitad. Peso corporal o tiempo: sin calentamiento con carga.
 */
export function warmupFor(o: { kg: number; barbell: boolean; bw: boolean; unit?: string }): Warm | null {
  if (o.bw || o.unit) return null;
  if (o.barbell) {
    if (o.kg > 0 && o.kg <= 20) return null; // ya trabajas con la barra sola: la primera serie es el calentamiento
    if (o.kg > 0 && o.kg <= 30) return [{ kg: 20, reps: 10 }];
    const mid = o.kg > 0 ? Math.max(20, Math.round((o.kg * 0.6) / 2.5) * 2.5) : null;
    return mid && mid > 20 && mid < o.kg ? [{ kg: 20, reps: 10 }, { kg: 20, reps: 8 }, { kg: mid, reps: 5 }] : [{ kg: 20, reps: 10 }, { kg: 20, reps: 8 }];
  }
  if (o.kg >= 8) return [{ kg: Math.max(1, Math.round(o.kg / 2)), reps: 10 }];
  return null;
}
export function warmupText(w: Warm, barbell = true) {
  const bar = barbell ? w.filter((s) => s.kg === 20) : [];
  const rest = w.filter((s) => !bar.includes(s));
  const out: string[] = [];
  if (bar.length) out.push(`${bar.length === 1 ? "1 serie" : `${bar.length} series`} con la barra sola (${bar.map((s) => s.reps).join(" y ")} reps)`);
  rest.forEach((s) => out.push(`1 de ${s.reps} con ${kgFmt(s.kg ?? 0)} kg`));
  const t = out.length > 1 ? `${out.slice(0, -1).join(", ")} y ${out.at(-1)}` : out[0];
  return `${t[0].toUpperCase()}${t.slice(1)}.`;
}

const STRETCH: Record<string, string> = {
  pierna: "cuádriceps", cuádriceps: "cuádriceps", glúteo: "glúteos", femoral: "femorales", isquio: "femorales",
  pecho: "pecho", hombro: "hombros", espalda: "espalda", dorsal: "espalda", tríceps: "tríceps", bíceps: "bíceps", core: "cadera", abdom: "cadera", cuerpo: "cadera",
};
/** Estiramientos sugeridos según los músculos del día (máximo 3, sin repetir). */
export function cooldownFor(muscles: string[]) {
  const out: string[] = [];
  for (const m of muscles) {
    const k = Object.keys(STRETCH).find((s) => m.toLowerCase().includes(s));
    const v = k ? STRETCH[k] : null;
    if (v && !out.includes(v)) out.push(v);
    if (out.length === 3) break;
  }
  const list = out.length ? out : ["piernas", "pecho", "espalda"];
  return { walk: 3, stretches: list, text: `3 min de caminata suave y 30 s de estiramiento para ${list.length > 1 ? `${list.slice(0, -1).join(", ")} y ${list.at(-1)}` : list[0]}.` };
}

/* ---------- Volumen y formato ---------- */
export function volumeOf(rows: Row[][]) {
  let v = 0;
  rows.forEach((r) => r.forEach((s) => { if (s.done) v += num(s.kg) * num(s.reps); }));
  return Math.round(v);
}
export const volumeText = (v: number) => (v >= 1000 ? `${kgFmt(Math.round(v / 100) / 10)} t` : `${kgFmt(v)} kg`);
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/* ---------- Voz del coach ---------- */
export function speechFor(kind: "exercise" | "rest" | "go" | "last" | "done" | "work" | "count", o: { name?: string; sets?: number; target?: string; cue?: string; rest?: number; set?: number; n?: number } = {}) {
  switch (kind) {
    case "exercise": return `${o.name}. ${o.sets} series${o.target ? `, ${o.target.replace("×", "por").replace("kg", "kilos")}` : ""}.${o.cue ? ` Clave: ${o.cue}.` : ""}`;
    case "rest": return `Descanso. ${restLabel(o.rest ?? 60).replace("min", "minutos").replace(" s", " segundos")}.`;
    case "go": return `Vamos. Serie ${o.set} de ${o.sets}.`;
    case "last": return "Última serie: déjalo todo.";
    case "work": return `${o.name}. Ya.`;
    case "done": return "Entreno completado. Bien hecho.";
    case "count": return String(o.n);
  }
}

/* ---------- Modo intervalos ---------- */
/** Exprés: todo el entreno es por tiempo con descansos cortos. */
export const isIntervalPlan = (ex: { cfg: { unit?: string; rest: number } }[]) => ex.length > 0 && ex.every((e) => e.cfg.unit === "s" && e.cfg.rest <= 30);

export type IvPhase = "ready" | "prep" | "work" | "switch" | "rest";
/** `side`: en un ejercicio por lado, el lado que se trabaja (o el que viene, durante el cambio). */
export type IvClock = { phase: IvPhase; end: number; total: number; side?: 1 | 2 };
/**
 * Avanza el reloj de intervalos hasta `now` encadenando cada fase desde el final exacto de la anterior.
 * Si la pestaña estuvo oculta, al volver se reconcilian todas las fases que pasaron (sin perder ni inventar tiempo).
 * `marked` son las marcas de tiempo de los intervalos de trabajo que terminaron.
 * Por lado (`perSide`): trabajo del lado derecho, cambio de lado y lado izquierdo; el intervalo se marca al final del segundo.
 */
export function advanceIntervals(iv: IvClock, rows: Row[][], idx: number, cfg: { hi: number; rest: number; perSide?: boolean }[], now: number) {
  let s = iv, r = rows, i = idx, finished = false;
  const marked: { ex: number; si: number; at: number }[] = [];
  for (let guard = 0; s.phase !== "ready" && s.end <= now && guard < 400; guard++) {
    const t = s.end;
    const tg = nextPending(r, i);
    if (!tg) { finished = true; s = { phase: "ready", end: 0, total: 0 }; break; }
    if (s.phase === "prep" || s.phase === "rest" || s.phase === "switch") {
      const secs = num(r[tg.ex][tg.si].reps) || cfg[tg.ex].hi;
      i = tg.ex;
      const side = cfg[tg.ex].perSide ? (s.phase === "switch" ? 2 : 1) : undefined;
      s = { phase: "work", end: t + secs * 1000, total: secs, ...(side ? { side } : {}) };
      continue;
    }
    if (cfg[tg.ex].perSide && s.side !== 2) {
      s = { phase: "switch", end: t + SWITCH_SECONDS * 1000, total: SWITCH_SECONDS, side: 2 };
      continue;
    }
    r = r.map((x, k) => (k !== tg.ex ? x : x.map((y, j) => (j === tg.si ? { ...y, done: true, at: t } : y))));
    marked.push({ ex: tg.ex, si: tg.si, at: t });
    const nx = nextPending(r, tg.ex);
    if (!nx) { finished = true; s = { phase: "ready", end: 0, total: 0 }; break; }
    i = nx.ex;
    const rest = cfg[tg.ex].rest;
    s = { phase: "rest", end: t + rest * 1000, total: rest };
  }
  return { iv: s, rows: r, idx: i, marked, finished };
}

/** Serie por tiempo con 3 s de preparación (los tramos de la serie viven en sides.ts). */
export const PREP_SECONDS = 3;

/* ---------- Sesión guardada en el teléfono ---------- */
export type Saved = { rows: Row[][]; idx: number; startedAt: string; choice: number[]; combo?: number; best?: number; lastAt?: number; warm?: boolean; mode?: string; repeat?: boolean; /** Ids elegidos por ejercicio (el índice cambia si la lista de opciones cambia). */ choiceIds?: string[]; /** Hitos ya mostrados (no se repiten al deshacer) */ ms?: string[]; /** Series del plan antes de pasar a modo exprés */ plan?: number };
/** Acepta sesiones del formato anterior (sin combo ni esfuerzo) y descarta las que no calzan con el plan de hoy. */
export function readSaved(v: unknown, exercises: number): Saved | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Partial<Saved>;
  if (!Array.isArray(s.rows) || s.rows.length !== exercises || !Array.isArray(s.choice) || s.choice.length !== exercises) return null;
  if (!s.rows.every((r) => Array.isArray(r) && r.every((x) => x && typeof x === "object" && typeof (x as Row).done === "boolean"))) return null;
  const t = Date.parse(String(s.startedAt));
  return {
    rows: s.rows.map((r) => r.map((x) => ({ kg: String(x.kg ?? ""), reps: String(x.reps ?? ""), done: !!x.done, easy: !!x.easy, ...(x.eff ? { eff: x.eff } : {}), ...(x.at ? { at: x.at } : {}), ...(x.c ? { c: Number(x.c) || 0 } : {}) }))),
    idx: Math.min(Math.max(0, Number(s.idx) || 0), exercises - 1), startedAt: Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString(),
    choice: s.choice.map((c) => Math.max(0, Number(c) || 0)),
    combo: Number(s.combo) || 0, best: Number(s.best) || 0, lastAt: Number(s.lastAt) || undefined, warm: !!s.warm,
    ...(typeof s.mode === "string" ? { mode: s.mode } : {}), ...(s.repeat ? { repeat: true } : {}),
    ...(Array.isArray(s.choiceIds) && s.choiceIds.length === exercises ? { choiceIds: s.choiceIds.map((x) => String(x ?? "").slice(0, 40)) } : {}),
    ...(Array.isArray(s.ms) ? { ms: s.ms.filter((x) => typeof x === "string").slice(0, 8) } : {}),
    ...(Number(s.plan) > 0 ? { plan: Math.min(80, Math.round(Number(s.plan))) } : {}),
  };
}
