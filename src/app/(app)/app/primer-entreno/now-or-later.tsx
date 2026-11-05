"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Barbell, Bell, House, MonkeyBanana } from "@/components/icons";
import { saveNotificationPrefs } from "@/app/actions/notifications";
import { safeAction } from "@/lib/action-client";
import { TRAIN_SLOTS, reminderTimeFor, type TrainSlot } from "@/lib/train-slot";
import { REMINDER_PROMPT_KEY } from "@/components/hoy/reminder-prompt";

const WHEN: Record<TrainSlot, string> = { manana: "en la mañana", mediodia: "al mediodía", tarde: "en la tarde", noche: "en la noche" };

export function NowOrLater() {
  const [later, setLater] = useState(false);
  const [done, setDone] = useState<TrainSlot | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const pick = (slot: TrainSlot) => {
    setErr(null);
    start(async () => {
      const r = await safeAction(saveNotificationPrefs({ reminder_time: reminderTimeFor(slot) }));
      if (!r.ok) return setErr(r.error ?? "No pudimos guardar la hora. Intenta de nuevo.");
      try { localStorage.setItem(REMINDER_PROMPT_KEY, "1"); } catch { /* sin almacenamiento */ }
      setDone(slot);
    });
  };

  return (
    <div className="mx-auto max-w-md py-4 text-center">
      <span className="mx-auto grid size-20 place-items-center rounded-[1.75rem] bg-banana-soft text-banana-ink"><MonkeyBanana className="size-14" /></span>
      {!later ? (
        <>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink text-balance">¿Entrenamos ahora?</h1>
          <p className="mt-2 text-muted text-pretty">Tu primer entreno es corto. Coach Banana te dice cada paso.</p>
          <div className="mt-6 flex flex-col gap-3 text-left">
            <Link href="/app/entreno?casa=1" data-cta="primer-entreno-casa" className="btn-primary flex min-h-16 h-auto w-full items-center justify-between gap-3 px-5 py-3 text-lg font-extrabold">
              <span className="flex items-center gap-3"><House weight="fill" className="size-6 shrink-0" /><span>Sí, en casa<span className="block text-sm font-semibold">Unos 12 min, sin equipo</span></span></span>
              <ArrowRight weight="bold" className="size-5 shrink-0" />
            </Link>
            <Link href="/app/entreno" data-cta="primer-entreno-gym" className="btn-ghost flex min-h-16 h-auto w-full items-center justify-between gap-3 px-5 py-3 text-lg font-extrabold">
              <span className="flex items-center gap-3"><Barbell weight="duotone" className="size-6 shrink-0" /><span>Sí, estoy en el gym<span className="block text-sm font-semibold">Tu entreno con las máquinas</span></span></span>
              <ArrowRight weight="bold" className="size-5 shrink-0" />
            </Link>
            <button type="button" onClick={() => setLater(true)} data-cta="primer-entreno-despues" className="tap mt-1 inline-flex min-h-12 items-center justify-center gap-2 font-bold text-ink underline decoration-ink/30 underline-offset-4">
              <Bell weight="duotone" className="size-5" />Ahora no puedo, recuérdame
            </button>
          </div>
        </>
      ) : done ? (
        <>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink text-balance">Listo, te escribimos {WHEN[done]}.</h1>
          <p className="mt-2 text-muted text-pretty">Tu primer entreno te espera en Hoy. Si se te abre un rato antes, son solo 12 minutos en casa.</p>
          <Link href="/app" data-cta="primer-entreno-ir-hoy" className="btn-primary mt-6 h-14 w-full text-base">Ver mi plan <ArrowRight weight="bold" className="size-5" /></Link>
        </>
      ) : (
        <>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink text-balance">¿A qué hora te recordamos?</h1>
          <p className="mt-2 text-muted text-pretty">Te avisamos a esa hora para tu primer entreno. Lo cambias cuando quieras en tu perfil.</p>
          <div className="mt-6 grid grid-cols-2 gap-2 text-left">
            {TRAIN_SLOTS.map((s) => (
              <button key={s.id} type="button" disabled={pending} onClick={() => pick(s.id)} data-cta={`primer-entreno-hora-${s.id}`}
                className="pressable min-h-16 rounded-2xl border-2 border-line bg-white px-3 py-2 text-ink transition-[border-color,transform] hover:border-ink disabled:opacity-60">
                <span className="block font-extrabold">{s.label}</span><span className="block text-xs font-semibold text-muted">{s.hint}</span>
              </button>
            ))}
          </div>
          {err && <p role="alert" className="mt-3 rounded-2xl bg-bad/10 p-3 text-sm font-semibold text-bad">{err}</p>}
          <button type="button" onClick={() => setLater(false)} className="tap mt-4 inline-flex min-h-12 items-center font-bold text-ink underline decoration-ink/30 underline-offset-4">Mejor entreno ahora</button>
        </>
      )}
    </div>
  );
}
