/** Fracción segura para barras, anillos y porcentajes: 0 si el divisor es 0 o algo no es un número. Nunca NaN ni Infinity. */
export function frac(value: number, total: number): number {
  const f = value / total;
  return Number.isFinite(f) ? f : 0;
}

/** Recorta a [lo, hi]; un valor no numérico cae en `lo`. */
export const clamp01 = (x: number, lo = 0, hi = 1) => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : lo);

// Cifras de la app en formato es-419 (regla del dueño): punto decimal y coma de miles: 1,276 ejercicios, 93.1 kg,
// 2.5 kg, 8,000 pasos. Precios: $6.99 (copy.ts money y challenges.ts usd). Los correos tienen su propio formato.
export const NUM_LOCALE = "es-419";

/** Número con el formato de la app. `max` y `min` son los decimales. */
export const nfmt = (n: number, max = 1, min = 0) => n.toLocaleString(NUM_LOCALE, { minimumFractionDigits: min, maximumFractionDigits: max });

/**
 * Textos escritos a mano con el formato contrario (la siembra de retos y programas, guardada tal cual en las migraciones
 * 0018, 0024, 0028 y 0033, o lo que escriba el panel): "8.000 pasos" pasa a "8,000 pasos" y "0,5 kg" a "0.5 kg".
 * Solo toca miles de exactamente tres dígitos tras el punto y decimales de uno o dos dígitos tras la coma, así
 * "10,000", "93.1" o "8 vasos, 3 comidas" quedan igual.
 */
export const es419Text = (s: string) =>
  s
    .replace(/(?<![\d.,])(\d{1,3})((?:\.\d{3})+)(?![\d.,]*\d)/g, (_, a: string, rest: string) => a + rest.replaceAll(".", ","))
    .replace(/(?<![\d.,])(\d+),(\d{1,2})(?![\d,])/g, "$1.$2");

const KEEP = new Set(["id", "slug", "cover", "icon", "verify", "startMode", "startDate", "status", "kind", "key", "coach", "tempo", "source"]);

/** Aplica es419Text a todos los textos de un objeto de datos (sin tocar ids, claves ni funciones). */
export function es419Deep<T>(x: T): T {
  if (typeof x === "string") return es419Text(x) as T;
  if (Array.isArray(x)) return x.map((v) => es419Deep(v)) as T;
  if (x && typeof x === "object" && Object.getPrototypeOf(x) === Object.prototype) {
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, KEEP.has(k) || typeof v === "function" ? v : es419Deep(v)])) as T;
  }
  return x;
}
