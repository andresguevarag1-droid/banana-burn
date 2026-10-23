"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowsLeftRight, Banana, BananaFlame, Barbell, BrandIcon, CheckCircle, DownloadSimple, Gorilla, House, PersonSimpleRun, Scales, SignOut, Trash, WarningCircle } from "@/components/icons";
import { updateTraining } from "./actions";
import { safeAction } from "@/lib/action-client";

type Eq = "gym" | "casa" | "mixto" | "ninguno";
type Lv = "principiante" | "intermedio" | "avanzado";
type Mode = "acelerada" | "recomp" | "fuerza";

export function TrainingSettings({ days: d0, equipment: e0, mode: m0, level: l0, minutes: n0 }: { days: number; equipment: Eq; mode: Mode; level: Lv; minutes: number | null }) {
  const [level, setLevel] = useState<Lv>(l0);
  const [mins, setMins] = useState<number | null>(n0);
  const [days, setDays] = useState(d0);
  const [eq, setEq] = useState<Eq>(e0);
  const [mode, setMode] = useState<Mode>(m0);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const dirty = days !== d0 || eq !== e0 || mode !== m0 || level !== l0 || mins !== n0;
  const seg = (on: boolean) => `pressable inline-flex items-center justify-center gap-1.5 px-2 h-11 rounded-2xl text-sm font-bold border-2 ${on ? "border-ink bg-banana text-ink" : "border-line bg-white text-muted"}`;
  return (
    <div className="space-y-5">
      <div><p className="text-sm font-bold text-ink mb-2">Días por semana</p><div className="grid grid-cols-4 gap-2">{[3, 4, 5, 6].map((n) => <button key={n} onClick={() => setDays(n)} aria-pressed={days === n} className={seg(days === n)}>{n}</button>)}</div></div>
      <div><p className="text-sm font-bold text-ink mb-2">Minutos por sesión</p><div className="grid grid-cols-3 sm:grid-cols-6 gap-2">{([[null, "Sin límite"], [15, "15"], [20, "20"], [30, "30"], [45, "45"], [60, "60"]] as const).map(([n, l]) => <button key={l} onClick={() => setMins(n)} aria-pressed={mins === n} className={seg(mins === n)}>{l}</button>)}</div></div>
      <div><p className="text-sm font-bold text-ink mb-2">Nivel</p><div className="grid grid-cols-3 gap-2">{([["principiante", <BrandIcon key="i" name="plant" className="size-5 shrink-0" />, "Inicio"], ["intermedio", <Banana key="i" className="size-5 shrink-0" />, "Medio"], ["avanzado", <Gorilla key="i" className="size-5 shrink-0" />, "Avanzado"]] as const).map(([k, icon, l]) => <button key={k} onClick={() => setLevel(k)} aria-pressed={level === k} className={seg(level === k)}>{icon}{l}</button>)}</div></div>
      <div><p className="text-sm font-bold text-ink mb-2">Dónde entrenas</p><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{([["gym", <Barbell key="i" weight="duotone" className="size-5 shrink-0" />, "Gym"], ["mixto", <ArrowsLeftRight key="i" weight="duotone" className="size-5 shrink-0" />, "Ambos"], ["casa", <House key="i" weight="duotone" className="size-5 shrink-0" />, "Casa"], ["ninguno", <PersonSimpleRun key="i" weight="duotone" className="size-5 shrink-0" />, "Sin equipo"]] as const).map(([k, icon, l]) => <button key={k} onClick={() => setEq(k)} aria-pressed={eq === k} className={seg(eq === k)}>{icon}{l}</button>)}</div>
        {eq === "ninguno" && <p className="mt-2 text-xs text-muted">Solo peso corporal en un espacio de 2 × 2 m: búlgaras, flexiones pica, remo invertido en una mesa…</p>}
        {eq === "casa" && <p className="mt-2 text-xs text-muted">Usamos mancuernas, bandas y peso corporal: goblet en vez de sentadilla con barra, remo invertido en vez de dominadas…</p>}</div>
      <div><p className="text-sm font-bold text-ink mb-2">Ritmo</p><div className="grid grid-cols-1 sm:grid-cols-3 gap-2">{([["acelerada", <BananaFlame key="i" className="size-5 shrink-0" />, "Bajar grasa (−500)"], ["recomp", <Scales key="i" weight="duotone" className="size-5 shrink-0" />, "Recomposición (−200)"], ["fuerza", <Barbell key="i" weight="duotone" className="size-5 shrink-0" />, "Ganar fuerza (+250)"]] as const).map(([k, icon, l]) => <button key={k} onClick={() => setMode(k)} aria-pressed={mode === k} className={seg(mode === k)}>{icon}{l}</button>)}</div></div>
      <div className="flex items-center gap-3">
        <button disabled={!dirty || pending} onClick={() => start(async () => { const r = await safeAction(updateTraining({ days, equipment: eq, mode, level, minutes: mins })); setMsg(r.ok ? { ok: true, t: r.demo ? "Demo: no se guardó." : "Plan actualizado" } : { ok: false, t: r.error ?? "No pudimos guardar tu plan. Intenta de nuevo." }); if (r.ok) router.refresh(); })} className="btn-primary h-11 px-6">{pending ? "Guardando…" : "Guardar cambios"}</button>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`flex items-center gap-1.5 text-sm font-semibold ${msg.ok ? "text-peel" : "text-bad"}`}>{msg.ok ? <CheckCircle weight="fill" className="size-4 shrink-0" /> : <WarningCircle weight="fill" className="size-4 shrink-0" />}{msg.t}</p>}
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
      <a href="/api/cuenta/exportar" className="btn-ghost w-full h-12 justify-start px-4"><DownloadSimple weight="bold" className="size-5" />Descargar mis datos (JSON)</a>
      <form action="/auth/salir" method="post"><button className="btn-ghost w-full h-12 justify-start px-4"><SignOut weight="bold" className="size-5" />Cerrar sesión</button></form>
      {!open ? (
        <button onClick={() => setOpen(true)} className="btn w-full h-12 justify-start px-4 text-bad hover:bg-bad/5"><Trash weight="bold" className="size-5" />Borrar mi cuenta</button>
      ) : (
        <div className="rounded-3xl border-2 border-bad/30 bg-bad/5 p-4 space-y-3">
          <p className="font-bold text-bad">¿Borrar tu cuenta para siempre?</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-body">
            <li>Se eliminan tu perfil, pesos, medidas, fotos, entrenos, comidas, publicaciones y conversaciones con el coach.</li>
            <li>Si tienes una suscripción, la cancelamos automáticamente: no habrá más cobros.</li>
            <li>No se puede deshacer. Si quieres una copia, descarga tus datos primero.</li>
          </ul>
          <label htmlFor="confirmar-borrado" className="block text-sm font-bold text-ink">Para confirmar, escribe <b>BORRAR</b></label>
          <input id="confirmar-borrado" value={text} onChange={(e) => setText(e.target.value.toUpperCase())} autoComplete="off" autoCapitalize="characters" spellCheck={false} className="input h-11 text-[16px]" />
          {err && <p role="alert" className="text-sm font-semibold text-bad">{err}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setOpen(false); setText(""); }} className="btn-ghost h-11 flex-1">Cancelar</button>
            <button disabled={text.trim() !== "BORRAR" || pending} onClick={() => start(async () => {
              const r = await fetch("/api/cuenta/borrar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: text.trim() }) }).then((x) => x.json()).catch(() => ({ ok: false }));
              if (r.ok) { window.location.href = r.demo ? "/app" : "/?cuenta=borrada"; } else setErr(r.error ?? "No pudimos borrar tu cuenta. Intenta de nuevo.");
            })} className="btn h-11 flex-1 bg-bad text-white disabled:opacity-40">{pending ? "Borrando…" : "Borrar mi cuenta"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
