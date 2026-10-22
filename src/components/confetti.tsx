"use client";
import { useMemo } from "react";

/** Confeti CSS ligero (sin librerías). Respeta reducción de movimiento. */
export function Confetti({ n = 70 }: { n?: number }) {
  const bits = useMemo(() => Array.from({ length: n }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.6, dur: 2.2 + Math.random() * 1.8, rot: Math.random() * 360,
    color: ["#FFD60A", "#FF5A1F", "#23A455", "#2F6FED", "#1B1505"][i % 5], w: 6 + Math.random() * 6, round: i % 3 === 0,
  })), [n]);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[70] overflow-hidden motion-reduce:hidden">
      {bits.map((b, i) => (
        <span key={i} className="absolute -top-4 animate-[confetti_var(--d)_ease-in_var(--dl)_both]"
          style={{ left: `${b.left}%`, width: b.w, height: b.round ? b.w : b.w * 1.6, background: b.color, borderRadius: b.round ? 999 : 2, transform: `rotate(${b.rot}deg)`, ["--d" as string]: `${b.dur}s`, ["--dl" as string]: `${b.delay}s` }} />
      ))}
    </div>
  );
}
