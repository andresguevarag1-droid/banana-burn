// Lógica pura del reproductor de entreno (sin React ni navegador) para poder probarla.
import { MIN_SET_SECONDS, workoutXp } from "@/lib/gamify";

export type Effort = "f" | "j" | "l";
/** Una serie en pantalla. `eff` es opcional para leer sesiones guardadas antes de que existiera. */
export type Row = { kg: string; reps: string; done: boolean; easy: boolean; eff?: Effort; at?: number };

export const num = (s: string | number | null | undefined) => Number(String(s ?? "").replace(",", ".")) || 0;
export const kgFmt = (n: number) => n.toLocaleString("es-CR", { maximumFractionDigits: 2 });
export const e1 = (kg: number, r: number) => kg * (1 + r / 30);
export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const clock = (s: number) => { const t = Math.max(0, Math.floor(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
export const unitLbl = (u?: string) => (u === "s" ? "seg" : u === "m" ? "m" : "reps");

/** "2 min", "90 s", "2,5 min": para hablar de descansos en texto corrido. */
export function restLabel(sec: number) {
  if (sec >= 120 || (sec >= 60 && sec % 60 === 0)) return `${(sec / 60).toLocaleString("es-CR", { maximumFractionDigits: 1 })} min`;
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
/** El motor solo distingue "fácil" (RIR 4) del resto (RIR 2): no cambia lo que se guarda. */
export const effortPatch = (eff: Effort): Pick<Row, "eff" | "easy"> => ({ eff, easy: eff === "f" });
export const effortOf = (r: Row): Effort | null => r.eff ?? (r.done && r.easy ? "f" : null);

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

/** "10 kg × 8 reps", "PC × 12 reps", "40 seg". */
export function targetText(r: Pick<Row, "kg" | "reps">, o: { unit?: string; bw: boolean }) {
  const u = unitLbl(o.unit);
  const kg = num(r.kg);
  if (o.unit === "s" && o.bw) return `${r.reps} ${u}`;
  if (kg > 0) return `${kgFmt(kg)} kg × ${r.reps} ${u}`;
  return o.bw ? `${r.reps} ${u}` : `${r.reps} ${u}`;
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
    case "last": return "Última serie. Con todo.";
    case "work": return `${o.name}. Ya.`;
    case "done": return "Entreno completado. Bien hecho.";
    case "count": return String(o.n);
  }
}

/* ---------- Modo intervalos ---------- */
/** Exprés: todo el entreno es por tiempo con descansos cortos. */
export const isIntervalPlan = (ex: { cfg: { unit?: string; rest: number } }[]) => ex.length > 0 && ex.every((e) => e.cfg.unit === "s" && e.cfg.rest <= 30);

/* ---------- Sesión guardada en el teléfono ---------- */
export type Saved = { rows: Row[][]; idx: number; startedAt: string; prs: string[]; choice: number[]; combo?: number; best?: number; lastAt?: number; warm?: boolean };
/** Acepta sesiones del formato anterior (sin combo ni esfuerzo) y descarta las que no calzan con el plan de hoy. */
export function readSaved(v: unknown, exercises: number): Saved | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Partial<Saved>;
  if (!Array.isArray(s.rows) || s.rows.length !== exercises || !Array.isArray(s.choice) || s.choice.length !== exercises) return null;
  if (!s.rows.every((r) => Array.isArray(r) && r.every((x) => x && typeof x === "object" && typeof (x as Row).done === "boolean"))) return null;
  const t = Date.parse(String(s.startedAt));
  return {
    rows: s.rows.map((r) => r.map((x) => ({ kg: String(x.kg ?? ""), reps: String(x.reps ?? ""), done: !!x.done, easy: !!x.easy, ...(x.eff ? { eff: x.eff } : {}), ...(x.at ? { at: x.at } : {}) }))),
    idx: Math.min(Math.max(0, Number(s.idx) || 0), exercises - 1), startedAt: Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString(),
    prs: Array.isArray(s.prs) ? s.prs.map(String) : [], choice: s.choice.map((c) => Math.max(0, Number(c) || 0)),
    combo: Number(s.combo) || 0, best: Number(s.best) || 0, lastAt: Number(s.lastAt) || undefined, warm: !!s.warm,
  };
}
