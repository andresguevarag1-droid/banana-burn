import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarCheck, Lock, MonkeyBanana, Scroll } from "@/components/icons";
import { createClient, getViewer } from "@/lib/supabase/server";
import { usd } from "@/lib/challenges";
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
  return (
    <div className="space-y-6 animate-rise">
      <Link href={`/app/temporadas/${slug}`} className="tap inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors duration-150 hover:text-ink"><ArrowLeft weight="bold" className="size-4" />Volver a la temporada</Link>
      <h1 className="text-3xl font-extrabold tracking-tight text-ink text-balance">Compra {s.title}</h1>
      <section className="card p-5" aria-label="Resumen">
        <dl className="space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-4"><dt className="text-muted">Temporada de {SPORTS[m.sport].name}, 8 semanas</dt><dd className="font-semibold tabular-nums text-ink">{usd(row.amount_minor as number)}</dd></div>
          <div className="flex items-baseline justify-between gap-4"><dt className="text-muted">Fechas</dt><dd className="font-semibold text-ink text-right">Del {longDate(s.startsOn)} al {longDate(s.endsOn)}</dd></div>
          <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3"><dt className="font-extrabold text-ink">Hoy pagas</dt><dd className="text-lg font-extrabold tabular-nums text-ink">{usd(row.amount_minor as number)} USD</dd></div>
        </dl>
        <p className="mt-3 text-sm text-muted">Pago único, no es una suscripción. Cada temporada se vive una sola vez: la siguiente llega con ejercicios nuevos.</p>
      </section>
      <section className="card p-5" aria-labelledby="pay-title">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="pay-title" className="font-extrabold text-ink">Tarjeta de crédito o débito</h2>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-peel"><Lock weight="duotone" aria-hidden className="size-4" />Pago seguro</span>
        </div>
        <OnvoPayForm publicKey={publicKey} paymentIntentId={pi} customerId={(row.provider_customer_id as string) ?? undefined} successHref={`/pago/temporada/exito?pi=${encodeURIComponent(pi)}`} />
        <ul className="mt-5 space-y-2.5 border-t border-line pt-4 text-sm text-body">
          <li className="flex gap-2.5"><Lock weight="duotone" aria-hidden className="mt-0.5 size-4 shrink-0 text-peel" /><span>Procesado por ONVO Pay. Banana Burn no ve ni guarda tu tarjeta. Cobro en dólares (USD).</span></li>
          <li className="flex gap-2.5"><CalendarCheck weight="duotone" aria-hidden className="mt-0.5 size-4 shrink-0 text-peel" /><span>La temporada se activa en tu cuenta en cuanto ONVO confirma el pago.</span></li>
          <li className="flex gap-2.5"><Scroll weight="duotone" aria-hidden className="mt-0.5 size-4 shrink-0 text-peel" /><span>Lee los <Link href="/terminos#temporadas" className="font-semibold text-ink underline underline-offset-2">términos de las temporadas</Link>.</span></li>
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
      <Link href="/app/temporadas" className="btn-primary">Ver las temporadas</Link>
    </div>
  );
}
