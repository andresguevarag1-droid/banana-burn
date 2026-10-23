// Planes y precios de Banana Burn (USD). Fuente única para landing, app y pagos.
import { coachPlanFeat } from "@/lib/coach-quota";
export type PlanId = "entreno" | "completo";
export type Billing = "mes" | "anual";

/**
 * Qué incluye cada plan. Es la fuente única para precios, landing, app, muro de planes y llms.txt:
 * cada frase debe corresponder a algo que el plan da de verdad (la regla de acceso vive en entitlements.ts).
 * `excluded`: lo que el plan NO incluye, para mostrarlo tachado sin prometer de más.
 */
export const PLANS: { id: PlanId; name: string; tagline: string; nutrition: boolean; price: Record<Billing, number>; feats: string[]; excluded: string[] }[] = [
  {
    id: "entreno", name: "Entreno", tagline: "Tu entrenador personal en el celular", nutrition: false,
    price: { mes: 9.99, anual: 59.99 },
    feats: [
      "Rutina hecha a tu nivel, tiempo y equipo",
      "Reproductor con animaciones de técnica y biblioteca de ejercicios",
      "Progresión automática de cargas y entrenos exprés",
      coachPlanFeat("entreno"),
      "Progreso de peso, medidas, fuerza y fotos",
      "Registro de agua, pasos y sueño",
      "Comunidad y retos gratis",
      "Niveles, XP y rachas",
    ],
    excluded: ["Calorías y macros calculados para ti", "Registro de comidas, recetas y menú", "Banana Shield para GLP-1"],
  },
  {
    id: "completo", name: "Entreno + Nutrición", tagline: "El plan completo para bajar de peso", nutrition: true,
    price: { mes: 14.99, anual: 89.99 },
    feats: [
      "Todo lo de Entreno",
      "Calorías y macros calculados para ti",
      "Registro de comidas con alimentos latinos, Mis recetas y Armar plato",
      "Recetas latinas y Menú flash con lo que te falta hoy",
      "Ajuste semanal según tu peso real",
      "Banana Shield para personas en GLP-1",
      coachPlanFeat("completo"),
    ],
    excluded: [],
  },
];

/** Los retos Premium nunca vienen dentro de un plan: se compran aparte. */
export const PREMIUM_RETOS_NOTE = "Los retos Premium se compran aparte con un pago único, en cualquier plan. Subir de nivel te da descuento en ellos.";

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
 * La base de datos repite la fecha en public._has_app_access() (0021) y public._has_nutrition_access() (0022): si la cambias, cámbiala también allí.
 */
export const BETA_ENDS_AT = process.env.NEXT_PUBLIC_BETA_ENDS_AT || "2026-11-01T06:00:00.000Z";
export const betaLive = (now = new Date()) => now.getTime() < Date.parse(BETA_ENDS_AT);

/** ¿El plan incluye nutrición y Banana Shield? Solo `completo` (y el histórico `pro`). La prueba gratis se resuelve en entitlements.ts. */
export function hasNutrition(plan: string | null | undefined) {
  return plan === "completo" || plan === "pro";
}
