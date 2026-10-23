"use client";
import { useState, useTransition } from "react";
import { ImageSquare } from "@/components/icons";
import { viewTicketShot } from "./actions";
import { btnGhost } from "@/components/admin/ui";
import { safeAction } from "@/lib/action-client";

/** Ver la captura con un enlace firmado de 60 segundos (queda en auditoría). */
export function ShotViewer({ ticketId }: { ticketId: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      {!url && (
        <button type="button" className={btnGhost} disabled={pending} onClick={() => start(async () => {
          const r = await safeAction(viewTicketShot(ticketId).then((x) => (x.ok ? { ok: true as const, url: x.url } : { ok: false as const, error: x.error })));
          if (r.ok && "url" in r) { setUrl(r.url); setErr(null); setTimeout(() => setUrl(null), 60_000); } else setErr(("error" in r && r.error) || "No pudimos abrir la captura.");
        })}><ImageSquare weight="duotone" className="size-4" aria-hidden />{pending ? "Abriendo…" : "Ver captura"}</button>
      )}
      {url && (
        <figure className="space-y-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Captura que adjuntó la persona" className="max-h-96 w-auto rounded-xl border border-line bg-white" />
          <figcaption className="text-xs text-muted">El enlace vence en 60 segundos. Ver la captura queda en auditoría.</figcaption>
        </figure>
      )}
      {err && <p role="alert" className="text-sm text-[#B4232A]">{err}</p>}
    </div>
  );
}
