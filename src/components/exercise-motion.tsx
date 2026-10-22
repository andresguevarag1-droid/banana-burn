"use client";
import { useEffect, useRef } from "react";

/** Animación de técnica: figura que hace el movimiento con tempo 3-1-1 y fases. */
export function ExerciseMotion({ anim, label = true, className = "" }: { anim: string; label?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    const el = ref.current;
    import("@/lib/motion").then(({ buildFigure }) => {
      if (!alive || !el) return;
      el.querySelector("svg")?.remove();
      buildFigure(el, anim, { label });
    });
    return () => { alive = false; el?.querySelector("svg")?.remove(); };
  }, [anim, label]);
  return <div ref={ref} className={`motion ${className}`} aria-label="Animación de la técnica" />;
}
