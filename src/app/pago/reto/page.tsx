import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowCounterClockwise, ArrowLeft, Lock, MonkeyBanana, Scroll } from "@/components/icons";
import { createClient, getViewer } from "@/lib/supabase/server";
import { getCatalog } from "@/lib/challenges-server";
import { usd } from "@/lib/challenges";
import { ChallengeCover } from "@/components/retos/cover";
import { OnvoPayForm } from "../checkout/onvo-pay-form";

export const metadata = { title: "Compra tu reto" };

export default async function PagoReto({ searchParams }: { searchParams: Promise<{ pi?: string }> }) {
  const { pi } = await searchParams;
  const v = await getViewer();
  if (!v) redirect(`/entrar?next=${encodeURIComponent(`/pago/reto?pi=${pi ?? ""}`)}`);
  if (v.demo || !pi) return <Notice title={v.demo ? "Modo demo" : "Falta el pago"} body={v.demo ? "Esta es una vista previa: aquí no se hace ningún cobro." : "No encontramos el pago que intentas completar."} />;

  const sb = await createClient();
  const { data: row } = await sb.from("challenge_purchases").select("status,challenge_slug,amount_minor,list_price_minor,discount_pct,provider_customer_id").eq("provider_payment_intent_id", pi).eq("user_id", v.id).maybeSingle();
  if (!row) return <Notice title="Pago no encontrado" body="Este enlace de pago no es válido para tu cuenta." />;
  if (row.status === "pagado") redirect(`/app/retos/${row.challenge_slug}`);
  if (row.status !== "pendiente") return <Notice title="Este enlace venció" body="Vuelve al reto para generar un pago nuevo." />;
  const c = (await getCatalog(false)).get(row.challenge_slug as string);
  const publicKey = process.env.NEXT_PUBLIC_ONVO_PUBLISHABLE_KEY;
  if (!c || !publicKey) return <Notice title="Pagos no disponibles" body="Estamos terminando de activar los pagos. Intenta más tarde." />;

  return (
    <div className="space-y-6 animate-rise">
      <Link href={`/app/retos/${c.id}`} className="tap inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors duration-150 hover:text-ink"><ArrowLeft weight="bold" className="size-4" />Volver al reto</Link>
      <h1 className="text-3xl font-extrabold tracking-tight text-ink text-balance">Compra {c.title}</h1>
      <section className="card overflow-hidden" aria-label="Resumen">
        <ChallengeCover c={c} className="h-24" />
        <div className="p-5">
          <dl className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-4"><dt className="text-muted">Reto de {c.days} días, pago único</dt><dd className="font-semibold tabular-nums text-ink">{usd(row.list_price_minor as number)}</dd></div>
            {(row.discount_pct as number) > 0 && <div className="flex items-baseline justify-between gap-4"><dt className="text-muted">Descuento por tu nivel ({row.discount_pct as number}%)</dt><dd className="font-semibold tabular-nums text-peel">−{usd((row.list_price_minor as number) - (row.amount_minor as number))}</dd></div>}
            <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3"><dt className="font-extrabold text-ink">Hoy pagas</dt><dd className="text-lg font-extrabold tabular-nums text-ink">{usd(row.amount_minor as number)} USD</dd></div>
          </dl>
          <p className="mt-3 text-sm text-muted">Es tuyo para siempre: puedes repetirlo cuantas veces quieras. No es una suscripción.</p>
        </div>
      </section>
      <section className="card p-5" aria-labelledby="pay-title">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="pay-title" className="font-extrabold text-ink">Tarjeta de crédito o débito</h2>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-peel"><Lock weight="duotone" aria-hidden className="size-4" />Pago seguro</span>
        </div>
        <OnvoPayForm publicKey={publicKey} paymentIntentId={pi} customerId={(row.provider_customer_id as string) ?? undefined} successHref={`/pago/reto/exito?pi=${encodeURIComponent(pi)}`} />
        <ul className="mt-5 space-y-2.5 border-t border-line pt-4 text-sm text-body">
          <li className="flex gap-2.5"><Lock weight="duotone" aria-hidden className="mt-0.5 size-4 shrink-0 text-peel" /><span>Procesado por ONVO Pay. Banana Burn no ve ni guarda tu tarjeta. Cobro en dólares (USD).</span></li>
          <li className="flex gap-2.5"><ArrowCounterClockwise weight="duotone" aria-hidden className="mt-0.5 size-4 shrink-0 text-peel" /><span>Un solo cobro. El reto se activa en tu cuenta en cuanto ONVO confirma el pago.</span></li>
          <li className="flex gap-2.5"><Scroll weight="duotone" aria-hidden className="mt-0.5 size-4 shrink-0 text-peel" /><span>Lee los <Link href="/terminos#reembolsos" className="font-semibold text-ink underline underline-offset-2">reembolsos y derecho de retracto</Link>.</span></li>
        </ul>
      </section>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-6 text-center space-y-4 animate-rise">
      <span className="mx-auto grid place-items-center size-16 rounded-3xl bg-banana-soft text-banana-ink"><MonkeyBanana className="size-10" /></span>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink text-balance">{title}</h1>
      <p className="text-muted">{body}</p>
      <Link href="/app/retos" className="btn-primary">Ir a la tienda de retos</Link>
    </div>
  );
}
