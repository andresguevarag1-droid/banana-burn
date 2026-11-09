import Link from "next/link";
import { FunnelTracker } from "@/components/analytics";
import { trialCardNotice } from "@/lib/trial-card-notice";
import type { Entitlements } from "@/lib/entitlements";
import { amountMinorFor } from "@/lib/trial";
import { usd2 } from "@/lib/num";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { rich } from "@/lib/i18n/rich";
import { tr } from "@/lib/i18n/t";

export function TrialCardNotice({ ent, tz, screen, now, minDay = 0, locale = DEFAULT_LOCALE }: { ent: Entitlements; tz: string; screen: "hoy" | "suscripcion"; now?: Date; /** Solo desde este día de la prueba. */ minDay?: number; locale?: Locale }) {
  const notice = trialCardNotice(ent, now);
  if (!notice || notice.day < minDay) return null;
  const date = new Date(notice.chargeAt).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: tz });
  const t = tr(locale);
  return <aside aria-label={t("Guardar tarjeta es opcional")} className="card p-4 sm:p-6">
    <FunnelTracker view="card_banner_view" props={{ kind: "trial-optional", screen, day: notice.day }} />
    {/* En Mi plan el pedido lo cuenta el formulario (mi-plan); en Hoy es el banner del día 7 (#280). */}
    {screen === "hoy" && <FunnelTracker view="card_ask_view" props={{ where: "hoy-banner" }} />}
    <p className="eyebrow">{t("Día {day} de 7", { day: notice.day })}</p>
    <h2 className="mt-2 text-xl font-extrabold tracking-tight text-ink">{t("Deja tu tarjeta lista y paga 50 % menos tu primer mes")}</h2>
    <p className="mt-2 text-sm text-body">{rich(t("Si guardas tu tarjeta, el {date} se cobra tu primer mes: {entreno} con Entreno o {completo} con Entreno + Nutrición, según el plan mensual que elijas. IVA incluido."),
      { date: <b className="tabular-nums">{date}</b>, entreno: <b className="tabular-nums">{usd2(notice.entreno)}</b>, completo: <b className="tabular-nums">{usd2(notice.completo)}</b> })}</p>
    <p className="mt-2 text-sm text-muted">{t("Hoy no te cobramos. Después, {entreno} o {completo} al mes, respectivamente. Puedes cancelar antes del cobro desde Mi plan.", { entreno: usd2(amountMinorFor("entreno", "mes") / 100), completo: usd2(amountMinorFor("completo", "mes") / 100) })}</p>
    <p className="mt-2 text-sm text-body">{t("Es opcional. Sin tarjeta no hay cobros y puedes seguir usando tu prueba hasta esa fecha.")}</p>
    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
      <Link href={screen === "hoy" ? "/app/suscripcion?desde=hoy-banner#tarjeta" : "/app/suscripcion#tarjeta"} data-cta={`trial-card-${screen}-guardar`} className="btn-ghost">{t("Dejar mi tarjeta lista")}</Link>
      <Link href={screen === "hoy" ? "#hoy-continuar" : "/app"} data-cta={`trial-card-${screen}-continuar`} className="btn-ghost">{t("Continuar sin tarjeta")}</Link>
    </div>
  </aside>;
}
