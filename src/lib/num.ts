/** Fracción segura para barras, anillos y porcentajes: 0 si el divisor es 0 o algo no es un número. Nunca NaN ni Infinity. */
export function frac(value: number, total: number): number {
  const f = value / total;
  return Number.isFinite(f) ? f : 0;
}

/** Recorta a [lo, hi]; un valor no numérico cae en `lo`. */
export const clamp01 = (x: number, lo = 0, hi = 1) => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : lo);
