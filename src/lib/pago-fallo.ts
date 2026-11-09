// Por qué no se completó un pago (#296). Pura, sin "server-only": la usan el servidor, el navegador y las pruebas.
// Se guarda SOLO un código corto del procesador o nuestro (nunca datos de la tarjeta, tokens ni textos libres) y de él
// salen el mensaje para la persona y la etiqueta para /admin/pagos.

/** Tipo de la fila en payment_events. /admin/pagos la lista con los cobros rechazados (type ilike %failed%). */
export const PAYMENT_FAILED = "app.payment_failed";

export type FailProvider = "onvo" | "tilopay";
export const FAIL_PROVIDERS: readonly FailProvider[] = ["onvo", "tilopay"];

/** Dónde se cayó: dejar la tarjeta, abrir el pago, la vuelta del banco (3D Secure) o la confirmación con el procesador. */
export const FAIL_STAGES = ["tarjeta", "checkout", "vuelta", "confirmacion"] as const;
export type FailStage = (typeof FAIL_STAGES)[number];

/** Qué le pasó a la persona, en pocas clases. */
export const FAIL_KINDS = ["rechazada", "verificacion", "fondos", "datos", "vencida", "conexion", "sin_confirmar", "abandono", "vencido", "error"] as const;
export type FailKind = (typeof FAIL_KINDS)[number];

export const isFailKind = (x: unknown): x is FailKind => (FAIL_KINDS as readonly unknown[]).includes(x);
export const isFailStage = (x: unknown): x is FailStage => (FAIL_STAGES as readonly unknown[]).includes(x);
export const isFailProvider = (x: unknown): x is FailProvider => x === "onvo" || x === "tilopay";

/** Código seguro: letras, números, punto, guion y guion bajo, máx. 40, en minúsculas. Cualquier otra cosa = null. */
export function safeCode(x: unknown): string | null {
  if (typeof x === "number" && Number.isFinite(x)) x = String(x);
  if (typeof x !== "string") return null;
  const s = x.trim().toLowerCase();
  return /^[a-z0-9_.-]{1,40}$/.test(s) ? s : null;
}

// Nuestros propios códigos (no vienen del procesador).
const OWN: Record<string, FailKind> = {
  abandono: "abandono", abandono_3ds: "verificacion", sin_confirmar: "sin_confirmar", sin_tarjeta: "abandono", vencido: "vencido",
  conexion: "conexion", red: "conexion", timeouterror: "conexion", aborterror: "conexion", typeerror: "conexion",
};

/**
 * Clase de un código. ONVO manda razones como issuer_declined o insufficient_funds; Tilopay devuelve code=1 si se aprobó y
 * cualquier otro valor si no. `hint` es la descripción del procesador: solo se usa aquí para reconocer 3D Secure o fondos y
 * NUNCA se guarda.
 */
export function failKind(code: string | null | undefined, hint?: string | null): FailKind {
  const c = (code ?? "").toLowerCase();
  const h = (hint ?? "").toLowerCase();
  if (OWN[c]) return OWN[c];
  const both = `${c} ${h}`;
  if (/3ds|3-d|three_d|authenticat|autentica|verificaci|challenge/.test(both)) return "verificacion";
  if (/insufficient|fondos|funds/.test(both)) return "fondos";
  if (/expired|vencid|caducad/.test(both)) return "vencida";
  if (/invalid_card|incorrect|invalid_number|invalid_cvc|invalid_expiry|cvv|cvc/.test(both)) return "datos";
  if (/timeout|network|conexi|processor_error|http_5|tilopay_5|onvo_5/.test(both)) return "conexion";
  if (/declin|rechaz|denied|denegad|not_permitted|do_not_honor|fraud|lost|stolen|restricted/.test(both)) return "rechazada";
  // Tilopay: code distinto de "1" = rechazado por el banco.
  if (/^\d{1,4}$/.test(c) && c !== "1") return "rechazada";
  return "error";
}

