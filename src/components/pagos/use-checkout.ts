"use client";
import { useState } from "react";
import type { Billing, PlanId } from "@/lib/plans";
import { track } from "@/components/analytics";

/** Llama a POST /api/pagos/checkout y redirige a la página de pago. El precio lo decide el servidor. */
export function useCheckout() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** `provider`: reintentar con el mismo procesador del pago que no se completó (#296). Sin él, decide el servidor. */
  async function start(plan: PlanId, billing: Billing, provider?: "onvo" | "tilopay") {
    setBusy(`${plan}.${billing}`);
    setError(null);
    try {
      const r = await fetch("/api/pagos/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(provider ? { plan, billing, provider } : { plan, billing }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
      if (r.status === 401) { window.location.href = `/entrar?next=${encodeURIComponent(`/app/suscripcion?plan=${plan}&pago=${billing}`)}`; return; }
      if (j.ok && j.url) {
        // /pago/checkout (ONVO) cuenta su propio checkout_view al abrir. La página de Tilopay es de otro dominio: aquí se
        // cuenta al salir hacia ella (#293), con el mismo event_id en el píxel y en /api/track (API de Conversiones).
        if (!j.url.startsWith("/pago/checkout")) track("checkout_view", { plan, billing });
        window.location.assign(j.url);
        return;
      }
      setError(j.error ?? "No pudimos iniciar el pago. Intenta de nuevo.");
    } catch {
      setError("Sin conexión. Revisa tu internet e intenta de nuevo.");
    }
    setBusy(null);
  }
  return { start, busy, error, clearError: () => setError(null) };
}
