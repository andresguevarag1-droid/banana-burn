"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { sheetFor } from "@/lib/exercise-frames";

type Kind = "ecc" | "con" | "hold" | "air";
/** Fase: fotograma destino (A = 0, B = 3, o un número de 0 a 3), duración en s, texto y tipo. */
type Phase = [string | number, number, string, Kind];
type Dir = "up" | "down" | "forward" | "back" | "out" | "in" | "none";

/** Ejercicios cíclicos o con secuencia propia: recorren los 4 fotogramas de la hoja en orden. */
const SHEET_PHASES: Record<string, { loop?: boolean; ph: Phase[] }> = {
  burpee: { ph: [[0, 0.6, "Plancha firme", "hold"], [1, 0.45, "Pies a las manos", "con"], [2, 0.4, "Ponte de pie", "con"], [3, 0.4, "Salta y estira", "con"], [0, 0.9, "Atrás a plancha", "ecc"]] },
  mountain: { loop: true, ph: [[1, 0.3, "Rodilla al pecho", "con"], [2, 0.3, "Cambia rápido", "air"], [3, 0.3, "Otra rodilla", "con"], [0, 0.3, "Cambia rápido", "air"]] },
  carry: { loop: true, ph: [[1, 0.55, "Paso firme", "air"], [2, 0.55, "Pecho alto", "air"], [3, 0.55, "Hombros abajo", "air"], [0, 0.55, "Agarre fuerte", "air"]] },
  plank: { loop: true, ph: [[1, 1.4, "Respira sin soltar", "hold"], [2, 1.4, "Glúteo y abdomen duros", "hold"], [3, 1.4, "Cuerpo en línea", "hold"], [0, 1.4, "Respira sin soltar", "hold"]] },
};

/** Hacia dónde va el esfuerzo (fase concéntrica) en la ilustración: el mono mira a la derecha. */
const CON_DIR: Record<string, Dir> = {
  squat: "up", frontsquat: "up", bench: "up", incline: "up", ohp: "up", dbpress: "up", deadlift: "up", rdl: "up",
  pullup: "up", dips: "up", row: "up", dbrow: "up", curl: "up", facepull: "back", pushup: "up", plank: "none",
  kneeraise: "up", carry: "none", lateral: "out", squat_bw: "up", jump_bw: "up", rdl_bw: "up", curl_bw: "up",
  burpee: "up", mountain: "none",
};
const REVERSE: Record<Dir, Dir> = { up: "down", down: "up", forward: "back", back: "forward", out: "in", in: "out", none: "none" };
const frameOf = (to: string | number) => (typeof to === "number" ? to : to === "A" ? 0 : 3);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * Técnica del ejercicio con motion graphics: el mono recorre 4 fotogramas del mismo plano al tempo de
 * cada fase, con rango de movimiento en fantasma, flecha del esfuerzo, conteo de la bajada, músculo que
 * trabaja y claves de técnica. Sin hoja de fotogramas, o si la imagen falla, usa el atleta vectorial.
 */
