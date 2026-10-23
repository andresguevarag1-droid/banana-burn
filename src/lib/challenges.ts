// Retos: tienda (gratis y Premium), plan día a día y estado. El catálogo vive en la BD (challenges_catalog, 0018) y lo edita
// el admin en /admin/retos; challenge-seed.ts es la siembra inicial y el respaldo si la base aún no tiene la migración.
import { SEED, type ChallengeStatus, type CoverStyle, type DayTask, type Difficulty, type SeedChallenge, type Verify } from "./challenge-seed";
import { ALL_PROGRAM_SEED, PROGRAM_SEED_BY_SLUG, type ProgramSeed } from "./program-seed";
import { parseMeta, type ProgramMeta } from "./programs";
import { RESTYLE } from "./catalog-0028";
import { FREE_HIDE, FREE_REWORK } from "./catalog-0033";

/** Catálogo de respaldo con los nombres, colores y estados de 0028 (la base ya los tiene después de la migración). */
function restyle(c0: Challenge): Challenge {
  // 0033: los retos gratis que se quedan, con su plan nuevo; los demás, ocultos.
  const f = FREE_REWORK[c0.id];
  const c: Challenge = f
    ? { ...c0, title: f.title, desc: f.description, days: f.days, xp: f.xp, grace: f.grace, minutes: f.minutes, badge: f.badge, sort: f.sort, featured: !!f.featured, stepsGoal: f.stepsGoal ?? c0.stepsGoal, plan: f.plan, task: (d) => taskFor(f.plan, d, c0.verify, f.stepsGoal ?? c0.stepsGoal) }
    : FREE_HIDE.includes(c0.id) ? { ...c0, status: "oculto", featured: false } : c0;
  const r = RESTYLE[c.id];
  if (!r || f) return c;
  const program = c.program && r.mode && c.program.experience?.mode === r.mode[0] ? { ...c.program, experience: { ...c.program.experience, mode: r.mode[1] } } : c.program;
  return { ...c, title: r.title ?? c.title, cover: r.cover ?? c.cover, color: r.cover ? COVER_COLOR[r.cover] : c.color, status: r.hide ? "oculto" : c.status, featured: r.hide ? false : c.featured, program };
}
export type { ChallengeStatus, CoverStyle, DayTask, Difficulty, TaskType, Verify } from "./challenge-seed";

export type Challenge = {
  id: string; title: string; icon: string; days: number; desc: string; verify: Verify; color: string; task: (day: number) => string; xp: number;
  /** Días que se pueden fallar sin perder el reto (comodines). */
  grace: number;
  /** Meta de pasos (solo verify = "steps"). */
  stepsGoal?: number;
  /** "app" = catálogo base; "admin" = creado o reemplazado desde el panel. */
  source?: "app" | "admin";
  // Tienda
  priceUsd: number; cover: CoverStyle; difficulty: Difficulty; minutes: number; badge: string; rewardTitle: string | null;
  startMode: "libre" | "fecha"; startDate: string | null; featured: boolean; comingSoon: boolean; safetyNote: string | null;
  status: ChallengeStatus; sort: number;
  /** Plan día a día visible para quien mira (null = no cargado o bloqueado). */
  plan: DayTask[] | null;
  /** "reto" = hábito con check-in diario; "programa" = plan de entreno que toma el control de la app (0024). */
  kind: ChallengeKind;
  /** Meta pública del programa (fases, días por semana, para quién...). Solo en programas. */
  program: ProgramMeta | null;
};
export type ChallengeKind = "reto" | "programa";
export const isProgram = (c: Pick<Challenge, "kind" | "program">): c is Challenge & { kind: "programa"; program: ProgramMeta } => c.kind === "programa" && !!c.program;

/** Estado de un reto. `activo` sigue en curso; los demás son finales. */
export type Outcome = "activo" | "completado" | "fallido" | "vencido";

