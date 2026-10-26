"use client";
// Herramientas de carrera (Temporada Running): tabla de ritmos (pace band) con imagen para guardar, la semana de
// carrera como lista para marcar, y el resultado con su tarjeta para compartir (sin mapa).
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Circle, CircleNotch, DownloadSimple, ShareNetwork } from "@/components/icons";
import { fmtDuration } from "@/lib/runs";
import { fmtTime } from "@/lib/run-fitness";
import { paceBand, type RaceWeekDay, type Strategy } from "@/lib/run-guide";

const fmtPaceS = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

async function shareCanvas(c: HTMLCanvasElement, name: string, text: string) {
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/png"));
  if (!blob) return;
  const file = new File([blob], name, { type: "image/png" });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
  } catch { /* cancelado */ }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function PaceBandTool({ distM, goalS, title }: { distM: number; goalS: number; title: string }) {
  const [strategy, setStrategy] = useState<Strategy>("pareja");
  const [start, setStart] = useState("");
  const band = useMemo(() => paceBand(distM, goalS, strategy, /^\d{1,2}:\d{2}$/.test(start) ? start : null), [distM, goalS, strategy, start]);
  const image = () => {
    const rows = band.length, h = 260 + rows * 54;
    const c = document.createElement("canvas"); c.width = 720; c.height = h;
    const g = c.getContext("2d")!;
    g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, 720, h);
    g.fillStyle = "#1B1505"; g.font = "800 40px system-ui, sans-serif"; g.fillText(title, 40, 70);
    g.font = "600 28px system-ui, sans-serif"; g.fillText(`Meta ${fmtTime(goalS)}. ${strategy === "pareja" ? "Ritmo parejo" : "Segunda mitad más rápida"}`, 40, 115);
    g.font = "700 24px system-ui, sans-serif"; g.fillStyle = "#6A604B"; g.fillText("Km", 40, 180); g.fillText("Parcial", 200, 180); g.fillText("Acumulado", 380, 180); if (band[0].clock) g.fillText("Reloj", 580, 180);
    band.forEach((r, i) => {
      const y = 230 + i * 54;
      if (i % 2 === 0) { g.fillStyle = "#FFF8E3"; g.fillRect(24, y - 36, 672, 50); }
      g.fillStyle = "#1B1505"; g.font = "800 30px system-ui, sans-serif";
      g.fillText(Number.isInteger(r.km) ? String(r.km) : r.km.toFixed(1), 40, y); g.fillText(fmtPaceS(r.splitS), 200, y); g.fillText(fmtTime(r.cumS), 380, y); if (r.clock) g.fillText(r.clock, 580, y);
    });
    g.fillStyle = "#6A604B"; g.font = "600 22px system-ui, sans-serif"; g.fillText("Banana Burn", 40, h - 24);
    return c;
  };
  return (
    <section className="card space-y-4 p-5" aria-labelledby="band">
      <h2 id="band" className="text-xl font-extrabold text-ink">Tu tabla de ritmos</h2>
      <p className="text-sm text-body">El tiempo en que debes pasar cada km para hacer {fmtTime(goalS)}.</p>
      <div role="radiogroup" aria-label="Estrategia" className="grid grid-cols-2 gap-2">
        {([["pareja", "Ritmo parejo"], ["negativa", "Cerrar más rápido"]] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={strategy === k} onClick={() => setStrategy(k)} className={`pressable min-h-12 rounded-2xl border-2 px-3 text-sm font-bold ${strategy === k ? "border-ink bg-banana text-ink" : "border-line bg-white text-muted"}`}>{l}</button>)}
      </div>
      <label className="block space-y-1"><span className="text-sm font-bold text-ink">Hora de salida (opcional)</span><input type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></label>
      <div className="max-h-96 overflow-auto rounded-2xl border border-line">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-paper"><tr className="text-xs font-bold text-muted"><th className="px-3 py-2">Km</th><th className="px-3 py-2">Parcial</th><th className="px-3 py-2">Pasas en</th>{band[0]?.clock && <th className="px-3 py-2">Reloj</th>}</tr></thead>
          <tbody className="divide-y divide-line">
            {band.map((r) => <tr key={r.km}><td className="px-3 py-2 font-bold text-ink">{Number.isInteger(r.km) ? r.km : r.km.toFixed(1)}</td><td className="px-3 py-2 tabular-nums">{fmtPaceS(r.splitS)}</td><td className="px-3 py-2 font-bold tabular-nums text-ink">{fmtTime(r.cumS)}</td>{r.clock && <td className="px-3 py-2 tabular-nums">{r.clock}</td>}</tr>)}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => void shareCanvas(image(), "tabla-de-ritmos.png", `Mi tabla de ritmos para ${title}`)} className="btn-primary h-12 w-full"><DownloadSimple weight="bold" className="size-5" />Guardar como imagen</button>
    </section>
  );
}

