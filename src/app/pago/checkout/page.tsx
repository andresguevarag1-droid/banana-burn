import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowCounterClockwise, Check, Lock, MonkeyBanana, Scroll } from "@/components/icons";
import { FunnelTracker } from "@/components/analytics";
import { createClient, getViewer } from "@/lib/supabase/server";
import { ANNUAL_SEASON_NOTE, PLANS, annualSaving } from "@/lib/plans";
import { money, noBreakGlp1 } from "@/lib/copy";
import { OnvoPayForm } from "./onvo-pay-form";

export const metadata = { title: "Completa tu pago" };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const v = await getViewer();
  if (!v) redirect(`/entrar?next=${encodeURIComponent(`/pago/checkout?s=${s ?? ""}`)}`);

  if (v.demo || !s) {
    return (
      <Notice demo={v.demo} title={v.demo ? "Modo demo" : "Falta el pago"} body={v.demo ? "Esta es una vista previa: aquí no se hace ningún cobro." : "No encontramos el pago que intentas completar."} />
    );
  }

  const sb = await createClient();
  const { data: row } = await sb.from("subscriptions").select("status, plan, billing, provider_customer_id").eq("provider_subscription_id", s).eq("user_id", v.id).maybeSingle();
  if (!row) return <Notice title="Pago no encontrado" body="Este enlace de pago no es válido para tu cuenta." />;
  if (row.status === "active") redirect("/app/suscripcion");
  if (row.status !== "incomplete") return <Notice title="Este enlace venció" body="Vuelve a elegir tu plan para generar un pago nuevo." />;

  const plan = PLANS.find((p) => p.id === row.plan);
  const publicKey = process.env.NEXT_PUBLIC_ONVO_PUBLISHABLE_KEY;
  if (!plan || (row.billing !== "mes" && row.billing !== "anual") || !publicKey) return <Notice title="Pagos no disponibles" body="Estamos terminando de activar los pagos. Intenta más tarde." />;
  const price = plan.price[row.billing as "mes" | "anual"];
  const annual = row.billing === "anual";
  // Próxima renovación: un mes o un año desde hoy, en la zona horaria de la persona.
  const next = new Date();
  if (annual) next.setFullYear(next.getFullYear() + 1); else next.setMonth(next.getMonth() + 1);
  const renews = next.toLocaleDateString("es-419", { day: "numeric", month: "long", year: "numeric", timeZone: v.tz });

  return (
    <div className="-mt-4 space-y-3 sm:mt-0 sm:space-y-5 animate-rise">
      <FunnelTracker view="checkout_view" props={{ plan: plan.id, billing: row.billing as string }} />
      <h1 className="text-xl font-extrabold tracking-tight text-ink text-balance">Completa tu pago</h1>

      <section className="rounded-2xl border border-line bg-banana-soft p-3" aria-label="Resumen del plan elegido">
        <div className="flex items-start justify-between gap-3">
          <p className="font-extrabold text-ink">{plan.name}</p>
          <p className="shrink-0 text-right text-ink"><span className="font-extrabold tabular-nums">{money(price)} USD</span><span className="block text-xs">{annual ? "Hoy y cada año" : "Hoy y cada mes"}</span></p>
        </div>
        {annual ? (
          <p className="mt-1 text-sm text-body">Ahorras <b className="tabular-nums">{money(annualSaving(plan))}</b> frente a 12 pagos mensuales. {ANNUAL_SEASON_NOTE}.</p>
        ) : (
          <Link href={`/app/suscripcion?plan=${plan.id}&pago=anual`} data-cta="checkout-cambiar-anual" className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-2">Cambiar a anual: {money(plan.price.anual)}, ahorra {money(annualSaving(plan))}</Link>
        )}
        <p className="text-xs text-body">Precios en USD, IVA incluido. Cancela cuando quieras desde Mi plan.</p>
      </section>

      <section className="card p-3 sm:p-5" aria-labelledby="pay-title">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 id="pay-title" className="text-sm font-extrabold text-ink">Tarjeta de crédito o débito</h2>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-peel"><Lock weight="duotone" aria-hidden className="size-4" />Pago seguro</span>
        </div>
        <OnvoPayForm publicKey={publicKey} subscriptionId={s} customerId={row.provider_customer_id ?? undefined} />
        <p className="mt-2 text-center"><Link href={`/pago/cancelado?s=${encodeURIComponent(s)}`} data-cta="checkout-ahora-no" className="tap inline-flex min-h-11 items-center text-sm font-semibold text-muted underline hover:text-ink">Continuar sin tarjeta</Link></p>
        <ul className="mt-5 space-y-2.5 border-t border-line pt-4 text-sm text-body">
          <li className="flex gap-2.5"><Lock weight="duotone" aria-hidden className="mt-0.5 size-4 shrink-0 text-peel" /><span className="text-pretty">Procesado por ONVO Pay. Banana Burn no ve ni guarda tu tarjeta. Cobro en dólares (USD).</span></li>
          <li className="flex gap-2.5"><ArrowCounterClockwise weight="duotone" aria-hidden className="mt-0.5 size-4 shrink-0 text-peel" /><span className="text-pretty">Cancelas cuando quieras desde Mi plan, sin llamadas. Conservas el acceso hasta el final del periodo pagado.</span></li>
          <li className="flex gap-2.5"><Scroll weight="duotone" aria-hidden className="mt-0.5 size-4 shrink-0 text-peel" /><span className="text-pretty">8 días hábiles de derecho de retracto. Lee los <Link href="/terminos#planes" className="font-semibold text-ink underline underline-offset-2">Términos</Link> y <Link href="/terminos#reembolsos" className="font-semibold text-ink underline underline-offset-2">reembolsos y retracto</Link>.</span></li>
        </ul>
      </section>
      <section className="card p-4" aria-labelledby="after-pay-title">
        <h2 id="after-pay-title" className="font-extrabold text-ink">¿Qué pasa después del pago?</h2>
        <p className="mt-2 text-sm text-body text-pretty">Te llevamos a la confirmación. Cuando ONVO confirme el cobro, tu plan se activa y puedes ir a tu entreno de hoy. Tu progreso sigue guardado.</p>
        <p className="mt-2 text-sm text-muted">Si la confirmación tarda, espera en esa pantalla. No vuelvas a pagar.</p>
        <dl className="mt-3 border-t border-line pt-3 text-sm">
          <div className="flex items-baseline justify-between gap-3"><dt className="text-muted">Próxima renovación</dt><dd className="text-right font-semibold text-ink">{renews}, por <span className="tabular-nums">{money(price)} USD</span></dd></div>
        </dl>
        <details className="mt-3 border-t border-line pt-1">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-ink">Qué incluye {plan.name}</summary>
          <ul className="space-y-2 text-sm text-body">
            {plan.feats.map((f) => <li key={f} className="flex gap-2"><Check weight="bold" aria-hidden className="mt-0.5 size-4 shrink-0 text-peel" /><span>{noBreakGlp1(f)}</span></li>)}
          </ul>
          {plan.excluded.length > 0 && <p className="mt-3 text-xs text-muted">No incluye: <span className="line-through">{plan.excluded.map(noBreakGlp1).join(", ")}</span>.</p>}
          <p className="mt-3 text-xs text-muted">{noBreakGlp1("Banana Shield para GLP-1: No sustituye la indicación de tu médico.")}</p>
          {!annual && <p className="mt-2 text-xs text-muted">La temporada deportiva gratis está incluida solo en el plan anual.</p>}
        </details>
      </section>
    </div>
  );
}

function Notice({ title, body, demo }: { title: string; body: string; demo?: boolean }) {
  return (
    <div className="card p-6 text-center space-y-4 animate-rise">
      {demo && <span className="mx-auto grid place-items-center size-16 rounded-3xl bg-banana-soft text-banana-ink"><MonkeyBanana className="size-10" /></span>}
      <h1 className="text-2xl font-extrabold tracking-tight text-ink text-balance">{title}</h1>
      <p className="text-muted">{body}</p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Link href="/app/suscripcion" className="btn-primary">Ver mi plan</Link>
        <Link href="/app" className="btn-ghost">Ir a Banana Burn</Link>
      </div>
    </div>
  );
}
