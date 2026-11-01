import Link from "next/link";
import { headers } from "next/headers";
import { Gift } from "@/components/icons";
import { getViewer } from "@/lib/supabase/server";
import { getSeasonsView } from "@/lib/seasons-server";
import { SPORTS, canEnroll, longDate, seasonStatus, seasonWeek } from "@/lib/seasons";
import { PLANS, hasNutrition } from "@/lib/plans";
import { usd2 } from "@/lib/num";
import { SeasonBuy } from "@/components/temporadas/season-buy";
import { tilopayOfferedTo } from "@/lib/tilopay";
import { providerFor } from "@/lib/pay-provider";
import { redirect } from "next/navigation";

export const metadata = { title: "Temporadas" };

export default async function Temporadas({ searchParams }: { searchParams: Promise<{ pago?: string }> }) {
  const v = await getViewer();
  if (!v) redirect("/entrar?next=/app/temporadas");
  const [view, sp, h] = await Promise.all([getSeasonsView(v), searchParams, headers()]);
  const first = view.seasons[0];
  const annualPlan = PLANS.find((p) => p.id === (hasNutrition(v.plan) ? "completo" : "entreno"))!;
  const tilopay = tilopayOfferedTo(v.role);
  const suggested = providerFor({ country: h.get("x-vercel-ip-country"), profileCountry: v.country, tilopayReady: tilopay });
  return (
    <div className="space-y-4 animate-rise">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-banana-ink">Temporadas deportivas</p>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">Elige tu deporte</h1>
        {first && <>
          <p className="text-sm font-semibold text-ink">Temporada {first.number}: del {longDate(first.startsOn)} al {longDate(first.endsOn)}</p>
          <p className="text-sm text-muted">Inscripciones hasta el {longDate(first.enrollUntil)}.</p>
        </>}
      </header>
      {sp.pago === "vencido" && <p role="alert" className="rounded-2xl bg-banana-soft p-3 text-sm font-semibold text-ink">Ese enlace de pago venció. Vuelve a intentarlo desde tu deporte.</p>}
      {view.annual && <p className="flex items-center gap-2 rounded-2xl bg-banana-soft p-3 text-sm font-semibold text-ink"><Gift weight="duotone" className="size-5 shrink-0" />Tienes 1 temporada gratis disponible con tu anual. Elige tu deporte para canjearla.</p>}
      {!view.seasons.length && <p className="card p-5 text-body">Todavía no hay temporadas disponibles. Puedes seguir con <Link href="/app/entrenar" className="tap underline font-bold">tu entreno de hoy</Link>.</p>}
      <ul className="grid items-start gap-4 md:grid-cols-3">
        {view.seasons.map((s) => {
          const info = SPORTS[s.sport];
          const owned = view.owned.has(s.slug);
          const open = canEnroll(s, view.today);
          const status = seasonStatus(s, view.today);
          return (
            <li key={s.slug} className="card space-y-3 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-extrabold tracking-tight text-ink">{info.name}</h2>
                <span className="font-extrabold text-ink tabular-nums">US{usd2(s.priceMinor / 100)}</span>
              </div>
              <p className="text-sm text-body">{info.tagline}</p>
              {owned ? <Link href={`/app/temporadas/${s.slug}`} className="btn-primary min-h-12 w-full">Ver mi temporada</Link>
                : !open ? <p className="rounded-2xl bg-cream p-3 text-sm font-semibold text-muted">Inscripciones cerradas</p>
                : view.access || v.demo ? <SeasonBuy slug={s.slug} price={usd2(s.priceMinor / 100)} annual={!!view.annual} tilopay={tilopay} suggested={suggested} />
                : <Link href="/app/suscripcion" className="btn-primary min-h-12 w-full">Activar mi plan para inscribirme</Link>}
              <Link href={`/app/temporadas/${s.slug}`} className="tap inline-flex text-sm font-semibold text-ink underline underline-offset-4">Ver qué incluye y las 8 semanas</Link>
              {status === "activa" && <p className="text-xs text-muted">Semana {seasonWeek(s, view.today)} de 8. La temporada sigue el calendario oficial, aunque te inscribas después del inicio.</p>}
            </li>
          );
        })}
      </ul>
      <section className="card space-y-3 p-5" aria-labelledby="incluye">
        <h2 id="incluye" className="text-xl font-extrabold text-ink">8 semanas para tu deporte</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-body">
          <li>Fuerza adaptada a tus días de carrera, partido o box mediante un cuestionario inicial.</li>
          <li>De 2 a 4 sesiones por semana de 30, 45 o 60 minutos, en casa o gimnasio.</li>
          <li>Tu coach, consejos y experiencia de la app se adaptan a tu deporte.</li>
        </ul>
        <p className="text-xs text-muted">Compra extra con pago único en USD. Necesitas un plan activo o tu prueba gratis. Cada año pagado del plan anual incluye 1 temporada.</p>
      </section>
      {!view.hasAnnual && <section className="rounded-3xl border border-line bg-banana-soft p-5 space-y-3" aria-labelledby="anual">
        <h2 id="anual" className="text-xl font-extrabold text-ink">¿Pagas mes a mes?</h2>
        <p className="text-sm text-body">Con {annualPlan.name} anual pagas <strong className="tabular-nums">US{usd2(annualPlan.price.anual)} al año</strong> e incluyes 1 temporada sin costo extra. Con mensual pagas US{usd2(annualPlan.price.mes)} al mes y la temporada se compra aparte.</p>
        <p className="text-sm text-body">El anual empieza al confirmar el pago y reemplaza tu plan actual, sin prorrateo.</p>
        <Link href={`/app/suscripcion?plan=${annualPlan.id}&pago=anual`} className="tap inline-flex text-sm font-bold text-ink underline underline-offset-4">Ver cambio a anual</Link>
      </section>}
      {view.hasAnnual && !view.annual && <p className="text-sm text-muted">La temporada incluida en tu anual ya no está disponible para canje en este periodo. Puedes comprar otra por separado.</p>}
    </div>
  );
}
