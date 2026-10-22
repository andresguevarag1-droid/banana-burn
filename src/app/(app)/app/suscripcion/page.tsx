import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft, Receipt } from "lucide-react";
import { createClient, getViewer } from "@/lib/supabase/server";
import { getEntitlements, type Entitlements } from "@/lib/entitlements";
import { isOnvoConfigured } from "@/lib/onvo";
import { PLANS, usd } from "@/lib/plans";
import { INTENT_COOKIE, decodeIntent, parseIntent } from "@/lib/checkout-intent";
import { SubscriptionManager } from "./manager";

export const metadata = { title: "Mi suscripción" };

const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("es-CR", { day: "numeric", month: "long", year: "numeric" }) : "—");

const STATUS: Record<Entitlements["status"], { label: string; cls: string }> = {
  demo: { label: "Demo", cls: "bg-ink text-white" },
  none: { label: "Beta sin costo", cls: "bg-banana-soft text-banana-ink" },
  incomplete: { label: "Pago pendiente", cls: "bg-banana-soft text-banana-ink" },
  active: { label: "Activa", cls: "bg-peel/10 text-peel" },
  trialing: { label: "Prueba", cls: "bg-sky/10 text-sky" },
  past_due: { label: "Pago fallido", cls: "bg-bad/10 text-bad" },
  canceling: { label: "Se cancela", cls: "bg-ember/10 text-ember-ink" },
  canceled: { label: "Cancelada", cls: "bg-line text-muted" },
  expired: { label: "Vencida", cls: "bg-line text-muted" },
};

type Payment = { id: number; provider_payment_intent_id: string | null; received_at: string; amount_minor: number | null; currency: string | null; period_start: string | null; period_end: string | null };

export default async function Suscripcion({ searchParams }: { searchParams: Promise<{ plan?: string; pago?: string }> }) {
  const v = (await getViewer())!;
  const sp = await searchParams;
  const ent = await getEntitlements(v);
  const payments = isOnvoConfigured() && !v.demo;
  const intent = parseIntent(sp.plan, sp.pago) ?? decodeIntent((await cookies()).get(INTENT_COOKIE)?.value);

  // Historial: pagos confirmados por webhook (datos reales de ONVO guardados en payment_events).
  let history: Payment[] = [];
  if (!v.demo) {
    const { data } = await (await createClient())
      .from("payment_events")
      .select("id, provider_payment_intent_id, received_at, amount_minor, currency, period_start, period_end")
      .eq("user_id", v.id)
      .eq("status", "processed")
      .in("type", ["subscription.renewal.succeeded", "payment-intent.succeeded"])
      .order("received_at", { ascending: false })
      .limit(24);
    // El primer cobro puede llegar como payment-intent.succeeded y como renewal.succeeded: uno por intento de pago.
    const seen = new Set<string>();
    history = ((data as Payment[] | null) ?? []).filter((h) => {
      const k = h.provider_payment_intent_id ?? `ev:${h.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  const plan = PLANS.find((p) => p.id === ent.plan) ?? null;
  const st = STATUS[ent.status];
  const price = plan && ent.billing ? plan.price[ent.billing] : null;

  return (
    <div className="space-y-5 animate-rise max-w-2xl">
      <Link href="/app/perfil" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />Perfil</Link>
      <header>
        <p className="eyebrow">Suscripción</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">Mi plan</h1>
      </header>

      {v.demo && <p className="rounded-2xl bg-ink text-white/90 p-4 text-sm">🧪 <b>Modo demo:</b> todavía no se hacen cobros. Aquí verás tu plan, la fecha de renovación y tus recibos.</p>}
      {!v.demo && !payments && <p className="rounded-2xl bg-banana-soft p-4 text-sm text-banana-ink font-semibold">Los pagos se activan muy pronto. Mientras tanto disfrutas la beta sin costo.</p>}

      <section className="card p-5 sm:p-6" aria-labelledby="plan-actual">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Plan actual</p>
            <h2 id="plan-actual" className="mt-1 text-2xl font-extrabold text-ink">{plan ? plan.name : "Beta sin costo"}</h2>
            {price !== null && <p className="text-muted"><b className="text-ink tabular-nums">{usd(price)}</b> {ent.billing === "anual" ? "/año" : "/mes"}</p>}
          </div>
          <span className={`chip shrink-0 ${st.cls}`}>{st.label}</span>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          {ent.renewsAt && <Item k="Próxima renovación" v={fmtDate(ent.renewsAt)} />}
          {ent.endsAt && <Item k={ent.status === "past_due" ? "Acceso hasta (aprox.)" : ent.status === "canceling" ? "Acceso hasta" : "Terminó"} v={fmtDate(ent.endsAt)} />}
          <Item k="Nutrición" v={ent.nutrition ? "Incluida" : "No incluida"} />
          {ent.billing && <Item k="Periodo" v={ent.billing === "anual" ? "Anual" : "Mensual"} />}
        </dl>
        {ent.status === "past_due" && <p role="alert" className="mt-4 rounded-2xl bg-bad/5 border border-bad/20 p-3 text-sm text-bad font-semibold">No pudimos cobrar tu renovación. ONVO reintentará; revisa que tu tarjeta tenga fondos o elige un plan de nuevo para pagar con otro método.</p>}
        {ent.status === "canceling" && <p className="mt-4 text-sm text-muted">Cancelaste la renovación. Sigues con acceso completo hasta el {fmtDate(ent.endsAt)}; no habrá más cobros.</p>}
        {!ent.fromSubscription && plan && !v.demo && <p className="mt-4 text-sm text-muted">Este plan fue asignado por el equipo de Banana Burn; no tiene cobros automáticos.</p>}
      </section>

      <SubscriptionManager
        current={{ plan: ent.plan, billing: ent.billing ?? null, status: ent.status, endsAt: ent.endsAt ?? ent.renewsAt ?? null, cancellable: ent.fromSubscription && (ent.status === "active" || ent.status === "past_due" || ent.status === "trialing") }}
        intent={intent}
        payments={payments}
        demo={v.demo}
      />

      <section className="card p-5 sm:p-6" aria-labelledby="historial">
        <h2 id="historial" className="font-extrabold text-ink flex items-center gap-2"><Receipt className="size-5" aria-hidden />Pagos</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{v.demo ? "En la demo no hay pagos." : "Aún no tienes pagos registrados."}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{fmtDate(h.received_at)}</p>
                  {h.period_start && h.period_end && <p className="text-xs text-muted">Periodo {fmtDate(h.period_start)} – {fmtDate(h.period_end)}</p>}
                </div>
                <p className="font-bold tabular-nums text-ink shrink-0">{h.amount_minor !== null ? `${usd(h.amount_minor / 100)} ${h.currency ?? ""}`.trim() : "Pagado"}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-faint">Para facturas o reembolsos escríbenos a <a className="underline" href="mailto:hola@bananaburn.app">hola@bananaburn.app</a>.</p>
      </section>
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return <div className="rounded-2xl bg-paper p-3"><dt className="text-xs font-semibold text-muted">{k}</dt><dd className="font-bold text-ink">{v}</dd></div>;
}
