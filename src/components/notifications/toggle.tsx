"use client";

/**
 * Interruptor único de la app (avisos, comunidad, Banana Shield). Botón con role="switch", área táctil ≥ 44 px,
 * anillo de foco visible con teclado y animación corta que respeta prefers-reduced-motion.
 */
export function Toggle({ on, onChange, title, hint, disabled = false, boxed = false, id }: { on: boolean; onChange: (v: boolean) => void; title: string; hint?: string; disabled?: boolean; boxed?: boolean; id?: string }) {
  return (
    <button id={id} type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}
      className={`group flex w-full min-h-11 items-center gap-3 text-left outline-none rounded-2xl focus-visible:ring-4 focus-visible:ring-banana/60 disabled:opacity-50 ${boxed ? "bg-cream p-3" : "py-3"}`}>
      <span className="flex-1 min-w-0"><span className="block text-sm font-bold text-ink">{title}</span>{hint && <span className="block text-xs text-muted">{hint}</span>}</span>
      <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-(--dur-fast) motion-reduce:transition-none ${on ? "bg-ink" : "bg-line"}`}>
        <span className={`absolute left-1 top-1 size-5 rounded-full shadow transition-[translate,background-color] duration-(--dur-fast) ease-out motion-reduce:transition-none ${on ? "translate-x-5 bg-banana" : "bg-white"}`} />
      </span>
    </button>
  );
}
