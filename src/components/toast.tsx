"use client";
import { Portal } from "@/components/portal";
import { usePresence, useSticky } from "@/components/use-presence";

/**
 * Aviso flotante breve. Entra y sale por el mismo lado (arriba o abajo) para que el movimiento tenga sentido espacial.
 * Pasa `null` para ocultarlo; el texto anterior se mantiene durante la salida.
 */
export function Toast({ children, side = "bottom", className = "" }: { children: React.ReactNode | null; side?: "top" | "bottom"; className?: string }) {
  const open = children != null && children !== false;
  const { mounted, closing } = usePresence(open, 200);
  const shown = useSticky(open ? children : null);
  if (!mounted) return null;
  return (
    <Portal>
      <div role="status" data-side={side} data-closing={closing || undefined}
        className={`toast fixed inset-x-0 z-[90] flex justify-center px-4 pointer-events-none ${side === "top" ? "top-[max(5.5rem,calc(env(safe-area-inset-top)+4.5rem))]" : "bottom-[calc(6.5rem+env(safe-area-inset-bottom))] lg:bottom-8"} ${className}`}>
        <p className="inline-flex max-w-full items-center gap-2 rounded-full bg-ink px-5 py-3 font-bold text-white shadow-lift">{shown}</p>
      </div>
    </Portal>
  );
}
