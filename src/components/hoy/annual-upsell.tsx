"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PLANS, annualSaving, ANNUAL_SEASON_NOTE, type PlanId } from "@/lib/plans";
import { usd2 } from "@/lib/num";
import { useLocale, useT } from "@/lib/i18n/client";
import { rich } from "@/lib/i18n/rich";
import { planName } from "@/lib/i18n/names";

export const annualDismissKey = (userId: string) => `bb.annual-dismiss.${userId}`;
export const annualDismissed = (value: string | null, now = Date.now()) => {
  const until = Number(value);
  return Number.isFinite(until) && until > now;
};

export function AnnualUpsell({ plan, userId }: { plan: PlanId; userId: string }) {
  const t = useT();
  const locale = useLocale();
  const [visible, show] = useState(false);
  const [error, report] = useState(false);
  const key = annualDismissKey(userId);
  useEffect(() => {
    try { show(!annualDismissed(localStorage.getItem(key))); }
    catch { show(false); }
  }, [key]);
  if (!visible) return null;
  const p = PLANS.find((item) => item.id === plan)!;
  const name = planName(p.name, locale);
  function dismiss() {
    try {
      localStorage.setItem(key, String(Date.now() + 30 * 864e5));
      show(false);
    } catch { report(true); }
  }
  return (
    <section className="card bg-banana-soft p-4 sm:p-6 motion-safe:animate-enter" aria-labelledby="annual-title">
      <p className="eyebrow">{t("Tu mismo plan, por un año")}</p>
      <h2 id="annual-title" className="mt-2 text-xl font-extrabold text-ink text-balance">{rich(t("Ahorra {amount} al año"), { amount: <span className="tabular-nums">{usd2(annualSaving(p))}</span> })}</h2>
      <p className="mt-2 text-sm text-body">{rich(t("{plan} por {price}, en USD, IVA incluido, en un solo pago por 12 meses, frente a pagar mes a mes."), { plan: name, price: <b className="tabular-nums">{t("{price}/año", { price: usd2(p.price.anual) })}</b> })} {t(ANNUAL_SEASON_NOTE)}.</p>
      <p className="mt-2 text-sm text-body">{t("El anual empieza al confirmar el pago y reemplaza tu plan actual, sin prorrateo.")}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Link href={`/app/suscripcion?plan=${plan}&pago=anual`} className="btn-primary min-h-12">{t("Ver cambio a anual")}</Link>
        <button type="button" onClick={dismiss} className="btn-ghost min-h-12">{t("Ahora no")}</button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-bad">{t("No pudimos guardar tu preferencia. Intenta cerrar el aviso otra vez.")}</p>}
    </section>
  );
}
