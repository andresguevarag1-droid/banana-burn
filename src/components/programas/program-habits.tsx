"use client";
// Hábitos del día del programa activo (0027). Los automáticos se marcan con lo que ya registras en Hoy; los demás, con un toque.
import Link from "next/link";
import { useOptimistic, useTransition, useState } from "react";
import { ArrowRight, BrandIcon, Check, ForkKnife } from "@/components/icons";
import { toggleProgramHabit } from "@/app/actions/program-habits";
import type { HabitView } from "@/lib/programs";

export function ProgramHabits({ mode, icon, habits, food, nutrition }: { mode: string; icon: string; habits: HabitView[]; food: string | null; nutrition: boolean }) {
  const [list, setList] = useOptimistic(habits, (cur, { key, on }: { key: string; on: boolean }) => cur.map((h) => (h.key === key ? { ...h, done: on, pct: on ? 1 : 0 } : h)));
  const [, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const done = list.filter((h) => h.done).length;
  const toggle = (h: HabitView) => {
    if (h.auto) return;
    const on = !h.done;
    setErr(null);
    start(async () => {
      setList({ key: h.key, on });
      const r = await toggleProgramHabit(h.key, on).catch(() => ({ ok: false, error: "Sin conexión. Intenta de nuevo." }));
      if (!r.ok) setErr(("error" in r && r.error) || "No se pudo guardar. Intenta de nuevo.");
    });
  };

  return (
    <section aria-labelledby="prog-habitos" className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 id="prog-habitos" className="flex items-center gap-2 text-lg font-extrabold text-ink">
          <span className="grid size-8 place-items-center rounded-lg bg-ink text-banana"><BrandIcon name={icon} className="size-4.5" /></span>Tu día en {mode}
        </h3>
        <span className="chip shrink-0 bg-banana-soft text-banana-ink tabular-nums" aria-label={`${done} de ${list.length} hábitos completados`}>{done} de {list.length}</span>
      </div>
      <ul className="mt-4 space-y-2">
        {list.map((h) => {
          const body = (
            <>
              <span aria-hidden className={`grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors duration-(--dur-fast) ${h.done ? "border-ink bg-ink text-banana" : "border-line bg-white text-transparent"}`}><Check weight="bold" className="size-4" /></span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[15px] font-bold text-ink">{h.label}</span>
                {h.detail && <span className="block text-xs font-semibold text-muted tabular-nums">{h.detail}</span>}
                {h.auto && !h.done && h.pct > 0 && <span aria-hidden className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-ink/10"><span className="block h-full rounded-full bg-[var(--program,var(--color-ember))] transition-[width] duration-(--dur-fill) ease-out" style={{ width: `${Math.round(h.pct * 100)}%` }} /></span>}
              </span>
              {h.auto && <span className="shrink-0 text-[11px] font-bold text-faint">Automático</span>}
            </>
          );
          return (
            <li key={h.key}>
              {h.auto ? (
                <div className="flex min-h-12 items-center gap-3 rounded-2xl bg-cream px-3 py-2">{body}</div>
              ) : (
                <button type="button" onClick={() => toggle(h)} aria-pressed={h.done} className="pressable flex min-h-12 w-full items-center gap-3 rounded-2xl bg-cream px-3 py-2 hover:bg-paper">{body}</button>
              )}
            </li>
          );
        })}
      </ul>
      {err && <p role="alert" className="mt-2 text-sm font-semibold text-bad">{err}</p>}
      {food && (
        <div className="mt-4 flex items-start gap-2.5 border-t border-line pt-3">
          <ForkKnife weight="duotone" className="mt-0.5 size-5 shrink-0 text-banana-ink" />
          <p className="min-w-0 text-sm text-body"><b className="text-ink">Comida del programa:</b> {food}{" "}
            {nutrition && <Link href="/app/nutricion" className="tap inline-flex items-center gap-1 font-bold text-ink underline-offset-4 hover:underline">Ver mi comida<ArrowRight weight="bold" className="size-3.5" /></Link>}
          </p>
        </div>
      )}
    </section>
  );
}
