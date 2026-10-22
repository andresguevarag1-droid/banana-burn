// Gamificación Banana Burn: XP, niveles, rachas y logros.

export const LEVELS = [
  { xp: 0, n: "Banana verde", icon: "banana" },
  { xp: 300, n: "Banana pintona", icon: "banana" },
  { xp: 800, n: "Banana madura", icon: "peeled" },
  { xp: 1600, n: "Plátano macho", icon: "bunch" },
  { xp: 3000, n: "Mono fuerte", icon: "monkey" },
  { xp: 5000, n: "Gorila", icon: "gorilla" },
  { xp: 8000, n: "Rey de la selva", icon: "monkeyCrown" },
  { xp: 12000, n: "King Kong", icon: "monkeyCrown" },
];

export function levelOf(xp: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++;
  const cur = LEVELS[i], next = LEVELS[i + 1];
  const into = xp - cur.xp, span = next ? next.xp - cur.xp : 1;
  return { idx: i + 1, ...cur, next: next ?? null, progress: next ? into / span : 1, toNext: next ? next.xp - xp : 0 };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const prev = (s: string) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() - 1); return iso(d); };

/** Racha: días consecutivos con actividad (entreno o check-in). Hoy cuenta si ya hay actividad; si no, no rompe la racha de ayer. */
export function streakOf(activeDays: Set<string>, today: string) {
  let d = activeDays.has(today) ? today : prev(today);
  let n = 0;
  while (activeDays.has(d)) { n++; d = prev(d); }
  return { days: n, todayDone: activeDays.has(today) };
}

export type Badge = { id: string; icon: string; n: string; d: string; got: boolean };

export function badges(s: { workouts: number; streak: number; prs: number; weighIns: number; lostKg: number }): Badge[] {
  return [
    { id: "first", icon: "medal", n: "Primer entreno", d: "Completa tu primera sesión", got: s.workouts >= 1 },
    { id: "w10", icon: "barbell", n: "10 entrenos", d: "La constancia gana", got: s.workouts >= 10 },
    { id: "s7", icon: "streak", n: "Racha de 7", d: "7 días seguidos activo", got: s.streak >= 7 },
    { id: "s30", icon: "streak", n: "Racha de 30", d: "Un mes sin fallar", got: s.streak >= 30 },
    { id: "pr", icon: "trophy", n: "Récord personal", d: "Supera tu mejor marca", got: s.prs >= 1 },
    { id: "scale", icon: "scale", n: "Báscula fiel", d: "10 pesajes registrados", got: s.weighIns >= 10 },
    { id: "kg2", icon: "trendDown", n: "−2 kg", d: "Primeros 2 kg fuera", got: s.lostKg >= 2 },
    { id: "kg5", icon: "target", n: "−5 kg", d: "Medio camino a la meta", got: s.lostKg >= 5 },
  ];
}

/** Segundos mínimos razonables por serie (ejecución + algo de descanso). Debajo de eso, no se premia. */
export const MIN_SET_SECONDS = 25;

/**
 * XP de un entreno, calculado igual en el cliente y en el servidor.
 * Anti-trampa: si las series se registraron más rápido de lo físicamente posible, el entreno
 * cuenta para la racha pero casi no da XP ni récords.
 */
export function workoutXp(o: { doneSets: number; totalSets: number; prs: number; seconds: number }) {
  const done = Math.max(0, Math.min(Math.round(o.doneSets), 40));
  const rushed = done > 0 && o.seconds < done * MIN_SET_SECONDS;
  if (rushed) return { xp: 0, prs: 0, rushed: true }; // series demasiado rápidas: no suman XP (coincide con lo que dice la app)
  const prs = Math.max(0, Math.min(Math.round(o.prs), 3));
  const full = o.totalSets > 0 && done >= o.totalSets;
  return { xp: done * 10 + prs * 50 + (full ? 30 : 0), prs, rushed: false };
}
