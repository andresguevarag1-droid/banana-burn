// Textos de oferta compartidos: precios para mostrar, prueba gratis y tipografía de marcas.
// Precios: siempre en USD con punto decimal y dos decimales ($5.00, $7.50, $59.99),
// para que no convivan "$5" y "$59.99" en la misma pantalla. Los montos salen de plans.ts.
export const money = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;

/** Días de prueba gratis con todo incluido, contados desde la creación de la cuenta (sin tarjeta). */
export const TRIAL_DAYS = 7;

/** Fin de la prueba a partir de la fecha de creación de la cuenta (ISO). Null si la fecha no es válida. */
export function trialEnd(createdAt: string | null | undefined): Date | null {
  if (!createdAt) return null;
  const t = Date.parse(createdAt);
  return Number.isFinite(t) ? new Date(t + TRIAL_DAYS * 864e5) : null;
}

/** "GLP-1" con guion no separable (U+2011) para que nunca se parta en dos líneas. Solo para texto visible. */
export const GLP1 = "GLP‑1";
export const noBreakGlp1 = (s: string) => s.replaceAll("GLP-1", GLP1);

/* ───────────── Embudo de la prueba gratis ───────────── */

export type TrialNudge = { day: number; tone: "start" | "calm" | "warn" | "last"; title: string; body: string; cta: string };

/**
 * Aviso dentro de la app según el día de la prueba (día 1, días 5 y 6, día 7 tienen mensaje propio).
 * `daysLeft` viene de entitlements (redondeado hacia arriba, mínimo 1). Honesto: sin tarjeta no hay cobro automático.
 */
export function trialNudge(daysLeft: number, trialDays = TRIAL_DAYS): TrialNudge {
  const left = Math.max(1, Math.min(trialDays, Math.round(daysLeft)));
  const day = trialDays - left + 1;
  if (left === 1) return { day, tone: "last", title: "Hoy termina tu prueba gratis", body: "Elige tu plan hoy y mañana sigues sin cortes. Tu progreso queda guardado.", cta: "Elegir plan" };
  if (day === 1) return { day, tone: "start", title: `Tu prueba gratis de ${trialDays} días empezó`, body: "Tienes todo incluido y no pediremos tarjeta. Haz tu primer entreno hoy.", cta: "Ver planes" };
  if (left <= 3) return { day, tone: "warn", title: `Te quedan ${left} días de prueba`, body: "Elige tu plan antes de que termine y no pierdes tu racha.", cta: "Elegir plan" };
  return { day, tone: "calm", title: `Te quedan ${left} días de prueba`, body: "Con todo incluido.", cta: "Elegir plan" };
}

/** Uso de la prueba que se muestra en el muro de planes. */
export type TrialUsage = { workouts: number; firstKg: number | null; lastKg: number | null; meals: number; glp1: boolean };

/** Plan recomendado según lo que la persona usó: si registró comidas o usa GLP-1, el plan con nutrición. */
export function recommendPlan(u: Pick<TrialUsage, "meals" | "glp1">): "entreno" | "completo" {
  return u.meals > 0 || u.glp1 ? "completo" : "entreno";
}

const kgFmt = (n: number) => n.toLocaleString("es-419", { maximumFractionDigits: 1 });

/** "Llevas 5 entrenos y −1.2 kg". Solo cifras reales y solo si hay algo que contar. */
export function progressLine(u: Pick<TrialUsage, "workouts" | "firstKg" | "lastKg">): string | null {
  const parts: string[] = [];
  if (u.workouts > 0) parts.push(`${u.workouts} ${u.workouts === 1 ? "entreno" : "entrenos"}`);
  const delta = u.firstKg != null && u.lastKg != null ? Math.round((u.lastKg - u.firstKg) * 10) / 10 : 0;
  if (delta <= -0.1) parts.push(`−${kgFmt(-delta)} kg`);
  if (!parts.length) return null;
  return `Llevas ${parts.join(" y ")}`;
}
