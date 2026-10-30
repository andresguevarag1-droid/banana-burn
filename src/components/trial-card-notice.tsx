import Link from "next/link";
import { FunnelTracker } from "@/components/analytics";
import { trialCardNotice } from "@/lib/trial-card-notice";
import type { Entitlements } from "@/lib/entitlements";
import { amountMinorFor } from "@/lib/trial";
import { usd2 } from "@/lib/num";

export function TrialCardNotice({ ent, tz, screen, now }: { ent: Entitlements; tz: string; screen: "hoy" | "suscripcion"; now?: Date }) {
  const notice = trialCardNotice(ent, now);
  if (!notice) return null;
  const date = new Date(notice.chargeAt).toLocaleDateString("es-419", { day: "numeric", month: "long", year: "numeric", timeZone: tz });
  return <aside aria-label="Guardar tarjeta es opcional" className="card p-4 sm:p-6">
    <FunnelTracker view="card_banner_view" props={{ kind: "trial-optional", screen, day: notice.day }} />
    <p className="eyebrow">Día {notice.day} de 7</p>
    <h2 className="mt-2 text-xl font-extrabold tracking-tight text-ink">Deja tu tarjeta lista y paga 50 % menos tu primer mes</h2>
    <p className="mt-2 text-sm text-body">Si guardas tu tarjeta, el <b className="tabular-nums">{date}</b> se cobra tu primer mes: <b className="tabular-nums">{usd2(notice.entreno)}</b> con Entreno o <b className="tabular-nums">{usd2(notice.completo)}</b> con Entreno + Nutrición, según el plan mensual que elijas. IVA incluido.</p>
    <p className="mt-2 text-sm text-muted">Hoy no te cobramos. Después, {usd2(amountMinorFor("entreno", "mes") / 100)} o {usd2(amountMinorFor("completo", "mes") / 100)} al mes, respectivamente. Puedes cancelar antes del cobro desde Mi plan.</p>
    <p className="mt-2 text-sm text-body">Es opcional. Sin tarjeta no hay cobros y puedes seguir usando tu prueba hasta esa fecha.</p>
    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
      <Link href="/app/suscripcion#tarjeta" data-cta={`trial-card-${screen}-guardar`} className="btn-ghost">Dejar mi tarjeta lista</Link>
      <Link href={screen === "hoy" ? "#hoy-continuar" : "/app"} data-cta={`trial-card-${screen}-continuar`} className="btn-ghost">Continuar sin tarjeta</Link>
    </div>
  </aside>;
}
