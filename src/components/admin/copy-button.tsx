"use client";
// Botón para copiar un identificador (p. ej. cliente o suscripción de ONVO) con confirmación accesible.
import { useState } from "react";
import { Check, Copy } from "@/components/icons";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState<null | "ok" | "error">(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone("ok");
    } catch {
      setDone("error");
    }
    setTimeout(() => setDone(null), 1800);
  }
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <code className="min-w-0 max-w-32 truncate rounded-md bg-paper px-1.5 py-0.5 text-xs text-ink" title={value}>{value}</code>
      <button type="button" onClick={copy} aria-label={`Copiar ${label}`} title={`Copiar ${label}`}
        className="tap grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink outline-none focus-visible:ring-4 focus-visible:ring-banana/50">
        {done === "ok" ? <Check className="size-4 text-[#17703A]" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      </button>
      <span role="status" aria-live="polite" className="sr-only">{done === "ok" ? `${label} copiado` : done === "error" ? "No se pudo copiar" : ""}</span>
    </span>
  );
}
