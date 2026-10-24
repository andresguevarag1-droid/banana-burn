"use client";
// Comprar una temporada (ONVO o Tilopay) o elegir la incluida en el plan anual. El precio lo pone el servidor.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleNotch, Gift } from "@/components/icons";

export function SeasonBuy({ slug, price, annual, tilopay, suggested }: { slug: string; price: string; annual: boolean; tilopay: boolean; suggested: "onvo" | "tilopay" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState(suggested);

  const post = (path: string, body: Record<string, unknown>, done: (j: { url?: string; slug?: string }) => void) => {
    setError(null);
    start(async () => {
      const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
      const j = (await r?.json().catch(() => null)) as { ok?: boolean; error?: string; url?: string; slug?: string } | null;
      if (!r || !j?.ok) { setError(j?.error ?? "No pudimos continuar. Revisa tu conexión e intenta de nuevo."); return; }
      done(j);
    });
  };

  return (
    <div className="space-y-2.5">
      {annual ? (
        <>
          <p className="flex items-center gap-2 text-sm font-bold text-peel"><Gift weight="duotone" className="size-5 shrink-0" />Incluida en tu plan anual</p>
          <button type="button" disabled={pending} onClick={() => post("/api/temporadas/anual", { slug }, () => { router.push(`/app/temporadas/${slug}/cuestionario`); router.refresh(); })} className="btn-banana w-full h-14 text-base">
            {pending ? <CircleNotch weight="bold" className="size-5 animate-spin" /> : <>Elegir mi temporada gratis <ArrowRight className="size-5" /></>}
          </button>
        </>
      ) : (
        <>
          <button type="button" disabled={pending} onClick={() => post("/api/temporadas/comprar", { slug, provider }, (j) => { if (j.url) window.location.assign(j.url); })} className="btn-banana w-full h-14 text-base">
            {pending ? <CircleNotch weight="bold" className="size-5 animate-spin" /> : <>Sumar la temporada por {price} <ArrowRight className="size-5" /></>}
          </button>
          <p className="text-center text-xs text-muted">Pago único en USD. No es una suscripción.</p>
          {tilopay && (
            <button type="button" onClick={() => setProvider(provider === "tilopay" ? "onvo" : "tilopay")} className="tap mx-auto block text-xs font-semibold text-muted underline underline-offset-4">
              {provider === "tilopay" ? "¿Tu tarjeta es de Costa Rica?" : "¿Tu tarjeta es de otro país?"}
            </button>
          )}
        </>
      )}
      {error && <p role="alert" className="rounded-2xl bg-bad/10 p-3 text-sm font-semibold text-bad">{error}</p>}
    </div>
  );
}
