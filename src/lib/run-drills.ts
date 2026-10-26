// Técnica de carrera (Temporada Running): calentamiento dinámico, ejercicios de técnica, fuerza para correr y
// enfriamiento, con la animación del mono cuando existe su hoja revisada. PURO y probado en run-drills.test.ts.
import { sheetFor } from "./exercise-frames";
import { formatExerciseTask } from "@/components/workout/task";
import type { RunKind } from "./run-plan";

export type DrillGroup = "calentamiento" | "tecnica" | "fuerza" | "enfriar";
export const GROUP_LABEL: Record<DrillGroup, string> = { calentamiento: "Calentamiento dinámico", tecnica: "Técnica de carrera", fuerza: "Fuerza para correr", enfriar: "Enfriamiento y estiramientos" };
export const GROUP_HINT: Record<DrillGroup, string> = {
  calentamiento: "5 a 8 minutos antes de las series, el tempo o tu carrera.",
  tecnica: "2 tramos de 20 a 30 metros de cada uno, caminando de regreso. Después del calentamiento.",
  fuerza: "Pantorrillas, tobillos y cadera fuertes: menos molestias cuando subes los km.",
  enfriar: "Después de correr, sin rebotes. 30 segundos cada uno.",
};
/** Dosis con la misma forma que el reproductor (formatExerciseTask): series, unidad ("m", "s" o repeticiones) y rango. */
export type Dose = { sets: number; unit?: "m" | "s"; lo: number; hi: number; perSide?: boolean };
export type Drill = { id: string; name: string; group: DrillGroup; plan: Dose; cues: string[]; anim: string | null };

export const DRILLS: Drill[] = [
  { id: "legswing", name: "Balanceo de piernas", group: "calentamiento", plan: { sets: 1, lo: 10, hi: 10, perSide: true }, cues: ["Mano en la pared", "Pierna suelta, sin forzar", "Torso alto"], anim: "legswing" },
  { id: "lunge", name: "Zancadas caminando", group: "calentamiento", plan: { sets: 1, lo: 8, hi: 8, perSide: true }, cues: ["Paso largo", "Rodilla de atrás cerca del piso", "Torso alto"], anim: "lunge" },
  { id: "highknees", name: "Rodillas arriba", group: "calentamiento", plan: { sets: 2, unit: "m", lo: 20, hi: 20 }, cues: ["Rodilla a la cadera", "Apoya en puntas", "Brazos rápidos"], anim: "highknees" },
  { id: "buttkicks", name: "Talones al glúteo", group: "calentamiento", plan: { sets: 2, unit: "m", lo: 20, hi: 20 }, cues: ["Rodilla apunta abajo", "Talón toca el glúteo", "Pasos cortos y rápidos"], anim: "buttkicks" },
  { id: "askip", name: "Skipping A", group: "tecnica", plan: { sets: 2, unit: "m", lo: 20, hi: 20 }, cues: ["Rodilla a la cadera", "Pie abajo, bajo la cadera", "Brazo contrario"], anim: "askip" },
  { id: "bskip", name: "Skipping B", group: "tecnica", plan: { sets: 2, unit: "m", lo: 20, hi: 20 }, cues: ["Sube la rodilla", "Estira la pierna", "Barre hacia atrás"], anim: "bskip" },
  { id: "carioca", name: "Carioca", group: "tecnica", plan: { sets: 2, unit: "m", lo: 20, hi: 20, perSide: true }, cues: ["Hombros al frente", "La cadera gira", "Pasos ligeros"], anim: "carioca" },
  { id: "pogo", name: "Saltos de tobillo", group: "tecnica", plan: { sets: 2, lo: 20, hi: 20 }, cues: ["Rodillas casi rectas", "El rebote sale del tobillo", "Talones sin tocar"], anim: "pogo" },
  { id: "rectas", name: "Rectas (strides)", group: "tecnica", plan: { sets: 6, unit: "s", lo: 20, hi: 20 }, cues: ["Acelera poco a poco", "Rápido y relajado, no a tope", "Camina de regreso"], anim: null },
  { id: "calfraise", name: "Elevación de talones", group: "fuerza", plan: { sets: 3, lo: 15, hi: 15 }, cues: ["Sube en puntas", "Arriba 1 segundo", "Baja en 2 segundos"], anim: "calfraise" },
  { id: "slbridge", name: "Puente de glúteo a una pierna", group: "fuerza", plan: { sets: 3, lo: 10, hi: 10, perSide: true }, cues: ["Cadera nivelada", "Aprieta el glúteo", "Baja lento"], anim: "slbridge" },
  { id: "monsterwalk", name: "Pasos laterales con banda", group: "fuerza", plan: { sets: 2, lo: 12, hi: 12, perSide: true }, cues: ["Rodillas afuera", "Siempre abajo", "Pasos cortos"], anim: "monsterwalk" },
  { id: "calfstretch", name: "Pantorrilla en la pared", group: "enfriar", plan: { sets: 1, unit: "s", lo: 30, hi: 30, perSide: true }, cues: ["Talón de atrás abajo", "Pierna de atrás recta", "Sin rebotes"], anim: "calfstretch" },
  { id: "quadstretch", name: "Cuádriceps de pie", group: "enfriar", plan: { sets: 1, unit: "s", lo: 30, hi: 30, perSide: true }, cues: ["Rodillas juntas", "Cadera al frente", "Torso alto"], anim: "quadstretch" },
  { id: "hamstretch", name: "Femorales", group: "enfriar", plan: { sets: 1, unit: "s", lo: 30, hi: 30, perSide: true }, cues: ["Espalda larga", "Inclínate desde la cadera", "Respira"], anim: "hamstretch" },
];
/** "2 x 20 metros", "30 segundos por lado": la meta con las mismas palabras que el reproductor. */
export function drillDose(d: Drill): string {
  const t = formatExerciseTask({ unit: d.plan.unit, reps: "", lo: d.plan.lo, hi: d.plan.hi, bw: true, perSide: d.plan.perSide, setNo: 1, sets: d.plan.sets });
  return d.plan.sets > 1 ? `${d.plan.sets} x ${t.line}` : t.line;
}
export const drillsBy = (g: DrillGroup) => DRILLS.filter((d) => d.group === g);
/** Solo animaciones con hoja revisada; si no hay, la interfaz muestra el respaldo quieto. */
export const drillAnim = (d: Drill) => (d.anim && sheetFor(d.anim) ? d.anim : null);

/** Qué técnica acompaña cada sesión del plan: antes de la calidad, calentamiento y técnica; después de la larga, enfriar. */
export function drillsFor(kind: RunKind, strides: boolean): { before: DrillGroup[]; after: DrillGroup[] } {
  if (["intervalos", "tempo", "cuestas", "ritmo", "carrera"].includes(kind)) return { before: ["calentamiento", "tecnica"], after: ["enfriar"] };
  if (kind === "larga") return { before: ["calentamiento"], after: ["enfriar"] };
  if (strides) return { before: [], after: ["tecnica"] };
  return { before: [], after: [] };
}
