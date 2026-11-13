// Resumen semanal (puro y probado). Textos honestos: nada se exagera y una semana floja no se regaña.
import { translate } from "@/lib/i18n/t";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";

/** Una línea de "Lo que cambia en tu plan" con su frase en español (la clave de la traducción) y sus datos (#309). */
export type RecapLine = { tpl: string; vars?: Record<string, number>; ex?: { id: string; name: string } };
export type WeekRecap = {
  weekOf: string;
  workouts: number;
  planned: number;
  sets: number;
  /** 0 a 1: entrenos hechos sobre los planeados (tope 1). */
  consistency: number;
  headline: string;
  changes: string[];
  /** Las mismas líneas de `changes`, para traducirlas en el cliente. */
  lines: RecapLine[];
};

export function recapFrom(x: { weekOf: string; workouts: number; sets: number; planned: number; heavier: string[]; heavierIds?: string[]; moreReps: number }): WeekRecap | null {
  if (x.workouts === 0 && x.sets === 0) return null;
  const planned = Math.max(1, x.planned);
  const consistency = Math.min(1, x.workouts / planned);
  const headline = consistency >= 1 ? "Cumpliste todos tus entrenos. Así se construye el cambio."
    : consistency >= 0.5 ? "Buena semana. Cada entreno cuenta."
    : "Entrenaste, y eso suma. Esta semana busca uno más.";
  const lines: RecapLine[] = [];
  const ex = x.heavier.length ? { id: x.heavierIds?.[0] ?? "", name: x.heavier[0] } : undefined;
  if (x.heavier.length) lines.push(x.heavier.length === 1 ? { tpl: "Por lo que anotaste, en {name} te toca subir el peso.", ex } : { tpl: "Por lo que anotaste, te toca subir el peso en {n} ejercicios, como {name}.", vars: { n: x.heavier.length }, ex });
  if (x.moreReps) lines.push(x.moreReps === 1 ? { tpl: "En 1 ejercicio te toca una repetición más por serie." } : { tpl: "En {n} ejercicios te toca una repetición más por serie.", vars: { n: x.moreReps } });
  if (!lines.length) lines.push({ tpl: "Sigue anotando cada serie: así la app sabe cuándo subirte el peso." });
  const changes = lines.map((l) => translate(DEFAULT_LOCALE, l.tpl, { ...l.vars, ...(l.ex ? { name: l.ex.name } : {}) }));
  return { weekOf: x.weekOf, workouts: x.workouts, planned, sets: x.sets, consistency, headline, changes, lines };
}
