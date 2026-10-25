"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, ShareNetwork } from "@/components/icons";

const message = (link: string) => `Estoy entrenando con Banana Burn: rutinas de gym y plan para bajar de peso. Pruébalo con mi enlace de referido (gano una comisión si te suscribes): ${link}`;

/** Enlace del referidor: copiar, compartir (Web Share) y código QR para mostrar en persona. */
export function AffShare({ link, qr, demo }: { link: string; qr: string; demo: boolean }) {
  const [copied, setCopied] = useState<"link" | "msg" | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => { setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"); return () => clearTimeout(timer.current); }, []);
  const flash = (k: "link" | "msg") => { setCopied(k); clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(null), 2200); };
  async function copy(text: string, k: "link" | "msg") {
    try { await navigator.clipboard.writeText(text); flash(k); return; } catch { /* sin permiso */ }
    input.current?.select();
    try { if (document.execCommand("copy")) flash(k); } catch { /* queda seleccionado */ }
  }
  async function share() {
    if (canShare) { try { await navigator.share({ title: "Banana Burn", text: message(link), url: link }); return; } catch (e) { if ((e as Error)?.name === "AbortError") return; } }
    await copy(message(link), "msg");
  }
  return (
    <div className="space-y-3">
      <label htmlFor="aff-link" className="block text-sm font-bold text-ink">Tu enlace</label>
      <div className="flex min-w-0 gap-2">
        <input id="aff-link" ref={input} readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="input h-12 min-w-0 flex-1 truncate font-mono text-[15px]" />
        <button type="button" onClick={() => copy(link, "link")} className="btn-ghost h-12 shrink-0 px-4" aria-live="polite">
          {copied === "link" ? <><Check weight="bold" className="size-5 text-peel" />Copiado</> : <><Copy weight="bold" className="size-5" />Copiar</>}
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={share} className="btn-primary h-12"><ShareNetwork weight="bold" className="size-5" />{canShare ? "Compartir enlace" : "Copiar mensaje"}</button>
        <button type="button" onClick={() => setShowQr((x) => !x)} className="btn-ghost h-12" aria-expanded={showQr} aria-controls="aff-qr">{showQr ? "Ocultar código QR" : "Mostrar código QR"}</button>
      </div>
      {showQr && qr && (
        <div id="aff-qr" className="mx-auto w-56 rounded-2xl border border-line bg-white p-3">
          <div className="[&>svg]:h-auto [&>svg]:w-full" role="img" aria-label="Código QR de tu enlace" dangerouslySetInnerHTML={{ __html: qr }} />
        </div>
      )}
      <p className="min-h-5 text-sm text-muted" aria-live="polite">
        {copied === "msg" ? "Mensaje copiado. Ya dice que es un enlace de referido." : demo ? "En la demo el enlace es de ejemplo." : "Funciona en cualquier página de Banana Burn: también puedes agregar ?ref= y tu código."}
      </p>
    </div>
  );
}
