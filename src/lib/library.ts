import "server-only";
import data from "@/data/exercise-library.json";

// Biblioteca de 1.324 ejercicios (datos MIT de hasaneyldrm/exercises-dataset).
export type LibEx = { id: string; n: string; en: string; bp: string; eq: string; t: string; m2: string[]; s: string[]; media: string; gif: string };
const CORE = new Set(["0043", "0042", "1760", "0025", "0030", "0314", "1457", "0426", "0251", "0032", "0085", "0652", "1326", "2330", "0027", "0292", "0031", "0313", "0334", "0178", "0203", "0378", "0662", "0283", "0279", "0472", "0475", "2133", "1160", "0630", "0514", "0499", "3360", "0410", "1757", "1459", "0620"]);
const EQ_RANK: Record<string, number> = { barbell: 0, dumbbell: 0, "body weight": 0, cable: 1, "leverage machine": 1, kettlebell: 2, band: 2, "smith machine": 2 };
const rank = (e: LibEx) => (CORE.has(e.id) ? 0 : 10) + (EQ_RANK[e.eq] ?? 3) + (/stretch/i.test(e.en) ? 5 : 0);
const ALL = (data as LibEx[]).slice().sort((a, b) => rank(a) - rank(b) || a.n.localeCompare(b.n, "es"));
const BY_ID = new Map(ALL.map((e) => [e.id, e]));

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
  let list = ALL;
  if (q) list = list.filter((e) => norm(e.n).includes(q) || norm(e.en).includes(q) || norm(es(MUSCLE, e.t)).includes(q));
  if (o.bp) list = list.filter((e) => e.bp === o.bp);
  if (o.eq) list = list.filter((e) => e.eq === o.eq);
  if (o.mine === "casa") list = list.filter((e) => HOME_EQ.has(e.eq));
  if (o.mine === "ninguno") list = list.filter((e) => BW_EQ.has(e.eq));
  const per = o.per ?? 48, page = Math.max(1, o.page ?? 1);
  return { total: list.length, items: list.slice((page - 1) * per, page * per), page, pages: Math.max(1, Math.ceil(list.length / per)) };
}

export const getLibEx = (id: string) => BY_ID.get(id) ?? null;

/** Alternativas: mismo músculo objetivo, equipo disponible. */
export function similar(e: LibEx, eq?: "gym" | "casa" | "mixto" | "ninguno", n = 6) {
  return ALL.filter((x) => x.id !== e.id && x.t === e.t && (eq === "casa" ? HOME_EQ.has(x.eq) : eq === "ninguno" ? BW_EQ.has(x.eq) : true)).slice(0, n);
}

export const LIB_COUNT = ALL.length;

/** Incremento de carga sugerido según el equipo (para progresión de ejercicios de la biblioteca). */
export function incFor(eq: string) {
  if (eq === "barbell" || eq === "ez barbell" || eq === "olympic barbell" || eq === "trap bar" || eq === "cable" || eq === "smith machine") return 2.5;
  if (eq === "dumbbell" || eq === "kettlebell") return 2;
  if (eq === "leverage machine" || eq === "sled machine") return 5;
  return 0;
}

/** Variantes de la biblioteca para un ejercicio del motor (mismo músculo objetivo y equipo disponible). */
export function libraryAlternatives(ourId: string, eqUser: "gym" | "casa" | "mixto" | "ninguno", n = 3) {
  const d = DS_ID[ourId] ? BY_ID.get(DS_ID[ourId]) : null;
  if (!d) return [];
  const used = new Set(Object.values(DS_ID));
  return ALL.filter((x) => x.t === d.t && x.id !== d.id && !used.has(x.id) && !/stretch/i.test(x.en) && (eqUser === "casa" ? HOME_EQ.has(x.eq) : eqUser === "ninguno" ? BW_EQ.has(x.eq) : true)).slice(0, n);
}
