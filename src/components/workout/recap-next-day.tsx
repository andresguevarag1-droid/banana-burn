"use client";
// Cierre del primer entreno (#286): el día del próximo entreno según su plan y, si todavía no eligió hora del recordatorio,
// "Recuérdame ese día". Guarda la hora en notification_prefs.reminder_time con la franja en que entrenó hoy (las mismas de
// /app/primer-entreno) y marca REMINDER_PROMPT_KEY para que Hoy no vuelva a preguntar. No crea otro sistema de avisos.
import { useState, useTransition } from "react";
import { Bell, CalendarCheck } from "@/components/icons";
import { saveNotificationPrefs } from "@/app/actions/notifications";
import { safeAction } from "@/lib/action-client";
import { reminderTimeFor, slotAt, type TrainSlot } from "@/lib/train-slot";
import { REMINDER_PROMPT_KEY } from "@/components/hoy/reminder-prompt";

const WHEN: Record<TrainSlot, string> = { manana: "en la mañana", mediodia: "al mediodía", tarde: "en la tarde", noche: "en la noche" };

export function RecapNextDay({ when, remind }: { when: string; remind: boolean }) {
  const [done, setDone] = useState<TrainSlot | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () => {
    setErr(null);
    start(async () => {
      const slot = slotAt(new Date().getHours());
      const r = await safeAction(saveNotificationPrefs({ reminder_time: reminderTimeFor(slot) }));
      if (!r.ok) return setErr(r.error ?? "No pudimos guardar el recordatorio. Intenta de nuevo.");
      try { localStorage.setItem(REMINDER_PROMPT_KEY, "1"); } catch { /* sin almacenamiento */ }
      setDone(slot);
    });
  };
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-banana-soft text-banana-ink"><CalendarCheck weight="duotone" className="size-6" /></span>
        <p className="min-w-0 font-extrabold text-ink">Tu próximo entreno: {when}</p>
      </div>
      {remind && !done && (
        <button type="button" onClick={save} disabled={pending} data-cta="resumen-recordar-proximo" className="btn-ghost mt-3 h-12 w-full text-base disabled:opacity-60">
          <Bell weight="duotone" className="size-5" />Recuérdame ese día
        </button>
      )}
      {done && <p role="status" className="mt-2 text-sm text-body">Listo. Te recordamos tu entreno {when} {WHEN[done]}. Lo cambias cuando quieras en tu perfil.</p>}
      {err && <p role="alert" className="mt-3 rounded-2xl bg-bad/10 p-3 text-sm font-semibold text-bad">{err}</p>}
    </div>
  );
}
