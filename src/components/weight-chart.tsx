"use client";
import { useState } from "react";
import { LineChart } from "./line-chart";
import type { Point } from "@/lib/progress";

const RANGES: [string, number][] = [["7 d", 7], ["30 d", 30], ["90 d", 90], ["Todo", 9999]];

export function WeightChart({ data, goal }: { data: Point[]; goal: number }) {
  const [r, setR] = useState(30);
  const last = data.at(-1)?.d;
  const cut = last ? new Date(new Date(last + "T12:00:00").getTime() - r * 864e5).toISOString().slice(0, 10) : "";
  const pts = data.filter((p) => p.d >= cut);
  const delta = pts.length > 1 ? pts.at(-1)!.v - pts[0].v : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className={`text-sm font-extrabold tabular-nums ${delta <= 0 ? "text-peel" : "text-ember-ink"}`}>{pts.length > 1 ? `${delta <= 0 ? "▼" : "▲"} ${Math.abs(delta).toLocaleString("es-CR", { maximumFractionDigits: 1 })} kg en ${r > 900 ? "total" : `${r} días`}` : " "}</p>
        <div className="flex rounded-full bg-cream p-0.5">
          {RANGES.map(([l, n]) => <button key={l} onClick={() => setR(n)} className={`tap pressable h-8 px-3 whitespace-nowrap rounded-full text-xs font-bold transition ${r === n ? "bg-ink text-white" : "text-muted"}`}>{l}</button>)}
        </div>
      </div>
      <LineChart data={pts} goal={goal} trend height={230} />
      <p className="mt-2 text-xs text-muted">La línea gruesa es tu <b className="text-ink">tendencia</b>: ignora el agua y la sal del día a día. Mírala a ella, no a la báscula.</p>
    </div>
  );
}
