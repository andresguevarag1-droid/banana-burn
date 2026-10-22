// Retos de 21 a 30 días. Catálogo por defecto en código; el admin podrá sobrescribirlo desde la BD.
export type Verify = "manual" | "workout" | "steps" | "protein" | "water";
export type Challenge = { id: string; title: string; emoji: string; icon: string; days: number; desc: string; verify: Verify; color: string; task: (day: number) => string; xp: number };

export const CHALLENGES: Challenge[] = [
  { id: "banana-30", title: "30 días Banana", icon: "banana", emoji: "🍌", days: 30, verify: "workout", color: "bg-banana", xp: 400,
    desc: "Entrena 30 días seguidos: tu rutina, modo suave o un exprés de 10 min. Lo que cuenta es no fallar.",
    task: () => "Completa cualquier entreno (aunque sea un exprés de 10 min)" },
  { id: "flexiones-30", title: "Reto de flexiones", icon: "barbell", emoji: "💪", days: 30, verify: "manual", color: "bg-ember/15", xp: 300,
    desc: "De 10 a 100 flexiones al día en 30 días. Divídelas en las series que necesites.",
    task: (d) => `${Math.round(10 + (d - 1) * (90 / 29))} flexiones en total hoy (en las series que quieras)` },
  { id: "plancha-30", title: "Plancha de acero", icon: "shield", emoji: "🧱", days: 30, verify: "manual", color: "bg-sky/15", xp: 300,
    desc: "De 20 segundos a 3 minutos de plancha. Core de acero en un mes.",
    task: (d) => { const s = Math.round(20 + (d - 1) * (160 / 29)); return `Plancha total de ${s >= 60 ? `${Math.floor(s / 60)} min ${s % 60 ? `${s % 60} s` : ""}` : `${s} s`} (puedes partirla)`; } },
  { id: "pasos-30", title: "10.000 pasos", icon: "sneaker", emoji: "👟", days: 30, verify: "steps", color: "bg-peel/15", xp: 300,
    desc: "30 días caminando 10.000 pasos. La forma más fácil de quemar 300-400 kcal extra al día.",
    task: () => "Llega a 10.000 pasos (regístralos en Hoy)" },
  { id: "proteina-21", title: "Proteína perfecta", icon: "egg", emoji: "🥩", days: 21, verify: "protein", color: "bg-ember/10", xp: 250,
    desc: "21 días llegando a tu meta de proteína. El hábito que protege tu músculo mientras bajas de grasa.",
    task: () => "Llega a tu meta de proteína del día" },
  { id: "agua-21", title: "Hidratado", icon: "drop", emoji: "💧", days: 21, verify: "water", color: "bg-sky/10", xp: 200,
    desc: "21 días tomando 8 vasos de agua. Menos hambre, mejor energía en el gym.",
    task: () => "Toma 8 vasos de agua" },
];
export const CHALLENGE_BY_ID = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));

const dayDiff = (a: string, b: string) => Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 864e5);

/** Estado de un reto: día actual (1-based), completados, si hoy está hecho, si terminó o se rompió. */
export function challengeState(c: Challenge, startedOn: string, doneDays: string[], today: string) {
  const day = Math.min(c.days, dayDiff(startedOn, today) + 1);
  const done = new Set(doneDays);
  const cells = Array.from({ length: c.days }, (_, i) => {
    const d = new Date(startedOn + "T12:00:00"); d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    return { n: i + 1, iso, done: done.has(iso), past: iso < today, today: iso === today };
  });
  const completed = cells.filter((c) => c.done).length;
  const missed = cells.filter((c) => c.past && !c.done).length;
  return { day, cells, completed, missed, todayDone: done.has(today), finished: completed >= c.days, pct: completed / c.days };
}
