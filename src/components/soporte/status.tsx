import { CheckCircle, Circle } from "@/components/icons";
import { STATUS_LABEL, type SupportStatus, type TimelineStep } from "@/lib/support";

/** Colores por estado (texto con contraste AA sobre su fondo). */
export const STATUS_TONE: Record<SupportStatus, string> = {
  recibido: "bg-line text-ink",
  en_proceso: "bg-banana-soft text-banana-ink",
  necesita_info: "bg-ember/15 text-ember-ink",
  resuelto: "bg-peel/10 text-peel",
  cerrado: "bg-line text-muted",
};

export function StatusChip({ status, className = "" }: { status: SupportStatus | string; className?: string }) {
  const s = status as SupportStatus;
  return <span className={`chip h-7 whitespace-nowrap ${STATUS_TONE[s] ?? "bg-line text-ink"} ${className}`}>{STATUS_LABEL[s] ?? status}</span>;
}

const fmt = (iso: string, tz: string) => new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: tz });

/** Línea de tiempo del caso: Recibido, En proceso (y Necesitamos más información si está pendiente), Resuelto. */
export function Timeline({ steps, tz }: { steps: TimelineStep[]; tz: string }) {
  return (
    <ol className="grid gap-0" aria-label="Estado de tu reporte">
      {steps.map((s, i) => (
        <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0" aria-current={s.state === "actual" ? "step" : undefined}>
          {i < steps.length - 1 && <span aria-hidden className={`absolute left-[11px] top-7 bottom-0 w-0.5 ${s.state === "hecho" ? "bg-ink" : "bg-line"}`} />}
          <span className={`relative grid size-6 shrink-0 place-items-center rounded-full ${s.state === "hecho" ? "bg-ink text-banana" : s.state === "actual" ? (s.key === "necesita_info" ? "bg-ember text-ink" : "bg-banana text-ink") : "bg-white text-faint ring-2 ring-line"}`}>
            {s.state === "hecho" ? <CheckCircle weight="fill" className="size-4" aria-hidden /> : <Circle weight={s.state === "actual" ? "fill" : "regular"} className="size-2.5" aria-hidden />}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className={`text-sm font-bold ${s.state === "pendiente" ? "text-muted" : "text-ink"}`}>{s.label}<span className="sr-only">{s.state === "hecho" ? ", listo" : s.state === "actual" ? ", ahora" : ", pendiente"}</span></p>
            {s.at && s.state !== "pendiente" && <p className="text-xs text-muted tabular-nums">{fmt(s.at, tz)}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
