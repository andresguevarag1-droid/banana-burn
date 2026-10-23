// Registro de errores sin datos personales (datos de salud y de pago). Seguro en cualquier runtime.

/**
 * Lo mínimo para diagnosticar un error: tipo, estado HTTP y código. Nunca el mensaje completo ni el cuerpo de la
 * respuesta: los errores de ONVO, Resend o PostgREST pueden repetir el correo, el nombre o los valores de la fila.
 */
export function errInfo(e: unknown): { name: string; status?: number; code?: string } {
  if (!e || typeof e !== "object") return { name: typeof e };
  const o = e as { name?: unknown; status?: unknown; statusCode?: unknown; code?: unknown };
  const out: { name: string; status?: number; code?: string } = { name: typeof o.name === "string" ? o.name.slice(0, 60) : "Error" };
  const status = typeof o.status === "number" ? o.status : typeof o.statusCode === "number" ? o.statusCode : undefined;
  if (status !== undefined) out.status = status;
  if (typeof o.code === "string" || typeof o.code === "number") out.code = String(o.code).slice(0, 40);
  return out;
}
