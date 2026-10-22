import "server-only";
import data from "@/data/exercise-library.json";

// Biblioteca de 1.324 ejercicios (datos MIT de hasaneyldrm/exercises-dataset).
export type LibEx = { id: string; n: string; en: string; bp: string; eq: string; t: string; m2: string[]; s: string[]; media: string; gif: string };
const CORE = new Set(["0043", "0042", "1760", "0025", "0030", "0314", "1457", "0426", "0251", "0032", "0085", "0652", "1326", "2330", "0027", "0292", "0031", "0313", "0334", "0178", "0203", "0378", "0662", "0283", "0279", "0472", "0475", "2133", "1160", "0630", "0514", "0499", "3360", "0410", "1757", "1459", "0620"]);
const EQ_RANK: Record<string, number> = { barbell: 0, dumbbell: 0, "body weight": 0, cable: 1, "leverage machine": 1, kettlebell: 2, band: 2, "smith machine": 2 };
const rank = (e: LibEx) => (CORE.has(e.id) ? 0 : 10) + (EQ_RANK[e.eq] ?? 3) + (/stretch/i.test(e.en) ? 5 : 0);

/** Nombres curados donde la traducción del dataset suena rara. */
const RENAME: Record<string, string> = {
  "0260": "Abdominal de recogimiento", "0508": "Abdominal Janda (sin flexores de cadera)", "0276": "Bicho muerto (dead bug)",
  "2271": "Gancho de izquierda (boxeo)", "3223": "Salto de estrella",
};
/** Músculo principal corregido en ejercicios de nuestras rutinas (el dataset marca glúteos en sentadillas, por ejemplo). */
const FIX: Record<string, Pick<LibEx, "t" | "m2">> = {
  "0043": { t: "quads", m2: ["glutes", "hamstrings", "lower back", "core"] },
  "0042": { t: "quads", m2: ["glutes", "upper back", "core"] },
  "0514": { t: "quads", m2: ["glutes", "hamstrings", "calves"] },
  "0032": { t: "glutes", m2: ["hamstrings", "lower back", "quads", "traps", "forearms"] },
  "2133": { t: "forearms", m2: ["traps", "core", "quads"] },
  "0027": { t: "upper back", m2: ["lats", "biceps", "rear deltoids"] },
  "0203": { t: "rear deltoids", m2: ["traps", "rhomboids", "biceps"] },
  "0378": { t: "rear deltoids", m2: ["traps", "rhomboids"] },
  "0410": { t: "quads", m2: ["glutes", "hamstrings"] },
};
/** Quita sufijos del dataset que no aportan: "(v2)", "(mujer)", "(vista lateral)". */
export const cleanName = (n: string) => n.replace(/\s*\((?:v\d+|mujer|hombre|vista (?:posterior|lateral|frontal))\)/gi, "").replace(/\s{2,}/g, " ").trim();

const ALL = (data as LibEx[]).map((e) => ({ ...e, n: RENAME[e.id] ?? cleanName(e.n), ...FIX[e.id] })).sort((a, b) => rank(a) - rank(b) || a.n.localeCompare(b.n, "es"));
const BY_ID = new Map(ALL.map((e) => [e.id, e]));
/** Músculo del dataset original: agrupa variantes igual que antes de las correcciones (las sentadillas del dataset dicen "glúteos"). */
const T0 = new Map((data as LibEx[]).map((e) => [e.id, e.t]));
const t0 = (e: LibEx) => T0.get(e.id) ?? e.t;
/** Para listar: una sola entrada por nombre (las variantes "v2" o de otra cámara siguen accesibles por id). */
const LIST = (() => { const seen = new Set<string>(); return ALL.filter((e) => { const k = e.n.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }); })();

