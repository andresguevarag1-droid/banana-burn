"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Portal } from "@/components/portal";
import { Monkey } from "@/components/icons";
import css from "./workout.module.css";

export type TourStep = { target: string; title: string; body: string };

const visible = (t: string) => { const el = document.querySelector<HTMLElement>(`[data-tour="${t}"]`); return !!el && el.getClientRects().length > 0; };

/**
 * Recorrido corto la primera vez: recorta el elemento real (data-tour) y explica qué hace.
 * Los pasos cuyo elemento no está en pantalla (vista Lista, ejercicio sin alternativas) se saltan.
 * La tarjeta nunca tapa el encabezado ni el objetivo: va pegada al objetivo, del lado con más espacio.
 * Es un diálogo: Escape lo cierra, el foco queda en "Siguiente". Se recuerda en el teléfono.
 */
export function Tour({ steps: all, onDone, extra }: { steps: TourStep[]; onDone: () => void; extra?: React.ReactNode }) {
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [headerBottom, setHeaderBottom] = useState(0);
  const next = useRef<HTMLButtonElement>(null);
  const step = steps?.[i];

  const ids = all.map((s) => s.target).join(",");
  const allRef = useRef(all);
  useEffect(() => { allRef.current = all; });
  useLayoutEffect(() => {
    const ok = allRef.current.filter((s) => visible(s.target));
    if (!ok.length) { onDone(); return; }
    setSteps(ok); setI(0);
  }, [ids, onDone]);

  useLayoutEffect(() => {
    if (!step) return;
    const measure = () => {
      const head = document.querySelector<HTMLElement>("[data-tour-anchor]");
      setHeaderBottom(head ? head.getBoundingClientRect().bottom : 0);
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!el) { setBox(null); return; }
      el.scrollIntoView({ block: "nearest" });
      const r = el.getBoundingClientRect(), pad = 8;
      setBox({ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.target]);

  useEffect(() => { next.current?.focus({ preventScroll: true }); }, [i, steps]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onDone(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDone]);

  if (!steps || !step) return null;
  const last = i === steps.length - 1;
  // Objetivo arriba: la tarjeta va justo debajo. Objetivo abajo: justo encima. Nunca sobre el encabezado.
  const gap = 12;
  const below = box ? box.top + box.height / 2 < window.innerHeight / 2 : false;
  const place: React.CSSProperties = !box
    ? { top: Math.max(headerBottom + gap, 16) }
    : below ? { top: Math.max(box.top + box.height + gap, headerBottom + gap) } : { bottom: Math.max(window.innerHeight - box.top + gap, 16) };

  return (
    <Portal>
      <div className="fixed inset-0 z-[95]" role="dialog" aria-modal="true" aria-labelledby="tour-t" aria-describedby="tour-b">
        {box ? (
          <div aria-hidden className={`${css.spot} absolute rounded-[1.75rem] ring-4 ring-white`} style={{ ...box, boxShadow: "0 0 0 9999px rgb(27 21 5 / .62)" }} />
        ) : (
          <div aria-hidden className="absolute inset-0 bg-ink/60" />
        )}
        <div className="absolute inset-x-0 px-4" style={place}>
          <div key={i} className="animate-enter mx-auto max-w-md rounded-[1.75rem] bg-paper p-5 shadow-lift">
            <div className="flex items-start gap-3">
              <span className="grid place-items-center size-11 shrink-0 rounded-2xl bg-banana text-ink"><Monkey className="size-7" /></span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-muted tabular-nums">Paso {i + 1} de {steps.length}</p>
                <h2 id="tour-t" className="text-xl font-extrabold leading-tight text-ink">{step.title}</h2>
              </div>
            </div>
            <p id="tour-b" className="mt-2 text-[15px] text-body">{step.body}</p>
            {last && extra}
            <div className="mt-4 flex items-center gap-2">
              <button type="button" onClick={onDone} className="btn h-12 px-4 text-muted hover:text-ink">Saltar</button>
              <div aria-hidden className="mx-auto flex gap-1.5">{steps.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-[width,background-color] duration-(--dur-fast) ${k === i ? "w-5 bg-ink" : "w-1.5 bg-line"}`} />)}</div>
              <button ref={next} type="button" onClick={() => (last ? onDone() : setI(i + 1))} className="btn-primary h-12 px-6">{last ? "A entrenar" : "Siguiente"}</button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