/** XP máximo por reto completado (lo repite el guard de xp_events en la BD). */
export const MAX_CHALLENGE_XP = 400;
/** Retos activos a la vez (lo repite el guard de user_challenges en 0013). */
export const MAX_ACTIVE = 3;
/** Días de un reto de pago que se ven antes de comprarlo. */
export const PREVIEW_DAYS = 3;
/** Un reto con fecha fija acepta inscripciones durante sus primeros 3 días (lo repite public.challenge_open en 0018). */
export const JOIN_WINDOW_DAYS = 3;
/** Mínimo que cobra ONVO en USD. */
export const MIN_PRICE_USD = 0.5;
export const MAX_PRICE_USD = 200;

export const COVERS: CoverStyle[] = ["banana", "ember", "sky", "peel", "noche", "selva", "fresa"];
export const COVER_LABEL: Record<CoverStyle, string> = { banana: "Banana", ember: "Fuego", sky: "Cielo", peel: "Hoja", noche: "Noche", selva: "Selva", fresa: "Fresa" };
const COVER_COLOR: Record<CoverStyle, string> = { banana: "bg-banana", ember: "bg-ember/15", sky: "bg-sky/15", peel: "bg-peel/15", noche: "bg-ink/10", selva: "bg-peel/10", fresa: "bg-[#FFD9E2]" };
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { facil: "Fácil", media: "Media", dificil: "Difícil" };
export const VERIFY_LABEL: Record<Verify, string> = { manual: "Lo marcas tú", workout: "Entreno registrado", steps: "Pasos registrados", protein: "Meta de proteína", water: "Vasos de agua" };
export const STATUS_LABEL: Record<ChallengeStatus, string> = { borrador: "Borrador", publicado: "Publicado", oculto: "Oculto", archivado: "Archivado" };

const fallbackTask = (verify: Verify, stepsGoal?: number) => ({
  manual: "Cumple el objetivo de hoy y márcalo",
  workout: "Completa cualquier entreno",
  steps: `Llega a ${(stepsGoal ?? 10000).toLocaleString("es-419")} pasos (regístralos en Hoy)`,
  protein: "Llega a tu meta de proteína del día",
  water: "Toma 8 vasos de agua",
}[verify]);

/** Texto del día `day` (1-based). Sin plan, la tarea genérica de su verificación. */
export function taskFor(plan: DayTask[] | null | undefined, day: number, verify: Verify, stepsGoal?: number, fixed?: string | null) {
  const t = plan?.[Math.max(0, Math.min(plan.length - 1, day - 1))]?.t;
  return t || fixed || fallbackTask(verify, stepsGoal);
}

export function fromSeed(s: SeedChallenge, source: "app" | "admin" = "app"): Challenge {
  const p = PROGRAM_SEED_BY_SLUG[s.slug];
  if (p) return fromProgramSeed(p, source);
  return {
    id: s.slug, title: s.title, icon: s.icon, days: s.days, desc: s.description, verify: s.verify, color: COVER_COLOR[s.cover], xp: s.xp, grace: s.grace,
    stepsGoal: s.stepsGoal, source, priceUsd: s.priceUsd, cover: s.cover, difficulty: s.difficulty, minutes: s.minutes, badge: s.badge, rewardTitle: s.rewardTitle,
    startMode: s.startMode, startDate: s.startDate, featured: s.featured, comingSoon: s.comingSoon, safetyNote: s.safetyNote, status: "publicado", sort: s.sort,
    plan: s.plan, task: (d) => taskFor(s.plan, d, s.verify, s.stepsGoal), kind: "reto", program: null,
  };
}

/** Programa de la siembra (program-seed.ts) como reto del catálogo (modo demo y respaldo). */
export function fromProgramSeed(p: ProgramSeed, source: "app" | "admin" = "app"): Challenge {
  const weeks = p.meta.phases.reduce((a, x) => a + x.weeks, 0);
  return {
    id: p.slug, title: p.title, icon: p.icon, days: weeks * 7, desc: p.description, verify: "workout", color: COVER_COLOR[p.cover], xp: p.xp, grace: 0,
    source, priceUsd: p.priceUsd, cover: p.cover, difficulty: p.difficulty, minutes: p.minutes, badge: p.badge, rewardTitle: p.rewardTitle,
    startMode: "libre", startDate: null, featured: p.featured, comingSoon: false, safetyNote: p.safetyNote, status: "publicado", sort: p.sort,
    plan: null, task: () => "Haz la sesión del programa", kind: "programa", program: p.meta,
  };
}

