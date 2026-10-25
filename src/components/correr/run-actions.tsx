"use client";
// "Comparte tu resumen": imagen con tus números y tus parciales, sin mapa (no muestra por dónde corres). Y borrar.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch, ShareNetwork, Trash } from "@/components/icons";

function draw({ km, time, pace, day, splits }: { km: string; time: string; pace: string; day: string; splits: number[] }): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 1080; c.height = 1350;
  const g = c.getContext("2d")!;
  g.fillStyle = "#FFD60A"; g.fillRect(0, 0, 1080, 1350);
  g.fillStyle = "#1A1A1A";
  g.font = "800 52px system-ui, sans-serif"; g.fillText("Banana Burn", 80, 130);
  g.font = "600 40px system-ui, sans-serif"; g.fillText(day, 80, 200);
  g.font = "800 260px system-ui, sans-serif"; g.fillText(km, 70, 470);
  g.font = "700 64px system-ui, sans-serif"; g.fillText("km", 80, 550);
  g.font = "700 44px system-ui, sans-serif"; g.fillText("Tiempo", 80, 680); g.fillText("Ritmo", 580, 680);
  g.font = "800 96px system-ui, sans-serif"; g.fillText(time, 80, 790); g.fillText(`${pace}/km`, 580, 790);
  if (splits.length) {
    const top = 900, h = 330, list = splits.slice(0, 20), w = Math.min(80, 920 / list.length - 10);
    const lo = Math.min(...list), hi = Math.max(...list);
    list.forEach((s, i) => {
      const bh = 80 + (hi === lo ? h / 2 : ((hi - s) / (hi - lo)) * (h - 80));
      g.fillStyle = "#1A1A1A"; g.fillRect(80 + i * (w + 10), top + h - bh, w, bh);
    });
    g.font = "600 34px system-ui, sans-serif"; g.fillText("Ritmo por kilómetro", 80, top + h + 60);
  }
  return c;
}

export function RunShare(p: { km: string; time: string; pace: string; day: string; splits: number[] }) {
  const [busy, setBusy] = useState(false);
  const share = async () => {
    setBusy(true);
    try {
      const blob = await new Promise<Blob | null>((ok) => draw(p).toBlob(ok, "image/png"));
      if (!blob) return;
      const file = new File([blob], `carrera-${p.km}km.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `${p.km} km` }).catch(() => {});
      else { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
    } finally { setBusy(false); }
  };
  return <button type="button" onClick={() => void share()} disabled={busy} className="btn-banana w-full h-14 text-base">{busy ? <CircleNotch weight="bold" className="size-5 animate-spin" /> : <><ShareNetwork weight="bold" className="size-5" />Comparte tu resumen</>}</button>;
}

export function RunDelete({ id }: { id: string }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const del = async () => {
    setBusy(true); setError(null);
    const res = await fetch(`/api/carreras?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) { setError("No pudimos borrar la carrera. Intenta de nuevo."); setBusy(false); return; }
    router.push("/app/correr"); router.refresh();
  };
  return (
    <div className="space-y-2">
      {!ask ? <button type="button" onClick={() => setAsk(true)} className="tap inline-flex items-center gap-1.5 text-sm font-semibold text-bad"><Trash className="size-4" />Borrar esta carrera</button> : (
        <div className="card p-4 space-y-2">
          <p className="text-sm text-body">Se borra con su mapa y no se puede recuperar.</p>
          <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void del()} className="btn h-12 flex-1 bg-bad text-white">Borrar</button><button type="button" onClick={() => setAsk(false)} className="btn-ghost h-12 flex-1">Cancelar</button></div>
        </div>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
    </div>
  );
}
