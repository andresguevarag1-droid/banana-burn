// Planes y precios de Banana Burn (USD). Fuente única para landing, app y pagos.
export type PlanId = "entreno" | "completo";
export type Billing = "mes" | "anual";

export const PLANS: { id: PlanId; name: string; tagline: string; nutrition: boolean; price: Record<Billing, number>; feats: string[] }[] = [
  {
    id: "entreno", name: "Entreno", tagline: "Tu entrenador personal con IA", nutrition: false,
    price: { mes: 9.99, anual: 59.99 },
    feats: ["Rutina distinta cada día, sin repetir", "Reproductor con animaciones de técnica", "Progresión automática de cargas", "Coach IA 24/7 para tu entreno", "Progreso de peso y fuerza", "Rachas, niveles y logros"],
  },
  {
    id: "completo", name: "Entreno + Nutrición", tagline: "El plan completo para bajar de peso", nutrition: true,
    price: { mes: 14.99, anual: 89.99 },
    feats: ["Todo lo de Entreno", "🛡️ Banana Shield para personas en GLP-1", "Calorías y macros calculados para ti", "Registro de comidas con alimentos ticos", "Ajuste semanal según tu peso real", "Coach IA también para tu comida", "Ideas de menú tico día a día"],
  },
];

export const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
/** Ahorro del plan anual vs. pagar 12 meses. */
export const annualSavingPct = (p: (typeof PLANS)[number]) => Math.round((1 - p.price.anual / (p.price.mes * 12)) * 100);
export const perMonthAnnual = (p: (typeof PLANS)[number]) => Math.floor((p.price.anual / 12) * 100) / 100;

/** ¿El plan del usuario incluye nutrición? (`pro`/`completo` sí; `entreno` no). Sin plan de pago aún = acceso libre en beta. */
export function hasNutrition(plan: string | null | undefined) {
  return plan !== "entreno";
}