/** Los 6 retos con los que nació la app (sus ids se guardan en user_challenges desde 0008). */
export const BASE_IDS = ["banana-30", "flexiones-30", "plancha-30", "pasos-30", "proteina-21", "agua-21"];
export const SEED_CHALLENGES: Challenge[] = [...SEED.map((s) => fromSeed(s)), ...ALL_PROGRAM_SEED.filter((p) => p.insert).map((p) => fromProgramSeed(p))].map(restyle);
export const CHALLENGES: Challenge[] = SEED_CHALLENGES.filter((c) => BASE_IDS.includes(c.id));
export const CHALLENGE_BY_ID: Record<string, Challenge> = Object.fromEntries(SEED_CHALLENGES.map((c) => [c.id, c]));

// ───────────── Catálogo editable (challenges_catalog) ─────────────

/** Fila de challenges_catalog. Las columnas de la tienda llegan en 0018; sin ellas se leen las `rules` (JSON) de 0005. */
export type CatalogRow = {
  slug: string; title: string; description: string | null; days: number; rules: Record<string, unknown> | null;
  status?: string | null; price_usd?: number | string | null; difficulty?: string | null; minutes?: number | null; cover?: string | null; icon?: string | null;
  verify?: string | null; grace?: number | null; xp?: number | null; steps_goal?: number | null; badge?: string | null; reward_title?: string | null;
  start_mode?: string | null; start_date?: string | null; featured?: boolean | null; coming_soon?: boolean | null; safety_note?: string | null; sort?: number | null;
  /** 0024 */
  kind?: string | null; program?: unknown;
};
const VERIFY: Verify[] = ["manual", "workout", "steps", "protein", "water"];
const DIFFS: Difficulty[] = ["facil", "media", "dificil"];
const STATUSES: ChallengeStatus[] = ["borrador", "publicado", "oculto", "archivado"];
export const ICONS = ["banana", "peeled", "bunch", "medal", "trophy", "monkey", "gorilla", "barbell", "shield", "sneaker", "steps", "walk", "run", "egg", "drop", "bolt", "leaf", "target", "timer", "moon", "sun", "flag", "sparkle", "trendDown", "fork", "scale"];
const TASK_TYPES = ["reps", "tiempo", "pasos", "entreno", "habito", "nutricion", "descanso"] as const;
const int = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? Math.round(x) : typeof x === "string" && /^\d+$/.test(x) ? Number(x) : d);
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const str = (x: unknown, max: number) => (typeof x === "string" && x.trim() ? x.trim().slice(0, max) : null);

/** Plan día a día saneado (texto corto, tipo conocido, meta numérica opcional). */
export function parsePlan(x: unknown, days: number): DayTask[] {
  if (!Array.isArray(x)) return [];
  return x.slice(0, days).map((d) => {
    const o = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
    const type = TASK_TYPES.includes(o.type as (typeof TASK_TYPES)[number]) ? (o.type as DayTask["type"]) : "habito";
    const target = typeof o.target === "number" && Number.isFinite(o.target) && o.target >= 0 ? Math.min(100000, Math.round(o.target)) : undefined;
    return { t: str(o.t, 200) ?? "", type, ...(target !== undefined ? { target } : {}) };
  }).filter((d) => d.t);
}

/**
 * Convierte una fila del panel en un reto. Las columnas de 0018 mandan; si faltan, se leen las reglas JSON de 0005:
 * `verify`, `tarea` (texto del día), `comodines`, `xp` (o `xpBonus`, máx. 400), `pasosMin` (para steps), `icono`.
 */
