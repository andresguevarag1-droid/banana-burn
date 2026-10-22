"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleNotch, Handshake, MonkeyBanana } from "@/components/icons";
import { PLANS, annualSavingPct, usd, type Billing, type PlanId } from "@/lib/plans";
import { INTENT_COOKIE, type CheckoutIntent } from "@/lib/checkout-intent";
import { useCheckout } from "@/components/pagos/use-checkout";
import type { Entitlements } from "@/lib/entitlements";

type Current = { plan: PlanId | "free"; billing: Billing | null; status: Entitlements["status"]; endsAt: string | null; cancellable: boolean };

const planOf = (id: PlanId) => PLANS.find((p) => p.id === id)!;
const label = (id: PlanId, b: Billing) => `${planOf(id).name} · ${b === "anual" ? "Anual" : "Mensual"}`;
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-CR", { day: "numeric", month: "long" }) : null);
const REASONS = ["Es muy caro para mí", "No lo estoy usando", "No veo resultados", "Problemas técnicos", "Otro motivo"];

export function SubscriptionManager({ current, intent, payments, demo }: { current: Current; intent: CheckoutIntent | null; payments: boolean; demo: boolean }) {
  const checkout = useCheckout();
  const isCurrent = (p: PlanId, b: Billing) => current.plan === p && current.billing === b && current.status !== "canceling";
  const showIntent = intent && !isCurrent(intent.plan, intent.billing);

  // La intención ya se mostró: limpiamos la cookie para no insistir en cada visita.
  useEffect(() => {
    try { document.cookie = `${INTENT_COOKIE}=; path=/; max-age=0; samesite=lax`; } catch { /* sin cookies */ }
  }, []);

  const options = PLANS.flatMap((p) => (["mes", "anual"] as const).map((b) => ({ p, b }))).filter(({ p, b }) => !isCurrent(p.id, b));
  const paid = current.plan !== "free" && current.status !== "canceled" && current.status !== "expired";
  const disabled = !payments || Boolean(checkout.busy);

  return (
    <>
      {showIntent && (
        <section className="rounded-[1.5rem] bg-ink text-white p-5 sm:p-6 shadow-lift" aria-labelledby="intent-title">
          <p className="eyebrow text-banana">Estás a un paso</p>
          <h2 id="intent-title" className="mt-1 text-xl font-extrabold">{label(intent.plan, intent.billing)}</h2>
          <p className="text-white/70"><b className="text-white tabular-nums">{usd(planOf(intent.plan).price[intent.billing])}</b> {intent.billing === "anual" ? "/año" : "/mes"} · cancela cuando quieras</p>
          {paid && <p className="mt-2 text-sm text-white/70">Reemplaza tu plan actual en cuanto se confirme el pago (sin prorrateo).</p>}
          <button type="button" disabled={disabled} onClick={() => checkout.start(intent.plan, intent.billing)} className="btn-banana mt-4 w-full h-13" aria-busy={checkout.busy === `${intent.plan}.${intent.billing}`}>
            {checkout.busy === `${intent.plan}.${intent.billing}` ? <><CircleNotch weight="bold" className="size-5 animate-spin" />Preparando tu pago…</> : <>Continuar al pago<ArrowRight weight="bold" className="size-5" /></>}
          </button>
          {!payments && <p className="mt-2 text-sm text-white/70">{demo ? "Modo demo: no se procesan pagos." : "Los pagos aún no están activos."}</p>}
        </section>
      )}

      {checkout.error && <p role="alert" className="rounded-2xl bg-bad/5 border border-bad/20 p-3 text-sm font-semibold text-bad">{checkout.error}</p>}

      <section className="card p-5 sm:p-6" aria-labelledby="cambiar">
        <h2 id="cambiar" className="font-extrabold text-ink">{paid ? "Cambiar de plan" : "Elige tu plan"}</h2>
        {paid && <p className="mt-1 text-sm text-muted">El nuevo plan empieza al confirmar el pago y reemplaza al actual (sin prorrateo).</p>}
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {options.map(({ p, b }) => {
            const key = `${p.id}.${b}`;
            const up = current.plan === "entreno" && p.id === "completo";
            const down = current.plan === "completo" && p.id === "entreno";
            return (
              <li key={key}>
                <button type="button" disabled={disabled} onClick={() => checkout.start(p.id, b)} aria-busy={checkout.busy === key}
                  className="w-full text-left rounded-2xl border-2 border-line bg-white p-4 transition hover:border-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-banana/50 disabled:opacity-50">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-bold text-ink">{p.name}</span>
                    {up && <span className="chip h-6 bg-peel/10 text-peel">Mejorar</span>}
                    {down && <span className="chip h-6 bg-line text-muted">Bajar</span>}
                    {b === "anual" && !up && !down && <span className="chip h-6 bg-banana-soft text-banana-ink">−{annualSavingPct(p)} %</span>}
                  </span>
                  <span className="mt-1 flex items-center justify-between text-sm text-muted">
                    <span>{b === "anual" ? "Anual" : "Mensual"} · <b className="text-ink tabular-nums">{usd(p.price[b])}</b>{b === "anual" ? "/año" : "/mes"}</span>
                    {checkout.busy === key ? <CircleNotch weight="bold" className="size-4 animate-spin" /> : <ArrowRight weight="bold" className="size-4" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {!payments && <p className="mt-3 text-sm text-muted">{demo ? "Modo demo: los botones de pago están desactivados." : "Los pagos se activan muy pronto."}</p>}
      </section>

      {current.cancellable && current.plan !== "free" && current.billing && (
        <CancelFlow plan={current.plan} billing={current.billing} endsAt={current.endsAt} onOffer={checkout.start} offerBusy={checkout.busy} payments={payments} />
      )}
    </>
  );
}

function CancelFlow({ plan, billing, endsAt, onOffer, offerBusy, payments }: { plan: PlanId; billing: Billing; endsAt: string | null; onOffer: (p: PlanId, b: Billing) => void; offerBusy: string | null; payments: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "offer" | "confirm" | "done">("idle");
  const [reason, setReason] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [until, setUntil] = useState<string | null>(endsAt);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (step !== "idle") heading.current?.focus(); }, [step]);

  const p = planOf(plan);
  const offers: { key: string; title: string; body: string; plan: PlanId; billing: Billing }[] = [];
  if (billing === "mes") offers.push({ key: `${plan}.anual`, title: `Pásate a anual y ahorra ${annualSavingPct(p)} %`, body: `${usd(p.price.anual)}/año en vez de ${usd(p.price.mes * 12)} pagando mes a mes.`, plan, billing: "anual" });
  if (plan === "completo") {
    const e = planOf("entreno");
    offers.push({ key: `entreno.${billing}`, title: `Quédate con Entreno por ${usd(e.price[billing])}${billing === "anual" ? "/año" : "/mes"}`, body: "Mantén tus rutinas, progreso y Coach IA; solo dejas el plan de nutrición.", plan: "entreno", billing });
  }

  async function confirm() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/pagos/cancelar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) })
      .then((x) => x.json()).catch(() => ({ ok: false, error: "Sin conexión. Intenta de nuevo." })) as { ok: boolean; error?: string; endsAt?: string | null; demo?: boolean };
    setBusy(false);
    if (!r.ok) return setErr(r.error ?? "No pudimos cancelar. Intenta de nuevo.");
    if (r.endsAt) setUntil(r.endsAt);
    setStep("done");
    router.refresh();
  }

  if (step === "idle") {
    return (
      <section className="card p-5 sm:p-6">
        <h2 className="font-extrabold text-ink">Cancelar renovación</h2>
        <p className="mt-1 text-sm text-muted">Mantienes el acceso hasta el final del periodo que ya pagaste.</p>
        <button type="button" onClick={() => setStep(offers.length ? "offer" : "confirm")} className="btn-ghost mt-4 h-11 text-bad">Cancelar suscripción</button>
      </section>
    );
  }

  return (
    <section className="rounded-[1.5rem] border-2 border-line bg-white p-5 sm:p-6 space-y-4" aria-live="polite">
      {step === "offer" && (
        <>
          <h2 ref={heading} tabIndex={-1} className="text-lg font-extrabold text-ink outline-none flex items-center gap-2"><Handshake weight="duotone" className="size-5 text-ember" />Antes de irte…</h2>
          <p className="text-sm text-muted">Tu racha y tu progreso se quedan contigo. Quizá esto te sirve más:</p>
          <ul className="space-y-2">
            {offers.map((o) => (
              <li key={o.key} className="rounded-2xl bg-paper p-4">
                <p className="font-bold text-ink flex items-center gap-2"><MonkeyBanana className="size-5 shrink-0 text-banana-ink" />{o.title}</p>
                <p className="mt-1 text-sm text-muted">{o.body}</p>
                <button type="button" disabled={!payments || Boolean(offerBusy)} onClick={() => onOffer(o.plan, o.billing)} className="btn-banana mt-3 h-11 w-full sm:w-auto" aria-busy={offerBusy === o.key}>
                  {offerBusy === o.key ? <><CircleNotch weight="bold" className="size-4 animate-spin" />Preparando…</> : "Quiero esta opción"}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="button" onClick={() => setStep("idle")} className="btn-primary h-11 flex-1">Me quedo como estoy</button>
            <button type="button" onClick={() => setStep("confirm")} className="btn-ghost h-11 flex-1">No, quiero cancelar</button>
          </div>
        </>
      )}

      {step === "confirm" && (
        <>
          <h2 ref={heading} tabIndex={-1} className="text-lg font-extrabold text-ink outline-none">¿Cancelar la renovación?</h2>
          <p className="text-sm text-body">No habrá más cobros. Sigues con acceso {fmtDate(endsAt) ? <>hasta el <b>{fmtDate(endsAt)}</b></> : "hasta el final de tu periodo pagado"}. Tus datos no se borran.</p>
          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-ink mb-2">¿Por qué te vas? <span className="font-normal text-muted">(opcional)</span></legend>
            {REASONS.map((r) => (
              <label key={r} className={`flex items-center gap-3 rounded-2xl border-2 px-4 h-12 cursor-pointer text-sm font-semibold transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-banana/50 ${reason === r ? "border-ink bg-banana-soft text-ink" : "border-line text-muted"}`}>
                <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-ink size-4" />{r}
              </label>
            ))}
          </fieldset>
          {err && <p role="alert" className="text-sm font-semibold text-bad">{err}</p>}
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="button" onClick={() => setStep("idle")} className="btn-primary h-11 flex-1">Mejor no</button>
            <button type="button" disabled={busy} onClick={confirm} className="btn h-11 flex-1 bg-bad text-white" aria-busy={busy}>{busy ? <><CircleNotch weight="bold" className="size-4 animate-spin" />Cancelando…</> : "Confirmar cancelación"}</button>
          </div>
        </>
      )}

      {step === "done" && (
        <>
          <h2 ref={heading} tabIndex={-1} className="text-lg font-extrabold text-ink outline-none">Listo, cancelaste la renovación</h2>
          <p className="text-sm text-muted">{fmtDate(until) ? <>Sigues con tu plan hasta el <b>{fmtDate(until)}</b>.</> : "Sigues con tu plan hasta el final del periodo pagado."} Puedes volver a suscribirte cuando quieras desde esta página.</p>
        </>
      )}
    </section>
  );
}
