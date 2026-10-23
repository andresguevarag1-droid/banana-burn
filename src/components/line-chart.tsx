import type { Point } from "@/lib/progress";
import { ChartLine } from "@/components/icons";

/** Gráfica de línea SVG ligera (sin librerías). `goal` dibuja una línea meta. */
export function LineChart({ data, goal, unit = "kg", height = 180, trend = false }: { data: Point[]; goal?: number; unit?: string; height?: number; trend?: boolean }) {
  if (data.length < 2) return <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-cream px-4 text-center text-sm text-muted" style={{ height }}><ChartLine weight="duotone" className="size-7 text-banana-ink" />Registra al menos 2 datos para ver la curva</div>;
  const W = 600, H = height, pl = 8, pr = 44, pt = 14, pb = 26;
  const xs = data.map((p) => new Date(p.d + "T12:00:00").getTime());
  const vals = data.map((p) => p.v);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max(0.5, (hi - lo) * 0.15); lo -= pad; hi += pad;
  const x = (t: number) => pl + ((t - xs[0]) / Math.max(1, xs.at(-1)! - xs[0])) * (W - pl - pr);
  const y = (v: number) => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  const path = data.map((p, i) => `${i ? "L" : "M"}${x(xs[i]).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const area = `${path} L${x(xs.at(-1)!).toFixed(1)} ${H - pb} L${x(xs[0]).toFixed(1)} ${H - pb} Z`;
  // tendencia (media móvil de 3)
  const ma = trend ? data.map((_, i) => { const s = data.slice(Math.max(0, i - 2), i + 1); return s.reduce((a, b) => a + b.v, 0) / s.length; }) : [];
  const maPath = ma.map((v, i) => `${i ? "L" : "M"}${x(xs[i]).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es-419", { day: "numeric", month: "short" });
  const last = data.at(-1)!;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Gráfica, último valor ${last.v} ${unit}`}>
      <defs><linearGradient id="lcfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFD60A" stopOpacity=".45" /><stop offset="1" stopColor="#FFD60A" stopOpacity="0" /></linearGradient></defs>
      {ticks.map((t) => (
        <g key={t}><line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="#EDE3C6" strokeDasharray="3 5" /><text x={W - pr + 6} y={y(t) + 4} fontSize="15" fill="#A0957C">{t.toLocaleString("es-419", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</text></g>
      ))}
      {goal != null && goal >= lo && goal <= hi && (<g><line x1={pl} x2={W - pr} y1={y(goal)} y2={y(goal)} stroke="#3F6B0E" strokeWidth="1.5" strokeDasharray="6 4" /><text x={pl + 4} y={y(goal) - 6} fontSize="15" fontWeight="700" fill="#3F6B0E">Meta {goal.toLocaleString("es-419")} {unit}</text></g>)}
      <path d={area} fill="url(#lcfill)" />
      <path d={path} fill="none" stroke={trend ? "#D9C79A" : "#1B1505"} strokeWidth={trend ? 1.5 : 2.5} strokeLinejoin="round" strokeLinecap="round" />
      {trend && <path d={maPath} fill="none" stroke="#1B1505" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
      {data.map((p, i) => <circle key={p.d} cx={x(xs[i])} cy={y(p.v)} r={i === data.length - 1 ? 5 : 2.5} fill={i === data.length - 1 ? "#F2A100" : "#1B1505"} stroke="#fff" strokeWidth={i === data.length - 1 ? 2 : 0} />)}
      {goal != null && goal < lo && <g><text x={W - pr - 16} y={H - pb - 6} fontSize="15" fontWeight="700" fill="#3F6B0E" textAnchor="end">Meta {goal.toLocaleString("es-419")} {unit}</text><path d={`M${W - pr - 6} ${H - pb - 18}v12m-4.5-4.5 4.5 4.5 4.5-4.5`} fill="none" stroke="#3F6B0E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden /></g>}
      <text x={pl} y={H - 6} fontSize="15" fill="#A0957C">{fmt(data[0].d)}</text>
      <text x={W - pr} y={H - 6} fontSize="15" fill="#A0957C" textAnchor="end">{fmt(last.d)}</text>
    </svg>
  );
}