export function fromCatalogRow(row: CatalogRow, plan?: DayTask[] | null): Challenge | null {
  if (!row?.slug || !/^[a-z0-9-]{2,60}$/.test(row.slug) || !row.title) return null;
  const days = clamp(int(row.days, 0), 1, 365);
  if (!days) return null;
  const r = row.rules && typeof row.rules === "object" ? row.rules : {};
  const v0 = row.verify ?? r.verify;
  const verify: Verify = VERIFY.includes(v0 as Verify) ? (v0 as Verify) : "manual";
  const stepsGoal = verify === "steps" ? clamp(int(row.steps_goal ?? r.pasosMin, 10000), 1000, 50000) : undefined;
  const tarea = str(r.tarea, 140);
  const icon0 = row.icon ?? r.icono;
  const icon = typeof icon0 === "string" && ICONS.includes(icon0) ? icon0 : "medal";
  const cover: CoverStyle = COVERS.includes(row.cover as CoverStyle) ? (row.cover as CoverStyle) : verify === "workout" ? "banana" : verify === "steps" ? "peel" : verify === "water" ? "sky" : "ember";
  const price = Number(row.price_usd ?? 0);
  const pl = plan === undefined ? null : plan;
  const start = row.start_mode === "fecha" && typeof row.start_date === "string" && /^\d{4}-\d{2}-\d{2}/.test(row.start_date) ? row.start_date.slice(0, 10) : null;
  return {
    id: row.slug, title: row.title.slice(0, 80), icon, days, verify, color: COVER_COLOR[cover],
    desc: (row.description ?? "").slice(0, 600),
    task: (d) => taskFor(pl, d, verify, stepsGoal, tarea),
    xp: clamp(int(row.xp ?? r.xp ?? r.xpBonus, Math.min(MAX_CHALLENGE_XP, days * 10)), 0, MAX_CHALLENGE_XP),
    grace: clamp(int(row.grace ?? r.comodines, Math.floor(days / 10)), 0, Math.max(0, days - 1)),
    stepsGoal, source: "admin",
    priceUsd: Number.isFinite(price) && price > 0 ? Math.round(price * 100) / 100 : 0,
    cover, difficulty: DIFFS.includes(row.difficulty as Difficulty) ? (row.difficulty as Difficulty) : "media",
    minutes: clamp(int(row.minutes, 10), 1, 240), badge: str(row.badge, 60) ?? row.title.slice(0, 60), rewardTitle: str(row.reward_title, 40),
    startMode: start ? "fecha" : "libre", startDate: start, featured: !!row.featured, comingSoon: !!row.coming_soon, safetyNote: str(row.safety_note, 600),
    status: STATUSES.includes(row.status as ChallengeStatus) ? (row.status as ChallengeStatus) : "publicado", sort: int(row.sort, 0),
    plan: pl, ...kindOf(row),
  };
}

/** Programa (0024) solo si la fila lo dice y su meta es válida; si no, reto de siempre. */
function kindOf(row: CatalogRow): { kind: ChallengeKind; program: ProgramMeta | null } {
  const meta = row.kind === "programa" ? parseMeta(row.program) : null;
  return meta ? { kind: "programa", program: meta } : { kind: "reto", program: null };
}

/** Catálogo efectivo sin la migración 0018: el base, con los retos del panel agregados (o reemplazando al base con el mismo id). */
export function mergeCatalog(rows: CatalogRow[]): Challenge[] {
  const out = new Map<string, Challenge>(CHALLENGES.map((c) => [c.id, c]));
  for (const row of rows) { const c = fromCatalogRow(row); if (c) out.set(c.id, c); }
  return [...out.values()];
}

// ───────────── Tienda ─────────────

export type StoreSection = "programas" | "gratis" | "premium" | "proximamente";
export const isPaid = (c: Pick<Challenge, "priceUsd">) => c.priceUsd > 0;

/** ¿Se puede empezar hoy? Retos con fecha fija: solo en su ventana de inscripción. */
export function openState(c: Pick<Challenge, "startMode" | "startDate" | "comingSoon">, today: string): "abierto" | "pronto" | "cerrado" {
  if (c.comingSoon) return "pronto";
  if (c.startMode !== "fecha" || !c.startDate) return "abierto";
  if (today < c.startDate) return "pronto";
  return today <= addDaysIso(c.startDate, JOIN_WINDOW_DAYS - 1) ? "abierto" : "cerrado";
}

