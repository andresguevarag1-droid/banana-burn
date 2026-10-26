// Técnica de carrera (Temporada Running): calentamiento dinámico, ejercicios de técnica, fuerza para correr y
// enfriamiento, con la animación del mono cuando existe su hoja revisada. PURO y probado en run-drills.test.ts.
import { sheetFor } from "./exercise-frames";
import type { RunKind } from "./run-plan";

export type DrillGroup = "calentamiento" | "tecnica" | "fuerza" | "enfriar";
export const GROUP_LABEL: Record<DrillGroup, string> = { calentamiento: "Calentamiento dinámico", tecnica: "Técnica de carrera", fuerza: "Fuerza para correr", enfriar: "Enfriamiento y estiramientos" };
export const GROUP_HINT: Record<DrillGroup, string> = {
  calentamiento: "5 a 8 minutos antes de las series, el tempo o tu carrera.",
  tecnica: "2 tramos de 20 a 30 metros de cada uno, caminando de regreso. Después del calentamiento.",
  fuerza: "Pantorrillas, tobillos y cadera fuertes: menos molestias cuando subes los km.",
  enfriar: "Después de correr, sin rebotes. 30 segundos cada uno.",
};
export type Drill = { id: string; name: string; group: DrillGroup; dose: string; cues: string[]; anim: string | null };

export const DRILLS: Drill[] = [
  { id: "legswing", name: "Balanceo de piernas", group: "calentamiento", dose: "10 por pierna, adelante y atrás", cues: ["Mano en la pared", "Pierna suelta, sin forzar", "Torso alto"], anim: "legswing" },
  { id: "lunge", name: "Zancadas caminando", group: "calentamiento", dose: "8 por pierna", cues: ["Paso largo", "Rodilla de atrás cerca del piso", "Torso alto"], anim: "lunge" },
  { id: "highknees", name: "Rodillas arriba", group: "calentamiento", dose: "2 x 20 m", cues: ["Rodilla a la cadera", "Apoya en puntas", "Brazos rápidos"], anim: "highknees" },
  { id: "buttkicks", name: "Talones al glúteo", group: "calentamiento", dose: "2 x 20 m", cues: ["Rodilla apunta abajo", "Talón toca el glúteo", "Pasos cortos y rápidos"], anim: "buttkicks" },
  { id: "askip", name: "Skipping A", group: "tecnica", dose: "2 x 20 m", cues: ["Rodilla a la cadera", "Pie abajo, bajo la cadera", "Brazo contrario"], anim: "askip" },
  { id: "bskip", name: "Skipping B", group: "tecnica", dose: "2 x 20 m", cues: ["Sube la rodilla", "Estira la pierna", "Barre hacia atrás"], anim: "bskip" },
  { id: "carioca", name: "Carioca", group: "tecnica", dose: "2 x 20 m por lado", cues: ["Hombros al frente", "La cadera gira", "Pasos ligeros"], anim: "carioca" },
  { id: "pogo", name: "Saltos de tobillo", group: "tecnica", dose: "2 x 20 saltos", cues: ["Rodillas casi rectas", "El rebote sale del tobillo", "Talones sin tocar"], anim: "pogo" },
  { id: "rectas", name: "Rectas (strides)", group: "tecnica", dose: "4 a 6 x 20 segundos", cues: ["Acelera poco a poco", "Rápido y relajado, no a tope", "Camina de regreso"], anim: null },
  { id: "calfraise", name: "Elevación de talones", group: "fuerza", dose: "3 x 15", cues: ["Sube en puntas", "Arriba 1 segundo", "Baja en 2 segundos"], anim: "calfraise" },
  { id: "slbridge", name: "Puente de glúteo a una pierna", group: "fuerza", dose: "3 x 10 por pierna", cues: ["Cadera nivelada", "Aprieta el glúteo", "Baja lento"], anim: "slbridge" },
  { id: "monsterwalk", name: "Pasos laterales con banda", group: "fuerza", dose: "2 x 12 pasos por lado", cues: ["Rodillas afuera", "Siempre abajo", "Pasos cortos"], anim: "monsterwalk" },
  { id: "calfstretch", name: "Pantorrilla en la pared", group: "enfriar", dose: "30 s por pierna", cues: ["Talón de atrás abajo", "Pierna de atrás recta", "Sin rebotes"], anim: "calfstretch" },
  { id: "quadstretch", name: "Cuádriceps de pie", group: "enfriar", dose: "30 s por pierna", cues: ["Rodillas juntas", "Cadera al frente", "Torso alto"], anim: "quadstretch" },
  { id: "hamstretch", name: "Femorales", group: "enfriar", dose: "30 s por pierna", cues: ["Espalda larga", "Inclínate desde la cadera", "Respira"], anim: "hamstretch" },
];
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
