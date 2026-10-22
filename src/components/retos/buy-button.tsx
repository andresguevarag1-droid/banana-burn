"use client";
import { useState } from "react";
import { CircleNotch, Lock } from "@/components/icons";

/** Compra de un reto Premium: pide al servidor el cobro único en ONVO y lleva a la página de pago. El acceso lo da el webhook. */
export function BuyButton({ slug, label }: { slug: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function buy() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/retos/comprar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
      if (j.ok && j.url) { window.location.assign(j.url); return; }
      setErr(j.error ?? "No pudimos iniciar el pago. Intenta de nuevo.");
    } catch { setErr("Sin conexión. Intenta de nuevo."); }
    setBusy(false);
  }
  return (
    <div>
      <button onClick={buy} disabled={busy} aria-busy={busy} className="btn-banana h-12 w-full px-5 text-base">
        {busy ? <><CircleNotch weight="bold" className="size-5 animate-spin motion-reduce:animate-none" />Preparando pago…</> : <><Lock weight="duotone" className="size-5" />{label}</>}
      </button>
      {err && <p role="alert" className="mt-2 text-sm font-semibold text-bad">{err}</p>}
    </div>
  );
}
