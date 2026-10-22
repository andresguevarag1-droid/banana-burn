"use client";
import { useState } from "react";
import type { Billing, PlanId } from "@/lib/plans";

/** Llama a POST /api/pagos/checkout y redirige a la página de pago. El precio lo decide el servidor. */
export function useCheckout() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function start(plan: PlanId, billing: Billing) {
    setBusy(`${plan}.${billing}`);
    setError(null);
    try {
      const r = await fetch("/api/pagos/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, billing }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
      if (r.status === 401) { window.location.href = `/entrar?next=${encodeURIComponent(`/app/suscripcion?plan=${plan}&pago=${billing}`)}`; return; }
      if (j.ok && j.url) { window.location.assign(j.url); return; }
      setError(j.error ?? "No pudimos iniciar el pago. Intenta de nuevo.");
    } catch {
      setError("Sin conexión. Revisa tu internet e intenta de nuevo.");
    }
    setBusy(null);
  }
  return { start, busy, error, clearError: () => setError(null) };
}
