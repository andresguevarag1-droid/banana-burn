"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowCounterClockwise, X } from "@/components/icons";
import { FunnelTracker } from "@/components/analytics";
import { RECOVERY_NOTICE } from "@/lib/recuperacion";

/** Llave local por cuenta: el aviso sale en el primer acceso elegible y no se repite en cada visita. */
export const recoveryNoticeKey = (account: string) => `bb:recuperacion-aviso:${account}`;

/**
 * Prueba terminada sin plan (recuperacion.ts): recuerda que el historial sigue y lleva a Mi plan. Descartable. El layout solo lo
 * pinta mientras la cuenta cumple la audiencia, así que al pagar desaparece. Si no se puede guardar que ya se vio, no se muestra.
 */
export function RecoveryNotice({ account }: { account: string }) {
  const [visible, setVisible] = useState(false);
  const claimed = useRef(false);
  useEffect(() => {
    if (claimed.current) return;
    claimed.current = true;
    try {
      const key = recoveryNoticeKey(account);
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, String(Date.now()));
      setVisible(true);
    } catch { /* Sin almacenamiento no se muestra: no se puede evitar que se repita. */ }
  }, [account]);
  return visible ? <RecoveryNoticeCard onClose={() => setVisible(false)} /> : null;
}

export function RecoveryNoticeCard({ onClose }: { onClose?: () => void }) {
  const n = RECOVERY_NOTICE;
  return (
    <aside aria-label={n.title} className="mb-5 rounded-2xl border border-banana bg-banana-soft text-sm">
      <FunnelTracker view="card_banner_view" props={{ kind: "recuperacion" }} />
      <div className="flex items-start gap-2.5 px-3.5 pt-3">
        <ArrowCounterClockwise weight="duotone" className="mt-0.5 size-5 shrink-0 text-banana-ink" aria-hidden />
        <div className="min-w-0 flex-1 text-pretty">
          <p className="font-bold text-ink">{n.title}</p>
          <p className="text-ink">{n.lead}</p>
          <p className="mt-1.5 text-body">{n.body}</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Cerrar aviso" className="tap -mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:text-ink">
            <X weight="bold" className="size-4" aria-hidden />
          </button>
        )}
      </div>
      <div className="px-3.5 pb-2 pl-11">
        <Link href={n.path} data-cta="recuperacion-elegir-plan" className="tap inline-flex h-11 items-center gap-1 font-bold text-ink underline-offset-4 hover:underline">{n.cta}<ArrowRight weight="bold" className="size-4" /></Link>
      </div>
    </aside>
  );
}
