import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient, getViewer } from "@/lib/supabase/server";
import { PLANS, perMonthAnnual, usd } from "@/lib/plans";
import { OnvoPayForm } from "./onvo-pay-form";

export const metadata = { title: "Completa tu pago" };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const v = await getViewer();
  if (!v) redirect(`/entrar?next=${encodeURIComponent(`/pago/checkout?s=${s ?? ""}`)}`);

  if (v.demo || !s) {
    return (
      <Notice title={v.demo ? "Modo demo 🧪" : "Falta el pago"} body={v.demo ? "Esta es una vista previa: aquí no se hace ningún cobro." : "No encontramos el pago que intentas completar."} />
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

  return (
    <div className="space-y-6 animate-rise">
      <Link href="/app/suscripcion" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />Volver</Link>
      <header>
        <p className="eyebrow">Último paso</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Activa tu plan 🍌</h1>
      </header>

      <section className="card p-5" aria-label="Resumen">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-extrabold text-ink">{plan.name}</p>
            <p className="text-sm text-muted">{annual ? "Pago anual" : "Pago mensual"} · se renueva solo, cancela cuando quieras</p>
          </div>
          <p className="text-right shrink-0">
            <span className="block text-2xl font-extrabold tabular-nums text-ink">{usd(price)}</span>
            <span className="text-xs text-muted">{annual ? `/año · ${usd(perMonthAnnual(plan))}/mes` : "/mes"}</span>
          </p>
        </div>
        <p className="mt-4 text-xs text-muted">Los métodos disponibles para pagos recurrentes aparecen en el formulario de abajo.</p>
      </section>

      <section className="card p-5" aria-labelledby="pay-title">
        <h2 id="pay-title" className="font-extrabold text-ink mb-4">Método de pago</h2>
        <OnvoPayForm publicKey={publicKey} subscriptionId={s} customerId={row.provider_customer_id ?? undefined} />
      </section>

      <p className="text-xs text-muted text-center">Tus datos de pago los procesa ONVO Pay; Banana Burn no ve ni guarda tu tarjeta. El cobro es en dólares (USD).</p>
      <p className="text-center"><Link href={`/pago/cancelado?s=${encodeURIComponent(s)}`} className="text-sm font-semibold text-muted underline hover:text-ink">No quiero pagar ahora</Link></p>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-6 text-center space-y-4 animate-rise">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
      <p className="text-muted">{body}</p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Link href="/app/suscripcion" className="btn-primary">Ver mi suscripción</Link>
        <Link href="/app" className="btn-ghost">Ir a la app</Link>
      </div>
    </div>
  );
}
