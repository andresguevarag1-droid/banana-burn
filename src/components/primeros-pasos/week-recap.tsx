"use client";
// "Tu semana con Banana Burn" (lunes). Se puede cerrar; se recuerda en este dispositivo por semana.
import { useEffect, useState } from "react";
import { TrendUp, X } from "@/components/icons";
import type { WeekRecap as R } from "@/lib/week-recap";
import { useLocale, useT } from "@/lib/i18n/client";
import { exerciseName } from "@/lib/i18n/names";

export function WeekRecap({ r }: { r: R }) {
  const t = useT(), locale = useLocale();
  const key = `bb.resumen.${r.weekOf}`;
  const [hidden, setHidden] = useState(true);
  useEffect(() => { try { setHidden(localStorage.getItem(key) === "1"); } catch { setHidden(false); } }, [key]);
  if (hidden) return null;
  const close = () => { setHidden(true); try { localStorage.setItem(key, "1"); } catch { /* */ } };
  return (
    <section aria-labelledby="resumen-t" className="card p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-banana-soft text-banana-ink"><TrendUp weight="bold" className="size-6" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-muted">{t("Tu semana con Banana Burn")}</p>
          <h2 id="resumen-t" className="text-lg font-extrabold leading-tight text-ink text-balance">{t(r.headline)}</h2>
        </div>
        <button type="button" onClick={close} className="tap -mr-2 -mt-2 grid size-11 place-items-center rounded-full text-muted hover:text-ink" aria-label={t("Cerrar resumen")}><X weight="bold" className="size-5" /></button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat v={t("{n} de {total}", { n: r.workouts, total: r.planned })} l={t("entrenos")} />
        <Stat v={r.sets.toLocaleString(locale)} l={t("series anotadas")} />
        <Stat v={`${Math.round(r.consistency * 100)} %`} l={t("constancia")} />
      </div>
      <p className="mt-4 text-sm font-bold text-ink">{t("Lo que cambia en tu plan")}</p>
      <ul className="mt-1 space-y-1">{r.lines.map((l) => t(l.tpl, { ...l.vars, ...(l.ex ? { name: exerciseName(l.ex.id, l.ex.name, locale) } : {}) })).map((c) => <li key={c} className="flex gap-2 text-sm text-body"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-banana-ink" />{c}</li>)}</ul>
    </section>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return <div className="rounded-2xl bg-cream px-2 py-3"><p className="text-lg font-extrabold text-ink tabular-nums leading-tight">{v}</p><p className="text-[11px] font-semibold text-muted">{l}</p></div>;
}
