// Logros de running y el reto del mes, calculados con las carreras con GPS (sin datos inventados). PURO y probado en
// run-badges.test.ts.
import { weekStreak, mondayOf, addDays } from "./run-plan";

export type RunRowLike = { id: string; day: string; distanceM: number; movingS: number };
export type Badge = { id: string; label: string; desc: string; earnedOn: string | null; progress: number };

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const monthKm = (runs: RunRowLike[], ym: string) => runs.filter((r) => r.day.startsWith(ym)).reduce((a, r) => a + r.distanceM, 0) / 1000;

/** Primera fecha (en orden) en que se cumple algo, recorriendo las carreras de la más vieja a la más nueva. */
function firstDay(runs: RunRowLike[], ok: (r: RunRowLike, i: number, sorted: RunRowLike[]) => boolean): string | null {
  const sorted = [...runs].sort((a, b) => a.day.localeCompare(b.day));
  return sorted.find((r, i) => ok(r, i, sorted))?.day ?? null;
}
/** Primer día en que un mes llegó a `km`. */
function monthReached(runs: RunRowLike[], km: number): string | null {
  const sorted = [...runs].sort((a, b) => a.day.localeCompare(b.day));
  const acc = new Map<string, number>();
  for (const r of sorted) { const ym = r.day.slice(0, 7); const v = (acc.get(ym) ?? 0) + r.distanceM / 1000; acc.set(ym, v); if (v >= km) return r.day; }
  return null;
}
/** Primer día en que se completaron `n` semanas seguidas con al menos una carrera. */
function streakReached(runs: RunRowLike[], n: number): string | null {
  const days = [...new Set(runs.map((r) => r.day))].sort();
  for (const d of days) if (weekStreak(days.filter((x) => x <= d), d) >= n) return d;
  return null;
}

export function runBadges(runs: RunRowLike[], today: string): Badge[] {
  const maxM = Math.max(0, ...runs.map((r) => r.distanceM));
  const bestMonth = Math.max(0, ...[...new Set(runs.map((r) => r.day.slice(0, 7)))].map((m) => monthKm(runs, m)));
  const streak = weekStreak(runs.map((r) => r.day), today);
  const b = (id: string, label: string, desc: string, earnedOn: string | null, progress: number): Badge => ({ id, label, desc, earnedOn, progress: earnedOn ? 1 : Math.max(0, Math.min(0.99, progress)) });
  return [
    b("primera", "Primera carrera", "Registra tu primera carrera con GPS.", firstDay(runs, () => true), 0),
    b("5k", "Primeros 5 km", "Una carrera de 5 km o más.", firstDay(runs, (r) => r.distanceM >= 5000), maxM / 5000),
    b("10k", "Primeros 10 km", "Una carrera de 10 km o más.", firstDay(runs, (r) => r.distanceM >= 10000), maxM / 10000),
    b("21k", "Medio maratón", "Una carrera de 21.1 km o más.", firstDay(runs, (r) => r.distanceM >= 21097), maxM / 21097),
    b("diez", "10 carreras", "Diez carreras registradas.", firstDay(runs, (_, i) => i >= 9), runs.length / 10),
    b("mes50", "50 km en un mes", "Suma 50 km en un mismo mes.", monthReached(runs, 50), bestMonth / 50),
    b("mes100", "100 km en un mes", "Suma 100 km en un mismo mes.", monthReached(runs, 100), bestMonth / 100),
    b("racha4", "4 semanas seguidas", "Corre al menos una vez por semana, 4 semanas seguidas.", streakReached(runs, 4), streak / 4),
    b("racha8", "8 semanas seguidas", "Corre al menos una vez por semana, 8 semanas seguidas.", streakReached(runs, 8), streak / 8),
  ];
}

/** Logros que se ganaron con una carrera de hoy (para celebrarlos al guardarla). */
export const newBadges = (runs: RunRowLike[], today: string) => runBadges(runs, today).filter((x) => x.earnedOn === today);

const TIERS = [20, 30, 50, 80, 100, 150, 200];
export type MonthChallenge = { title: string; goalKm: number; km: number; daysLeft: number; done: boolean; month: string };
/** Reto del mes: la meta sube un poco sobre lo que corriste el mes pasado (20, 30, 50, 80, 100 km...). */
export function monthChallenge(runs: RunRowLike[], today: string): MonthChallenge {
  const [y, m] = today.split("-").map(Number);
  const prev = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
  const last = monthKm(runs, prev);
  const goalKm = TIERS.find((t) => t >= Math.max(20, last * 1.1)) ?? TIERS.at(-1)!;
  const km = Math.round(monthKm(runs, today.slice(0, 7)) * 10) / 10;
  const end = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { title: `${goalKm} km en ${MONTHS[m - 1]}`, goalKm, km, daysLeft: end - Number(today.slice(8, 10)), done: km >= goalKm, month: MONTHS[m - 1] };
}

/** Resumen de la semana para Hoy: km, mejor ritmo de la semana y carreras. */
export function weekRecap(runs: (RunRowLike & { paceSKm: number | null })[], today: string) {
  const mon = mondayOf(today);
  const wk = runs.filter((r) => r.day >= mon && r.day <= addDays(mon, 6));
  const paces = wk.map((r) => r.paceSKm).filter((p): p is number => p != null && r1(p));
  return { km: Math.round(wk.reduce((a, r) => a + r.distanceM, 0) / 100) / 10, runs: wk.length, bestPace: paces.length ? Math.min(...paces) : null };
}
const r1 = (p: number) => p >= 120 && p <= 1200;

/** XP por carrera: 20 + 8 por km, hasta 100. */
export const runXp = (distanceM: number) => Math.min(100, Math.round(20 + 8 * (distanceM / 1000)));