const CHECK_KEY = "bb.correr.semana";
export function RaceWeekList({ days, today, raceDate }: { days: RaceWeekDay[]; today: string; raceDate: string }) {
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => { try { const x = JSON.parse(localStorage.getItem(CHECK_KEY) ?? "{}"); if (x.race === raceDate && Array.isArray(x.done)) setDone(x.done); } catch {} }, [raceDate]);
  const toggle = (id: string) => setDone((d) => { const n = d.includes(id) ? d.filter((x) => x !== id) : [...d, id]; try { localStorage.setItem(CHECK_KEY, JSON.stringify({ race: raceDate, done: n })); } catch {} return n; });
  return (
    <ol className="space-y-3">
      {days.map((d) => (
        <li key={d.date} className={`rounded-2xl border p-4 ${d.date === today ? "border-2 border-[var(--run)] bg-white" : "border-line bg-white"}`}>
          <p className="text-xs font-bold uppercase tracking-[.12em] text-muted">{d.offset === 0 ? "El día" : d.offset > 0 ? "Día después" : `Faltan ${-d.offset} días`}{d.date === today ? ". Hoy" : ""}</p>
          <p className="font-extrabold text-ink">{d.title}</p>
          <ul className="mt-2 space-y-1.5">
            {d.items.map((it, i) => {
              const id = `${d.offset}:${i}`, on = done.includes(id);
              return <li key={id}><button type="button" aria-pressed={on} onClick={() => toggle(id)} className="flex w-full items-start gap-2 text-left text-sm text-body">{on ? <CheckCircle weight="fill" className="mt-0.5 size-5 shrink-0 text-peel" /> : <Circle weight="bold" className="mt-0.5 size-5 shrink-0 text-muted" />}<span className={on ? "line-through opacity-70" : ""}>{it}</span></button></li>;
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export function ResultForm({ runs }: { runs: { id: string; label: string; movingS: number }[] }) {
  const router = useRouter();
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (body: Record<string, unknown>) => {
    setBusy(true); setError(null);
    const res = await fetch("/api/correr/objetivo", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (!res?.ok) { setError(j?.error ?? "No pudimos guardar tu resultado."); setBusy(false); return; }
    router.refresh();
  };
  return (
    <div className="space-y-3">
      {runs.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-bold text-ink">Usar tu carrera con GPS de ese día</p>
          {runs.map((r) => <button key={r.id} type="button" disabled={busy} onClick={() => void send({ runId: r.id })} className="btn-ghost h-12 w-full justify-between"><span>{r.label}</span><span className="tabular-nums">{fmtDuration(r.movingS)}</span></button>)}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); void send({ time }); }} className="space-y-2">
        <label className="block space-y-1"><span className="text-sm font-bold text-ink">O escribe tu tiempo oficial</span><input className="input" inputMode="numeric" value={time} onChange={(e) => setTime(e.target.value)} placeholder="1:58:40" required /></label>
        {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary h-12 w-full">{busy && <CircleNotch weight="bold" className="size-5 animate-spin" />}Guardar mi resultado</button>
      </form>
    </div>
  );
}

export function ResultShare({ title, km, timeS, pr }: { title: string; km: string; timeS: number; pr: boolean }) {
  const card = () => {
    const c = document.createElement("canvas"); c.width = 1080; c.height = 1350;
    const g = c.getContext("2d")!;
    g.fillStyle = "#FFD60A"; g.fillRect(0, 0, 1080, 1350);
    g.fillStyle = "#1B1505"; g.font = "800 52px system-ui, sans-serif"; g.fillText("Banana Burn", 80, 130);
    g.font = "700 56px system-ui, sans-serif"; g.fillText(title.slice(0, 26), 80, 300);
    g.font = "800 230px system-ui, sans-serif"; g.fillText(fmtTime(timeS), 70, 600);
    g.font = "700 64px system-ui, sans-serif"; g.fillText(`${km} km`, 80, 720);
    if (pr) { g.fillStyle = "#1B1505"; g.fillRect(80, 820, 640, 110); g.fillStyle = "#FFD60A"; g.font = "800 60px system-ui, sans-serif"; g.fillText("Marca personal", 110, 895); }
    g.fillStyle = "#1B1505"; g.font = "600 40px system-ui, sans-serif"; g.fillText("Terminé mi carrera.", 80, 1200);
    return c;
  };
  return <button type="button" onClick={() => void shareCanvas(card(), "mi-carrera.png", `Terminé ${title} en ${fmtTime(timeS)}.`)} className="btn-banana h-14 w-full text-base"><ShareNetwork weight="bold" className="size-5" />Compartir mi resultado</button>;
}
