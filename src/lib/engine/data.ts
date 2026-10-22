// Conocimiento de entrenamiento portado del prototipo Banana Burn (v3).
export type ExerciseId = keyof typeof EX;
export type Unit = "reps" | "s" | "m";

export const EX = {
  squat: { n: "Sentadilla trasera", m: "Piernas", inc: 2.5 },
  frontsquat: { n: "Sentadilla frontal", m: "Piernas", inc: 2.5 },
  goblet: { n: "Sentadilla goblet", m: "Piernas", inc: 2 },
  bench: { n: "Press banca", m: "Pecho", inc: 2.5 },
  closebench: { n: "Press banca agarre cerrado", m: "Tríceps", inc: 2.5 },
  incline: { n: "Press inclinado con mancuernas", m: "Pecho", inc: 2 },
  ohp: { n: "Press militar de pie", m: "Hombros", inc: 1.25 },
  dbpress: { n: "Press militar con mancuernas", m: "Hombros", inc: 2 },
  dips: { n: "Fondos en paralelas", m: "Tríceps", inc: 0 },
  dipsw: { n: "Fondos lastrados", m: "Tríceps", inc: 2.5 },
  deadlift: { n: "Peso muerto", m: "Espalda", inc: 5 },
  rdl: { n: "Peso muerto rumano", m: "Femorales", inc: 2.5 },
  pullup: { n: "Dominadas", m: "Espalda", inc: 0 },
  chinup: { n: "Dominadas agarre neutro", m: "Espalda", inc: 0 },
  row: { n: "Remo con barra", m: "Espalda", inc: 2.5 },
  lat: { n: "Jalón al pecho", m: "Espalda", inc: 2.5 },
  dbrow: { n: "Remo con mancuerna", m: "Espalda", inc: 2 },
  curl: { n: "Curl con barra", m: "Bíceps", inc: 1.25 },
  hammer: { n: "Curl martillo", m: "Bíceps", inc: 1 },
  curlp: { n: "Curl con pausa", m: "Bíceps", inc: 1 },
  lateral: { n: "Elevaciones laterales", m: "Hombros", inc: 1 },
  lateralc: { n: "Lateral en polea", m: "Hombros", inc: 1 },
  laterall: { n: "Lateral inclinado", m: "Hombros", inc: 1 },
  facepull: { n: "Face pull", m: "Hombro posterior", inc: 2.5 },
  facepullp: { n: "Face pull con pausa", m: "Hombro posterior", inc: 2.5 },
  reardelt: { n: "Pájaros con mancuernas", m: "Hombro posterior", inc: 1 },
  pushup: { n: "Flexiones", m: "Pecho", inc: 0 },
  pushupd: { n: "Flexiones diamante", m: "Tríceps", inc: 0 },
  pushupe: { n: "Flexiones con pies elevados", m: "Pecho", inc: 0 },
  plank: { n: "Plancha", m: "Core", inc: 0 },
  planktap: { n: "Plancha con toque de hombro", m: "Core", inc: 0 },
  plankrkc: { n: "Plancha RKC", m: "Core", inc: 0 },
  kneeraise: { n: "Elevación de rodillas colgado", m: "Core", inc: 0 },
  legraise: { n: "Elevación de piernas colgado", m: "Core", inc: 0 },
  twistraise: { n: "Elevación de rodillas con giro", m: "Core", inc: 0 },
  carry: { n: "Paseo del granjero", m: "Agarre", inc: 2 },
  suitcase: { n: "Paseo maleta (una mano)", m: "Core", inc: 2 },
  carryp: { n: "Paseo con pausa", m: "Agarre", inc: 2 },
} as const;

export const SLOTS: Record<string, ExerciseId[]> = {
  pushA_acc: ["dips", "closebench", "dipsw"],
  pullA_acc: ["curl", "hammer", "curlp"],
  pushB_leg: ["frontsquat", "goblet", "frontsquat"],
  pushB_acc: ["lateral", "lateralc", "laterall"],
  pullB_acc: ["facepull", "reardelt", "facepullp"],
  core_hang: ["kneeraise", "legraise", "twistraise"],
  core_plank: ["plank", "planktap", "plankrkc"],
  core_carry: ["carry", "suitcase", "carryp"],
  pump_push: ["pushup", "pushupd", "pushupe"],
  pump_arm: ["hammer", "curlp", "curl"],
  pump_sh: ["lateralc", "laterall", "lateral"],
};

export type SlotCfg = { id?: ExerciseId; slot?: string; sets: number; lo: number; hi: number; rest: number; unit?: Unit };
export type Template = { n: string; tag: string; light?: boolean; mins?: number; cardio?: string; finisher?: boolean; emoji: string; ex: SlotCfg[] };
export type TemplateId = "pushA" | "pullA" | "pushB" | "pullB" | "core" | "pump";

