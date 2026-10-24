"use client";
// Diálogo de la guía: pantalla completa en el celular y diálogo centrado en escritorio.
// Teclado: Tab queda dentro, Esc cierra, flechas izquierda y derecha cambian de paso. Movimiento: entra en 300 ms con la
// curva de cajón de globals.css y cada paso cambia con un fundido corto; con movimiento reducido, solo fundidos.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle, X } from "@/components/icons";
import { Portal } from "@/components/portal";
import { usePresence } from "@/components/use-presence";
import type { GuideInput, GuideStep } from "@/lib/guide";
import { GuideVisual } from "./guide-visuals";

const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';
const focusables = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);

export function GuideDialog({ open, steps, input, onClose }: { open: boolean; steps: GuideStep[]; input: GuideInput; onClose: () => void }) {
  const { mounted, closing } = usePresence(open, 200);
  if (!mounted || !steps.length) return null;
  return <Panel steps={steps} input={input} onClose={onClose} closing={closing} />;
}

function Panel({ steps, input, onClose, closing }: { steps: GuideStep[]; input: GuideInput; onClose: () => void; closing: boolean }) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const panel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  const titleId = useId();
  const bodyId = useId();
  useEffect(() => { close.current = onClose; }, [onClose]);

  const last = steps.length - 1;
  const idx = Math.min(i, last);
  const step = steps[idx];
  const go = useCallback((n: number) => {
    setI((cur) => {
      const next = Math.max(0, Math.min(last, n));
      if (next !== cur) setDir(next > cur ? 1 : -1);
      return next;
    });
  }, [last]);

  // Cada paso empieza arriba.
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [idx]);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const body = document.body;
    const prev = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    const bar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (bar > 0) body.style.paddingRight = `${bar}px`;
    let raf = 0, tries = 0;
    const focusFirst = () => {
      const p = panel.current;
      if (!p) { if (++tries < 10) raf = requestAnimationFrame(focusFirst); return; }
      (p.querySelector<HTMLElement>("[data-autofocus]") ?? p).focus({ preventScroll: true });
    };
    raf = requestAnimationFrame(focusFirst);
    return () => {
      cancelAnimationFrame(raf);
      body.style.overflow = prev.overflow;
      body.style.paddingRight = prev.paddingRight;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const p = panel.current;
      if (!p) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close.current(); return; }
      if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && !e.altKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        go(idx + (e.key === "ArrowRight" ? 1 : -1));
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusables(p);
      if (!els.length) { e.preventDefault(); p.focus(); return; }
      const first = els[0], end = els[els.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === p || !p.contains(active))) { e.preventDefault(); end.focus(); }
      else if (!e.shiftKey && (active === end || !p.contains(active))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [go, idx]);

  const isLast = idx === last;
  return (
    <Portal>
      <div data-closing={closing || undefined} className="sheet-backdrop fixed inset-0 z-[90] flex items-stretch justify-center bg-ink/45 backdrop-blur-sm sm:items-center sm:p-6"
        onClick={(e) => { if (!closing && e.target === e.currentTarget) onClose(); }}>
        <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId} tabIndex={-1} data-closing={closing || undefined}
          className="sheet-panel relative flex h-[100dvh] w-full flex-col bg-paper outline-none sm:h-[min(760px,calc(100dvh-3rem))] sm:max-w-4xl sm:rounded-[2rem] sm:shadow-lift">
          {/* Encabezado: capítulo, avance y Saltar */}
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-[max(.75rem,env(safe-area-inset-top))] pb-2 sm:px-6 sm:pt-5">
            {/* Sin truncar: en 360 px "Cómo funciona la app" no cabía junto al contador y Saltar; parte en dos líneas. */}
            <div className="min-w-0 text-[12px] font-bold uppercase leading-tight tracking-[.1em] text-banana-ink sm:tracking-[.14em]">
              <span className="sr-only">Guía de la app. </span>{step.chapter}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className="text-xs font-semibold text-muted tabular-nums" aria-hidden>{idx + 1} de {steps.length}</span>
              {!isLast && <button type="button" onClick={onClose} className="pressable h-11 rounded-full px-3 text-sm font-bold text-ink hover:bg-white">Saltar</button>}
              <button type="button" onClick={onClose} aria-label="Cerrar la guía" className="pressable grid size-11 place-items-center rounded-full text-muted hover:bg-white hover:text-ink">
                <X weight="bold" className="size-5" aria-hidden />
              </button>
            </div>
          </div>

          {/* Contenido del paso */}
          <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-6">
            <div key={step.id} className="guide-step grid gap-5 sm:min-h-[calc(100%-1.5rem)] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] sm:content-center sm:items-center sm:gap-8" style={{ "--guide-dx": `${dir * 12}px` } as React.CSSProperties}>
              {/* Alto mínimo (no fijo): un visual más alto que la caja en pantallas bajas (la doble progresión en 360x640)
                  crece en vez de quedar cortado arriba y abajo. Grid: los hijos h-full toman el alto de la fila. */}
              <div className="grid min-h-[clamp(180px,31dvh,280px)] sm:min-h-[min(440px,calc(100dvh-16rem))]">
                <GuideVisual step={step} input={input} />
              </div>
              <div className="min-w-0 sm:py-4">
                <h2 id={titleId} className="text-[26px] font-extrabold leading-[1.1] tracking-tight text-ink sm:text-3xl">{step.title}</h2>
                <div id={bodyId}>
                  <p className="mt-3 text-[15px] leading-relaxed text-body">{step.body}</p>
                  {step.bullets.length > 0 && (
                    <ul className="mt-4 space-y-2.5">
                      {step.bullets.map((b) => <li key={b} className="flex gap-2.5 text-[15px] leading-snug text-ink"><CheckCircle weight="fill" aria-hidden className="mt-0.5 size-5 shrink-0 text-peel" />{b}</li>)}
                    </ul>
                  )}
                  {step.note && <p className="mt-4 rounded-2xl bg-white/80 px-3.5 py-2.5 text-sm text-muted ring-1 ring-line">{step.note}</p>}
                </div>
                {step.cta && (
                  <Link href={step.cta.href} onClick={onClose} className="tap mt-5 inline-flex min-h-11 items-center gap-1.5 font-bold text-ink underline decoration-banana decoration-2 underline-offset-[6px] hover:decoration-ink">
                    <span className="sr-only">Probar ahora: </span>{step.cta.label}<ArrowRight weight="bold" className="size-4" aria-hidden />
                  </Link>
                )}
              </div>
            </div>
            {/* Desvanecido al pie: avisa que hay más texto si el paso no cabe en la pantalla */}
            <div aria-hidden className="pointer-events-none sticky bottom-0 -mx-4 -mb-4 h-6 bg-gradient-to-t from-paper to-transparent sm:-mx-6" />
          </div>

          {/* Pie: puntos, Atrás y Siguiente */}
          <div className="shrink-0 border-t border-line/80 bg-paper px-4 pt-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:rounded-b-[2rem] sm:px-6 sm:pb-5">
            <p className="sr-only" aria-live="polite">Paso {idx + 1} de {steps.length}: {step.title}</p>
            <div className="sm:flex sm:items-center sm:justify-between sm:gap-6">
            {/* Celular: barra de avance (no caben 16 puntos de 24 px). Escritorio: puntos que llevan a cada paso. */}
            <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-line sm:hidden"><div className="h-full rounded-full bg-ink transition-[width] duration-(--dur-base) ease-out" style={{ width: `${((idx + 1) / steps.length) * 100}%` }} /></div>
            <ol className="hidden flex-wrap items-center justify-start sm:flex" aria-label="Pasos de la guía">
              {steps.map((s, n) => (
                <li key={s.id}>
                  <button type="button" onClick={() => go(n)} aria-label={`Paso ${n + 1}: ${s.title}`} aria-current={n === idx ? "step" : undefined}
                    className="group grid h-8 min-w-6 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-banana/60">
                    <span className={`block h-2 rounded-full transition-[width,background-color] duration-(--dur-fast) ease-out ${n === idx ? "w-5 bg-ink" : n < idx ? "w-2 bg-ink/40" : "w-2 bg-line group-hover:bg-ink/25"}`} />
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex items-center gap-2 sm:mt-0 sm:shrink-0">
              <button type="button" onClick={() => { if (idx === 1) primary.current?.focus(); go(idx - 1); }} disabled={idx === 0} className="btn-ghost h-12 px-4 disabled:invisible">
                <ArrowLeft weight="bold" className="size-4" aria-hidden />Atrás
              </button>
              {/* Un solo botón (no se desmonta al llegar al final): el foco del teclado no se pierde. */}
              <button ref={primary} type="button" data-autofocus onClick={() => (isLast ? onClose() : go(idx + 1))} className={`${isLast ? "btn-primary" : "btn-banana"} h-12 flex-1 sm:w-44 sm:flex-none`}>
                {isLast ? "Terminar" : idx === 0 ? "Empezar" : "Siguiente"}{!isLast && <ArrowRight weight="bold" className="size-4" aria-hidden />}
              </button>
            </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
