"use client";
import { useState, useTransition } from "react";
import { saveCommunityProfile } from "@/app/actions/community";
import { CheckCircle, Globe, Lock, Users, WarningCircle } from "@/components/icons";

type Vis = "publico" | "seguidores" | "privado";

export function CommunitySettings({ username: u0, bio: b0, visibility: v0, share: s0 }: { username: string; bio: string; visibility: Vis; share: boolean }) {
  const [username, setU] = useState(u0);
  const [bio, setB] = useState(b0);
  const [vis, setVis] = useState<Vis>(v0);
  const [share, setShare] = useState(s0);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveCommunityProfile({ username, bio, visibility: vis, share }); setMsg(r.ok ? { ok: true, t: r.demo ? "Demo: no se guardó." : "Perfil público actualizado" } : { ok: false, t: r.error ?? "No pudimos guardar tu perfil. Intenta de nuevo." }); }); }}>
      <label className="block"><span className="text-sm font-bold text-ink">Usuario</span>
        <div className="mt-1 flex items-center rounded-2xl border border-line bg-white focus-within:border-ink focus-within:ring-4 focus-within:ring-banana/40"><span className="pl-4 text-faint">@</span><input value={username} onChange={(e) => setU(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))} maxLength={24} placeholder="tunombre" className="h-12 flex-1 min-w-0 bg-transparent px-1 text-[16px] text-ink outline-none" aria-describedby="u-help" /></div>
        <span id="u-help" className="text-[11px] text-faint">De 3 a 24 caracteres: letras, números, punto o guion bajo.</span></label>
      <label className="block"><span className="text-sm font-bold text-ink">Bio <span className="font-normal text-faint">({bio.length}/160)</span></span><textarea value={bio} onChange={(e) => setB(e.target.value.slice(0, 160))} rows={2} placeholder="Ej: Bajando de 94 a 85 kg" className="input h-auto py-3 mt-1 resize-none" /></label>
      <fieldset><legend className="text-sm font-bold text-ink mb-2">¿Quién ve tus entrenos?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {([["publico", Globe, "Todos", "Cualquiera en Banana Burn"], ["seguidores", Users, "Seguidores", "Solo quienes te siguen"], ["privado", Lock, "Solo yo", "Nadie más"]] as const).map(([k, I, l, d]) => (
            <label key={k} className={`cursor-pointer rounded-2xl border-2 p-3 ${vis === k ? "border-ink bg-banana" : "border-line bg-white"}`}>
              <input type="radio" name="vis" value={k} checked={vis === k} onChange={() => setVis(k)} className="sr-only" />
              <span className="flex items-center gap-1.5 font-bold text-ink text-sm"><I weight="duotone" className="size-4.5 shrink-0" />{l}</span><span className="block text-[11px] text-ink/70">{d}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center justify-between gap-3 rounded-2xl bg-cream p-3 cursor-pointer">
        <span><span className="block text-sm font-bold text-ink">Publicar mis entrenos automáticamente</span><span className="block text-[11px] text-muted">Solo el resumen: tiempo, series, volumen y récords.</span></span>
        <input type="checkbox" role="switch" checked={share} onChange={(e) => setShare(e.target.checked)} className="size-5 accent-ink" />
      </label>
      <div className="flex items-center gap-3"><button disabled={pending} className="btn-primary h-11 px-6">{pending ? "Guardando…" : "Guardar"}</button>{msg && <p role={msg.ok ? "status" : "alert"} className={`flex items-center gap-1.5 text-sm font-semibold ${msg.ok ? "text-peel" : "text-bad"}`}>{msg.ok ? <CheckCircle weight="fill" className="size-4 shrink-0" /> : <WarningCircle weight="fill" className="size-4 shrink-0" />}{msg.t}</p>}</div>
    </form>
  );
}
