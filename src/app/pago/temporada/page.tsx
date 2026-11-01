import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarCheck, Lock, MonkeyBanana, Scroll } from "@/components/icons";
import { createClient, getViewer } from "@/lib/supabase/server";
import { usd2 } from "@/lib/num";
import { PLANS, annualSaving } from "@/lib/plans";
import { getSeason } from "@/lib/seasons-server";
import { SPORTS, longDate, parseSeasonSlug } from "@/lib/seasons";
import { OnvoPayForm } from "../checkout/onvo-pay-form";

export const metadata = { title: "Compra tu temporada" };

/** Pago con ONVO de una temporada (pago único). El acceso lo otorga el webhook al confirmar el cobro. */
export default async function PagoTemporada({ searchParams }: { searchParams: Promise<{ pi?: string }> }) {
  const { pi } = await searchParams;
  const v = await getViewer();
  if (!v) redirect(`/entrar?next=${encodeURIComponent(`/pago/temporada?pi=${pi ?? ""}`)}`);
  if (v.demo || !pi) return <Notice title={v.demo ? "Modo demo" : "Falta el pago"} body={v.demo ? "Esta es una vista previa: aquí no se hace ningún cobro." : "No encontramos el pago que intentas completar."} />;
  const { data: row } = await (await createClient()).from("challenge_purchases").select("status,challenge_slug,amount_minor,provider_customer_id").eq("provider_payment_intent_id", pi).eq("user_id", v.id).maybeSingle();
  if (!row) return <Notice title="Pago no encontrado" body="Este enlace de pago no es válido para tu cuenta." />;
  if (row.status === "pagado") redirect(`/app/temporadas/${row.challenge_slug}`);
  if (row.status !== "pendiente") return <Notice title="Este enlace venció" body="Vuelve a la temporada para generar un pago nuevo." />;
  const slug = row.challenge_slug as string;
  const s = await getSeason(false, slug);
  const m = parseSeasonSlug(slug);
  const publicKey = process.env.NEXT_PUBLIC_ONVO_PUBLISHABLE_KEY;
  if (!s || !m || !publicKey) return <Notice title="Pagos no disponibles" body="Estamos terminando de activar los pagos. Intenta más tarde." />;
  const { data: subscriptions } = await (await createClient()).from("subscriptions").select("plan,billing,status").eq("user_id", v.id).eq("status", "active");
  const monthly = subscriptions?.find((sub) => sub.billing === "mes");
  const annualPlan = !subscriptions?.some((sub) => sub.billing === "anual") && monthly
    ? PLANS.find((plan) => plan.id === monthly.plan) : undefined;
  return (
    <div className="-mt-4 space-y-3 sm:mt-0 sm:space-y-5 animate-rise">
      <h1 className="text-xl font-extrabold tracking-tight text-ink text-balance">Compra {s.title}</h1>
      <section className="rounded-2xl border border-line bg-banana-soft p-3" aria-label="Resumen de la temporada elegida">
        <div className="flex items-start justify-between gap-3">
          <p className="font-extrabold text-ink">{SPORTS[m.sport].name}, 8 semanas</p>
          <p className="shrink-0 font-extrabold tabular-nums text-ink">{usd2((row.amount_minor as number) / 100)} USD</p>
        </div>
        <p className="mt-1 text-sm text-body">Del {longDate(s.startsOn)} al {longDate(s.endsOn)}.</p>
        <p className="mt-1 text-sm text-body">Fuerza adaptada a tu deporte, nivel, equipo y días disponibles.</p>
        <p className="mt-1 text-xs text-body">Pago único, IVA incluido. Sin renovación automática.</p>
      </section>
      <section className="card p-3 sm:p-5" aria-labelledby="pay-title">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 id="pay-title" className="text-sm font-extrabold text-ink">Tarjeta de crédito o débito</h2>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-peel"><Lock weight="duotone" aria-hidden className="size-4" />Pago seguro</span>
        </div>
        <OnvoPayForm publicKey={publicKey} paymentIntentId={pi} customerId={(row.provider_customer_id as string) ?? undefined} successHref={`/pago/temporada/exito?pi=${encodeURIComponent(pi)}`} />
        <p className="mt-2 text-center"><Link href={`/app/temporadas/${slug}`} className="tap inline-flex min-h-11 items-center text-sm font-semibold text-muted underline underline-offset-2">Continuar sin tarjeta</Link></p>
        <ul className="mt-5 space-y-2.5 border-t border-line pt-4 text-sm text-body">
          <li className="flex gap-2.5"><Lock weight="duotone" aria-hidden className="mt-0.5 size-4 shrink-0 text-peel" /><span>Procesado por ONVO Pay. Banana Burn no ve ni guarda tu tarjeta. Cobro en dólares (USD).</span></li>
          <li className="flex gap-2.5"><CalendarCheck weight="duotone" aria-hidden className="mt-0.5 size-4 shrink-0 text-peel" /><span>Te llevamos a la confirmación. Cuando ONVO confirme el pago, podrás completar el cuestionario para armar tu semana. Si tarda, espera allí y no vuelvas a pagar.</span></li>
          <li className="flex gap-2.5"><Scroll weight="duotone" aria-hidden className="mt-0.5 size-4 shrink-0 text-peel" /><span>Lee los <Link href="/terminos#temporadas" className="font-semibold text-ink underline underline-offset-2">términos de las temporadas</Link>.</span></li>
        </ul>
      </section>
      {annualPlan && <section className="card p-4" aria-labelledby="annual-title">
        <h2 id="annual-title" className="font-extrabold text-ink">Tu plan mensual también tiene opción anual</h2>
        <p className="mt-2 text-sm text-body">{annualPlan.name}: <b className="tabular-nums">{usd2(annualPlan.price.anual)} USD al año</b>, en lugar de {usd2(annualPlan.price.mes)} al mes. Incluye 1 temporada deportiva gratis por año pagado. Ahorras {usd2(annualSaving(annualPlan))} frente a 12 pagos mensuales.</p>
        <p className="mt-2 text-xs text-muted">El precio anual es el total del plan, no un cargo adicional al mensual. Revisa el cambio en Mi plan antes de pagar esta temporada por separado.</p>
        <Link href={`/app/suscripcion?plan=${annualPlan.id}&pago=anual`} className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-2">Revisar plan anual</Link>
      </section>}
      <section className="card p-4" aria-labelledby="includes-title">
        <h2 id="includes-title" className="font-extrabold text-ink">Qué incluye tu temporada</h2>
        <p className="mt-2 text-sm text-body">8 semanas de fuerza para {SPORTS[m.sport].name}, con ejercicios de técnica y una semana organizada alrededor de los días de tu deporte. El cuestionario adapta las sesiones a tu nivel, tiempo y equipo.</p>
        <p className="mt-2 text-sm text-muted">Las semanas siguen el calendario oficial, aunque te incorpores después del inicio.</p>
        <p className="mt-2 text-sm text-body">Aquí pagas con tarjeta de crédito o débito mediante ONVO Pay, en USD.</p>
      </section>
      <Link href={`/app/temporadas/${slug}`} className="tap inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted transition-colors duration-150 hover:text-ink"><ArrowLeft weight="bold" className="size-4" />Volver a la temporada</Link>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-6 text-center space-y-4 animate-rise">
      <span className="mx-auto grid place-items-center size-16 rounded-3xl bg-banana-soft text-banana-ink"><MonkeyBanana className="size-10" /></span>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink text-balance">{title}</h1>
      <p className="text-muted">{body}</p>
      <Link href="/app/temporadas" className="btn-primary">Ver las temporadas</Link>
    </div>
  );
}
