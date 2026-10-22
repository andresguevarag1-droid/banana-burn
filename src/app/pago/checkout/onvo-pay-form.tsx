"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { CircleNotch, WarningCircle } from "@/components/icons";

// SDK web de ONVO: https://docs.onvopay.com/en/integrations/sdk.md
type OnvoErrorData = { message?: string; details?: { card?: { reason?: string } } };
type OnvoPayInstance = { render: (selector: string) => void };
declare global {
  interface Window {
    onvo?: { pay: (opts: Record<string, unknown>) => OnvoPayInstance };
  }
}

const SDK_URL = "https://sdk.onvopay.com/sdk.js";

function errorText(d: OnvoErrorData | undefined) {
  const reason = d?.details?.card?.reason;
  if (reason === "issuer_declined") return "Tu banco rechazó el pago. Prueba con otra tarjeta.";
  if (reason === "gateway_declined") return "El pago fue rechazado. Revisa los datos o prueba otro método.";
  return d?.message || "No se pudo completar el pago. Intenta de nuevo.";
}

export function OnvoPayForm({ publicKey, subscriptionId, customerId }: { publicKey: string; subscriptionId: string; customerId?: string }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.onvo) setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || mounted.current || !window.onvo) return;
    mounted.current = true;
    window.onvo
      .pay({
        publicKey,
        paymentType: "subscription",
        subscriptionId,
        customerId,
        locale: "es",
        onSuccess: () => router.replace(`/pago/exito?s=${encodeURIComponent(subscriptionId)}`),
        onError: (d: OnvoErrorData) => setError(errorText(d)),
      })
      .render("#onvo-pay");
  }, [ready, publicKey, subscriptionId, customerId, router]);

  return (
    <div>
      <Script src={SDK_URL} strategy="afterInteractive" onReady={() => setReady(true)} onError={() => setLoadFailed(true)} />
      {error && (
        <p role="alert" className="mb-4 flex gap-2 rounded-2xl bg-bad/5 border border-bad/20 p-3 text-sm font-semibold text-bad">
          <WarningCircle weight="duotone" className="size-5 shrink-0" />{error}
        </p>
      )}
      {loadFailed ? (
        <p role="alert" className="text-sm text-muted">No pudimos cargar el formulario de pago. Revisa tu conexión o desactiva bloqueadores de anuncios y <button type="button" onClick={() => location.reload()} className="font-semibold text-ink underline">recarga la página</button>.</p>
      ) : (
        <div id="onvo-pay" className="min-h-48" aria-live="polite" aria-busy={!ready}>
          {!ready && <p className="flex items-center gap-2 text-sm text-muted"><CircleNotch weight="bold" className="size-4 animate-spin" />Cargando formulario seguro…</p>}
        </div>
      )}
    </div>
  );
}
