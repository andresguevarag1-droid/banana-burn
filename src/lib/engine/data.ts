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
  floorpress: { n: "Press de piso con mancuernas", m: "Pecho", inc: 2 },
  dbrdl: { n: "Peso muerto rumano con mancuernas", m: "Femorales", inc: 2 },
  invrow: { n: "Remo invertido (mesa o barra baja)", m: "Espalda", inc: 0 },
  bandpull: { n: "Jalón con banda", m: "Espalda", inc: 0 },
  legraisef: { n: "Elevación de piernas en el piso", m: "Core", inc: 0 },
  bicycle: { n: "Bicicleta abdominal", m: "Core", inc: 0 },
  bwsquat: { n: "Sentadilla con peso corporal", m: "Piernas", inc: 0 },
  bulgarian: { n: "Sentadilla búlgara", m: "Piernas", inc: 0 },
  pikepush: { n: "Flexión pica", m: "Hombros", inc: 0 },
  slrdl: { n: "Peso muerto a una pierna", m: "Femorales", inc: 0 },
  glutebridge: { n: "Puente de glúteo", m: "Glúteos", inc: 0 },
  towelcurl: { n: "Curl isométrico con toalla", m: "Bíceps", inc: 0 },
  ytw: { n: "Y-T-W boca abajo", m: "Hombro posterior", inc: 0 },
  bearcrawl: { n: "Caminata del oso", m: "Core", inc: 0 },
  jumpsquat: { n: "Sentadilla con salto", m: "Piernas", inc: 0 },
  burpee: { n: "Burpees", m: "Cuerpo completo", inc: 0 },
  mountain: { n: "Escaladores", m: "Core", inc: 0 },
  lunge: { n: "Zancadas alternas", m: "Piernas", inc: 0 },
  jacks: { n: "Jumping jacks", m: "Cardio", inc: 0 },
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
/** `n`: nombre que se ve (los ids pushA, pullA... no cambian: así se guardan en workouts.template). `hook`: una línea que da ganas de entrenar.
 * `nf` / `hookF`: versión para ella cuando el nombre de él suena masculino ("Espalda de gorila"). */
export type Template = { n: string; hook: string; nf?: string; hookF?: string; tag: string; light?: boolean; mins?: number; cardio?: string; finisher?: boolean; icon: string; ex: SlotCfg[] };
export type TemplateId = "pushA" | "pullA" | "pushB" | "pullB" | "core" | "pump";