export const BODY: Record<string, string> = { back: "Espalda", cardio: "Cardio", chest: "Pecho", "lower arms": "Antebrazos", "lower legs": "Pantorrillas", neck: "Cuello", shoulders: "Hombros", "upper arms": "Brazos", "upper legs": "Piernas", waist: "Abdomen" };
export const EQUIP: Record<string, string> = {
  "body weight": "Peso corporal", dumbbell: "Mancuernas", cable: "Polea", barbell: "Barra", "leverage machine": "Máquina", band: "Banda", "smith machine": "Multipower (Smith)",
  kettlebell: "Kettlebell", weighted: "Lastre", "stability ball": "Fitball", "ez barbell": "Barra Z", assisted: "Asistido", "sled machine": "Prensa/trineo", "medicine ball": "Balón medicinal",
  rope: "Cuerda", roller: "Rodillo", "resistance band": "Banda", "bosu ball": "Bosu", "olympic barbell": "Barra olímpica", "wheel roller": "Rueda abdominal", "upper body ergometer": "Ergómetro",
  "skierg machine": "SkiErg", hammer: "Mazo", "stationary bike": "Bici estática", tire: "Llanta", "trap bar": "Barra hexagonal", "elliptical machine": "Elíptica", "stepmill machine": "Escaladora",
};
export const MUSCLE: Record<string, string> = {
  abductors: "abductores", abs: "abdomen", adductors: "aductores", biceps: "bíceps", calves: "pantorrillas", "cardiovascular system": "sistema cardiovascular", delts: "deltoides",
  forearms: "antebrazos", glutes: "glúteos", hamstrings: "isquiotibiales", lats: "dorsales", "levator scapulae": "elevador de la escápula", pectorals: "pectorales", quads: "cuádriceps",
  "serratus anterior": "serrato", spine: "espalda baja", traps: "trapecios", triceps: "tríceps", "upper back": "espalda alta", abdominals: "abdomen", "ankle stabilizers": "tobillos",
  ankles: "tobillos", back: "espalda", brachialis: "braquial", chest: "pecho", core: "core", deltoids: "deltoides", feet: "pies", "grip muscles": "agarre", groin: "ingle", hands: "manos",
  "hip flexors": "flexores de cadera", "inner thighs": "aductores", "latissimus dorsi": "dorsales", "lower abs": "abdomen bajo", "lower back": "espalda baja", obliques: "oblicuos",
  quadriceps: "cuádriceps", "rear deltoids": "deltoides posterior", rhomboids: "romboides", "rotator cuff": "manguito rotador", shins: "tibiales", shoulders: "hombros", soleus: "sóleo",
  sternocleidomastoid: "esternocleidomastoideo", trapezius: "trapecios", "upper chest": "pecho superior", "wrist extensors": "extensores de muñeca", "wrist flexors": "flexores de muñeca", wrists: "muñecas",
};
export const es = (dict: Record<string, string>, k: string) => dict[k] ?? k;

/** Ejercicios del motor → registro de la biblioteca (para pasos e info muscular). */
export const DS_ID: Record<string, string> = {
  squat: "0043", frontsquat: "0042", goblet: "1760", bench: "0025", closebench: "0030", incline: "0314", ohp: "1457", dbpress: "0426", dips: "0251", dipsw: "1755",
  deadlift: "0032", rdl: "0085", pullup: "0652", chinup: "1326", lat: "2330", row: "0027", dbrow: "0292", curl: "0031", hammer: "0313", lateral: "0334", lateralc: "0178",
  facepull: "0203", reardelt: "0378", pushup: "0662", pushupd: "0283", pushupe: "0279", kneeraise: "0472", legraise: "0475", carry: "2133", burpee: "1160", mountain: "0630",
  jumpsquat: "0514", invrow: "0499", bearcrawl: "3360", bulgarian: "0410", slrdl: "1757", dbrdl: "1459", legraisef: "0620", jacks: "3223",
};

