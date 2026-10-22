/**
 * Barra de progreso que anima solo con transform (la barra completa se desliza dentro de su pista),
 * así el extremo redondeado no se deforma y no se recalcula el layout.
 * Sin `label` es decorativa (aria-hidden): úsala cuando el número ya está escrito al lado.
 */
export function ProgressBar({ value, className = "h-2", track = "bg-line", fill = "bg-ink", min = 0, label }: { value: number; className?: string; track?: string; fill?: string; min?: number; label?: string }) {
  const v = Math.min(1, Math.max(min, Number.isFinite(value) ? value : 0));
  return (
    <div className={`overflow-hidden rounded-full ${track} ${className}`}
      {...(label ? { role: "progressbar", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(v * 100) } : { "aria-hidden": true })}>
      <div className={`bar-fill h-full w-full rounded-full ${fill}`} style={{ transform: `translateX(${(v - 1) * 100}%)` }} />
    </div>
  );
}
