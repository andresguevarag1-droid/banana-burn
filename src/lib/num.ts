/** Fracción segura para barras, anillos y porcentajes: 0 si el divisor es 0 o algo no es un número. Nunca NaN ni Infinity. */
export function frac(value: number, total: number): number {
  const f = value / total;
  return Number.isFinite(f) ? f : 0;
}

/** Recorta a [lo, hi]; un valor no numérico cae en `lo`. */
export const clamp01 = (x: number, lo = 0, hi = 1) => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : lo);

// Cifras como pide la marca (libro de marca, "números es-419"): coma decimal y punto de miles: 1.276 ejercicios,
// 2,5 kg, 93,1 kg. Ojo: el locale "es-419" de Intl usa lo contrario (1,276 y 93.1), por eso se usa "es-CO", que da
// exactamente este formato. Los precios en USD siguen su propia regla en copy.ts (money).
export const NUM_LOCALE = "es-CO";

/** Número con el formato de la marca. `max` y `min` son los decimales. */
export const nfmt = (n: number, max = 1, min = 0) => n.toLocaleString(NUM_LOCALE, { minimumFractionDigits: min, maximumFractionDigits: max });

/**
 * Textos guardados con miles en coma ("10,000 pasos", de la siembra 0018/0033 o del panel) a punto de miles
 * ("10.000 pasos"). Solo toca grupos de exactamente tres dígitos tras la coma, así "2,5 kg" queda igual.
 */
export const fixThousands = (s: string) => s.replace(/\b(\d{1,3})((?:,\d{3})+)\b/g, (_, a: string, rest: string) => a + rest.replaceAll(",", "."));