/** Medios con licencia propia (Gym visual): solo si se configura un CDN licenciado. */
export function mediaUrl(e: LibEx, kind: "gif" | "img" = "gif") {
  const base = process.env.EXERCISE_MEDIA_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/${kind === "gif" ? e.gif : e.gif.replace("videos/", "images/").replace(".gif", ".jpg")}`;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const HOME_EQ = new Set(["body weight", "dumbbell", "band", "resistance band", "kettlebell", "stability ball", "medicine ball", "rope", "roller", "wheel roller"]);
const BW_EQ = new Set(["body weight"]);

export function searchLibrary(o: { q?: string; bp?: string; eq?: string; mine?: "gym" | "casa" | "mixto" | "ninguno"; page?: number; per?: number }) {
  const q = o.q ? norm(o.q) : "";
  let list = LIST;
  if (q) {
    // Primero los ejercicios de nuestras rutinas, luego los que empiezan con la búsqueda y los nombres más simples.
    const core = new Set(Object.values(DS_ID));
    const score = (e: LibEx) => (core.has(e.id) ? 0 : 1000) + (norm(e.n).startsWith(q) ? 0 : norm(e.n).includes(q) ? 300 : 600) + e.n.length;
    list = list.filter((e) => norm(e.n).includes(q) || norm(e.en).includes(q) || norm(es(MUSCLE, e.t)).includes(q)).sort((a, b) => score(a) - score(b));
  }
  if (o.bp) list = list.filter((e) => e.bp === o.bp);
  if (o.eq) list = list.filter((e) => e.eq === o.eq);
  if (o.mine === "casa") list = list.filter((e) => HOME_EQ.has(e.eq));
  if (o.mine === "ninguno") list = list.filter((e) => BW_EQ.has(e.eq));
  const per = o.per ?? 48, page = Math.max(1, o.page ?? 1);
  return { total: list.length, items: list.slice((page - 1) * per, page * per), page, pages: Math.max(1, Math.ceil(list.length / per)) };
}

export const getLibEx = (id: string) => BY_ID.get(id) ?? null;

export const LIB_COUNT = LIST.length;

/** Incremento de carga sugerido según el equipo (para progresión de ejercicios de la biblioteca). */
export function incFor(eq: string) {
  if (eq === "barbell" || eq === "ez barbell" || eq === "olympic barbell" || eq === "trap bar" || eq === "cable" || eq === "smith machine") return 2.5;
  if (eq === "dumbbell" || eq === "kettlebell") return 2;
  if (eq === "leverage machine" || eq === "sled machine") return 5;
  return 0;
}

/** Patrón de movimiento a partir del nombre en inglés del dataset (para que un cambio sea un sustituto real). */
const PATTERNS: [string, RegExp][] = [
  ["stretch", /stretch|massage|roll(er)? release|mobility|rotation hold|\bcircles?\b|\bsplits\b|yoga|\bpose\b/],
  ["carry", /carry|farmer|walk(ing)?\b/],
  ["squat", /squat|leg press|hack|pistol|wall sit|step-?up|box jump/],
  ["lunge", /lunge|split squat|bulgarian/],
  ["hinge", /deadlift|good morning|hip thrust|glute bridge|bridge|hyperextension|back extension|swing|pull[- ]through|romanian|rdl/],
  ["vpull", /pull-?up|chin-?up|pulldown|pull down|muscle up/],
  ["core", /crunch|sit-?up|plank|leg raise|knee raise|hip raise|twist|v-?up|rollout|hollow|dead bug|bicycle|flutter|jackknife|mountain climber|wiper|tuck/],
  ["hpull", /\brow\b|rows\b|inverted|face pull|reverse fly|rear delt|rear fly|pullover/],
  ["vpush", /overhead|military|shoulder press|arnold|push press|pike|handstand|jerk/],
  ["fly", /\bfly\b|flyes?|cross-?over|pec deck/],
  ["hpush", /bench press|chest press|push-?up|floor press|dip\b|dips\b|svend|\bpress\b/],
  ["curl", /curl/],
  ["ext", /triceps|tricep|kickback|skull|pushdown|push down|extension/],
  ["raise", /lateral raise|front raise|upright row|shrug|y raise|raise/],
  ["cardio", /jump|jack|burpee|run|sprint|skip|climber|crawl|shuffle|hop/],
];
export function patternOf(en: string) {
  const t = en.toLowerCase();
  return PATTERNS.find(([, re]) => re.test(t))?.[0] ?? "other";
}
const ODD = /stability ball|exercise ball|bosu|assisted|towel|isometric|\bhold\b|weighted vest|\bpartner\b|sled|\bv\. ?\d|\(male\)|\(female\)|one leg|single leg .*support|stepbox|rocky|side lying|\bdrop\b|to overhead|with twist|twisting|bench squat|jerk|lying on floor|off dumbbell|\bon knees\b|one arm (fly|chin)|korean|clock|muscle up|l-pull|frankenstein|guillotine|potty|wheel run|^run$|jm bench|behind (the )?head|cambered|rear pull-?up|push-up plus|frog|curtsey|drag curl/i;
/** Menos rarezas primero: nombres cortos y equipos comunes; mismo equipo que el original arriba. */
function score(x: LibEx, ref: LibEx) {
  let s = x.en.length;
  if (x.eq === ref.eq) s -= 25;
  if (/one arm|alternate|single|reverse grip|close-grip|wide|incline|decline/.test(x.en)) s += 12;
  return s;
}

/**
 * Alternativas reales: mismo patrón de movimiento (una sentadilla se cambia por otra sentadilla, no por un peso muerto),
 * misma zona y equipo disponible; primero las del mismo músculo principal y las menos raras.
 */
export function similar(e: LibEx, eq?: "gym" | "casa" | "mixto" | "ninguno", n = 6) {
  const pat = patternOf(e.en);
  const fits = (x: LibEx) => (eq === "casa" ? HOME_EQ.has(x.eq) : eq === "ninguno" ? BW_EQ.has(x.eq) : true);
  const same = pat === "other" ? (x: LibEx) => t0(x) === t0(e) && x.bp === e.bp : pat === "stretch" ? (x: LibEx) => patternOf(x.en) === pat && t0(x) === t0(e) : (x: LibEx) => patternOf(x.en) === pat && x.bp === e.bp;
  return LIST.filter((x) => x.id !== e.id && x.n !== e.n && same(x) && fits(x) && !ODD.test(x.en))
    .sort((a, b) => (t0(a) === t0(e) ? 0 : 40) + score(a, e) - ((t0(b) === t0(e) ? 0 : 40) + score(b, e))).slice(0, n);
}

/** Patrones donde aplica el tempo de fuerza (bajar en 3 s, pausa, subir con fuerza). */
const STRENGTH = new Set(["squat", "lunge", "hinge", "vpull", "hpull", "vpush", "hpush", "fly", "curl", "ext", "raise"]);
export const isStrength = (e: LibEx) => STRENGTH.has(patternOf(e.en)) && !/jump|plyo|burpee|sprint|skip|hop|stretch|hold/i.test(e.en);

/**
 * Animación del mono que representa bien el patrón del ejercicio (null si ninguna se parece lo suficiente).
 * Sirve de referencia visual cuando el ejercicio no tiene video propio.
 */
export function animFor(e: LibEx): string | null {
  const t = e.en.toLowerCase(), eq = e.eq, bw = eq === "body weight";
  if (/burpee/.test(t)) return "burpee";
  if (/mountain climber/.test(t)) return "mountain";
  if (/jump squat|squat jump/.test(t)) return "jump_bw";
  if (/farmer|suitcase carry|\bcarry\b/.test(t)) return "carry";
  if (/\bplank\b/.test(t) && !/jack|walk|reach|rotation|side/.test(t)) return "plank";
  if (/hanging (knee|leg) raise|captains chair|vertical leg raise/.test(t)) return "kneeraise";
  switch (patternOf(e.en)) {
    case "squat": if (/leg press|hack|wall sit|step|box|pistol|sissy/.test(t)) return null; return bw ? "squat_bw" : /front|goblet|dumbbell|kettlebell/.test(t) ? "frontsquat" : "squat";
    case "hinge": return /romanian|stiff|good morning|single leg deadlift/.test(t) ? (bw ? "rdl_bw" : "rdl") : /deadlift/.test(t) && !/sumo|deficit|trap bar/.test(t) ? "deadlift" : null;
    case "vpull": return /pull-?up|chin-?up|pulldown|pull down/.test(t) && !/muscle up|behind/.test(t) ? "pullup" : null;
    case "hpull": return /face pull|rear delt/.test(t) ? "facepull" : /\brow\b|rows\b|inverted/.test(t) && !/upright|high row|kneeling/.test(t) ? (eq === "dumbbell" ? "dbrow" : "row") : null;
    case "vpush": return /pike|handstand|behind|jerk|arnold/.test(t) ? null : eq === "dumbbell" ? "dbpress" : eq === "barbell" || eq === "smith machine" ? "ohp" : null;
    case "hpush": return /push-?up/.test(t) ? (/(wall|knee|bosu|stability|clap|archer|one arm)/.test(t) ? null : "pushup") : /\bdips?\b/.test(t) ? (/bench/.test(t) ? null : "dips") : /incline/.test(t) && /bench press|press/.test(t) ? "incline" : /bench press/.test(t) && !/decline|reverse|jm/.test(t) ? (eq === "dumbbell" ? "dbpress" : "bench") : null;
    case "curl": return /leg curl|wrist|reverse|spider|preacher|concentration/.test(t) ? null : bw ? "curl_bw" : "curl";
    case "raise": return /lateral raise/.test(t) && !/rear|lying|incline|front/.test(t) ? "lateral" : null;
    default: return null;
  }
}

/** Variantes de la biblioteca para un ejercicio del motor: mismo patrón de movimiento y músculo, equipo disponible. */
export function libraryAlternatives(ourId: string, eqUser: "gym" | "casa" | "mixto" | "ninguno", n = 3) {
  const d = DS_ID[ourId] ? BY_ID.get(DS_ID[ourId]) : null;
  if (!d) return [];
  const pat = patternOf(d.en);
  if (pat === "stretch" || pat === "other") return [];
  const used = new Set(Object.values(DS_ID));
  return ALL.filter((x) => t0(x) === t0(d) && x.id !== d.id && !used.has(x.id) && patternOf(x.en) === pat && !ODD.test(x.en)
    && (eqUser === "casa" ? HOME_EQ.has(x.eq) : eqUser === "ninguno" ? BW_EQ.has(x.eq) : true))
    .sort((a, b) => score(a, d) - score(b, d)).slice(0, n);
}
