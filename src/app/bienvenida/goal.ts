// Reglas de la meta de peso según el objetivo. Las usan el wizard (cliente) y la acción de servidor.
export type Goal = "grasa" | "recomp" | "fuerza";

export const GOALS: { id: Goal; t: string; d: string }[] = [
  { id: "grasa", t: "Bajar grasa rápido", d: "Déficit de unas 500 kcal al día, a un ritmo que cuida tu músculo" },
  { id: "recomp", t: "Bajar grasa y ganar músculo", d: "Déficit suave y fuerza como prioridad, sin obsesionarte con la báscula" },
  { id: "fuerza", t: "Ganar fuerza", d: "Más kilos en la barra; tu meta de peso puede ser igual o mayor a tu peso actual" },
];

/** Margen para recomposición: la meta puede quedar hasta 3 % por encima del peso actual (≈ mantener). */
export const RECOMP_UP = 0.03;
/** Ritmos de referencia por semana, como fracción del peso actual. */
export const LOSS_RATE = 0.0075; // ~0.75 %: rápido pero sano
export const LOSS_MAX = 0.01; // más de 1 % suele costar músculo
export const GAIN_RATE = 0.0025; // ~0.25 %: ganancia limpia
export const GAIN_MAX = 0.005; // más de 0.5 % suele ser grasa

const minHealthy = (heightCm: number) => Math.ceil(18.5 * (heightCm / 100) ** 2);

/** Error de la meta para el objetivo elegido, o null si es válida. */
export function goalError({ goal, weight, goalWeight, heightCm }: { goal: Goal; weight: number; goalWeight: number; heightCm: number }): string | null {
  if (!(weight > 0) || !(goalWeight > 0) || !(heightCm > 0)) return "Completa tu peso, tu meta y tu estatura.";
  if (goalWeight / (heightCm / 100) ** 2 < 18.5) return `Esa meta queda por debajo de un peso saludable para tu estatura (mínimo ${minHealthy(heightCm)} kg).`;
  if (goal === "grasa" && goalWeight > weight) return "Para bajar grasa tu meta debe ser menor o igual a tu peso actual. Si quieres subir de peso, elige Ganar fuerza.";
  if (goal === "recomp" && goalWeight > weight * (1 + RECOMP_UP)) return "En recomposición tu peso se mantiene más o menos igual. Si quieres subir de peso, elige Ganar fuerza.";
  return null;
}

/** Fecha sugerida (ISO) para llegar a la meta a un ritmo sano, mínimo 4 semanas. */
export function suggestDate(weight: number, goalWeight: number, from = new Date()) {
  const delta = Math.abs(weight - goalWeight);
  const perWeek = goalWeight > weight ? Math.max(0.1, weight * GAIN_RATE) : Math.max(0.3, weight * LOSS_RATE);
  const weeks = Math.max(4, Math.ceil(delta / perWeek));
  const d = new Date(from); d.setDate(d.getDate() + weeks * 7);
  // Fecha local (no UTC): en el teléfono de alguien en Costa Rica a las 7 p. m., el día UTC ya sería mañana.
  return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, perWeek };
}

export type Pace = { kgPerWeek: number; direction: "baja" | "sube" | "mantiene"; tooFast: boolean; title: string; body: string };

/** Ritmo semanal hacia la meta y su mensaje según el objetivo. */
export function paceFor({ goal, weight, goalWeight, goalDate, now = new Date() }: { goal: Goal; weight: number; goalWeight: number; goalDate: string; now?: Date }): Pace {
  const weeks = Math.max(1, (new Date(goalDate + "T12:00:00").getTime() - now.getTime()) / (7 * 864e5));
  const diff = goalWeight - weight;
  const kgPerWeek = Math.abs(diff) / weeks;
  const direction = Math.abs(diff) < 0.25 ? "mantiene" : diff > 0 ? "sube" : "baja";
  if (direction === "mantiene") {
    return { kgPerWeek: 0, direction, tooFast: false, title: "Mantienes tu peso", body: goal === "fuerza" ? "Ganarás fuerza sin cambiar tu peso." : "Bajarás grasa y ganarás músculo. Tus medidas y tu fuerza contarán más que la báscula." };
  }
  if (direction === "sube") {
    const tooFast = kgPerWeek > weight * GAIN_MAX;
    return { kgPerWeek, direction, tooFast, title: tooFast ? "Muy rápido" : "Ritmo sano", body: tooFast ? "Subir más de 0.5 % por semana suele ser grasa, no músculo." : "Subirás de peso ganando fuerza y músculo, con poca grasa." };
  }
  const tooFast = kgPerWeek > weight * LOSS_MAX;
  const ok = goal === "fuerza" ? "Ganarás fuerza mientras bajas de peso." : goal === "recomp" ? "Bajarás grasa y ganarás músculo a la vez." : "Perderás grasa y conservarás tu músculo.";
  return { kgPerWeek, direction, tooFast, title: tooFast ? "Muy agresivo" : "Ritmo sano", body: tooFast ? "Bajar más de 1 % por semana suele costar músculo." : ok };
}
