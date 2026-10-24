// Reportes de errores sin datos personales. Lo usan el navegador (antes de mandar), el endpoint /api/errores (antes de
// guardar) y el registro del servidor. Sin dependencias: corre en cualquier runtime.
//
// Regla: de un error solo guardamos QUÉ falló y DÓNDE (tipo, mensaje limpio, ruta sin parámetros, digest, versión).
// Nunca el usuario, la IP, el cuerpo de la petición, la query string ni el stack completo.

export const REPORT_SOURCES = ["client", "boundary", "server"] as const;
export type ReportSource = (typeof REPORT_SOURCES)[number];

export type ErrorReport = {
  source: ReportSource;
  /** Tipo corto: TypeError, ChunkLoadError, unhandledrejection, http_500… */
  kind: string;
  /** Mensaje limpio (sin correos, números, ids ni tokens), máx. 300 caracteres. */
  message: string;
  /** Ruta sin query ni ids: /app/retos/:id */
  route: string;
  /** Digest de Next (une el error de la pantalla con el log del servidor). */
  digest: string | null;
  /** Versión del deploy (commit corto o id del deploy). */
  release: string | null;
  /** Familia del navegador (chrome, safari, firefox, edge, samsung, otro): sin versión ni sistema. */
  browser: string | null;
};

export const MAX_BODY = 4096;
export const MAX_MESSAGE = 300;
export const MAX_ROUTE = 120;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const URL_RE = /\bhttps?:\/\/[^\s"'<>)]+/gi;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
// Tokens, llaves, JWT, hashes: JWT (eyJ…), 20+ caracteres seguidos con algún número, o 40+ caracteres seguidos.
const TOKEN = /\beyJ[A-Za-z0-9_\-.]+|\b(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{20,}\b|\b[A-Za-z0-9_-]{40,}\b/g;
// Números de 3+ cifras (teléfonos, cédulas, montos, tarjetas): se reemplazan. Los de 1–2 cifras ("línea 2") quedan.
const DIGITS = /\d[\d\s().-]{1,}\d/g;

/** Solo la ruta de una URL, sin dominio externo ni query: "https://x.com/a?b" -> "x.com/a". */
function shortUrl(u: string): string {
  try {
    const x = new URL(u);
    return `${x.host}${x.pathname}`.slice(0, 80);
  } catch {
    return "[url]";
  }
}

/** Mensaje de error sin datos personales. */
export function scrubMessage(raw: unknown, max = MAX_MESSAGE): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(URL_RE, (u) => shortUrl(u))
    .replace(EMAIL, "[correo]")
    .replace(UUID, "[id]")
    .replace(TOKEN, "[token]")
    .replace(DIGITS, (m) => (m.replace(/\D/g, "").length >= 3 ? "[n]" : m))
    .replace(/\d{3,}/g, "[n]")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Segmento que parece un dato (id, código, usuario, número) y no una sección fija de la app. */
function isDataSegment(seg: string): boolean {
  return /\d/.test(seg) || seg.length > 24 || /^[0-9a-f-]{16,}$/i.test(seg);
}

/**
 * Ruta sin datos: quita dominio, query y hash; los segmentos con ids pasan a ":id". Las rutas con un nombre o código
 * en la URL (/r/<código>, /app/comunidad/u/<usuario>) pierden siempre ese segmento.
 */
export function cleanRoute(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "/";
  let path = raw;
  try { path = new URL(raw, "http://x").pathname; } catch { path = raw.split(/[?#]/)[0]; }
  path = path.replace(/\/{2,}/g, "/");
  const segs = path.split("/").filter(Boolean).slice(0, 8);
  const out = segs.map((s, i) => {
    let seg = s;
    try { seg = decodeURIComponent(s); } catch { /* segmento con % roto: se trata como dato */ return ":id"; }
    const prev = segs[i - 1];
    if (prev === "r" && i === 1) return ":codigo";
    if (prev === "u") return ":usuario";
    if (isDataSegment(seg) || !/^[a-z0-9_.()\[\]-]+$/i.test(seg)) return ":id";
    return seg.toLowerCase();
  });
  return (`/${out.join("/")}`).slice(0, MAX_ROUTE);
}

/** Familia del navegador a partir del User-Agent. Nada más (ni versión ni sistema): no sirve para identificar a nadie. */
export function browserFamily(ua: unknown): string | null {
  if (typeof ua !== "string" || !ua) return null;
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/Edg\//i.test(ua)) return "edge";
  if (/Firefox\//i.test(ua)) return "firefox";
  if (/Chrome\//i.test(ua) || /CriOS/i.test(ua)) return "chrome";
  if (/Safari\//i.test(ua)) return "safari";
  if (/bot|crawl|spider/i.test(ua)) return "bot";
  return "otro";
}

const KIND = /^[A-Za-z][A-Za-z0-9_.:-]{0,39}$/;
const DIGEST = /^[A-Za-z0-9_-]{1,64}$/;
const RELEASE = /^[A-Za-z0-9_.-]{1,40}$/;

/**
 * Valida y limpia un reporte que llega del navegador (o de cualquiera: el endpoint es público). Devuelve null si no
 * sirve. Campos desconocidos se ignoran. La fuente "server" no se acepta desde afuera.
 */
export function cleanReport(raw: unknown, ua?: string | null): ErrorReport | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const b = raw as Record<string, unknown>;
  const source = b.source === "boundary" ? "boundary" : b.source === "client" ? "client" : null;
  if (!source) return null;
  const kind = typeof b.kind === "string" && KIND.test(b.kind) ? b.kind : "Error";
  const message = scrubMessage(b.message);
  const digest = typeof b.digest === "string" && DIGEST.test(b.digest) ? b.digest : null;
  if (!message && !digest) return null;
  return {
    source,
    kind,
    message,
    route: cleanRoute(b.route),
    digest,
    release: typeof b.release === "string" && RELEASE.test(b.release) ? b.release : null,
    browser: browserFamily(ua),
  };
}

/** Errores que no son nuestros o no se pueden accionar: extensiones, scripts de otros dominios, ruido del navegador. */
const NOISE = /ResizeObserver loop|^Script error\.?$|chrome-extension:|moz-extension:|safari-(web-)?extension:|Non-Error promise rejection captured|AbortError|The operation was aborted|NEXT_REDIRECT|NEXT_NOT_FOUND/i;
export function isNoise(message: string, kind = ""): boolean {
  return NOISE.test(message) || NOISE.test(kind);
}

/** Huella para agrupar el mismo error (misma fuente, tipo, ruta y mensaje). Sin criptografía: corre en el navegador. */
export function fingerprint(r: Pick<ErrorReport, "source" | "kind" | "route" | "message">): string {
  const s = `${r.source}|${r.kind}|${r.route}|${r.message.slice(0, 120)}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
