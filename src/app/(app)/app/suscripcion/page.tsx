import { TrialCardNotice } from "@/components/trial-card-notice";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft, Gift, Info, Receipt } from "@/components/icons";
import { getMyGifts } from "@/lib/gifts-server";
import { GIFT_STATUS_LABEL, type GiftStatus } from "@/lib/gifts";
import { createClient, getViewer } from "@/lib/supabase/server";
import { getEntitlements, type Entitlements } from "@/lib/entitlements";
import { isOnvoConfigured } from "@/lib/onvo";
import { PLANS, usd } from "@/lib/plans";
import { INTENT_COOKIE, decodeIntent, parseIntent } from "@/lib/checkout-intent";
import { SubscriptionManager } from "./manager";
import { FunnelTracker } from "@/components/analytics";
import { CardPanel } from "./card-panel";
import { PastDueCard } from "./past-due-card";
import { betaDates } from "@/components/beta-notice";
import { demoCardState } from "@/lib/trial-demo";

export const metadata = { title: "Mi plan" };

const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long", year: "numeric" }) : "Sin fecha");

const STATUS: Record<Entitlements["status"], { label: string; cls: string }> = {
  demo: { label: "Demo", cls: "bg-ink text-white" },
  none: { label: "Sin suscripción", cls: "bg-line text-muted" },
  incomplete: { label: "Pago pendiente", cls: "bg-banana-soft text-banana-ink" },
  active: { label: "Activa", cls: "bg-peel/10 text-peel" },
  trialing: { label: "Prueba", cls: "bg-sky/10 text-sky" },
  past_due: { label: "Pago fallido", cls: "bg-bad/10 text-bad" },
  canceling: { label: "Se cancela", cls: "bg-ember/10 text-ember-ink" },
  canceled: { label: "Cancelada", cls: "bg-line text-muted" },
  expired: { label: "Vencida", cls: "bg-line text-muted" },
};

/** Vuelta desde Tilopay (/api/pagos/tilopay/vuelta): qué pasó, en una línea. */
const TILOPAY_NOTICE: Record<string, { ok: boolean; text: string }> = {
  tarjeta_ok: { ok: true, text: "Listo, tu tarjeta quedó guardada." },
  pago_ok: { ok: true, text: "Listo, tu pago se aprobó y tu plan está activo." },
  confirmando: { ok: true, text: "Estamos confirmando tu pago con Tilopay. Revisa en unos minutos." },
  rechazada: { ok: false, text: "Tu banco no aprobó la tarjeta. Prueba con otra o pide a tu banco activar las compras internacionales." },
  sin_tarjeta: { ok: false, text: "No recibimos tu tarjeta desde Tilopay. Intenta de nuevo." },
  vencido: { ok: false, text: "El enlace de pago venció. Vuelve a intentarlo." },
  ocupado: { ok: false, text: "Estamos procesando tu cobro. Revisa en unos minutos." },
  error: { ok: false, text: "No pudimos terminar con Tilopay. Intenta de nuevo en un momento." },
};

type Payment = { id: number; provider_payment_intent_id: string | null; received_at: string; amount_minor: number | null; currency: string | null; period_start: string | null; period_end: string | null };

