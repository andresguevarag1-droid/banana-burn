// Validación del formulario de tarjeta en el navegador (pura, testeada). Mismas reglas que pide ONVO para no recibir un 400
// (https://docs.onvopay.com/en/api/crear-un-metodo-de-pago): nombre no vacío, número solo dígitos y con Luhn válido,
// mes 1 a 12, año de 4 dígitos entre 2023 y 2100, CVV de 3 o 4 dígitos. Estos datos nunca se mandan a nuestro servidor.

export const onlyDigits = (s: string) => s.replace(/\D/g, "");

/** Algoritmo de Luhn. */
export function luhnOk(num: string): boolean {
  const d = onlyDigits(num);
  if (d.length < 12 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}

/** "4242424242424242" -> "4242 4242 4242 4242" (máx. 19 dígitos). */
export const formatCardNumber = (s: string) => onlyDigits(s).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");

/** "1229", "12/29" o "12/2029" -> "12/29" mientras se escribe. */
export function formatExp(s: string): string {
  const d = onlyDigits(s).slice(0, 6);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** Vencimiento a { mes, año de 4 dígitos }. null si no es válido o ya venció. */
export function parseExp(s: string, now = new Date()): { month: number; year: number } | null {
  const m = /^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/.exec(s.trim());
  if (!m) return null;
  const month = Number(m[1]);
  const year = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  if (month < 1 || month > 12 || year < 2023 || year > 2100) return null;
  const endOfMonth = new Date(Date.UTC(year, month, 1));
  return endOfMonth.getTime() > now.getTime() ? { month, year } : null;
}

export type CardInput = { holder: string; number: string; exp: string; cvv: string };
export type CardErrors = Partial<Record<keyof CardInput, string>>;

export function cardInputErrors(c: CardInput, now = new Date()): CardErrors {
  const e: CardErrors = {};
  if (!c.holder.trim()) e.holder = "Escribe el nombre como aparece en la tarjeta.";
  if (!luhnOk(c.number)) e.number = "Revisa el número de la tarjeta.";
  if (!parseExp(c.exp, now)) e.exp = "Revisa el vencimiento (MM/AA).";
  if (!/^\d{3,4}$/.test(c.cvv)) e.cvv = "El código de seguridad tiene 3 o 4 dígitos.";
  return e;
}

/** Cuerpo para POST https://api.onvopay.com/v1/payment-methods (lo manda el navegador con la llave publicable). */
export function onvoCardBody(c: CardInput, customerId: string, now = new Date()) {
  const exp = parseExp(c.exp, now)!;
  return { type: "card", customerId, card: { holderName: c.holder.trim().slice(0, 80), number: onlyDigits(c.number), expMonth: exp.month, expYear: exp.year, cvv: c.cvv } };
}

/** Mensaje para la persona a partir del error de ONVO al crear la tarjeta. No se interpretan códigos del banco (ONVO pide no hacerlo). */
export function onvoCardError(body: unknown): string {
  const b = body && typeof body === "object" ? (body as { code?: unknown; message?: unknown; details?: { card?: { reason?: unknown } } }) : {};
  const reason = b.details?.card?.reason;
  if (b.code === "cards.invalid_card_info") return "Revisa los datos de tu tarjeta e intenta de nuevo.";
  if (reason === "issuer_declined") return "Tu banco rechazó la tarjeta. Prueba con otra o llama a tu banco.";
  if (reason === "gateway_declined") return "La tarjeta fue rechazada. Revisa los datos o prueba con otra.";
  if (reason === "processor_error") return "El procesador de pagos tuvo un problema. Intenta de nuevo en un momento.";
  return "No pudimos guardar tu tarjeta. Revisa los datos o prueba con otra.";
}
