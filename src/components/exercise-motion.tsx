"use client";
import { useEffect, useRef } from "react";

/** Animación de técnica: atleta ilustrado que hace el movimiento con su tempo y fases. */
export function ExerciseMotion({ anim, label = true, className = "" }: { anim: string; label?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    let handle: { destroy: () => void } | null = null;
    const el = ref.current;
    import("@/lib/motion").then(({ buildFigure }) => {
      if (!alive || !el) return;
      handle = buildFigure(el, anim, { label });
    });
    return () => { alive = false; handle?.destroy(); };
  }, [anim, label]);
  return <div ref={ref} role="img" aria-label="Animación de la técnica" className={`motion ${className}`} />;
}
