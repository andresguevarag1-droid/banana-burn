"use client";
import { startTransition, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowCounterClockwise, MonkeyBanana } from "@/components/icons";
import { ERROR_COPY, errorKind, type ErrorKind } from "@/lib/error-kind";

/** Registro sin datos personales: solo el área, el tipo de falla y el código (digest) que Next asocia al log del servidor. */
export function logClientError(area: string, error: Error & { digest?: string }, kind: ErrorKind) {
  console.error(`[ui:${area}] ${kind}`, { digest: error.digest ?? null, name: error.name });
}

/**
 * Estado de error con marca: mensaje calmado, reintento y salida a un lugar seguro.
 * Si el error viene de una versión vieja (deploy nuevo), ofrece recargar; si no hay red, lo dice.
 */
export function ErrorState({ error, reset, homeHref, homeLabel, full = false, area = "app" }: { error: Error & { digest?: string }; reset: () => void; homeHref: string; homeLabel: string; full?: boolean; area?: string }) {
  const title = useRef<HTMLHeadingElement>(null);
  const router = useRouter();
  const [kind, setKind] = useState<ErrorKind>("generic");
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    const k = errorKind(error, typeof navigator === "undefined" ? true : navigator.onLine);
    setKind(k);
    logClientError(area, error, k);
    title.current?.focus({ preventScroll: true });
  }, [error, area]);
  const copy = ERROR_COPY[kind];

  function retry() {
    if (kind === "stale") { window.location.reload(); return; }
    setRetrying(true);
    // Un error de un componente de servidor no se arregla con solo reset(): hay que volver a pedir los datos.
    startTransition(() => { router.refresh(); reset(); });
    setTimeout(() => setRetrying(false), 1500);
  }

  return (
    <div role="alert" className={`grid place-items-center text-center px-4 sm:px-6 ${full ? "min-h-dvh" : "min-h-[60dvh] py-10"}`}>
      <div className="w-full max-w-sm animate-enter">
        <span aria-hidden className="mx-auto grid place-items-center size-20 rounded-[1.75rem] bg-banana text-ink shadow-soft"><MonkeyBanana className="size-12" /></span>
        <h1 ref={title} tabIndex={-1} className="mt-5 text-3xl font-extrabold tracking-tight text-ink text-balance outline-none">{copy.title}</h1>
        <p className="mt-2 text-muted text-pretty">{copy.body}</p>
        <div className="mt-6 flex flex-col gap-2.5">
          <button type="button" onClick={retry} disabled={retrying} aria-busy={retrying} className="btn-primary w-full h-13 disabled:opacity-70"><ArrowCounterClockwise weight="bold" className="size-4" aria-hidden />{retrying ? "Cargando…" : copy.action}</button>
          <Link href={homeHref} className="btn-ghost w-full h-13">{homeLabel}</Link>
        </div>
        {error.digest && <p className="mt-5 text-[11px] text-faint">Código de referencia: <span className="font-mono select-all">{error.digest}</span></p>}
      </div>
    </div>
  );
}
