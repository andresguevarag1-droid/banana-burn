"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowCounterClockwise, MonkeyBanana } from "@/components/icons";

/** Estado de error con marca: mensaje calmado, reintento y salida a un lugar seguro. */
export function ErrorState({ error, reset, homeHref, homeLabel, full = false }: { error: Error & { digest?: string }; reset: () => void; homeHref: string; homeLabel: string; full?: boolean }) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { console.error(error); title.current?.focus({ preventScroll: true }); }, [error]);
  return (
    <div role="alert" className={`grid place-items-center text-center px-6 ${full ? "min-h-dvh" : "min-h-[60dvh] py-10"}`}>
      <div className="w-full max-w-sm animate-enter">
        <span aria-hidden className="mx-auto grid place-items-center size-20 rounded-[1.75rem] bg-banana text-ink shadow-soft"><MonkeyBanana className="size-12" /></span>
        <h1 ref={title} tabIndex={-1} className="mt-5 text-3xl font-extrabold tracking-tight text-ink outline-none">No pudimos cargar esta pantalla.</h1>
        <p className="mt-2 text-muted">Puede ser la conexión o un tropiezo de nuestro lado. Tus datos están a salvo. Prueba otra vez en un momento.</p>
        <div className="mt-6 flex flex-col gap-2.5">
          <button type="button" onClick={reset} className="btn-primary w-full h-13"><ArrowCounterClockwise weight="bold" className="size-4" aria-hidden />Intentar de nuevo</button>
          <Link href={homeHref} className="btn-ghost w-full h-13">{homeLabel}</Link>
        </div>
        {error.digest && <p className="mt-5 text-[11px] text-faint">Código de referencia: <span className="font-mono select-all">{error.digest}</span></p>}
      </div>
    </div>
  );
}
