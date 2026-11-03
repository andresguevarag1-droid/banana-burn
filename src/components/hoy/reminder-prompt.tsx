"use client";
// #255: la hora del recordatorio salió de la bienvenida. Hoy la pregunta desde el primer entreno guardado, con las mismas
// franjas de #197; se guarda en notification_prefs y se cambia después en Perfil. Al elegir o cerrar no vuelve a salir.
import { useEffect, useState, useTransition } from "react";
import { Bell, X } from "@/components/icons";
import { saveNotificationPrefs } from "@/app/actions/notifications";
import { safeAction } from "@/lib/action-client";
import { TRAIN_SLOTS, reminderTimeFor, type TrainSlot } from "@/lib/train-slot";

export const REMINDER_PROMPT_KEY = "bb_recordatorio_hoy";
const WHEN: Record<TrainSlot, string> = { manana: "en la mañana", mediodia: "al mediodía", tarde: "en la tarde", noche: "en la noche" };

export function ReminderPrompt() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<TrainSlot | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => { try { setOpen(!localStorage.getItem(REMINDER_PROMPT_KEY)); } catch { /* sin almacenamiento */ } }, []);
  if (!open) return null;
  const hide = () => { try { localStorage.setItem(REMINDER_PROMPT_KEY, "1"); } catch { /* */ } };
  const pick = (slot: TrainSlot) => {
    setErr(null);
    start(async () => {
      const r = await safeAction(saveNotificationPrefs({ reminder_time: reminderTimeFor(slot) }));
      if (!r.ok) return setErr(r.error ?? "No pudimos guardar la hora. Intenta de nuevo.");
      hide();
      setDone(slot);
    });
  };
  return (
    <section aria-labelledby="reminder-prompt-title" className="card relative p-5">
      <button type="button" onClick={() => { hide(); setOpen(false); }} aria-label="Cerrar" className="tap absolute right-2 top-2 grid size-11 place-items-center rounded-xl text-muted hover:text-ink"><X weight="bold" className="size-5" /></button>
      <span className="grid size-12 place-items-center rounded-2xl bg-banana-soft text-banana-ink"><Bell weight="duotone" className="size-7" /></span>
      <h2 id="reminder-prompt-title" className="mt-3 pr-10 text-xl font-extrabold tracking-tight text-ink text-balance">¿A qué hora sueles entrenar?</h2>
      {done ? (
        <p role="status" className="mt-1 text-body">Listo. Te recordamos tu entreno {WHEN[done]}. Lo cambias cuando quieras en tu perfil.</p>
      ) : (<>
        <p className="mt-1 text-sm text-muted">Te recordamos tu entreno a esa hora. Lo cambias cuando quieras en tu perfil.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {TRAIN_SLOTS.map((s) => (
            <button key={s.id} type="button" disabled={pending} onClick={() => pick(s.id)} data-cta={`hoy-recordatorio-${s.id}`}
              className="pressable min-h-14 rounded-2xl border-2 border-line bg-white px-3 py-2 text-left text-ink transition-[background-color,border-color,transform] hover:border-ink disabled:opacity-60">
              <span className="block font-extrabold">{s.label}</span><span className="block text-xs font-semibold text-muted">{s.hint}</span>
            </button>
          ))}
        </div>
        {err && <p role="alert" className="mt-3 rounded-2xl bg-bad/10 p-3 text-sm font-semibold text-bad">{err}</p>}
      </>)}
    </section>
  );
}
