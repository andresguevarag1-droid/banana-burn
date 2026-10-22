"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { framesFor } from "@/lib/exercise-frames";

type Kind = "ecc" | "con" | "hold" | "air";
type Phase = [string, number, string, Kind];

/** Fases para ilustraciones cuyo par A/B no coincide con las poses del motor vectorial. */
const IMAGE_PHASES: Record<string, Phase[]> = {
  burpee: [["A", 0.9, "Plancha firme", "hold"], ["B", 0.7, "Salta y estira", "con"], ["B", 0.3, "Aterriza suave", "hold"], ["A", 0.8, "Atrás a plancha", "ecc"]],
};

/**
 * Técnica del ejercicio. Si hay ilustración del mono (pose inicial y final), alterna las dos
 * siguiendo el tempo de cada fase; si no, o si la imagen falla, usa el atleta vectorial animado.
 */
export function ExerciseMotion({ anim, label = true, className = "" }: { anim: string; label?: boolean; className?: string }) {
  const frames = framesFor(anim);
  const [broken, setBroken] = useState(false);
  if (frames && !broken) return <ExerciseFrames anim={anim} frames={frames} label={label} className={className} onFail={() => setBroken(true)} />;
  return <ExerciseVector anim={anim} label={label} className={className} />;
}

function ExerciseVector({ anim, label, className }: { anim: string; label: boolean; className: string }) {
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

function ExerciseFrames({ anim, frames, label, className, onFail }: { anim: string; frames: { A: string; B: string }; label: boolean; className: string; onFail: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const fills = useRef<(HTMLElement | null)[]>([]);
  const [phases, setPhases] = useState<Phase[] | null>(IMAGE_PHASES[anim] ?? null);
  const [pose, setPose] = useState<"A" | "B">("A");
  const [text, setText] = useState("");
  const [still, setStill] = useState(false);

  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (IMAGE_PHASES[anim]) { setPhases(IMAGE_PHASES[anim]); return; }
    let alive = true;
    import("@/lib/motion").then(({ ANIM }) => {
      const ph = ANIM[anim]?.ph as Phase[] | undefined;
      if (alive) setPhases(ph?.length ? ph : [["B", 1.2, "", "con"], ["A", 1.2, "", "ecc"]]);
    });
    return () => { alive = false; };
  }, [anim]);

  useEffect(() => {
    const el = root.current;
    if (!el || !phases || still) return;
    const total = phases.reduce((s, p) => s + p[1], 0);
    let raf = 0, visible = true, start = performance.now(), paused = 0, last = -1;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      let t = ((now - start) / 1000) % total, i = 0;
      while (i < phases.length - 1 && t >= phases[i][1]) { t -= phases[i][1]; i++; }
      if (i !== last) {
        last = i;
        setPose(phases[i][0] === "A" ? "A" : "B");
        setText(phases[i][2]);
      }
      fills.current.forEach((f, j) => { if (f) f.style.transform = `scaleX(${j < i ? 1 : j === i ? t / phases[i][1] : 0})`; });
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !visible) start += performance.now() - paused;
      if (!e.isIntersecting && visible) paused = performance.now();
      visible = e.isIntersecting;
    });
    io.observe(el);
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [phases, still]);

  const img = (src: string, on: boolean, alt: string) => (
    <Image src={src} alt={alt} fill sizes={label ? "320px" : "96px"} onError={onFail} draggable={false}
      className={`object-contain select-none transition-[opacity,filter] duration-[420ms] ease-(--ease-in-out) ${on ? "opacity-100 blur-0" : "opacity-0 blur-[2px]"}`} />
  );

  if (still) {
    return (
      <div role="img" aria-label="Posición inicial y final del ejercicio" className={`motion ${className}`}>
        <div className="relative flex-1 min-h-0 grid grid-cols-2 gap-1">
          <div className="relative">{img(frames.A, true, "")}</div>
          {label ? <div className="relative">{img(frames.B, true, "")}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div ref={root} role="img" aria-label="Animación de la técnica" className={`motion ${className}`}>
      {label && phases ? (
        <div className="motion-hud" aria-hidden="true">
          <p className="motion-label">{text}</p>
          <div className="motion-track">
            {phases.map(([, d, , k], j) => (
              <span key={j} className="motion-seg" style={{ flexGrow: d }}><i data-k={k} ref={(n) => { fills.current[j] = n; }} /></span>
            ))}
          </div>
        </div>
      ) : null}
      <div className="relative flex-1 min-h-0 overflow-hidden rounded-2xl">
        {img(frames.A, pose === "A", "")}
        {img(frames.B, pose === "B", "")}
      </div>
    </div>
  );
}