/** Lo que ve la persona, en palabras simples. */
export const FAIL_MESSAGE: Record<FailKind, string> = {
  rechazada: "Tu banco no aprobó el cobro. Prueba con otra tarjeta o pide a tu banco activar las compras internacionales en dólares.",
  verificacion: "No terminaste la verificación de tu banco. Vuelve a intentarlo y completa el código que te pide tu banco.",
  fondos: "Tu tarjeta no tiene fondos suficientes para este cobro. Prueba con otra tarjeta.",
  datos: "Algún dato de la tarjeta no coincide. Revisa el número, el vencimiento y el código de seguridad.",
  vencida: "Tu tarjeta está vencida. Prueba con otra.",
  conexion: "Se perdió la conexión con el procesador de pagos. Revisa tu internet e intenta de nuevo.",
  sin_confirmar: "Todavía no tenemos la respuesta de tu banco. Si lo aprueba, tu plan se activa solo. No vuelvas a pagar por ahora.",
  abandono: "El pago no se terminó y no se hizo ningún cobro.",
  vencido: "El enlace de pago venció. Vuelve a intentarlo.",
  error: "No pudimos terminar el pago. Intenta de nuevo en un momento.",
};

/** Etiqueta corta para el equipo en /admin/pagos. */
export const FAIL_LABEL: Record<FailKind, string> = {
  rechazada: "Banco rechazó", verificacion: "No terminó 3D Secure", fondos: "Sin fondos", datos: "Datos de tarjeta",
  vencida: "Tarjeta vencida", conexion: "Sin conexión con el procesador", sin_confirmar: "Sin confirmar con el procesador",
  abandono: "No terminó el pago", vencido: "Enlace vencido", error: "Error",
};

/** ¿Tiene sentido ofrecer reintentar ya? Sin confirmar, no: podría cobrarse dos veces. */
export const canRetry = (k: FailKind) => k !== "sin_confirmar";

const PROVIDER_NAME: Record<FailProvider, string> = { onvo: "ONVO", tilopay: "Tilopay" };
const STAGE_NAME: Record<FailStage, string> = { tarjeta: "al dejar la tarjeta", checkout: "al abrir el pago", vuelta: "al volver del banco", confirmacion: "al confirmar" };

/** Nota que se guarda en payment_events y se ve en /admin/pagos, p. ej. "Tilopay, al volver del banco: Banco rechazó (código 2)". */
export function failNote(provider: FailProvider, stage: FailStage, code: string, kind: FailKind = failKind(code)): string {
  return `${PROVIDER_NAME[provider]}, ${STAGE_NAME[stage]}: ${FAIL_LABEL[kind]} (código ${code})`;
}

/**
 * Motivo de una suscripción sin completar para /admin/pagos: el guardado (payment_failed) o, si no hay, lo que se sabe por
 * el tiempo: en curso las primeras 2 horas; después, la persona no volvió del pago (cerró la página o la verificación del banco).
 */
export function pendingReason(s: { status?: string | null; created_at?: string | null }, saved: string | null | undefined, now = new Date()): string | null {
  if (saved) return saved;
  if (s.status !== "incomplete") return null;
  const age = s.created_at ? now.getTime() - Date.parse(s.created_at) : Infinity;
  return age < 2 * 3600_000 ? "Pago en curso" : "Sin respuesta del procesador: no volvió del pago (cerró la página o no terminó la verificación del banco)";
}

/**
 * Adónde vuelve la persona desde Tilopay: Mi plan con el resultado (?tilopay=) y, si no se completó, el motivo (?motivo=), si
 * era tarjeta o pago (?para=) y el mismo plan y periodo (?plan=&pago=) para reintentar con un toque.
 */
export function tilopayReturnPath(result: string, s?: { p: "tarjeta" | "pago"; plan: string; billing: string } | null, kind?: FailKind): string {
  const q = new URLSearchParams({ tilopay: result });
  if (kind) q.set("motivo", kind);
  if (s && result !== "tarjeta_ok" && result !== "pago_ok") { q.set("para", s.p); q.set("plan", s.plan); q.set("pago", s.billing); }
  return `/app/suscripcion?${q}#tarjeta`;
}
