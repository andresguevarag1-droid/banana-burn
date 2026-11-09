"use client";
// Hoy después del primer entreno guardado a medias (#246): si salió antes del cierre, aquí ve lo que hizo, la oferta del
// plan (#199) y el coach (#198), igual que al terminar. Sale una sola vez por teléfono.
import { useEffect, useState } from "react";
import { BananaFlame, X } from "@/components/icons";
import { CoachPrompt } from "@/components/coach-prompt";
import { FirstWorkoutOffer } from "@/components/workout/first-workout-offer";
import { clearFirstPartial, readFirstPartial, type FirstPartial } from "@/lib/first-partial";
import { useT } from "@/lib/i18n/client";

export function FirstPartialCard({ offer, coachPrompt = null, coach = null }: {
  /** Id de la cuenta si aún puede activar su plan en la prueba (la misma regla del cierre). */
  offer?: string;
  coachPrompt?: { home: boolean } | null;
  coach?: { name: string; avatar: string } | null;
}) {
  const t = useT();
  const [p, setP] = useState<FirstPartial | null>(null);
  useEffect(() => { try { setP(readFirstPartial(localStorage, Date.now())); } catch { /* sin almacenamiento */ } }, []);
  if (!p) return null;
  const close = () => { try { clearFirstPartial(localStorage); } catch { /* */ } setP(null); };
  return (
    <section aria-labelledby="first-partial-title" className="card relative p-5">
      <button type="button" onClick={close} aria-label={t("Cerrar")} className="tap absolute right-2 top-2 grid size-11 place-items-center rounded-xl text-muted hover:text-ink"><X weight="bold" className="size-5" /></button>
      <span className="grid size-12 place-items-center rounded-2xl bg-banana text-ink"><BananaFlame weight="fill" className="size-7" /></span>
      <h2 id="first-partial-title" className="mt-3 pr-10 text-2xl font-extrabold tracking-tight text-ink text-balance">{t("¡Ya hiciste tu primer entreno!")}</h2>
      <p className="mt-1 text-body tabular-nums">{t(p.total === 1 ? "{title}: {done} de {total} serie en {mins} min. Quedó guardado y ya cuenta para tu racha." : "{title}: {done} de {total} series en {mins} min. Quedó guardado y ya cuenta para tu racha.", { title: t(p.title), done: p.done, total: p.total, mins: p.mins })}</p>
      {offer && <FirstWorkoutOffer userId={offer} />}
      {coachPrompt && <CoachPrompt where="hoy" home={coachPrompt.home} coach={coach} className="mt-4" />}
    </section>
  );
}