export const TPL: Record<TemplateId, Template> = {
  pushA: { n: "Fuerza total: piernas, pecho y hombros", hook: "Hoy construyes la fuerza base de piernas, pecho y hombros", tag: "Fuerza", icon: "barbell", ex: [{ id: "squat", sets: 4, lo: 5, hi: 8, rest: 180 }, { id: "bench", sets: 4, lo: 6, hi: 10, rest: 150 }, { id: "ohp", sets: 3, lo: 6, hi: 10, rest: 150 }, { slot: "pushA_acc", sets: 2, lo: 8, hi: 12, rest: 90 }] },
  pullA: { n: "Espalda ancha y bíceps fuertes", hook: "Hoy armas una espalda ancha y unos bíceps que se notan", nf: "Espalda firme y brazos tonificados", hookF: "Hoy fortaleces la espalda y tonificas los brazos", tag: "Fuerza", icon: "gorilla", ex: [{ id: "deadlift", sets: 3, lo: 4, hi: 6, rest: 180 }, { id: "pullup", sets: 4, lo: 5, hi: 10, rest: 150 }, { id: "row", sets: 3, lo: 6, hi: 10, rest: 120 }, { slot: "pullA_acc", sets: 2, lo: 8, hi: 12, rest: 75 }] },
  pushB: { n: "Piernas de acero y pecho firme", hook: "Hoy esculpes piernas firmes, pecho y hombros con más repeticiones", nf: "Piernas firmes y hombros definidos", hookF: "Hoy esculpes piernas firmes y hombros definidos con más repeticiones", tag: "Volumen", icon: "bunch", ex: [{ id: "incline", sets: 4, lo: 8, hi: 12, rest: 120 }, { slot: "pushB_leg", sets: 3, lo: 8, hi: 12, rest: 150 }, { id: "dbpress", sets: 3, lo: 8, hi: 12, rest: 120 }, { slot: "pushB_acc", sets: 3, lo: 12, hi: 20, rest: 60 }] },
  pullB: { n: "Espalda de gorila y glúteos", hook: "Hoy trabajas toda la parte de atrás, de la espalda a los glúteos", nf: "Glúteos y espalda esculpida", hookF: "Hoy trabajas toda la parte de atrás, de los glúteos a la espalda", tag: "Volumen", icon: "streak", ex: [{ id: "rdl", sets: 3, lo: 8, hi: 10, rest: 150 }, { id: "chinup", sets: 4, lo: 6, hi: 12, rest: 120 }, { id: "dbrow", sets: 3, lo: 8, hi: 12, rest: 90 }, { slot: "pullB_acc", sets: 2, lo: 12, hi: 20, rest: 60 }] },
  core: { n: "Abdomen y quema", hook: "Hoy aprietas el abdomen y quemas grasa caminando en subida", tag: "Ligero", icon: "target", light: true, mins: 40, ex: [{ slot: "core_hang", sets: 3, lo: 8, hi: 15, rest: 60 }, { slot: "core_plank", sets: 3, lo: 30, hi: 60, rest: 45, unit: "s" }, { slot: "core_carry", sets: 3, lo: 30, hi: 40, rest: 60, unit: "m" }], cardio: "20 min de caminata inclinada (10-12 %) a ritmo de conversación" },
  pump: { n: "Bombeo Banana: brazos y hombros", hook: "Hoy llenas brazos y hombros con descansos cortos y un reto final", nf: "Bombeo Banana: brazos tonificados", hookF: "Hoy tonificas brazos y hombros con descansos cortos y un reto final", tag: "Ligero", icon: "bolt", light: true, mins: 35, finisher: true, ex: [{ slot: "pump_push", sets: 3, lo: 10, hi: 20, rest: 60 }, { slot: "pump_arm", sets: 3, lo: 10, hi: 15, rest: 60 }, { slot: "pump_sh", sets: 3, lo: 12, hi: 20, rest: 45 }] },
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
  floorpress: ["pushupe", "pushup"], dbrdl: ["goblet", "slrdl"], invrow: ["dbrow", "bandpull"], bandpull: ["invrow", "dbrow"],
  bulgarian: ["bwsquat", "lunge"], pushup: ["pushupe", "pushupd"], pikepush: ["pushupe"], slrdl: ["glutebridge"], towelcurl: ["hammer"], ytw: ["reardelt"],
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

export type Equipment = "gym" | "casa" | "mixto" | "ninguno";
export type Level = "principiante" | "intermedio" | "avanzado";

/** Versión en casa (mancuernas, bandas o peso corporal) de cada ejercicio que requiere gimnasio. */
export const HOME: Partial<Record<ExerciseId, ExerciseId>> = {
  squat: "goblet", frontsquat: "goblet", bench: "floorpress", closebench: "pushupd", incline: "pushupe",
  ohp: "dbpress", deadlift: "dbrdl", rdl: "dbrdl", pullup: "invrow", chinup: "invrow", lat: "bandpull",
  row: "dbrow", dips: "pushupd", dipsw: "pushupd", facepull: "reardelt", facepullp: "reardelt", lateralc: "lateral",
  kneeraise: "legraisef", legraise: "legraisef", twistraise: "bicycle", curl: "hammer",
};
/** Sin equipo: solo peso corporal, para un cuarto pequeño. */
export const NOEQUIP: Partial<Record<ExerciseId, ExerciseId>> = {
  squat: "bulgarian", frontsquat: "bulgarian", goblet: "bulgarian", bench: "pushup", floorpress: "pushup", closebench: "pushupd", incline: "pushupe",
  ohp: "pikepush", dbpress: "pikepush", deadlift: "slrdl", rdl: "slrdl", dbrdl: "slrdl", pullup: "invrow", chinup: "invrow", lat: "invrow", bandpull: "invrow",
  row: "invrow", dbrow: "invrow", dips: "pushupd", dipsw: "pushupd", curl: "towelcurl", hammer: "towelcurl", curlp: "towelcurl",
  lateral: "ytw", lateralc: "ytw", laterall: "ytw", facepull: "ytw", facepullp: "ytw", reardelt: "ytw",
  carry: "bearcrawl", suitcase: "bearcrawl", carryp: "bearcrawl", kneeraise: "legraisef", legraise: "legraisef", twistraise: "bicycle",
};
/** Principiante: variantes más fáciles de aprender en las primeras semanas. */
export const BEGINNER: Partial<Record<ExerciseId, ExerciseId>> = { pullup: "lat", chinup: "lat", dipsw: "dips", deadlift: "rdl", plankrkc: "plank", legraise: "kneeraise", pushupe: "pushup" };

export function forEquipment(id: ExerciseId, eq: Equipment = "gym", level: Level = "intermedio"): ExerciseId {
  let x = level === "principiante" ? BEGINNER[id] ?? id : id;
  if (eq === "casa") x = HOME[x] ?? x;
  if (eq === "ninguno") x = NOEQUIP[HOME[x] ?? x] ?? NOEQUIP[x] ?? HOME[x] ?? x;
  return x;
}

/** Ejercicios para entrenos exprés (sin equipo, en cualquier lugar). */
export const EXPRESS_POOL: { id: ExerciseId; kind: "piernas" | "empuje" | "core" | "cardio" | "tiron" }[] = [
  { id: "bwsquat", kind: "piernas" }, { id: "pushup", kind: "empuje" }, { id: "mountain", kind: "core" }, { id: "lunge", kind: "piernas" },
  { id: "plank", kind: "core" }, { id: "burpee", kind: "cardio" }, { id: "glutebridge", kind: "piernas" }, { id: "pikepush", kind: "empuje" },
  { id: "jumpsquat", kind: "cardio" }, { id: "bicycle", kind: "core" }, { id: "jacks", kind: "cardio" }, { id: "ytw", kind: "tiron" },
];
