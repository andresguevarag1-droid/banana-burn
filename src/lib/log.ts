// Registro de fallas del servidor: una línea JSON por evento, con área y código, sin datos personales.
// Nunca se registran mensajes de error crudos (pueden traer correos, nombres o contenido del usuario),
// solo su tipo, su código y su estado HTTP. Vercel indexa cada línea JSON: se filtra por "area" o "code".

type Extra = Record<string, string | number | boolean | null | undefined>;
export type LogLevel = "error" | "warn" | "info";

/** Código seguro de un error desconocido: code de Postgres/Supabase, estado HTTP o nombre del tipo. Nunca el mensaje. */
export function errCode(e: unknown): string {
  if (!e || typeof e !== "object") return typeof e === "string" ? "string" : "unknown";
  const x = e as { code?: unknown; status?: unknown; statusCode?: unknown; name?: unknown };
  if (typeof x.code === "string" && /^[A-Za-z0-9_.-]{1,40}$/.test(x.code)) return x.code;
  const status = typeof x.status === "number" ? x.status : typeof x.statusCode === "number" ? x.statusCode : null;
  if (status) return `http_${status}`;
  if (typeof x.name === "string" && /^[A-Za-z0-9_]{1,40}$/.test(x.name)) return x.name;
  return "error";
}

/** Extra acotado: sin undefined, textos de máx. 120 caracteres, máx. 12 llaves. Las llaves con nombre de dato personal se descartan. */
const PII_KEY = /^(email|correo|name|nombre|phone|telefono|ip|address|direccion|token|password|clave|body|content|message|mensaje)$/i;
function cleanExtra(extra?: Extra): Extra {
  const clean: Extra = {};
  let n = 0;
  for (const [k, v] of Object.entries(extra ?? {})) {
    if (v === undefined || PII_KEY.test(k) || n >= 12) continue;
    clean[k] = typeof v === "string" ? v.slice(0, 120) : v;
    n++;
  }
  return clean;
}

/** Una línea legible y filtrable en los logs de Vercel: `[area] codigo {"k":"v"}`. */
export function formatLog(area: string, code: string, extra?: Extra): string {
  const clean = cleanExtra(extra);
  const tail = Object.keys(clean).length ? ` ${JSON.stringify(clean)}` : "";
  return `[${area}] ${code}${tail}`;
}

const release = () => (process.env.VERCEL_GIT_COMMIT_SHA || process.env.BB_RELEASE || process.env.BB_BUILD_ID || "").slice(0, 7) || null;

/** Línea JSON: {"level","area","code",...extra,"release","at"}. Área y código acotados a [A-Za-z0-9_.:-]. */
export function jsonLog(level: LogLevel, area: string, code: string, extra?: Extra, now = new Date()): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9_.:-]/g, "_").slice(0, 60);
  return JSON.stringify({ level, area: safe(area), code: safe(code), ...cleanExtra(extra), release: release(), at: now.toISOString() });
}

/**
 * Destino extra para errores (la tabla app_errors, ver lib/monitor/server.ts). Lo registra instrumentation.ts en el
 * runtime de Node; sin registrar (pruebas, edge, navegador) solo queda la línea del log.
 */
type Sink = (area: string, code: string, extra: Extra) => void;
let sink: Sink | null = null;
export function setErrorSink(fn: Sink | null) { sink = fn; }

export function logError(area: string, code: string, extra?: Extra) {
  console.error(jsonLog("error", area, code, extra));
  if (sink) { try { sink(area, code, cleanExtra(extra)); } catch { /* el registro nunca rompe la petición */ } }
}

export function logWarn(area: string, code: string, extra?: Extra) {
  console.warn(jsonLog("warn", area, code, extra));
}

export function logInfo(area: string, code: string, extra?: Extra) {
  console.info(jsonLog("info", area, code, extra));
}