/**
 * Sección de la tienda en la que aparece un reto, o null si no se muestra.
 * Solo los publicados se ven (borrador, oculto y archivado nunca); los cerrados solo los ve quien ya está o lo compró.
 */
export function storeSection(c: Pick<Challenge, "status" | "priceUsd" | "startMode" | "startDate" | "comingSoon"> & { kind?: ChallengeKind }, today: string): StoreSection | null {
  if (c.status !== "publicado") return null;
  if (c.kind === "programa") return c.comingSoon ? "proximamente" : "programas";
  const o = openState(c, today);
  if (o === "pronto") return "proximamente";
  if (o === "cerrado") return null;
  return isPaid(c) ? "premium" : "gratis";
}

/** Precio final en centavos de USD con el descuento por nivel (nunca menos que el mínimo de ONVO). */
export function priceMinor(priceUsd: number, discountPct = 0) {
  const base = Math.round(Math.max(0, priceUsd) * 100);
  if (!base) return 0;
  const d = clamp(Math.floor(discountPct), 0, 50);
  return Math.max(Math.round(MIN_PRICE_USD * 100), Math.round((base * (100 - d)) / 100));
}

export const usd = (minor: number) => `$${(minor / 100).toLocaleString("es-419", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Días del plan que puede ver alguien: todos si es gratis o ya lo tiene; si no, los primeros PREVIEW_DAYS. */
export function visibleDays(c: Pick<Challenge, "priceUsd" | "days">, owned: boolean) {
  return !isPaid(c) || owned ? c.days : Math.min(PREVIEW_DAYS, c.days);
}

/** Hitos de un reto: días 7 y 14 (si caben antes del final) y el día final. */
export function milestonesFor(days: number) {
  return [...[7, 14].filter((d) => d < days), days];
}
/** Próximo hito según días cumplidos (o null si ya llegó al último). */
export function nextMilestone(completed: number, days: number) {
  const m = milestonesFor(days).find((d) => d > completed);
  return m ? { at: m, left: m - completed, final: m === days } : null;
}

// ───────────── Estado ─────────────

const dayDiff = (a: string, b: string) => Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 864e5);
export const addDaysIso = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/**
 * Estado de un reto: día actual (1-based), cumplidos, fallados, comodines y resultado.
 * - completado: cumpliste `days - grace` días y ya no queda ningún día pendiente (o los cumpliste todos).
 * - fallido: fallaste más días de los que permiten los comodines antes de terminar el plazo.
 * - vencido: terminó el plazo sin llegar a la meta.
 */
export function challengeState(c: Pick<Challenge, "days"> & { grace?: number }, startedOn: string, doneDays: string[], today: string) {
  const grace = clamp(c.grace ?? 0, 0, Math.max(0, c.days - 1));
  const need = c.days - grace;
  const day = clamp(dayDiff(startedOn, today) + 1, 1, c.days);
  const done = new Set(doneDays);
  const cells = Array.from({ length: c.days }, (_, i) => {
    const iso = addDaysIso(startedOn, i);
    return { n: i + 1, iso, done: done.has(iso), past: iso < today, today: iso === today };
  });
  const endIso = cells[cells.length - 1].iso;
  const completed = cells.filter((x) => x.done).length;
  const missed = cells.filter((x) => x.past && !x.done).length;
  const pending = cells.filter((x) => !x.past && !x.done).length;
  let outcome: Outcome = "activo";
  if (completed >= c.days || (completed >= need && pending === 0)) outcome = "completado";
  else if (today > endIso) outcome = "vencido";
  else if (missed > grace) outcome = "fallido";
  return {
    day, cells, completed, missed, grace, graceLeft: Math.max(0, grace - missed), need, endIso,
    todayDone: done.has(today), finished: outcome === "completado", outcome, pct: completed / c.days,
  };
}
