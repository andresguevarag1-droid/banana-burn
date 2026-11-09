// Avisa al servidor que un pago no se completó (#296, /api/pagos/fallo). Solo proveedor, etapa y un código corto: nunca
// datos de la tarjeta. Nunca lanza ni bloquea la pantalla.
import { safeCode, type FailProvider, type FailStage } from "@/lib/pago-fallo";

export function reportPayFail(b: { provider: FailProvider; stage: FailStage; code: unknown; s?: string; plan?: string; billing?: string }) {
  try {
    const body = JSON.stringify({ ...b, code: safeCode(b.code) ?? "desconocido" });
    void fetch("/api/pagos/fallo", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    /* sin aviso */
  }
}

/** Código de un error de ONVO (SDK o API): la razón de la tarjeta, si no el código del error. */
export function onvoFailCode(d: unknown): string {
  const o = d && typeof d === "object" ? (d as { code?: unknown; details?: { card?: { reason?: unknown } } }) : {};
  return safeCode(o.details?.card?.reason) ?? safeCode(o.code) ?? "desconocido";
}
