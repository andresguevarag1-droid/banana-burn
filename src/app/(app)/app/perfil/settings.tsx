"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, LogOut, Trash2 } from "lucide-react";
import { updateTraining } from "./actions";

type Eq = "gym" | "casa" | "mixto" | "ninguno";
type Lv = "principiante" | "intermedio" | "avanzado";
type Mode = "acelerada" | "recomp";

export function TrainingSettings({ days: d0, equipment: e0, mode: m0, level: l0, minutes: n0 }: { days: number; equipment: Eq; mode: Mode; level: Lv; minutes: number | null }) {
  const [level, setLevel] = useState<Lv>(l0);
  const [mins, setMins] = useState<number | null>(n0);
  const [days, setDays] = useState(d0);
  const [eq, setEq] = useState<Eq>(e0);
  const [mode, setMode] = useState<Mode>(m0);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const dirty = days !== d0 || eq !== e0 || mode !== m0 || level !== l0 || mins !== n0;
  const seg = (on: boolean) => `pressable h-11 rounded-2xl text-sm font-bold border-2 transition ${on ? "border-ink bg-banana text-ink" : "border-line bg-white text-muted"}`;
  return (
    <div className="space-y-5">
      <div><p className="text-sm font-bold text-ink mb-2">Días por semana</p><div className="grid grid-cols-4 gap-2">{[3, 4, 5, 6].map((n) => <button key={n} onClick={() => setDays(n)} className={seg(days === n)}>{n}</button>)}</div></div>
      <div><p className="text-sm font-bold text-ink mb-2">Minutos por sesión</p><div className="grid grid-cols-4 gap-2">{[20, 30, 45, 60].map((n) => <button key={n} onClick={() => setMins(n)} className={seg(mins === n)}>{n}</button>)}</div></div>
      <div><p className="text-sm font-bold text-ink mb-2">Nivel</p><div className="grid grid-cols-3 gap-2">{([["principiante", "🌱 Inicio"], ["intermedio", "🍌 Medio"], ["avanzado", "🦍 Avanzado"]] as const).map(([k, l]) => <button key={k} onClick={() => setLevel(k)} className={seg(level === k)}>{l}</button>)}</div></div>
      <div><p className="text-sm font-bold text-ink mb-2">Dónde entrenas</p><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{([["gym", "🏋️ Gym"], ["mixto", "🔀 Ambos"], ["casa", "🏠 Casa"], ["ninguno", "🛏️ Sin equipo"]] as const).map(([k, l]) => <button key={k} onClick={() => setEq(k)} className={seg(eq === k)}>{l}</button>)}</div>
        {eq === "ninguno" && <p className="mt-2 text-xs text-muted">Solo peso corporal en un espacio de 2 × 2 m: búlgaras, flexiones pica, remo invertido en una mesa…</p>}
        {eq === "casa" && <p className="mt-2 text-xs text-muted">Usamos mancuernas, bandas y peso corporal: goblet en vez de sentadilla con barra, remo invertido en vez de dominadas…</p>}</div>
      <div><p className="text-sm font-bold text-ink mb-2">Ritmo</p><div className="grid grid-cols-2 gap-2">{([["acelerada", "🔥 Acelerado (−500)"], ["recomp", "⚖️ Recomposición (−200)"]] as const).map(([k, l]) => <button key={k} onClick={() => setMode(k)} className={seg(mode === k)}>{l}</button>)}</div></div>
      <div className="flex items-center gap-3">
        <button disabled={!dirty || pending} onClick={() => start(async () => { const r = await updateTraining({ days, equipment: eq, mode, level, minutes: mins }); setMsg(r.ok ? (r.demo ? "Demo: no se guardó." : "✅ Plan actualizado") : r.error ?? "Error"); router.refresh(); })} className="btn-primary h-11 px-6">{pending ? "Guardando…" : "Guardar cambios"}</button>
        {msg && <p className="text-sm font-semibold text-peel">{msg}</p>}
      </div>
    </div>
  );
}

export function DataControls() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <a href="/api/cuenta/exportar" className="btn-ghost w-full h-12 justify-start px-4"><Download className="size-5" />Descargar mis datos (JSON)</a>
      <form action="/auth/salir" method="post"><button className="btn-ghost w-full h-12 justify-start px-4"><LogOut className="size-5" />Cerrar sesión</button></form>
      {!open ? (
        <button onClick={() => setOpen(true)} className="btn w-full h-12 justify-start px-4 text-bad hover:bg-bad/5"><Trash2 className="size-5" />Borrar mi cuenta</button>
      ) : (
        <div className="rounded-3xl border-2 border-bad/30 bg-bad/5 p-4 space-y-3">
          <p className="font-bold text-bad">¿Borrar tu cuenta para siempre?</p>
          <p className="text-sm text-body">Se eliminan tu perfil, pesos, entrenos, comidas y conversaciones. No se puede deshacer. Si tienes suscripción, cancélala primero.</p>
          <input value={text} onChange={(e) => setText(e.target.value.toUpperCase())} placeholder="Escribe BORRAR" className="input h-11" aria-label="Confirmación" />
          {err && <p role="alert" className="text-sm font-semibold text-bad">{err}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setOpen(false); setText(""); }} className="btn-ghost h-11 flex-1">Cancelar</button>
            <button disabled={text !== "BORRAR" || pending} onClick={() => start(async () => {
              const r = await fetch("/api/cuenta/borrar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: text }) }).then((x) => x.json()).catch(() => ({ ok: false }));
              if (r.ok) { window.location.href = r.demo ? "/app" : "/?cuenta=borrada"; } else setErr(r.error ?? "No se pudo borrar.");
            })} className="btn h-11 flex-1 bg-bad text-white">{pending ? "Borrando…" : "Borrar"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
