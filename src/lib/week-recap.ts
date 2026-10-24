// Resumen semanal (puro y probado). Textos honestos: nada se exagera y una semana floja no se regaña.
export type WeekRecap = {
  weekOf: string;
  workouts: number;
  planned: number;
  sets: number;
  /** 0 a 1: entrenos hechos sobre los planeados (tope 1). */
  consistency: number;
  headline: string;
  changes: string[];
};

export function recapFrom(x: { weekOf: string; workouts: number; sets: number; planned: number; heavier: string[]; moreReps: number }): WeekRecap | null {
  if (x.workouts === 0 && x.sets === 0) return null;
  const planned = Math.max(1, x.planned);
  const consistency = Math.min(1, x.workouts / planned);
  const headline = consistency >= 1 ? "Cumpliste todos tus entrenos. Así se construye el cambio."
    : consistency >= 0.5 ? "Buena semana. Cada entreno cuenta."
    : "Entrenaste, y eso suma. Esta semana busca uno más.";
  const changes: string[] = [];
  if (x.heavier.length) changes.push(x.heavier.length === 1 ? `Por lo que anotaste, en ${x.heavier[0]} te toca subir el peso.` : `Por lo que anotaste, te toca subir el peso en ${x.heavier.length} ejercicios, como ${x.heavier[0]}.`);
  if (x.moreReps) changes.push(x.moreReps === 1 ? "En 1 ejercicio te toca una repetición más por serie." : `En ${x.moreReps} ejercicios te toca una repetición más por serie.`);
  if (!changes.length) changes.push("Sigue anotando cada serie: así la app sabe cuándo subirte el peso.");
  return { weekOf: x.weekOf, workouts: x.workouts, planned, sets: x.sets, consistency, headline, changes };
}
