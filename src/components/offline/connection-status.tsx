"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudArrowUp, WifiSlash, CheckCircle } from "@/components/icons";
import { OUTBOX_EVENT, flushWorkouts, pendingWorkouts, type OutboxEvent } from "./outbox";

type State = { kind: "offline" } | { kind: "syncing"; n: number } | { kind: "synced"; n: number } | null;

/**
 * Aviso pequeño de conexión: "sin señal" mientras no hay red, y al volver sube solo los entrenos guardados en el teléfono.
 * No bloquea nada: es una píldora arriba, con aria-live para lectores de pantalla.
 */
export function ConnectionStatus() {
  const router = useRouter();
  const [state, setState] = useState<State>(null);
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    let hide: ReturnType<typeof setTimeout> | undefined;
    async function sync() {
      if (busy.current || !navigator.onLine) return;
      const n = pendingWorkouts().length;
      if (!n) return;
      busy.current = true;
      setState({ kind: "syncing", n });
      const saved = await flushWorkouts().catch(() => 0);
      busy.current = false;
      if (!alive) return;
      if (saved) {
        setState({ kind: "synced", n: saved });
        router.refresh();
        clearTimeout(hide); hide = setTimeout(() => alive && setState(null), 3500);
      } else setState(navigator.onLine ? null : { kind: "offline" });
    }
    const off = () => setState({ kind: "offline" });
    const on = () => { setState(null); void sync(); };
    const vis = () => { if (document.visibilityState === "visible") void sync(); };
    // Si el reproductor guardó un entreno pendiente mientras esto estaba montado, se refleja aquí.
    const ev = (e: Event) => { const d = (e as CustomEvent<OutboxEvent>).detail; if (d?.result?.ok && !busy.current) router.refresh(); };
    if (!navigator.onLine) off();
    // Service worker mínimo (push + página "sin conexión"). Nunca guarda pantallas de la app, así que no deja versiones viejas.
    try { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {}); } catch { /* */ }
    const t = setTimeout(() => void sync(), 1500);
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    document.addEventListener("visibilitychange", vis);
    window.addEventListener(OUTBOX_EVENT, ev);
    return () => {
      alive = false; clearTimeout(t); clearTimeout(hide);
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener(OUTBOX_EVENT, ev);
    };
  }, [router]);

  const text = !state ? "" : state.kind === "offline" ? "Sin conexión. Puedes seguir entrenando: guardamos todo en este teléfono."
    : state.kind === "syncing" ? (state.n === 1 ? "Subiendo tu entreno guardado sin señal…" : `Subiendo ${state.n} entrenos guardados sin señal…`)
    : state.n === 1 ? "Listo, subimos tu entreno guardado." : `Listo, subimos ${state.n} entrenos guardados.`;
  const Icon = state?.kind === "offline" ? WifiSlash : state?.kind === "synced" ? CheckCircle : CloudArrowUp;

  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-[70] flex justify-center px-4">
      {state && (
        <p className={`pointer-events-auto flex max-w-md items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-lift animate-enter ${state.kind === "offline" ? "bg-ink text-white" : state.kind === "synced" ? "bg-peel text-white" : "bg-banana text-ink"}`}>
          <Icon weight="bold" className="size-4 shrink-0" aria-hidden />
          <span>{text}</span>
        </p>
      )}
    </div>
  );
}
