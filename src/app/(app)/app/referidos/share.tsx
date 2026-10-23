"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, ShareNetwork } from "@/components/icons";
import { shareMessage } from "@/lib/referrals";

/** Enlace con copiar y compartir (Web Share API; sin ella, copia el mensaje y ofrece WhatsApp). */
export function ShareLink({ link, demo }: { link: string; demo: boolean }) {
  const [copied, setCopied] = useState<"link" | "msg" | null>(null);
  const [canShare, setCanShare] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => { setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"); return () => clearTimeout(timer.current); }, []);

  const flash = (k: "link" | "msg") => { setCopied(k); clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(null), 2200); };
  async function copy(text: string, k: "link" | "msg") {
    try { await navigator.clipboard.writeText(text); flash(k); return; } catch { /* sin permiso de portapapeles */ }
    input.current?.select();
    try { if (document.execCommand("copy")) flash(k); } catch { /* el texto queda seleccionado para copiarlo a mano */ }
  }
  async function share() {
    const text = shareMessage(link);
    if (canShare) {
      try { await navigator.share({ title: "Banana Burn", text, url: link }); return; } catch (e) { if ((e as Error)?.name === "AbortError") return; }
    }
    await copy(text, "msg");
  }

  return (
    <div className="space-y-3">
      <label htmlFor="ref-link" className="block text-sm font-bold text-ink">Tu enlace</label>
      <div className="flex min-w-0 gap-2">
        <input id="ref-link" ref={input} readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="input h-12 min-w-0 flex-1 truncate font-mono text-[15px]" aria-describedby="ref-link-hint" />
        <button type="button" onClick={() => copy(link, "link")} className="btn-ghost h-12 shrink-0 px-4" aria-live="polite">
          {copied === "link" ? <><Check weight="bold" className="size-5 text-peel" />Copiado</> : <><Copy weight="bold" className="size-5" />Copiar</>}
        </button>
      </div>
      <button type="button" onClick={share} className="btn-primary h-12 w-full">
        <ShareNetwork weight="bold" className="size-5" />{canShare ? "Compartir enlace" : "Copiar mensaje para compartir"}
      </button>
      <p id="ref-link-hint" className="min-h-5 text-sm text-muted" aria-live="polite">
        {copied === "msg" ? "Mensaje copiado. Pégalo en WhatsApp, Instagram o donde quieras." : demo ? "En la demo el enlace es de ejemplo." : "Cada persona cuenta una sola vez."}
      </p>
      {!canShare && (
        <a href={`https://wa.me/?text=${encodeURIComponent(shareMessage(link))}`} target="_blank" rel="noopener noreferrer" className="btn-ghost h-12 w-full">Enviar por WhatsApp</a>
      )}
    </div>
  );
}
