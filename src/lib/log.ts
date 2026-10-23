// Registro de fallas del servidor: una línea por evento, con área y código, sin datos personales.
// Nunca se registran mensajes de error crudos (pueden traer correos, nombres o contenido del usuario),
// solo su tipo, su código y su estado HTTP.

type Extra = Record<string, string | number | boolean | null | undefined>;

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

/** Una línea legible y filtrable en los logs de Vercel: `[area] codigo {"k":"v"}`. */
export function formatLog(area: string, code: string, extra?: Extra): string {
  const clean: Extra = {};
  for (const [k, v] of Object.entries(extra ?? {})) if (v !== undefined) clean[k] = typeof v === "string" ? v.slice(0, 120) : v;
  const tail = Object.keys(clean).length ? ` ${JSON.stringify(clean)}` : "";
  return `[${area}] ${code}${tail}`;
}

export function logError(area: string, code: string, extra?: Extra) {
  console.error(formatLog(area, code, extra));
}

export function logWarn(area: string, code: string, extra?: Extra) {
  console.warn(formatLog(area, code, extra));
}
