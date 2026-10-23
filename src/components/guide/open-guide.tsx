"use client";
// Botón para volver a abrir la guía de la app (Perfil, menú). Abre con el evento global de GuideProvider.
import { Compass } from "@/components/icons";
import { openGuide } from "./guide-provider";

export function OpenGuideButton({ className = "btn-ghost", children = "Ver la guía de la app", onOpen }: { className?: string; children?: React.ReactNode; onOpen?: () => void }) {
  return (
    <button type="button" onClick={() => { onOpen?.(); openGuide(); }} aria-haspopup="dialog" className={className}>
      <Compass weight="duotone" className="size-5 shrink-0" aria-hidden />{children}
    </button>
  );
}