export const TPL: Record<TemplateId, Template> = {
  pushA: { n: "Empuje A", tag: "Fuerza", emoji: "🏋️", ex: [{ id: "squat", sets: 4, lo: 5, hi: 8, rest: 180 }, { id: "bench", sets: 4, lo: 6, hi: 10, rest: 150 }, { id: "ohp", sets: 3, lo: 6, hi: 10, rest: 150 }, { slot: "pushA_acc", sets: 2, lo: 8, hi: 12, rest: 90 }] },
  pullA: { n: "Tracción A", tag: "Fuerza", emoji: "🦍", ex: [{ id: "deadlift", sets: 3, lo: 4, hi: 6, rest: 180 }, { id: "pullup", sets: 4, lo: 5, hi: 10, rest: 150 }, { id: "row", sets: 3, lo: 6, hi: 10, rest: 120 }, { slot: "pullA_acc", sets: 2, lo: 8, hi: 12, rest: 75 }] },
  pushB: { n: "Empuje B", tag: "Volumen", emoji: "💪", ex: [{ id: "incline", sets: 4, lo: 8, hi: 12, rest: 120 }, { slot: "pushB_leg", sets: 3, lo: 8, hi: 12, rest: 150 }, { id: "dbpress", sets: 3, lo: 8, hi: 12, rest: 120 }, { slot: "pushB_acc", sets: 3, lo: 12, hi: 20, rest: 60 }] },
  pullB: { n: "Tracción B", tag: "Volumen", emoji: "🔥", ex: [{ id: "rdl", sets: 3, lo: 8, hi: 10, rest: 150 }, { id: "chinup", sets: 4, lo: 6, hi: 12, rest: 120 }, { id: "dbrow", sets: 3, lo: 8, hi: 12, rest: 90 }, { slot: "pullB_acc", sets: 2, lo: 12, hi: 20, rest: 60 }] },
  core: { n: "Core + Cardio", tag: "Ligero", emoji: "🌀", light: true, mins: 40, ex: [{ slot: "core_hang", sets: 3, lo: 8, hi: 15, rest: 60 }, { slot: "core_plank", sets: 3, lo: 30, hi: 60, rest: 45, unit: "s" }, { slot: "core_carry", sets: 3, lo: 30, hi: 40, rest: 60, unit: "m" }], cardio: "20 min de caminata inclinada (10–12 %) a ritmo de conversación" },
  pump: { n: "Bombeo + Reto", tag: "Ligero", emoji: "⚡", light: true, mins: 35, finisher: true, ex: [{ slot: "pump_push", sets: 3, lo: 10, hi: 20, rest: 60 }, { slot: "pump_arm", sets: 3, lo: 10, hi: 15, rest: 60 }, { slot: "pump_sh", sets: 3, lo: 12, hi: 20, rest: 45 }] },
};

/** Semana por defecto: 1=lunes … 6=sábado; domingo descanso. */
export const DEFAULT_WEEK: Record<number, TemplateId | null> = { 0: null, 1: "pushA", 2: "pullA", 3: "core", 4: "pushB", 5: "pullB", 6: "pump" };

export const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Alternativas por si la máquina está ocupada o falta equipo (mismo patrón de movimiento). */
export const ALTS: Record<string, ExerciseId[]> = {
  squat: ["frontsquat", "goblet"], frontsquat: ["squat", "goblet"], goblet: ["frontsquat", "squat"],
  bench: ["incline", "closebench", "pushupe"], incline: ["bench", "pushupe"], closebench: ["dips", "pushupd"],
  ohp: ["dbpress"], dbpress: ["ohp"], dips: ["closebench", "pushupd"], dipsw: ["dips", "closebench"],
  deadlift: ["rdl"], rdl: ["deadlift"],
  pullup: ["chinup", "lat"], chinup: ["pullup", "lat"], lat: ["pullup", "chinup"],
  row: ["dbrow"], dbrow: ["row"],
};

/** Ejercicios con barra olímpica (para la calculadora de discos). */
export const BARBELL = new Set<string>(["squat", "frontsquat", "bench", "closebench", "ohp", "deadlift", "rdl", "row"]);

/** Discos por lado para llegar a `kg` con barra de 20 kg. */
export function platesPerSide(kg: number, bar = 20): number[] | null {
  let side = (kg - bar) / 2;
  if (side < 0) return null;
  const out: number[] = [];
  for (const p of [25, 20, 15, 10, 5, 2.5, 1.25]) while (side >= p - 1e-9) { out.push(p); side -= p; }
  return side > 0.01 ? null : out;
}
