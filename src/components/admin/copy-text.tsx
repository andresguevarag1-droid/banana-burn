"use client";
// Botón "Copiar" para un texto largo (enlace o mensaje de WhatsApp de un condominio), con confirmación accesible.
import { useState } from "react";
import { Check, Copy } from "@/components/icons";

export function CopyText({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  const [done, setDone] = useState<null | "ok" | "error">(null);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setDone("ok"); } catch { setDone("error"); }
    setTimeout(() => setDone(null), 1800);
  }
  return (
    <>
      <button type="button" onClick={copy} className={`btn-ghost h-10! gap-1.5 px-3! text-sm! bg-white! ${className}`}>
        {done === "ok" ? <Check className="size-4 text-[#17703A]" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {done === "ok" ? "Copiado" : label}
      </button>
      <span role="status" aria-live="polite" className="sr-only">{done === "ok" ? "Copiado" : done === "error" ? "No se pudo copiar" : ""}</span>
    </>
  );
}
