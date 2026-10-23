"use client";
// Campos del regalo de meses en el panel: plan, meses (1, 3, 6, 12 u otro), mensaje personal y motivo interno.
// Con `cover` muestra en vivo cuándo empieza y termina (misma regla que la base: se apila al final del acceso actual).
import { useId, useState } from "react";
import { GIFT_MAX_MONTHS, GIFT_MESSAGE_MAX, GIFT_MONTH_PRESETS, giftWindow, monthsLabel, planLabel, type CoverComp, type CoverSub } from "@/lib/gifts";
import { inputSm, textareaSm } from "@/components/admin/ui";
import type { PlanId } from "@/lib/plans";

export type GiftCover = { createdAt: string | null; betaEndsAt: string; comps: CoverComp[]; subs: CoverSub[]; renewsAt?: string | null };

const fmt = (iso: string) => new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Costa_Rica" });

export function GiftFields({ cover }: { cover?: GiftCover }) {
  const uid = useId();
  const [plan, setPlan] = useState<PlanId>("completo");
  const [pick, setPick] = useState<string>("3");
  const [custom, setCustom] = useState("2");
  const [msg, setMsg] = useState("");
  const months = pick === "otro" ? Math.max(1, Math.min(GIFT_MAX_MONTHS, Math.round(Number(custom) || 0))) : Number(pick);
  const win = cover ? giftWindow({ now: new Date(), plan, months, createdAt: cover.createdAt, betaEndsAt: cover.betaEndsAt, comps: cover.comps, subs: cover.subs }) : null;
  const startsLater = win ? Date.parse(win.startsAt) > Date.now() + 60_000 : false;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`${uid}-plan`} className="block text-xs font-bold text-ink mb-1">Plan</label>
        <select id={`${uid}-plan`} name="plan" value={plan} onChange={(e) => setPlan(e.target.value as PlanId)} className={inputSm}>
          <option value="completo">Entreno + Nutrición</option>
          <option value="entreno">Entreno</option>
        </select>
      </div>
      <fieldset>
        <legend className="block text-xs font-bold text-ink mb-1">Meses</legend>
        <div className="flex flex-wrap gap-2">
          {[...GIFT_MONTH_PRESETS.map(String), "otro"].map((m) => (
            <label key={m} className={`relative inline-flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-bold transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[.97] has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-banana/50 ${pick === m ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:bg-paper"}`}>
              <input type="radio" name="months" value={m} checked={pick === m} onChange={() => setPick(m)} className="sr-only" />
              {m === "otro" ? "Otro" : m}
            </label>
          ))}
        </div>
        {pick === "otro" && (
          <div className="mt-2">
            <label htmlFor={`${uid}-custom`} className="block text-xs font-bold text-ink mb-1">¿Cuántos meses? (1 a {GIFT_MAX_MONTHS})</label>
            <input id={`${uid}-custom`} name="months_custom" type="number" inputMode="numeric" min={1} max={GIFT_MAX_MONTHS} required value={custom} onChange={(e) => setCustom(e.target.value)} className={`${inputSm} w-28!`} />
          </div>
        )}
      </fieldset>
      <div>
        <label htmlFor={`${uid}-msg`} className="block text-xs font-bold text-ink mb-1">Mensaje para la persona (opcional)</label>
        <textarea id={`${uid}-msg`} name="message" rows={2} maxLength={GIFT_MESSAGE_MAX} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Lo verá en la app y en el correo" className={textareaSm} />
        <p className="mt-1 text-right text-xs text-muted tabular-nums" aria-live="polite">{msg.length.toLocaleString("es-419")} de {GIFT_MESSAGE_MAX.toLocaleString("es-419")}</p>
      </div>
      <div>
        <label htmlFor={`${uid}-reason`} className="block text-xs font-bold text-ink mb-1">Motivo interno</label>
        <input id={`${uid}-reason`} name="reason" required minLength={4} maxLength={300} placeholder="Solo lo ve el equipo, queda en auditoría" className={inputSm} />
      </div>
      <div className="rounded-xl bg-banana-soft px-3 py-2.5 text-sm text-ink" aria-live="polite">
        <b>{monthsLabel(months)} de {planLabel(plan)}.</b>{" "}
        {win ? (startsLater ? <>Empieza el {fmt(win.startsAt)}, cuando termina el acceso que ya tiene, y termina el {fmt(win.expiresAt)}.</> : <>Empieza hoy y termina el {fmt(win.expiresAt)}.</>)
          : <>Cada regalo se suma al final del acceso que ya tenga cada persona.</>}
      </div>
      {cover?.renewsAt && (
        <p className="rounded-xl border border-ember/40 bg-ember/10 px-3 py-2.5 text-sm text-ink">
          Tiene una suscripción que se renueva el {fmt(cover.renewsAt)}. El regalo empieza al terminar ese periodo, pero ONVO cobrará la renovación. Si no quieres que pague mientras tanto, pídele que cancele la renovación en Mi plan.
        </p>
      )}
    </div>
  );
}