export default async function Suscripcion({ searchParams }: { searchParams: Promise<{ plan?: string; pago?: string; demo?: string; tilopay?: string }> }) {
  const v = (await getViewer())!;
  const sp = await searchParams;
  const [real, gifts] = await Promise.all([getEntitlements(v), getMyGifts(v)]);
  // Modo demo: estado de ejemplo de la tarjeta (?demo=beta|prueba|nueva|fallo|procesando|cancelado|vencida), sin llamar a ONVO.
  const jar = await cookies();
  const cs = v.demo ? demoCardState(sp.demo ?? jar.get("bb_demo_tarjeta")?.value) : null;
  const ent: Entitlements = cs ? { ...real, charge: cs.charge, card: cs.card, cardStep: cs.cardStep, trial: cs.trial, locked: cs.locked, plan: "free", status: "none", access: cs.locked ? "none" : "trial", app: !cs.locked, nutrition: !cs.locked } : real;
  const charge = ent.charge ?? null;
  const cardStep = ent.cardStep ?? "none";
  const payments = isOnvoConfigured() && !v.demo;
  const tlp = sp.tilopay && Object.hasOwn(TILOPAY_NOTICE, sp.tilopay) ? TILOPAY_NOTICE[sp.tilopay] : null;
  const intent = parseIntent(sp.plan, sp.pago) ?? decodeIntent(jar.get(INTENT_COOKIE)?.value);

  // Historial: pagos confirmados por webhook (datos reales de ONVO guardados en payment_events).
  let history: Payment[] = [];
  if (!v.demo) {
    const { data } = await (await createClient())
      .from("payment_events")
      .select("id, provider_payment_intent_id, received_at, amount_minor, currency, period_start, period_end")
      .eq("user_id", v.id)
      .eq("status", "processed")
      .in("type", ["subscription.renewal.succeeded", "payment-intent.succeeded", "charge.approved"])
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
  const fmtDay = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long", timeZone: v.tz }) : null);
  // Chip de estado: la suscripción si existe; si no, de dónde sale el acceso.
  const st = ent.fromSubscription || (ent.access === "none" && ent.status !== "none") ? STATUS[ent.status]
    : ent.access === "trial" ? { label: "Prueba gratis", cls: "bg-sky/10 text-sky" }
    : ent.access === "comp" ? { label: "Cortesía", cls: "bg-peel/10 text-peel" }
    : ent.access === "staff" ? { label: "Equipo", cls: "bg-ink text-white" }
    : ent.access === "manual" ? { label: "Asignado", cls: "bg-peel/10 text-peel" }
    : ent.access === "demo" ? STATUS.demo
    : { label: "Sin plan", cls: "bg-line text-muted" };
  const price = plan && ent.fromSubscription && ent.billing ? plan.price[ent.billing] : null;

  return (
    <div className="space-y-5 animate-enter max-w-2xl">
      <FunnelTracker view="page_view" props={{ screen: "suscripcion", access: ent.access }} />
      <Link href="/app/perfil" className="tap inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft weight="bold" className="size-4" />Perfil</Link>
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Mi plan</h1>
        <Link href="/app/incluye" className="tap mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">Lo que incluye tu plan, explicado fácil</Link>
      </header>

      {v.demo && <p className="flex items-start gap-2.5 rounded-2xl bg-ink text-white/90 p-4 text-sm"><Info weight="duotone" className="size-5 shrink-0 text-banana" /><span><b>Modo demo:</b> todavía no se hacen cobros. Aquí verás tu plan, la fecha de renovación y tus recibos.</span></p>}
      {!v.demo && !payments && <p className="rounded-2xl bg-banana-soft p-4 text-sm text-banana-ink font-semibold">Los pagos todavía no están activos. Si necesitas activar tu plan, escríbenos a <a className="underline" href="mailto:hola@bananaburn.app">hola@bananaburn.app</a>.</p>}
      {ent.trial?.beta && !charge && <p className="rounded-2xl bg-sky/10 p-4 text-sm text-ink"><b>Eres de los primeros en Banana Burn: todo incluido gratis hasta el {betaDates().lastFree}.</b> Todavía no guardaste una tarjeta, así que no hay ningún cobro programado. Desde el {betaDates().firstPaid} la app se paga; si dejas tu tarjeta lista antes, tu primer mes cuesta 50 % menos.</p>}
      {ent.locked && cardStep !== "trial" && charge?.phase !== "procesando" && charge?.phase !== "reintento" && charge?.phase !== "fallido" && <p className="rounded-2xl bg-ember/10 p-4 text-sm text-ink"><b>Tu prueba gratis terminó{ent.trialEndsAt ? ` el ${fmtDay(ent.trialEndsAt)}` : ""}.</b> Tus datos siguen guardados. Elige un plan para volver a entrenar con Banana Burn.</p>}

      <TrialCardNotice ent={ent} tz={v.tz} screen="suscripcion" />
      {tlp && (
        <p role="status" className={`rounded-2xl p-3 text-sm font-semibold text-pretty ${tlp.ok ? "bg-peel/10 text-ink" : "bg-bad/10 text-bad"}`}>{tlp.text}</p>
      )}
      {(cardStep !== "none" || (charge && charge.phase !== "cobrado")) && (
        <CardPanel step={cardStep} charge={charge} card={ent.card ?? null} demo={v.demo} payments={payments} tz={v.tz} betaFirstPaid={betaDates().firstPaid} trialEndsAt={ent.trial && !ent.trial.beta ? ent.trial.endsAt : null}
          initial={charge ? { plan: charge.plan, billing: charge.billing } : intent ?? { plan: "completo", billing: "mes" }} />
      )}

      <section className="card p-5 sm:p-6" aria-labelledby="plan-actual">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-muted">Tu plan actual</p>
            <h2 id="plan-actual" className="mt-1 text-2xl font-extrabold text-ink">{plan ? plan.name : ent.trial?.beta ? "Acceso anticipado (todo incluido)" : ent.trial ? "Prueba gratis (todo incluido)" : "Sin plan"}</h2>
            {price !== null && <p className="text-muted"><b className="text-ink tabular-nums">{usd(price)}</b> {ent.billing === "anual" ? "/año" : "/mes"}</p>}
          </div>
          <span className={`chip shrink-0 ${st.cls}`}>{st.label}</span>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          {ent.renewsAt && <Item k="Próxima renovación" v={fmtDate(ent.renewsAt)} />}
          {ent.endsAt && <Item k={ent.status === "past_due" ? "Acceso hasta (aprox.)" : ent.status === "canceling" ? "Acceso hasta" : "Terminó"} v={fmtDate(ent.endsAt)} />}
          <Item k="Nutrición y Banana Shield" v={ent.nutrition ? (ent.trial ? "Incluidas en la prueba" : "Incluidas") : "No incluidas"} />
          <Item k="Retos Premium" v="Aparte, con pago único" />
          {ent.fromSubscription && ent.billing && <Item k="Periodo" v={ent.billing === "anual" ? "Anual" : "Mensual"} />}
        </dl>
        {ent.status === "past_due" && <p role="alert" className="mt-4 rounded-2xl bg-bad/5 border border-bad/20 p-3 text-sm text-bad font-semibold">No pudimos cobrar tu renovación. Cambia tu tarjeta aquí abajo y lo intentamos de nuevo en ese momento, o revisa que tu tarjeta tenga fondos.</p>}
        {ent.status === "past_due" && payments && ent.plan !== "free" && ent.billing && <PastDueCard choice={{ plan: ent.plan, billing: ent.billing }} />}
        {ent.status === "canceling" && <p className="mt-4 text-sm text-muted">Cancelaste la renovación. Sigues con acceso completo hasta el {fmtDate(ent.endsAt)}; no habrá más cobros.</p>}
        {ent.access === "comp" && <p className="mt-4 text-sm text-muted">Es un plan regalado{ent.compEndsAt ? ` hasta el ${fmtDay(ent.compEndsAt)}` : ""}; no tiene cobros automáticos.</p>}
        {(ent.access === "manual" || ent.access === "staff") && !v.demo && <p className="mt-4 text-sm text-muted">Este plan fue asignado por el equipo de Banana Burn; no tiene cobros automáticos.</p>}
      </section>

      {/* Con la prueba con tarjeta (o el cobro programado o en curso) se elige y cambia el plan arriba: aquí no se cobra hoy. */}
      {!(cardStep === "trial" || (charge && (charge.phase === "programado" || charge.phase === "procesando" || (charge.phase === "cancelado" && cardStep === "none")))) && <SubscriptionManager
        current={{ plan: ent.plan, billing: ent.fromSubscription ? ent.billing ?? null : null, status: ent.status, endsAt: ent.endsAt ?? ent.renewsAt ?? null, renewsAt: ent.renewsAt ?? null, fromSubscription: ent.fromSubscription, cancellable: ent.fromSubscription && (ent.status === "active" || ent.status === "past_due" || ent.status === "trialing") }}
        intent={intent}
        payments={payments}
        demo={v.demo}
      />}

      {gifts.length > 0 && (
        <section className="card p-5 sm:p-6" aria-labelledby="regalos">
          <h2 id="regalos" className="font-extrabold text-ink flex items-center gap-2"><Gift weight="duotone" className="size-5 text-banana-ink" />Regalos recibidos</h2>
          {v.demo && <p className="mt-1 text-xs text-muted">Ejemplo del modo demo.</p>}
          <ul className="mt-3 divide-y divide-line">
            {gifts.map((g) => (
              <li key={g.id} className="py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-ink text-pretty">{g.title}</p>
                    <p className="text-xs text-muted">{g.status === "programado" ? `Empieza el ${fmtDate(g.startsAt)} y termina el ${fmtDate(g.expiresAt)}` : `Del ${fmtDate(g.startsAt)} al ${fmtDate(g.expiresAt)}`}{g.source === "referido" ? ". Por invitar amigos" : ""}</p>
                  </div>
                  <span className={`chip shrink-0 ${GIFT_TONE[g.status]}`}>{GIFT_STATUS_LABEL[g.status]}</span>
                </div>
                {g.message && <p className="mt-2 rounded-2xl bg-banana-soft px-3 py-2 text-ink text-pretty">{g.message}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-faint">Los regalos se suman al final del acceso que ya tenías y no tienen cobros. <Link href="/app/referidos" className="underline">Invita amigos y gana más meses.</Link></p>
        </section>
      )}

      <section className="card p-5 sm:p-6" aria-labelledby="historial">
        <h2 id="historial" className="font-extrabold text-ink flex items-center gap-2"><Receipt weight="duotone" className="size-5" />Pagos</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{v.demo ? "En la demo no hay pagos." : "Aún no tienes pagos registrados."}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{fmtDate(h.received_at)}</p>
                  {h.period_start && h.period_end && <p className="text-xs text-muted">Periodo del {fmtDate(h.period_start)} al {fmtDate(h.period_end)}</p>}
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

const GIFT_TONE: Record<GiftStatus, string> = { activo: "bg-peel/10 text-peel", programado: "bg-banana-soft text-banana-ink", terminado: "bg-line text-muted", revocado: "bg-line text-muted" };

function Item({ k, v }: { k: string; v: string }) {
  return <div className="rounded-2xl bg-paper p-3"><dt className="text-xs font-semibold text-muted">{k}</dt><dd className="font-bold text-ink">{v}</dd></div>;
}
