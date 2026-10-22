import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MonkeyBanana } from "@/components/icons";
import { createClient, getViewer } from "@/lib/supabase/server";
import { PLANS, perMonthAnnual } from "@/lib/plans";
import { money } from "@/lib/copy";
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
    <div className="space-y-6 animate-rise">
      <Link href="/app/suscripcion" className="tap inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors duration-150 hover:text-ink"><ArrowLeft weight="bold" className="size-4" />Volver a Mi suscripción</Link>
      <h1 className="text-3xl font-extrabold tracking-tight text-ink text-balance">Activa {plan.name}</h1>

      <section className="card p-5" aria-label="Resumen">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-extrabold text-ink">{plan.name}</p>
            <p className="text-sm text-muted">{annual ? `Pago anual, equivale a ${money(perMonthAnnual(plan))} al mes.` : "Pago mensual, sin permanencia."}</p>
          </div>
          <p className="text-right shrink-0">
            <span className="block text-2xl font-extrabold tabular-nums text-ink">{money(price)}</span>
            <span className="text-xs text-muted">{annual ? "al año" : "al mes"}</span>
          </p>
        </div>
        <dl className="mt-4 border-t border-line pt-4 space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-4"><dt className="font-extrabold text-ink">Hoy pagas</dt><dd className="text-lg font-extrabold tabular-nums text-ink">{money(price)} USD</dd></div>
          <div className="flex items-baseline justify-between gap-4"><dt className="text-muted">Se renueva el</dt><dd className="font-semibold text-ink text-right">{renews}, por {money(price)}</dd></div>
        </dl>
        <p className="mt-4 text-xs text-muted text-pretty">Pagas con tarjeta de crédito o débito. Cancelas cuando quieras desde Mi suscripción y tienes 8 días hábiles de derecho de retracto: lee los <Link href="/terminos#planes" className="tap font-semibold text-ink underline underline-offset-2">Términos</Link> y la sección de <Link href="/terminos#reembolsos" className="tap font-semibold text-ink underline underline-offset-2">reembolsos y retracto</Link>.</p>
      </section>

      <section className="card p-5" aria-labelledby="pay-title">
        <h2 id="pay-title" className="font-extrabold text-ink mb-4">Método de pago</h2>
        <OnvoPayForm publicKey={publicKey} subscriptionId={s} customerId={row.provider_customer_id ?? undefined} />
      </section>

      <p className="text-xs text-muted text-center">Tus datos de pago los procesa ONVO Pay; Banana Burn no ve ni guarda tu tarjeta. El cobro es en dólares (USD).</p>
      <p className="text-center"><Link href={`/pago/cancelado?s=${encodeURIComponent(s)}`} className="tap text-sm font-semibold text-muted underline hover:text-ink">No quiero pagar ahora</Link></p>
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
        <Link href="/app/suscripcion" className="btn-primary">Ver mi suscripción</Link>
        <Link href="/app" className="btn-ghost">Ir a la app</Link>
      </div>
    </div>
  );
}
