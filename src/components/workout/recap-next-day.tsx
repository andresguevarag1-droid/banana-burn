"use client";
// Cierre del entreno (#286, #288): el plan de la semana. Cuántos lleva de su meta semanal, con una banana por entreno, y
// los próximos días sugeridos según su plan ("Martes y jueves"). Si todavía no eligió la hora del recordatorio, "Recuérdame
// esos días" guarda notification_prefs.reminder_time con la franja en que entrenó hoy (las mismas de /app/primer-entreno) y
// marca REMINDER_PROMPT_KEY para que Hoy no vuelva a preguntar. Los recordatorios salen los días de entreno de su plan:
// no se crea otro sistema de avisos.
import { useState, useTransition } from "react";
import { Bell, CalendarCheck } from "@/components/icons";
import { saveNotificationPrefs } from "@/app/actions/notifications";
import { safeAction } from "@/lib/action-client";
import { reminderTimeFor, slotAt, type TrainSlot } from "@/lib/train-slot";
import { REMINDER_PROMPT_KEY } from "@/components/hoy/reminder-prompt";
import { GoldBanana } from "./ui";
import { useLang } from "./use-lang";

const WHEN: Record<TrainSlot, string> = { manana: "en la mañana", mediodia: "al mediodía", tarde: "en la tarde", noche: "en la noche" };

export type WeekPlan = {
  /** Días con entreno esta semana, contando el de hoy. */
  count: number;
  goal: number;
  /** De qué semana son los días sugeridos. */
  week: "esta" | "proxima";
  /** Días sugeridos en texto ("martes y jueves"); vacío si su plan no tiene días de entreno. */
  days: string;
  /** Cuántos días son (para "ese día" o "esos días"). */
  n: number;
  /** true si todavía no eligió la hora del recordatorio. */
  remind: boolean;
};

export function RecapWeekPlan({ plan }: { plan: WeekPlan }) {
  const { count, goal, week, days, n, remind } = plan;
  const [done, setDone] = useState<TrainSlot | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { t } = useLang();
  const met = count >= goal;
  const save = () => {
    setErr(null);
    start(async () => {
      const slot = slotAt(new Date().getHours());
      const r = await safeAction(saveNotificationPrefs({ reminder_time: reminderTimeFor(slot) }));
      if (!r.ok) return setErr(t(r.error ?? "No pudimos guardar el recordatorio. Intenta de nuevo."));
      try { localStorage.setItem(REMINDER_PROMPT_KEY, "1"); } catch { /* sin almacenamiento */ }
      setDone(slot);
    });
  };
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-banana-soft text-banana-ink"><CalendarCheck weight="duotone" className="size-6" /></span>
        <p className="min-w-0 font-extrabold text-ink tabular-nums">{met ? t("Cumpliste tu meta de la semana: {count} de {goal}", { count, goal }) : t("Esta semana: {count} de {goal} entrenos", { count, goal })}</p>
      </div>
      <div className="mt-2 flex gap-1.5" role="img" aria-label={t("{n} de {goal} entrenos de tu meta semanal", { n: Math.min(count, goal), goal })}>
        {Array.from({ length: goal }, (_, i) => i < count ? <GoldBanana key={i} className="size-7" /> : <span key={i} aria-hidden className="inline-grid size-7 opacity-30"><GoldBanana className="size-7" /></span>)}
      </div>
      {days && (
        <p className="mt-3"><span className="block text-sm font-bold text-muted">{t(week === "esta" ? (n === 1 ? "Tu próximo entreno" : "Tus próximos entrenos") : "La próxima semana")}</span><span className="block font-extrabold text-ink first-letter:uppercase">{days}</span></p>
      )}
      {days && remind && !done && (
        <button type="button" onClick={save} disabled={pending} data-cta="resumen-recordar-semana" className="btn-ghost mt-3 h-12 w-full text-base disabled:opacity-60">
          <Bell weight="duotone" className="size-5" />{t(n === 1 ? "Recuérdame ese día" : "Recuérdame esos días")}
        </button>
      )}
      {done && <p role="status" className="mt-2 text-sm text-body">{t("Listo. Te recordamos tu entreno {days} {when}. Lo cambias cuando quieras en tu perfil.", { days, when: t(WHEN[done]) })}</p>}
      {err && <p role="alert" className="mt-3 rounded-2xl bg-bad/10 p-3 text-sm font-semibold text-bad">{err}</p>}
    </div>
  );
}
