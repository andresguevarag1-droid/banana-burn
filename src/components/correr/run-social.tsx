"use client";
// Tus tenis, la tabla semanal (opcional) y compartir una carrera en la comunidad (sin mapa).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch, Sneaker, Trophy, Users } from "@/components/icons";
import { createPost } from "@/app/actions/community";
import type { BoardRow, Shoe } from "@/lib/running-server";

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
  const j = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
  return res?.ok ? null : j?.error ?? "Revisa tu conexión e intenta de nuevo.";
}

export function ShoeCard({ shoe }: { shoe: Shoe | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [startKm, setStartKm] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pct = shoe ? Math.min(100, Math.round((shoe.km / 700) * 100)) : 0;
  const save = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); const err = await call("/api/correr/tenis", "POST", { name, startKm }); setBusy(false); if (err) { setError(err); return; } setOpen(false); router.refresh(); };
  return (
    <section className="card space-y-3 p-5" aria-labelledby="shoes">
      <h2 id="shoes" className="flex items-center gap-2 text-xl font-extrabold text-ink"><Sneaker weight="duotone" className="size-6 text-[var(--run)]" />Tus tenis</h2>
      {shoe ? (
        <>
          <div className="flex items-baseline justify-between gap-2"><p className="font-bold text-ink">{shoe.name}</p><p className="text-2xl font-extrabold tabular-nums text-ink">{shoe.km} km</p></div>
          <div className="h-3 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Uso de tus tenis sobre 700 km"><div className={`h-full rounded-full ${shoe.km >= 600 ? "bg-[var(--run)]" : "bg-ink"}`} style={{ width: `${Math.max(2, pct)}%` }} /></div>
          <p className="text-sm text-body">{shoe.km >= 800 ? "Ya pasaron los 800 km: es buen momento para cambiarlos." : shoe.km >= 600 ? "Entre 600 y 800 km la amortiguación suele bajar. Fíjate cómo se sienten tus piernas." : `Te quedan unos ${Math.round(600 - shoe.km)} km antes de empezar a pensar en cambiarlos.`}</p>
        </>
      ) : <p className="text-sm text-body">Agrega tus tenis y te avisamos cuando lleguen a 600 a 800 km, cuando la amortiguación suele bajar.</p>}
      {open ? (
        <form onSubmit={save} className="space-y-2">
          <label className="block space-y-1"><span className="text-sm font-bold text-ink">Nombre</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Mis tenis de diario" required /></label>
          <label className="block space-y-1"><span className="text-sm font-bold text-ink">Km que ya tenían</span><input className="input" inputMode="decimal" value={startKm} onChange={(e) => setStartKm(e.target.value)} /></label>
          {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary h-12 w-full">{busy && <CircleNotch weight="bold" className="size-5 animate-spin" />}Guardar tenis</button>
        </form>
      ) : <button type="button" onClick={() => setOpen(true)} className="btn-ghost h-12 w-full">{shoe ? "Estrené tenis nuevos" : "Agregar mis tenis"}</button>}
    </section>
  );
}

export function BoardCard({ joined, board }: { joined: boolean; board: BoardRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const toggle = async () => { setBusy(true); await call("/api/correr/tabla", joined ? "DELETE" : "POST"); setBusy(false); router.refresh(); };
  return (
    <section className="card space-y-3 p-5" aria-labelledby="board">
      <h2 id="board" className="flex items-center gap-2 text-xl font-extrabold text-ink"><Trophy weight="duotone" className="size-6 text-[var(--run)]" />Tabla de la semana</h2>
      {joined ? (
        board.length ? (
          <ol className="divide-y divide-line">{board.map((b) => <li key={b.pos} className={`flex items-center gap-3 py-2 ${b.me ? "font-extrabold text-ink" : "text-body"}`}><span className="w-6 text-right tabular-nums text-muted">{b.pos}</span><span className="min-w-0 flex-1 truncate">{b.me ? `${b.name} (tú)` : b.name}</span><span className="tabular-nums">{b.km} km</span></li>)}</ol>
        ) : <p className="text-sm text-body">Todavía nadie corre esta semana. Sal y estrena la tabla.</p>
      ) : <p className="text-sm text-body">Compara tus km de la semana con otras personas que también se suman. Solo se ve tu nombre y tus km; nunca tus recorridos.</p>}
      <button type="button" onClick={() => void toggle()} disabled={busy} className={joined ? "btn-ghost h-12 w-full" : "btn-primary h-12 w-full"}><Users weight="duotone" className="size-5" />{joined ? "Salirme de la tabla" : "Sumarme a la tabla"}</button>
    </section>
  );
}

export function ShareRunToCommunity({ km, time, pace }: { km: string; time: string; pace: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | string>("idle");
  const share = async () => {
    setState("busy");
    const r = await createPost(`Corrí ${km} km en ${time}, a ${pace}/km. Registrado en Banana Run.`, undefined, null);
    setState(r.ok ? "done" : r.error ?? "No pudimos publicar.");
  };
  if (state === "done") return <p role="status" className="rounded-2xl bg-paper p-3 text-sm font-semibold text-ink">Listo, tu carrera está en la comunidad.</p>;
  return (
    <div className="space-y-1">
      <button type="button" onClick={() => void share()} disabled={state === "busy"} className="btn-ghost h-12 w-full"><Users weight="duotone" className="size-5" />Compartir en la comunidad</button>
      <p className="text-xs text-muted">Solo tus km, tu tiempo y tu ritmo. Sin mapa.</p>
      {state !== "idle" && state !== "busy" && <p role="alert" className="text-sm font-semibold text-bad">{state}</p>}
    </div>
  );
}
