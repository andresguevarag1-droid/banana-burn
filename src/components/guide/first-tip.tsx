"use client";
// Consejo de la primera vez (coach mark): una tarjeta chica con Coach Banana que se cierra con un toque y no vuelve.
// No se muestra mientras la guía está abierta ni antes de saber si ya se vio (sin parpadeo).
import Image from "next/image";
import { X } from "@/components/icons";
import type { TipKey } from "@/lib/guide";
import { useGuide } from "./guide-provider";

export function FirstTip({ id, title, children, className = "" }: { id: TipKey; title: string; children: React.ReactNode; className?: string }) {
  const g = useGuide();
  if (!g || g.guideOpen || g.tipSeen(id)) return null;
  return (
    <aside aria-label="Consejo de Coach Banana"
      className={`coach-mark flex items-start gap-3 rounded-[1.25rem] bg-ink p-3.5 pr-2 text-white shadow-lift ${className}`}>
      <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-banana"><Image src="/brand/mascota-sola.webp" alt="" width={44} height={44} className="size-10 object-contain" /></span>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="font-extrabold text-banana">{title}</p>
        <div className="mt-0.5 text-sm text-white/85 text-pretty">{children}</div>
        <button type="button" onClick={() => g.dismissTip(id)} className="pressable mt-2 inline-flex h-11 items-center rounded-full bg-banana px-4 text-sm font-bold text-ink hover:brightness-95">Entendido</button>
      </div>
      <button type="button" onClick={() => g.dismissTip(id)} aria-label="Cerrar el consejo" className="pressable grid size-11 shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"><X weight="bold" className="size-4" aria-hidden /></button>
    </aside>
  );
}
