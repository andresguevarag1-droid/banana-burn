// Qué procesador cobra a cada persona. Pura y testeada (sin "server-only": la usan servidor y pruebas).
//   - Costa Rica: ONVO Pay (como siempre).
//   - Cualquier otro país: Tilopay, solo si está configurado y encendido (TILOPAY_ENABLED=1). Si no, ONVO como hoy.
//   - La persona puede cambiarlo en el formulario de tarjeta ("¿Tu tarjeta es de otro país?"): esa elección manda.
// El país sale de la IP (cabecera x-vercel-ip-country) y, si no llega, del país elegido en la bienvenida.

export type PayProvider = "onvo" | "tilopay";

export const isPayProvider = (x: unknown): x is PayProvider => x === "onvo" || x === "tilopay";

/** País ISO de 2 letras en mayúsculas, o null. Ignora valores raros (cabeceras falsas, "XX", "T1" de Tor). */
export function normCountry(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const c = x.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) && c !== "XX" ? c : null;
}

export function providerFor(i: { country?: string | null; profileCountry?: string | null; override?: unknown; tilopayReady: boolean }): PayProvider {
  if (!i.tilopayReady) return "onvo";
  if (isPayProvider(i.override)) return i.override;
  const c = normCountry(i.country) ?? normCountry(i.profileCountry);
  // Sin país conocido: ONVO, que es lo que funciona hoy.
  if (!c || c === "CR") return "onvo";
  return "tilopay";
}
