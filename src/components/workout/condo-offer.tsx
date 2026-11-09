"use client";
// 0066: al terminar un entreno, el residente de un condominio con tarjeta que todavía prueba sin tarjeta ve su regalo:
// dejar la tarjeta y seguir gratis hasta el último día. "Ahora no" la esconde 2 días en este teléfono.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Buildings } from "@/components/icons";
import { FunnelTracker } from "@/components/analytics";
import { useLang } from "./use-lang";

export type CondoNudge = { code: string; name: string; freeDay: string };
const KEY = (code: string) => `bb_condo_nudge:${code}`;
const HIDE_MS = 2 * 864e5;

export function CondoWorkoutOffer({ nudge }: { nudge: CondoNudge }) {
  const [show, setShow] = useState(false);
  const { t } = useLang();
  useEffect(() => {
    try { const t = Number(localStorage.getItem(KEY(nudge.code)) ?? 0); setShow(!(t && Date.now() - t < HIDE_MS)); }
    catch { setShow(true); }
  }, [nudge.code]);
  if (!show) return null;
  const hide = () => { try { localStorage.setItem(KEY(nudge.code), String(Date.now())); } catch { /* sin almacenamiento */ } setShow(false); };
  return (
    <section aria-labelledby="condo-offer-title" className="mt-3 rounded-[1.5rem] border-2 border-ink bg-banana-soft p-4 text-left">
      <FunnelTracker view="card_banner_view" props={{ kind: "condominio-entreno" }} />
      <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-banana-ink"><Buildings weight="fill" className="size-4" />{t("Regalo de {name}", { name: nudge.name })}</p>
      <h2 id="condo-offer-title" className="mt-1 text-lg font-extrabold text-ink text-balance">{t("¿Te gustó? Sigue gratis hasta el {day}.", { day: nudge.freeDay })}</h2>
      <p className="mt-1 text-sm text-body text-pretty">{t("Deja tu tarjeta y entrenas con todo incluido sin pagar nada este año. Desde enero sigues solo si quieres, y cancelas cuando quieras.")}</p>
      <Link href={`/c/${nudge.code}#activar`} data-cta="condo-offer-tarjeta" className="btn-banana mt-3 h-13 w-full text-base font-extrabold">{t("Seguir gratis")}</Link>
      <p className="text-center"><button type="button" onClick={hide} data-cta="condo-offer-ahora-no" className="tap inline-flex min-h-11 items-center text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">{t("Ahora no")}</button></p>
    </section>
  );
}
