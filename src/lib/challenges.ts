// Retos de 14 a 30 días. Catálogo base en código; el admin agrega o reemplaza retos desde la BD (challenges_catalog).
export type Verify = "manual" | "workout" | "steps" | "protein" | "water";
export type Challenge = {
  id: string; title: string; icon: string; days: number; desc: string; verify: Verify; color: string; task: (day: number) => string; xp: number;
  /** Días que se pueden fallar sin perder el reto (comodines). */
  grace: number;
  /** Meta de pasos (solo verify = "steps"). */
  stepsGoal?: number;
  /** "app" = catálogo base; "admin" = creado o reemplazado desde el panel. */
  source?: "app" | "admin";
};

/** Estado de un reto. `activo` sigue en curso; los demás son finales. */
export type Outcome = "activo" | "completado" | "fallido" | "vencido";

/** XP máximo por reto completado (lo repite el guard de xp_events en la BD). */
export const MAX_CHALLENGE_XP = 400;
/** Retos activos a la vez (lo repite el guard de user_challenges en 0013). */
export const MAX_ACTIVE = 3;

export const CHALLENGES: Challenge[] = [
  { id: "banana-30", title: "30 días Banana", icon: "banana", days: 30, verify: "workout", color: "bg-banana", xp: 400, grace: 3,
    desc: "Entrena 30 días: tu rutina, modo suave o un exprés de 10 min. Tienes 3 comodines por si un día no puedes.",
    task: () => "Completa cualquier entreno (aunque sea un exprés de 10 min)" },
  { id: "flexiones-30", title: "Reto de flexiones", icon: "barbell", days: 30, verify: "manual", color: "bg-ember/15", xp: 300, grace: 3,
    desc: "De 10 a 100 flexiones al día en 30 días. Divídelas en las series que necesites.",
    task: (d) => `${Math.round(10 + (d - 1) * (90 / 29))} flexiones en total hoy (en las series que quieras)` },
  { id: "plancha-30", title: "Plancha de acero", icon: "shield", days: 30, verify: "manual", color: "bg-sky/15", xp: 300, grace: 3,
    desc: "De 20 segundos a 3 minutos de plancha. Core de acero en un mes.",
    task: (d) => { const s = Math.round(20 + (d - 1) * (160 / 29)); return `Plancha total de ${s >= 60 ? `${Math.floor(s / 60)} min ${s % 60 ? `${s % 60} s` : ""}` : `${s} s`} (puedes partirla)`; } },
  { id: "pasos-30", title: "10.000 pasos", icon: "sneaker", days: 30, verify: "steps", color: "bg-peel/15", xp: 300, grace: 3, stepsGoal: 10000,
    desc: "30 días caminando 10.000 pasos. La forma más fácil de quemar 300-400 kcal extra al día.",
    task: () => "Llega a 10.000 pasos (regístralos en Hoy)" },
  { id: "proteina-21", title: "Proteína perfecta", icon: "egg", days: 21, verify: "protein", color: "bg-ember/10", xp: 250, grace: 2,
    desc: "21 días llegando a tu meta de proteína. El hábito que protege tu músculo mientras bajas de grasa.",
    task: () => "Llega a tu meta de proteína del día" },
  { id: "agua-21", title: "Hidratado", icon: "drop", days: 21, verify: "water", color: "bg-sky/10", xp: 200, grace: 2,
    desc: "21 días tomando 8 vasos de agua. Menos hambre, mejor energía en el gym.",
    task: () => "Toma 8 vasos de agua" },
];
export const CHALLENGE_BY_ID: Record<string, Challenge> = Object.fromEntries(CHALLENGES.map((c) => [c.id, c.source ? c : { ...c, source: "app" as const }]));

// ───────────── Catálogo editable (challenges_catalog) ─────────────

export type CatalogRow = { slug: string; title: string; description: string | null; days: number; rules: Record<string, unknown> | null };
const VERIFY: Verify[] = ["manual", "workout", "steps", "protein", "water"];
const ICONS = ["banana", "barbell", "shield", "sneaker", "steps", "walk", "run", "egg", "drop", "medal", "trophy", "bolt", "leaf", "target", "timer", "moon", "sun", "flag"];
const COLORS: Record<Verify, string> = { manual: "bg-ember/15", workout: "bg-banana", steps: "bg-peel/15", protein: "bg-ember/10", water: "bg-sky/10" };
const int = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? Math.round(x) : typeof x === "string" && /^\d+$/.test(x) ? Number(x) : d);
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

/**
 * Convierte una fila del panel en un reto. Reglas reconocidas (JSON):
 * `verify` (manual | workout | steps | protein | water), `tarea` (texto del día), `comodines`, `xp` (o `xpBonus`, máx. 400),
 * `pasosMin` (para steps), `icono`. Cualquier otra clave se ignora.
 */
export function fromCatalogRow(row: CatalogRow): Challenge | null {
  if (!row?.slug || !/^[a-z0-9-]{2,60}$/.test(row.slug) || !row.title) return null;
  const days = clamp(int(row.days, 0), 1, 365);
  if (!days) return null;
  const r = row.rules && typeof row.rules === "object" ? row.rules : {};
  const verify: Verify = VERIFY.includes(r.verify as Verify) ? (r.verify as Verify) : "manual";
  const stepsGoal = verify === "steps" ? clamp(int(r.pasosMin, 10000), 1000, 50000) : undefined;
  const tarea = typeof r.tarea === "string" && r.tarea.trim() ? r.tarea.trim().slice(0, 140) : null;
  const fallback: Record<Verify, string> = {
    manual: "Cumple el objetivo de hoy y márcalo",
    workout: "Completa cualquier entreno",
    steps: `Llega a ${(stepsGoal ?? 10000).toLocaleString("es-419")} pasos (regístralos en Hoy)`,
    protein: "Llega a tu meta de proteína del día",
    water: "Toma 8 vasos de agua",
  };
  const icon = typeof r.icono === "string" && ICONS.includes(r.icono) ? r.icono : "medal";
  return {
    id: row.slug, title: row.title.slice(0, 80), icon, days, verify, color: COLORS[verify],
    desc: (row.description ?? "").slice(0, 600),
    task: () => tarea ?? fallback[verify],
    xp: clamp(int(r.xp ?? r.xpBonus, Math.min(MAX_CHALLENGE_XP, days * 10)), 0, MAX_CHALLENGE_XP),
    grace: clamp(int(r.comodines, Math.floor(days / 10)), 0, Math.max(0, days - 1)),
    stepsGoal, source: "admin",
  };
}

/** Catálogo efectivo: el base, con los retos del panel agregados (o reemplazando al base si usan el mismo identificador). */
export function mergeCatalog(rows: CatalogRow[]): Challenge[] {
  const out = new Map<string, Challenge>(CHALLENGES.map((c) => [c.id, CHALLENGE_BY_ID[c.id]]));
  for (const row of rows) { const c = fromCatalogRow(row); if (c) out.set(c.id, c); }
  return [...out.values()];
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
