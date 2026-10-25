"use client";
import { useState } from "react";

// Variables del tema: con Platanita salen en rosado (banana, ember y banana-ink se remapean).
const COLORS = ["var(--color-banana)", "var(--color-ember)", "#3F6B0E", "var(--color-banana-ink)", "#1B1505"];

/**
 * Confeti CSS ligero (sin librerías), solo para el cierre de un entreno: un momento raro, así que se permite el gusto.
 * Rendimiento: cada pieza anima únicamente transform (en GPU), una sola vez, y el contenedor se vacía al terminar.
 * La caída usa una curva de gravedad (acelera al bajar); no es una respuesta de interfaz, es física.
 * Con movimiento reducido no se muestra.
 */
export function Confetti({ n = 48 }: { n?: number }) {
  const [bits] = useState(() => Array.from({ length: n }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.35, dur: 1.9 + Math.random() * 1.3, rot: Math.round(Math.random() * 360),
    dx: Math.round((Math.random() - 0.5) * 80), color: COLORS[i % COLORS.length], w: 6 + Math.random() * 5, round: i % 3 === 0,
  })));
  const [done, setDone] = useState(0);
  if (done >= n) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[70] overflow-hidden motion-reduce:hidden">
      {bits.map((b, i) => (
        <span key={i} onAnimationEnd={() => setDone((d) => d + 1)}
          className="absolute -top-4 will-change-transform animate-[confetti_var(--d)_cubic-bezier(.45,.05,.75,.6)_var(--dl)_both]"
          style={{ left: `${b.left}%`, width: b.w, height: b.round ? b.w : b.w * 1.6, background: b.color, borderRadius: b.round ? 999 : 2, ["--r" as string]: `${b.rot}deg`, ["--dx" as string]: `${b.dx}px`, ["--d" as string]: `${b.dur}s`, ["--dl" as string]: `${b.delay}s` }} />
      ))}
    </div>
  );
}
