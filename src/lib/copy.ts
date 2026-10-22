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
