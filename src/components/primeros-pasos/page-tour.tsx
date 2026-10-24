"use client";
// Recorrido guiado sobre la pantalla real (Hoy, Entrenar): ilumina cada parte y la explica en una frase. Se abre solo la
// primera vez (después de la guía de bienvenida, nunca encima) y se repite con el botón "¿Cómo se usa?".
import { useCallback, useEffect, useState } from "react";
import { Question } from "@/components/icons";
import { Tour, type TourStep } from "@/components/workout/tour";
import { useGuide } from "@/components/guide/guide-provider";
import { TOUR_KEYS, shouldAutoTour, type TourId } from "@/lib/primeros-pasos";
import { useLearnKeys } from "./learn-store";

const REPLAY = "bb:como-se-usa";

export function PageTour({ tour, steps, serverKeys, finalLabel = "Entendido" }: { tour: TourId; steps: TourStep[]; serverKeys: readonly string[]; finalLabel?: string }) {
  const { keys, ready, mark } = useLearnKeys(serverKeys);
  const guide = useGuide();
  const [open, setOpen] = useState(false);
  const [auto, setAuto] = useState(false);

  // Primera vez: espera a que la guía decida (y se cierre) y a que la pantalla pinte.
  useEffect(() => {
    if (!ready || auto || open) return;
    const blocked = !guide || !guide.settled || guide.guideOpen;
    if (!shouldAutoTour({ keys, tour, blocked })) return;
    const t = setTimeout(() => { setAuto(true); setOpen(true); }, 700);
    return () => clearTimeout(t);
  }, [ready, auto, open, guide, keys, tour]);

  useEffect(() => {
    const h = (e: Event) => { if ((e as CustomEvent<string>).detail === tour) setOpen(true); };
    window.addEventListener(REPLAY, h);
    return () => window.removeEventListener(REPLAY, h);
  }, [tour]);

  const done = useCallback(() => { setOpen(false); mark(TOUR_KEYS[tour]); }, [mark, tour]);
  return open ? <Tour steps={steps} onDone={done} finalLabel={finalLabel} /> : null;
}

/** Botón "¿Cómo se usa?" para repetir el recorrido de la pantalla. */
export function HowToButton({ tour, className = "" }: { tour: TourId; className?: string }) {
  return (
    <button type="button" onClick={() => { try { window.dispatchEvent(new CustomEvent(REPLAY, { detail: tour })); } catch { /* */ } }}
      className={`tap inline-flex min-h-11 items-center gap-1.5 rounded-full px-1 text-sm font-bold text-muted hover:text-ink ${className}`}>
      <Question weight="bold" className="size-4" />¿Cómo se usa?
    </button>
  );
}
