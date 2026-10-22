// Gamificación de Nutrición sin culpa: registrar es lo que cuenta, la semana importa más que un día.
import { streakOf } from "@/lib/gamify";

const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const mondayOf = (iso: string) => addDays(iso, -((new Date(iso + "T12:00:00").getDay() + 6) % 7));

/**
 * Balance de la semana (lunes a hoy) contando solo los días con algo registrado:
 * meta × días registrados contra lo comido. `diff` > 0 = margen; < 0 = por encima.
 */
export function weeklyBalance(days: { day: string; kcal: number }[], targetKcal: number, today: string) {
  const from = mondayOf(today);
  const byDay = new Map<string, number>();
  for (const d of days) if (d.day >= from && d.day <= today && d.kcal > 0) byDay.set(d.day, (byDay.get(d.day) ?? 0) + d.kcal);
  const logged = byDay.size;
  const eaten = [...byDay.values()].reduce((a, b) => a + b, 0);
  const target = targetKcal * logged;
  const week = [0, 1, 2, 3, 4, 5, 6].map((i) => { const day = addDays(from, i); return { day, kcal: byDay.get(day) ?? 0, future: day > today }; });
  return { logged, eaten: Math.round(eaten), target: Math.round(target), diff: Math.round(target - eaten), week };
}

/** Pasos que compensan aprox. `kcal` (≈ 40 kcal por cada 1.000 pasos), redondeado a 500. */
export function stepsFor(kcal: number) {
  return Math.max(1000, Math.ceil(Math.max(0, kcal) / 40 / 0.5) * 500);
}

/**
 * Mensaje empático cuando el día se pasa de la meta. Nunca culpa: algo concreto para mañana
 * y el recordatorio de que la semana es lo que cuenta. `weekDiff` (balance semanal) suaviza el mensaje.
 */
export function overMessage(over: number, weekDiff?: number): string | null {
  if (!(over > 0)) return null;
  if (weekDiff !== undefined && weekDiff >= 0) return "Hoy comiste más, pero tu semana sigue dentro de la meta. Así se ve un plan sostenible.";
  const steps = stepsFor(over);
  if (steps > 6000) return "Un día alto no borra tu progreso. Mañana una cena ligera y una caminata larga lo equilibran; tu semana es lo que importa.";
  return `Mañana compensas con +${steps.toLocaleString("es-419")} pasos o una cena ligera; tu semana es lo que importa.`;
}

/** Racha de registro de comidas (cualquier comida cuenta). */
export const mealStreak = (days: Iterable<string>, today: string) => streakOf(new Set(days), today);

export type NutritionBadge = { id: string; icon: string; n: string; d: string; got: boolean; progress: number };

/** Logros de nutrición: premian registrar con honestidad, no comer "perfecto". */
export function nutritionBadges(s: { streak: number; daysLogged: number }): NutritionBadge[] {
  const b = (id: string, icon: string, n: string, d: string, v: number, goal: number): NutritionBadge => ({ id, icon, n, d, got: v >= goal, progress: Math.min(1, v / goal) });
  return [
    b("first-meal", "fork", "Primer registro", "Registra tu primera comida", s.daysLogged, 1),
    b("honesto", "medal", "Honesto", "7 días seguidos registrando, aunque sea comida rápida", s.streak, 7),
    b("bitacora30", "trophy", "Bitácora de 30", "30 días con comidas registradas", s.daysLogged, 30),
  ];
}

/**
 * Inicio del día local (`iso` en la zona `tz`) como instante UTC en ISO. Sirve para contar el XP de hoy
 * sin asumir una zona horaria fija.
 */
export function localDayStartUtc(iso: string, tz: string) {
  const guess = Date.parse(iso + "T00:00:00Z");
  const offset = (at: number) => {
    try {
      const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(at)).map((x) => [x.type, x.value]));
      return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - at;
    } catch { return 0; }
  };
  const first = guess - offset(guess);
  return new Date(guess - offset(first)).toISOString();
}
