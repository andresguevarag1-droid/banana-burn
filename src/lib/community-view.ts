// Lógica pura de la comunidad "La tropa" (sin servidor): tiempo relativo, tipos de publicación,
// formato de cifras, contador de caracteres, podio del ranking e insignias públicas. Probada en community-view.test.ts.
import { badges, levelOf, type Badge } from "@/lib/gamify";
import type { Flair } from "@/lib/profile-power";
import { NUM_LOCALE } from "@/lib/num";

/** Fechas relativas en español latino; las cifras van con NUM_LOCALE (coma decimal). */
const LOCALE = "es-419";
const nf = (n: number, max = 0) => n.toLocaleString(NUM_LOCALE, { maximumFractionDigits: max });

/** Tiempo relativo en español latinoamericano: "hace 5 minutos", "ayer", "hace 3 días", o la fecha si pasó más de una semana. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.round((now.getTime() - t) / 1000);
  if (s < 45) return "ahora";
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  const m = Math.round(s / 60);
  if (m < 60) return rtf.format(-m, "minute");
  const h = Math.round(m / 60);
  if (h < 24) return rtf.format(-h, "hour");
  const d = Math.round(h / 24);
  if (d < 7) return rtf.format(-d, "day");
  return new Date(t).toLocaleDateString(LOCALE, { day: "numeric", month: "short", ...(new Date(t).getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
}

// ───────────── Tipos de publicación ─────────────
export type PostTag = "entreno" | "logro" | "pregunta" | "comida" | "progreso";
export type TagDef = { id: PostTag; label: string; chip: string; icon: string; placeholder: string };
/** Igual que la lista permitida en guard_post_write (0019). */
export const POST_TAGS: TagDef[] = [
  { id: "entreno", label: "Entreno", chip: "Terminé mi entreno", icon: "barbell", placeholder: "¿Cómo te sentiste? Cuenta qué te costó y qué salió mejor que la vez pasada." },
  { id: "logro", label: "Logro", chip: "Logro", icon: "medal", placeholder: "¿Qué lograste? Grande o pequeño, cuenta." },
  { id: "pregunta", label: "Pregunta", chip: "Pregunta", icon: "question", placeholder: "Pregunta lo que quieras a la tropa: técnica, rutina, comida." },
  { id: "comida", label: "Comida", chip: "Comida", icon: "fork", placeholder: "¿Qué comiste hoy que te ayudó con tu meta?" },
  { id: "progreso", label: "Progreso", chip: "Progreso", icon: "trendDown", placeholder: "¿Cómo vas? Comparte cómo te sientes, tu energía o tu ropa." },
];
export const isPostTag = (x: unknown): x is PostTag => typeof x === "string" && POST_TAGS.some((t) => t.id === x);
export const tagDef = (x: unknown): TagDef | null => POST_TAGS.find((t) => t.id === x) ?? null;

// ───────────── Cifras ─────────────
/** Volumen levantado: "820 kg" o "7.4 t" en es-419. */
export function fmtVolume(kg: number | null | undefined): string | null {
  if (!kg || kg <= 0) return null;
  return kg < 1000 ? `${nf(Math.round(kg))} kg` : `${nf(kg / 1000, 1)} t`;
}
/** Duración: "52 min" o "1 h 05 min". */
export function fmtDuration(mins: number | null | undefined): string | null {
  if (!mins || mins <= 0) return null;
  const m = Math.round(mins);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")} min` : `${h} h`;
}
export const fmtNum = (n: number) => nf(n);
export const plural = (n: number, one: string, many: string) => `${nf(n)} ${n === 1 ? one : many}`;

// ───────────── Compositor ─────────────
/** El contador de caracteres solo aparece cerca del límite (último 20 %). */
export function counterState(len: number, max: number) {
  const left = max - len;
  return { left, show: left <= Math.max(20, Math.round(max * 0.2)), danger: left <= Math.max(10, Math.round(max * 0.05)) };
}

// ───────────── Ranking ─────────────
export type BoardRow = { userId: string; username: string | null; name: string; workouts: number; xp: number; totalXp: number | null; pos: number; me: boolean; flair?: Flair | null };

/**
 * Divide el ranking en podio (3 primeros con XP), el resto y tu fila fijada.
 * `honest` es falso si hay menos de 2 personas con XP esta semana: mejor decirlo que mostrar un podio vacío.
 */
export function splitBoard(rows: BoardRow[]) {
  const sorted = [...rows].sort((a, b) => a.pos - b.pos || b.xp - a.xp);
  const active = sorted.filter((r) => r.xp > 0);
  const me = sorted.find((r) => r.me) ?? null;
  const podium = active.slice(0, 3);
  const rest = active.slice(3);
  return { podium, rest, me, active: active.length, honest: active.length >= 2, meInList: !!me && active.some((r) => r.me) };
}

/** Orden visual del podio: 2.º, 1.º, 3.º. */
export const podiumOrder = <T,>(p: T[]): (T | null)[] => [p[1] ?? null, p[0] ?? null, p[2] ?? null];

// ───────────── Nivel e insignias ─────────────
/** Nivel a partir del XP total (null si la persona no comparte). */
export function levelFor(xp: number | null | undefined) {
  if (xp === null || xp === undefined || !Number.isFinite(xp)) return null;
  const lv = levelOf(Math.max(0, xp));
  return { idx: lv.idx, name: lv.n, icon: lv.icon };
}

/** Insignias que se pueden mostrar en un perfil: nunca las de peso ni báscula (datos de salud). Sin racha conocida, sin las de racha. */
export function publicBadges(s: { workouts: number; prs: number; streak?: number | null }): Badge[] {
  const all = badges({ workouts: s.workouts, prs: s.prs, streak: s.streak ?? 0, weighIns: 0, lostKg: 0 });
  const health = new Set(["scale", "kg2", "kg5"]);
  return all.filter((b) => !health.has(b.id) && (s.streak !== undefined && s.streak !== null ? true : !b.id.startsWith("s")));
}

// ───────────── Semana ─────────────
/** Lunes (fecha local ISO) de la semana de `today`. */
export function mondayIso(today: string) {
  const d = new Date(today + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** Instante UTC de las 00:00 de `isoDate` en la zona `tz` (para filtrar por "desde el lunes" en hora local). */
export function zonedMidnightUtc(isoDate: string, tz: string): Date {
  const guess = new Date(isoDate + "T00:00:00Z");
  let offsetMin = 0;
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(guess);
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"));
    offsetMin = Math.round((asUtc - guess.getTime()) / 60000);
  } catch { /* zona inválida: UTC */ }
  return new Date(guess.getTime() - offsetMin * 60000);
}

/** Iniciales para el avatar (máx. 2 letras). */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const s = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 1);
  return s.toUpperCase();
}
