"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowsClockwise } from "@/components/icons";
import { errorKind } from "@/lib/error-kind";
import { isNewer } from "@/lib/version";

const EVERY = 30 * 60_000, MIN_GAP = 5 * 60_000;

/**
 * Después de un deploy, una pestaña abierta (o la app instalada) puede quedarse con JavaScript viejo y fallar al navegar.
 * Revisa la versión al volver a la app y, si cambió o falló una pieza de la app, ofrece recargar con un botón.
 * No interrumpe un entreno en curso: en el reproductor no se muestra.
 */
export function UpdatePrompt({ version }: { version: string }) {
  const [show, setShow] = useState(false);
  const path = usePathname();

  useEffect(() => {
    let last = 0;
    async function check() {
      if (!version || !navigator.onLine || Date.now() - last < MIN_GAP) return;
      last = Date.now();
      try {
        const r = await fetch("/api/version", { cache: "no-store", signal: AbortSignal.timeout(5_000) });
        const j = (await r.json()) as { v?: string };
        if (isNewer(version, j.v)) setShow(true);
      } catch { /* sin red: se revisa la próxima vez */ }
    }
    const vis = () => { if (document.visibilityState === "visible") void check(); };
    const stale = (e: unknown) => { if (errorKind(e as Error) === "stale") setShow(true); };
    const onErr = (e: ErrorEvent) => stale(e.error ?? { message: e.message });
    const onRej = (e: PromiseRejectionEvent) => stale(e.reason);
    const t = setInterval(() => void check(), EVERY);
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onRej); };
  }, [version]);

  if (!show || path?.startsWith("/app/entreno")) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-[65] flex justify-center px-4 animate-enter">
      <div className="flex max-w-md items-center gap-3 rounded-full bg-ink py-1.5 pl-4 pr-1.5 text-sm font-semibold text-white shadow-lift">
        <span>Hay una versión nueva de la app.</span>
        <button type="button" onClick={() => window.location.reload()} className="pressable inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-banana px-4 font-extrabold text-ink">
          <ArrowsClockwise weight="bold" className="size-4" aria-hidden />Actualizar
        </button>
      </div>
    </div>
  );
}
