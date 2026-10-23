"use client";
// Sesiones de una semana del programa, en pestañas (Entrenar y la vista previa de la semana 1 en la tienda).
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock, Info, Lock, Repeat } from "@/components/icons";
import { DEFAULT_VOICE, muscleText, setsReps, t, tempoLabel, type Voice } from "@/lib/voice";

export type WeekSessionView = {
  day: number; title: string; focus: string; optional: boolean; done: boolean; mins: number; href: string | null;
  exercises: { id: string; name: string; muscle: string; sets: string; cfg?: { sets: number; lo: number; hi: number; unit?: string }; rest: string; tempo?: string; note?: string }[];
};

/**
 * `dayLabel`: nombre de cada sesión. Por defecto "Día 1, 2, 3" de la semana; un programa contado en días pasa el día
 * del programa ("Día 12"), así coincide con "Día 12 de 30".
 */
export function ProgramWeek({ sessions, current, cta = true, label = "Sesiones de la semana", voice = DEFAULT_VOICE, dayLabel }: { sessions: WeekSessionView[]; current: number | null; cta?: boolean; label?: string; voice?: Voice; dayLabel?: Record<number, number> }) {
  const word = (day: number) => `Día ${dayLabel?.[day] ?? day}`;
  const [sel, setSel] = useState(current ?? sessions[0]?.day ?? 1);
  const s = sessions.find((x) => x.day === sel) ?? sessions[0];
  if (!s) return null;
  return (
    <div className="space-y-3">
      <div role="tablist" aria-label={label} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${sessions.length}, minmax(0, 1fr))` }}>
        {sessions.map((x) => {
          const on = x.day === sel;
          return (
            <button key={x.day} type="button" role="tab" aria-selected={on} onClick={() => setSel(x.day)}
              className={`pressable relative min-h-14 rounded-2xl px-1 py-2 text-center ${on ? "bg-ink text-white shadow-lift" : x.optional ? "border border-dashed border-line bg-white/60 text-ink" : "border border-line bg-white text-ink"}`}>
              <span className={`block text-[11px] font-bold uppercase tracking-[.08em] ${on ? "text-banana" : "text-muted"}`}>{x.optional ? "Extra" : word(x.day)}</span>
              <span className="mt-0.5 block truncate text-xs font-extrabold">{x.title.replace(/^Extra: /, "")}</span>
              {x.done && <span className="absolute -top-1.5 -right-1.5 grid size-[18px] place-items-center rounded-full bg-peel text-white ring-2 ring-paper" role="img" aria-label="Hecha"><Check weight="bold" className="size-2.5" /></span>}
            </button>
          );
        })}
      </div>

      <section key={s.day} role="tabpanel" className="card animate-enter p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-muted">{s.optional ? "Sesión opcional" : word(s.day)}{s.focus ? `: ${s.focus}` : ""}</p>
          {s.done ? <span className="chip bg-peel text-white"><Check weight="bold" className="size-3.5" />Hecha</span> : <span className="chip bg-cream text-ink"><Clock weight="duotone" className="size-3.5" />{s.mins} min</span>}
        </div>
        <h3 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">{s.title}</h3>
        <ol className="mt-4 space-y-2">
          {s.exercises.map((e, i) => (
            <li key={`${e.id}-${i}`} className="rounded-2xl bg-cream px-3.5 py-3">
              <div className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-ink text-sm font-bold text-white">{i + 1}</span>
                <div className="min-w-0 flex-1"><p className="font-bold leading-tight text-ink">{e.name}</p><p className="text-xs text-muted">{[muscleText(voice, e.muscle), `${t(voice, { basico: "descansa", intermedio: "descanso", tecnico: "descanso" })} ${e.rest}`, e.tempo ? tempoLabel(voice, e.tempo) : ""].filter(Boolean).join(", ")}</p></div>
                {/* Series y repeticiones en el registro de la persona: "3 series de 10 a 12" en básico, "3×10-12" en técnico. */}
                <p className={`shrink-0 font-extrabold tabular-nums text-ink text-right ${voice === "basico" ? "max-w-[9rem] text-sm leading-tight" : "whitespace-nowrap"}`}>{e.cfg ? setsReps(voice, e.cfg.sets, e.cfg.lo, e.cfg.hi, e.cfg.unit) : e.sets}</p>
              </div>
              {e.note && <p className="mt-2 flex gap-1.5 pl-11 text-xs text-body"><Info weight="duotone" className="mt-px size-3.5 shrink-0 text-banana-ink" />{e.note}</p>}
            </li>
          ))}
        </ol>
        {cta && (s.href ? (
          s.done ? (
            <Link href={`${s.href}${s.href.includes("?") ? "&" : "?"}repetir=1`} className="btn-ghost mt-5 h-13 w-full px-6 sm:w-auto"><Repeat weight="bold" className="size-5" />Repetir (no suma XP)</Link>
          ) : (
            <Link href={s.href} className={`mt-5 h-13 w-full px-6 sm:w-auto ${s.day === current ? "btn-primary" : "btn-ghost"}`}>{s.day === current ? "Empezar esta sesión" : `Hacer ${s.title} ahora`}<ArrowRight weight="bold" className="size-5" /></Link>
          )
        ) : <p className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-muted"><Lock weight="duotone" className="size-4" />Disponible al empezar el programa.</p>)}
      </section>
    </div>
  );
}
