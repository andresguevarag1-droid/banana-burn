// Seguro en cliente y servidor (sin dependencias de Node).

/**
 * Devuelve `raw` solo si es una ruta relativa del mismo sitio ("/app/x?y=1#z"); si no, `fallback`.
 * Rechaza URLs absolutas, protocolo-relativas ("//evil"), barras invertidas ("/\\evil"), esquemas (javascript:) y
 * caracteres de control, que algunos navegadores normalizan hacia otro origen.
 */
export function safeNext(raw: unknown, fallback = "/app"): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  try {
    const base = "https://same-origin.invalid";
    const u = new URL(raw, base);
    if (u.origin !== base) return fallback;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return fallback;
  }
}
