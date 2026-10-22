"use client";
import { useState, useTransition } from "react";
import { Flag } from "@/components/icons";
import { report, type ReportReason } from "@/app/actions/community";

const REASONS: [ReportReason, string][] = [["spam", "Spam"], ["acoso", "Acoso"], ["contenido_inapropiado", "Inapropiado"], ["otro", "Otro"]];

/** Reportar un perfil (va a la cola de moderación del panel con la etiqueta "Perfil"). */
export function ReportUser({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [, start] = useTransition();
  if (done) return <span role="status" className="text-xs font-semibold text-peel">{done}</span>;
  return (
    <span className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Reportar perfil" className="tap pressable grid place-items-center size-11 rounded-full text-faint hover:bg-cream hover:text-ink"><Flag weight="duotone" className="size-4" /></button>
      {open && (
        <div role="group" aria-label="Motivo del reporte del perfil" onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }} className="popover absolute right-0 top-12 z-20 w-64 card p-3 shadow-lift">
          <p className="text-sm font-bold text-ink">¿Por qué reportas este perfil?</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {REASONS.map(([k, l]) => <button key={k} type="button" onClick={() => { setOpen(false); start(async () => { const r = await report("user", userId, k).catch(() => ({ ok: false, error: "Sin conexión." })); setDone(r.ok ? "Gracias, lo revisaremos." : r.error ?? "No pudimos enviar el reporte."); }); }} className="chip pressable h-11 px-4 bg-white border border-line text-ink hover:border-ink">{l}</button>)}
          </div>
        </div>
      )}
    </span>
  );
}