export function ExerciseMotion({ anim, label = true, className = "", mus, cues }: { anim: string; label?: boolean; className?: string; mus?: string; cues?: string[] }) {
  const sheet = sheetFor(anim);
  const [broken, setBroken] = useState(false);
  if (sheet && !broken) return <ExerciseSheet anim={anim} sheet={sheet} label={label} className={className} mus={mus} cues={cues} onFail={() => setBroken(true)} />;
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

type Live = { i: number; left: number; cycle: number };

/** Un fotograma de la hoja 2x2: recorta su cuadrante (con un margen para esconder las líneas divisorias). */
function Frame({ src, n, sizes, onFail, refCb, className = "" }: { src: string; n: number; sizes: string; onFail: () => void; refCb?: (el: HTMLDivElement | null) => void; className?: string }) {
  const col = n % 2, row = Math.floor(n / 2);
  return (
    <div ref={refCb} className={`absolute inset-0 overflow-hidden ${className}`}>
      <div className="absolute w-[200%] h-[200%]" style={{ left: `${-100 * col}%`, top: `${-100 * row}%`, transform: "scale(1.035)", transformOrigin: `${col ? 75 : 25}% ${row ? 75 : 25}%` }}>
        <Image src={src} alt="" fill sizes={sizes} onError={onFail} draggable={false} className="object-cover select-none" />
      </div>
    </div>
  );
}

function ExerciseSheet({ anim, sheet, label, className, mus, cues, onFail }: {
  anim: string; sheet: string; label: boolean; className: string; mus?: string; cues?: string[]; onFail: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const fills = useRef<(HTMLElement | null)[]>([]);
  const custom = SHEET_PHASES[anim];
  const loop = !!custom?.loop;
  const [phases, setPhases] = useState<Phase[] | null>(custom?.ph ?? null);
  const [live, setLive] = useState<Live>({ i: -1, left: 0, cycle: 0 });
  const [still, setStill] = useState(false);
  const conDir = CON_DIR[anim] ?? "none";
  const sizes = label ? "720px" : "224px";

  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (SHEET_PHASES[anim]) { setPhases(SHEET_PHASES[anim].ph); return; }
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
    const from = (i: number) => frameOf(phases[(i - 1 + phases.length) % phases.length][0]);
    let raf = 0, visible = true, start = performance.now(), paused = 0, lastI = -1, lastLeft = -1;
    const paint = (f: number, a: number, b: number) => {
      // Fotograma base opaco + el siguiente encima con opacidad = avance: así el paso entre poses se ve continuo.
      const lo = loop ? a : Math.floor(f), hi = loop ? b : Math.ceil(f), w = loop ? f : f - lo;
      layers.current.forEach((l, n) => {
        if (!l) return;
        l.style.zIndex = n === hi ? "2" : n === lo ? "1" : "0";
        l.style.opacity = n === lo ? "1" : n === hi ? String(w) : "0";
      });
      if (ghostRef.current) {
        const g = f >= 1.5 ? 0 : 3;
        ghostRef.current.dataset.frame = String(g);
        ghostRef.current.style.opacity = loop ? "0" : String(Math.min(1, Math.abs(f - g) / 2) * 0.28);
      }
    };
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      const elapsed = (now - start) / 1000;
      let t = elapsed % total, i = 0;
      while (i < phases.length - 1 && t >= phases[i][1]) { t -= phases[i][1]; i++; }
      const [to, d, , k] = phases[i];
      const a = from(i), b = frameOf(to), p = k === "hold" && a === b ? 1 : easeInOut(Math.min(1, t / d));
      if (loop) paint(p, a, b);
      else paint(a + (b - a) * p, a, b);
      const left = Math.ceil(d - t);
      if (i !== lastI || left !== lastLeft) {
        lastI = i; lastLeft = left;
        setLive({ i, left, cycle: Math.floor(elapsed / total) });
      }
      fills.current.forEach((f, j) => { if (f) f.style.transform = `scaleX(${j < i ? 1 : j === i ? t / d : 0})`; });
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !visible) start += performance.now() - paused;
      if (!e.isIntersecting && visible) paused = performance.now();
      visible = e.isIntersecting;
    });
    io.observe(el);
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [phases, still, loop]);

  if (still) {
    return (
      <div role="img" aria-label="Posición inicial y final del ejercicio" className={`motion ${className}`}>
        <div className="relative flex-1 min-h-0 grid grid-cols-2 gap-1">
          <div className="relative overflow-hidden rounded-xl"><Frame src={sheet} n={0} sizes={sizes} onFail={onFail} /></div>
          {label ? <div className="relative overflow-hidden rounded-xl"><Frame src={sheet} n={3} sizes={sizes} onFail={onFail} /></div> : null}
        </div>
      </div>
    );
  }

  const ph = phases && live.i >= 0 ? phases[live.i] : null;
  const kind = ph?.[3];
  const moving = kind === "con" || kind === "ecc";
  const dir: Dir = !ph ? "none" : kind === "con" ? conDir : kind === "ecc" ? REVERSE[conDir] : "none";
  const cue = cues?.length ? cues[live.cycle % cues.length] : null;
  const muscles = mus?.split(/,| y /).map((s) => s.trim()).filter(Boolean).slice(0, 2).join(" y ");

  return (
    <div ref={root} role="img" aria-label="Animación de la técnica" className={`motion ${className}`}>
      {label && phases ? (
        <div className="motion-hud" aria-hidden="true">
          <p className="motion-label">{ph?.[2] ?? ""}</p>
          <div className="motion-track">
            {phases.map(([, d, , k], j) => (
              <span key={j} className="motion-seg" style={{ flexGrow: d }}><i data-k={k} ref={(n) => { fills.current[j] = n; }} /></span>
            ))}
          </div>
        </div>
      ) : null}
      <div className="relative flex-1 min-h-0 flex justify-center">
        <div className="relative h-full aspect-square max-w-full overflow-hidden rounded-2xl bg-banana">
          {[0, 1, 2, 3].map((n) => (
            <Frame key={n} src={sheet} n={n} sizes={sizes} onFail={onFail} refCb={(l) => { layers.current[n] = l; }} className={n === 0 ? "" : "opacity-0"} />
          ))}
          {label && !loop ? <GhostFrame sheet={sheet} sizes={sizes} onFail={onFail} refCb={(g) => { ghostRef.current = g; }} /> : null}
          {label && ph ? (
            <div className="absolute inset-0 z-10 pointer-events-none" aria-hidden="true">
              {moving && dir !== "none" ? <Arrow key={`a${live.i}-${live.cycle}`} dir={dir} strong={kind === "con"} dur={Math.min(ph[1], 0.9)} /> : null}
              {kind === "ecc" && ph[1] >= 1.5 && live.left > 0 ? (
                <span key={`n${live.i}-${live.left}`} className="mg-pop absolute left-[6%] top-[5%] text-5xl font-black tabular-nums text-ink [text-shadow:0_2px_0_#fff,0_0_14px_rgb(255_255_255/.8)]">{live.left}</span>
              ) : null}
              {kind === "hold" && ph[1] >= 0.6 && !loop && frameOf(ph[0]) === 3 ? (
                <span key={`h${live.i}`} className="mg-pop absolute left-[6%] top-[6%] rounded-full bg-ink px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-banana">Sostén</span>
              ) : null}
              {muscles ? (
                <span className={`absolute right-[4%] top-[4%] max-w-[60%] truncate rounded-full px-2.5 py-1 text-[11px] font-bold transition-[background-color,color,transform] duration-300 ease-out ${kind === "con" ? "bg-[var(--ember)] text-white scale-105" : "bg-white/85 text-ink"}`}>{muscles}</span>
              ) : null}
              {cue ? (
                <span key={`c${live.cycle}`} className="mg-rise absolute inset-x-[6%] bottom-[4%] mx-auto w-fit max-w-[88%] text-center rounded-xl bg-ink px-2.5 py-1 text-[11px] font-bold leading-tight text-white">{cue}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Silueta del extremo opuesto del movimiento: deja ver el rango completo mientras el mono se mueve. */
function GhostFrame({ sheet, sizes, onFail, refCb }: { sheet: string; sizes: string; onFail: () => void; refCb: (el: HTMLDivElement | null) => void }) {
  const [frame, setFrame] = useState(3);
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const mo = new MutationObserver(() => { const f = Number(el.dataset.frame ?? 3); setFrame((cur) => (cur === f ? cur : f)); });
    mo.observe(el, { attributes: true, attributeFilter: ["data-frame"] });
    return () => mo.disconnect();
  }, []);
  return (
    <div ref={(el) => { box.current = el; refCb(el); }} data-frame="3" className="absolute inset-0 z-[3] mix-blend-darken opacity-0">
      <Frame src={sheet} n={frame} sizes={sizes} onFail={onFail} />
    </div>
  );
}

const ARROWS: Record<Exclude<Dir, "none">, [number, number, number, number][]> = {
  up: [[88, 72, 88, 34]], down: [[88, 34, 88, 72]],
  forward: [[60, 46, 92, 46]], back: [[92, 46, 60, 46]],
  out: [[38, 44, 12, 30], [62, 44, 88, 30]], in: [[12, 30, 38, 44], [88, 30, 62, 44]],
};

/** Flecha que se dibuja en la dirección del movimiento: llena y naranja en el esfuerzo, punteada al bajar. */
function Arrow({ dir, strong, dur }: { dir: Exclude<Dir, "none">; strong: boolean; dur: number }) {
  const color = strong ? "var(--ember)" : "var(--color-ink)";
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible" style={{ ["--mg-d" as string]: `${dur}s` }}>
      {ARROWS[dir].map(([x1, y1, x2, y2], j) => {
        const a = Math.atan2(y2 - y1, x2 - x1), h = 6;
        const p = (t: number) => `${(x2 - h * Math.cos(a + t)).toFixed(1)},${(y2 - h * Math.sin(a + t)).toFixed(1)}`;
        return (
          <g key={j} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
            <path d={`M${x1} ${y1} L${x2} ${y2}`} pathLength={1} strokeWidth={9} stroke="#fff" opacity={0.85} className="mg-draw" />
            <path d={`M${x1} ${y1} L${x2} ${y2}`} pathLength={1} strokeWidth={4} strokeDasharray={strong ? undefined : "0.08 0.07"} className={strong ? "mg-draw" : "mg-fade"} />
            <path d={`M${p(0.55)} L${x2} ${y2} L${p(-0.55)}`} strokeWidth={4} className="mg-head" />
          </g>
        );
      })}
    </svg>
  );
}
