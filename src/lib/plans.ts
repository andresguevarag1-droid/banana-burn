// Planes y precios de Banana Burn (USD). Fuente única para landing, app y pagos.
export type PlanId = "entreno" | "completo";
export type Billing = "mes" | "anual";

export const PLANS: { id: PlanId; name: string; tagline: string; nutrition: boolean; price: Record<Billing, number>; feats: string[] }[] = [
  {
    id: "entreno", name: "Entreno", tagline: "Tu entrenador personal con IA", nutrition: false,
    price: { mes: 9.99, anual: 59.99 },
    feats: ["Rutina hecha a tu nivel, tiempo y equipo", "Reproductor con animaciones de técnica", "Progresión automática de cargas", "Coach IA 24/7 para tu entreno", "Progreso de peso y fuerza", "Rachas, niveles y logros"],
  },
  {
    id: "completo", name: "Entreno + Nutrición", tagline: "El plan completo para bajar de peso", nutrition: true,
    price: { mes: 14.99, anual: 89.99 },
    feats: ["Todo lo de Entreno", "Banana Shield para personas en GLP-1", "Calorías y macros calculados para ti", "Registro de comidas con alimentos latinos", "Ajuste semanal según tu peso real", "Coach IA también para tu comida", "Ideas de menú latino día a día"],
  },
];

export const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
/** Ahorro del plan anual vs. pagar 12 meses. */
export const annualSavingPct = (p: (typeof PLANS)[number]) => Math.round((1 - p.price.anual / (p.price.mes * 12)) * 100);
export const perMonthAnnual = (p: (typeof PLANS)[number]) => Math.round((p.price.anual / 12) * 100) / 100;

/** Días de prueba gratis con todo incluido, contados desde la creación de la cuenta (profiles.created_at). */
export const TRIAL_DAYS = 7;

/**
 * Período de prueba del servicio (beta): hasta esta fecha todas las cuentas tienen acceso completo y gratis.
 * Desde aquí se aplican las reglas normales (prueba de 7 días desde el registro y luego plan de pago).
 * Medianoche del 1 de noviembre de 2026 en Costa Rica. Se puede mover con NEXT_PUBLIC_BETA_ENDS_AT (ISO).
 * La base de datos repite la fecha en public._has_app_access() (0021): si la cambias, cámbiala también allí.
 */
export const BETA_ENDS_AT = process.env.NEXT_PUBLIC_BETA_ENDS_AT || "2026-11-01T06:00:00.000Z";
export const betaLive = (now = new Date()) => now.getTime() < Date.parse(BETA_ENDS_AT);

/** ¿El plan incluye nutrición y Banana Shield? Solo `completo` (y el histórico `pro`). La prueba gratis se resuelve en entitlements.ts. */
export function hasNutrition(plan: string | null | undefined) {
  return plan === "completo" || plan === "pro";
}
