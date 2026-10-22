// Gráficas SVG inline, livianas y accesibles (sin librerías). Server components.
// El SVG solo dibuja marcas; los textos (ejes, máximos) son HTML de 12 px o más para que no se encojan con el ancho.
// Cada gráfica trae un resumen (figcaption) y una tabla sr-only con los datos para lectores de pantalla.
import type { ReactNode } from "react";
import { fmtDay, fmtNum } from "@/lib/admin-format";

type Point = { day: string; n: number };

function Frame({ label, summary, data, unit = "", max, children }: { label: string; summary: string; data: Point[]; unit?: string; max: number; children: ReactNode }) {
  const allZero = data.every((d) => d.n === 0);
  return (
    <figure className="m-0">
      {allZero ? (
        <p className="grid h-36 place-items-center rounded-2xl bg-paper/60 text-sm text-muted">Sin registros en este periodo.</p>
      ) : (
        <>
          <div className="relative pt-5">
            <span className="pointer-events-none absolute left-0 top-0 text-xs font-semibold text-muted tabular-nums" aria-hidden>Máx. {fmtNum(max)}{unit}</span>
            {children}
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted tabular-nums" aria-hidden><span>{fmtDay(data[0]?.day)}</span><span>Hoy</span></div>
        </>
      )}
      <figcaption className="sr-only">{summary}</figcaption>
      <table className="sr-only">
        <caption>{label}: datos por día</caption>
        <thead><tr><th scope="col">Día</th><th scope="col">Valor</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.day}><td>{fmtDay(d.day)}</td><td>{fmtNum(d.n)}{unit}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

const summaryOf = (label: string, data: Point[], unit: string) => {
  const total = data.reduce((a, b) => a + b.n, 0);
  const max = Math.max(0, ...data.map((d) => d.n));
  const peak = data.find((d) => d.n === max);
  const last = data[data.length - 1];
  return `${label}: ${fmtNum(total)}${unit} en ${data.length} días; hoy ${fmtNum(last?.n ?? 0)}${unit}; máximo ${fmtNum(max)}${unit}${peak ? ` el ${fmtDay(peak.day)}` : ""}.`;
};

/** Barras diarias con la última barra (hoy) resaltada. `data` en orden cronológico. */
export function BarChart({ data, label, unit = "", height = 140, color = "var(--color-banana)" }: { data: Point[]; label: string; unit?: string; height?: number; color?: string }) {
  const W = 600, H = height;
  const max = Math.max(1, ...data.map((d) => d.n));
  const bw = W / Math.max(1, data.length);
  const summary = summaryOf(label, data, unit);
  return (
    <Frame label={label} summary={summary} data={data} unit={unit} max={max}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto" role="img" aria-label={summary}>
        {[0.5, 1].map((g) => <line key={g} x1={0} x2={W} y1={H - (H - 4) * g} y2={H - (H - 4) * g} stroke="var(--color-line)" strokeDasharray="3 4" />)}
        {data.map((d, i) => {
          const h = Math.max(d.n ? 3 : 1, ((H - 4) * d.n) / max);
          const last = i === data.length - 1;
          return (
            <rect key={d.day} x={i * bw + 1.5} y={H - h} width={Math.max(2, bw - 3)} height={h} rx={3} fill={last ? "var(--color-ink)" : d.n ? color : "var(--color-line)"}>
              <title>{`${fmtDay(d.day)}: ${fmtNum(d.n)}${unit}`}</title>
            </rect>
          );
        })}
      </svg>
    </Frame>
  );
}

/** Línea simple (p. ej. usuarios activos por día). */
export function LineChart({ data, label, unit = "", height = 140, color = "var(--color-ember)" }: { data: Point[]; label: string; unit?: string; height?: number; color?: string }) {
  const W = 600, H = height;
  const max = Math.max(1, ...data.map((d) => d.n));
  const x = (i: number) => 4 + (i * (W - 8)) / Math.max(1, data.length - 1);
  const y = (n: number) => H - 4 - ((H - 10) * n) / max;
  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.n).toFixed(1)}`).join(" ");
  const summary = summaryOf(label, data, unit);
  return (
    <Frame label={label} summary={summary} data={data} unit={unit} max={max}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto" role="img" aria-label={summary}>
        {[0.5, 1].map((g) => <line key={g} x1={0} x2={W} y1={y(max * g)} y2={y(max * g)} stroke="var(--color-line)" strokeDasharray="3 4" />)}
        <polygon points={`${x(0)},${H - 4} ${pts} ${x(data.length - 1)},${H - 4}`} fill={color} opacity={0.12} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => <circle key={d.day} cx={x(i)} cy={y(d.n)} r={i === data.length - 1 ? 4 : 6} fill={i === data.length - 1 ? color : "transparent"}><title>{`${fmtDay(d.day)}: ${fmtNum(d.n)}${unit}`}</title></circle>)}
      </svg>
    </Frame>
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
  const kg = (n: number) => `${fmtNum(n)} kg`;
  const sign = diff > 0 ? "+" : "";
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img"
        aria-label={`${label}: de ${kg(first.kg)} (${fmtDay(first.day)}) a ${kg(last.kg)} (${fmtDay(last.day)}), ${sign}${kg(diff)}, ${values.length} pesajes.`}>
        <polyline points={values.map((v, i) => `${x(i)},${y(v.kg)}`).join(" ")} fill="none" stroke="var(--color-ember)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <circle cx={x(values.length - 1)} cy={y(last.kg)} r={3} fill="var(--color-ember)" />
      </svg>
      <figcaption className="mt-1 flex flex-wrap justify-between gap-x-3 text-xs text-muted tabular-nums">
        <span>{kg(first.kg)} · {fmtDay(first.day)}</span>
        <span className={diff <= 0 ? "text-peel font-bold" : "text-bad font-bold"}>{sign}{kg(diff)}</span>
        <span>{kg(last.kg)} · {fmtDay(last.day)}</span>
      </figcaption>
    </figure>
  );
}

/** Mapa de 28 días (actividad). */
export function ActivityStrip({ days, today, label }: { days: string[]; today: string; label: string }) {
  const set = new Set(days);
  const cells = Array.from({ length: 28 }, (_, i) => { const d = new Date(Date.parse(today + "T00:00:00Z") - (27 - i) * 864e5).toISOString().slice(0, 10); return { d, on: set.has(d) }; });
  return (
    <div>
      <div role="img" aria-label={`${label}: ${cells.filter((c) => c.on).length} de 28 días.`} className="grid gap-1" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
        {cells.map((c) => <span key={c.d} title={`${fmtDay(c.d)}${c.on ? ": con entreno" : ""}`} className={`aspect-square rounded-[4px] ${c.on ? "bg-peel" : "bg-line"}`} />)}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted" aria-hidden><span>{fmtDay(cells[0].d)}</span><span>Hoy</span></div>
    </div>
  );
}
