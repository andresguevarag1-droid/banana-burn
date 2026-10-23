"use client";
// Muro de insignias de tu perfil: eliges cuál se ve junto a tu nombre en la comunidad. La base valida que sea tuya.
import { useState, useTransition } from "react";
import { CheckCircle, PushPin, WarningCircle } from "@/components/icons";
import { setFeaturedBadge } from "@/app/actions/perfil-poder";
import { safeAction } from "@/lib/action-client";
import { canFeature, type Insignia } from "@/lib/profile-power";
import { InsigniaArt, KIND_LABEL } from "./power";

export function InsigniasPicker({ items, featured: f0 }: { items: Insignia[]; featured: string | null }) {
  const [featured, setFeatured] = useState<string | null>(f0);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pending, start] = useTransition();

  function pick(id: string | null) {
    if (!canFeature(items, id) || pending) return;
    const prev = featured;
    setFeatured(id); setMsg(null);
    start(async () => {
      const r = await safeAction(setFeaturedBadge(id));
      if (!r.ok) { setFeatured(prev); setMsg({ ok: false, t: r.error ?? "No pudimos guardar tu insignia." }); return; }
      const label = items.find((i) => i.id === id)?.label;
      setMsg({ ok: true, t: r.demo ? "Demo: no se guardó." : id ? `${label} se ve junto a tu nombre en la tropa.` : "Ya no destacas ninguna insignia." });
    });
  }

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="mis-insignias-t">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 id="mis-insignias-t" className="font-extrabold text-ink">Mis insignias</h2>
          <p className="text-sm text-muted">Elige una para mostrar junto a tu nombre en publicaciones, comentarios y el ranking.</p>
        </div>
        {featured && <button type="button" onClick={() => pick(null)} disabled={pending} className="tap h-11 px-2 text-sm font-bold text-muted underline hover:text-ink">Quitar destacada</button>}
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:grid-cols-3">
        {items.map((i) => {
          const on = featured === i.id;
          if (i.kind === "racha") return (
            <li key={i.id} className="flex min-h-16 items-center gap-2.5 rounded-2xl bg-cream p-2.5">
              <InsigniaArt i={i} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold uppercase tracking-[.08em] text-banana-ink">Racha<span className="normal-case tracking-normal text-muted">, solo tú la ves</span></span>
                <span className="block truncate text-sm font-bold leading-tight text-ink">{i.label}</span>
                {i.detail && <span className="block truncate text-[11px] leading-tight text-muted">{i.detail}</span>}
              </span>
            </li>
          );
          return (
            <li key={i.id}>
              <button type="button" onClick={() => pick(on ? null : i.id)} aria-pressed={on} disabled={pending}
                className={`pressable flex w-full min-h-16 items-center gap-2.5 rounded-2xl p-2.5 text-left transition-[background-color,box-shadow] duration-150 ease-out disabled:cursor-wait focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-banana/60 ${on ? "bg-banana-soft ring-2 ring-banana" : "bg-cream hover:bg-banana-soft/50"}`}>
                <InsigniaArt i={i} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[.08em] text-banana-ink">
                    {on ? <><PushPin weight="fill" aria-hidden className="size-3" />Destacada</> : KIND_LABEL[i.kind]}
                  </span>
                  <span className="block truncate text-sm font-bold leading-tight text-ink">{i.label}</span>
                  {i.detail && <span className="block truncate text-[11px] leading-tight text-muted">{i.detail}</span>}
                </span>
                <span className="sr-only">{on ? "Destacada. Toca para quitarla." : "Toca para destacarla."}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-3 flex items-center gap-1.5 text-sm font-semibold ${msg.ok ? "text-peel" : "text-bad"}`}>{msg.ok ? <CheckCircle weight="fill" className="size-4 shrink-0" /> : <WarningCircle weight="fill" className="size-4 shrink-0" />}{msg.t}</p>}
    </section>
  );
}
