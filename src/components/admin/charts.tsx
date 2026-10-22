// Gráficas SVG inline, livianas y accesibles (sin librerías). Server components.
import type { ReactNode } from "react";

const fmtDay = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("es-CR", { day: "numeric", month: "short", timeZone: "UTC" });

/** Barras diarias con la última barra resaltada. `data` en orden cronológico. */
export function BarChart({ data, label, unit = "", height = 140, color = "var(--color-banana)" }: { data: { day: string; n: number }[]; label: string; unit?: string; height?: number; color?: string }) {
  const W = 600, H = height, pad = 18;
  const max = Math.max(1, ...data.map((d) => d.n));
  const bw = (W - pad) / data.length;
  const total = data.reduce((a, b) => a + b.n, 0);
  return (
    <Figure label={label} summary={`${label}: ${total}${unit} en ${data.length} días; máximo ${max}${unit} en un día.`}>
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full h-auto" role="img" aria-label={`${label}. Total ${total}${unit}.`}>
        {[0.5, 1].map((g) => <line key={g} x1={pad} x2={W} y1={H - (H - 8) * g} y2={H - (H - 8) * g} stroke="var(--color-line)" strokeDasharray="3 4" />)}
        <text x={0} y={12} fontSize={10} fill="var(--color-muted)">{max}</text>
        {data.map((d, i) => {
          const h = Math.max(d.n ? 3 : 1, ((H - 8) * d.n) / max);
          const last = i === data.length - 1;
          return (
            <rect key={d.day} x={pad + i * bw + 1.5} y={H - h} width={Math.max(2, bw - 3)} height={h} rx={3} fill={last ? "var(--color-ink)" : d.n ? color : "var(--color-line)"}>
              <title>{`${fmtDay(d.day)}: ${d.n}${unit}`}</title>
            </rect>
          );
        })}
        <text x={pad} y={H + 16} fontSize={10} fill="var(--color-muted)">{fmtDay(data[0]?.day ?? "")}</text>
        <text x={W} y={H + 16} fontSize={10} fill="var(--color-muted)" textAnchor="end">Hoy</text>
      </svg>
    </Figure>
  );
}

/** Línea simple (p. ej. usuarios activos por día). */
export function LineChart({ data, label, height = 140, color = "var(--color-ember)" }: { data: { day: string; n: number }[]; label: string; height?: number; color?: string }) {
  const W = 600, H = height, pad = 18;
  const max = Math.max(1, ...data.map((d) => d.n));
  const x = (i: number) => pad + (i * (W - pad - 4)) / Math.max(1, data.length - 1);
  const y = (n: number) => H - 4 - ((H - 12) * n) / max;
  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.n).toFixed(1)}`).join(" ");
  const last = data[data.length - 1];
  return (
    <Figure label={label} summary={`${label}: hoy ${last?.n ?? 0}, máximo ${max}.`}>
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full h-auto" role="img" aria-label={`${label}. Hoy ${last?.n ?? 0}.`}>
        {[0.5, 1].map((g) => <line key={g} x1={pad} x2={W} y1={y(max * g)} y2={y(max * g)} stroke="var(--color-line)" strokeDasharray="3 4" />)}
        <text x={0} y={12} fontSize={10} fill="var(--color-muted)">{max}</text>
        <polygon points={`${x(0)},${H - 4} ${pts} ${x(data.length - 1)},${H - 4}`} fill={color} opacity={0.12} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => <circle key={d.day} cx={x(i)} cy={y(d.n)} r={i === data.length - 1 ? 4 : 6} fill={i === data.length - 1 ? color : "transparent"}><title>{`${fmtDay(d.day)}: ${d.n}`}</title></circle>)}
        <text x={pad} y={H + 16} fontSize={10} fill="var(--color-muted)">{fmtDay(data[0]?.day ?? "")}</text>
        <text x={W} y={H + 16} fontSize={10} fill="var(--color-muted)" textAnchor="end">Hoy</text>
      </svg>
    </Figure>
  );
}

/** Mini tendencia de peso. */
export function Sparkline({ values, label, width = 240, height = 56 }: { values: { day: string; kg: number }[]; label: string; width?: number; height?: number }) {
  if (values.length < 2) return <p className="text-sm text-muted">Aún no hay suficientes pesajes para una tendencia.</p>;
  const ks = values.map((v) => v.kg);
  const min = Math.min(...ks), max = Math.max(...ks), span = Math.max(0.5, max - min);
  const x = (i: number) => 3 + (i * (width - 6)) / (values.length - 1);
  const y = (k: number) => 4 + ((max - k) * (height - 8)) / span;
  const first = values[0], last = values[values.length - 1];
  const diff = Math.round((last.kg - first.kg) * 10) / 10;
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img"
        aria-label={`${label}: de ${first.kg} kg (${fmtDay(first.day)}) a ${last.kg} kg (${fmtDay(last.day)}), ${diff > 0 ? "+" : ""}${diff} kg.`}>
        <polyline points={values.map((v, i) => `${x(i)},${y(v.kg)}`).join(" ")} fill="none" stroke="var(--color-ember)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <circle cx={x(values.length - 1)} cy={y(last.kg)} r={3} fill="var(--color-ember)" />
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-muted tabular-nums">
        <span>{first.kg} kg · {fmtDay(first.day)}</span>
        <span className={diff <= 0 ? "text-peel font-bold" : "text-bad font-bold"}>{diff > 0 ? "+" : ""}{diff} kg</span>
        <span>{last.kg} kg · {fmtDay(last.day)}</span>
      </figcaption>
    </figure>
  );
}

/** Mapa de 28 días (actividad). */
export function ActivityStrip({ days, today, label }: { days: string[]; today: string; label: string }) {
  const set = new Set(days);
  const cells = Array.from({ length: 28 }, (_, i) => { const d = new Date(Date.parse(today + "T00:00:00Z") - (27 - i) * 864e5).toISOString().slice(0, 10); return { d, on: set.has(d) }; });
  return (
    <div role="img" aria-label={`${label}: ${cells.filter((c) => c.on).length} de 28 días con actividad.`} className="grid grid-cols-14 gap-1" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
      {cells.map((c) => <span key={c.d} title={`${fmtDay(c.d)}${c.on ? ": activo" : ""}`} className={`aspect-square rounded-[4px] ${c.on ? "bg-peel" : "bg-line"}`} />)}
    </div>
  );
}

function Figure({ label, summary, children }: { label: string; summary: string; children: ReactNode }) {
  return (
    <figure className="m-0">
      {children}
      <figcaption className="sr-only">{label}. {summary}</figcaption>
    </figure>
  );
}
