"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowCounterClockwise, ArrowRight, CircleNotch, Handshake, Lock, MonkeyBanana, Scroll } from "@/components/icons";
import { PLANS, annualSavingPct, perMonthAnnual, usd, type Billing, type PlanId } from "@/lib/plans";
import { money } from "@/lib/copy";
import { INTENT_COOKIE, type CheckoutIntent } from "@/lib/checkout-intent";
import { useCheckout } from "@/components/pagos/use-checkout";
import type { Entitlements } from "@/lib/entitlements";

type Current = { plan: PlanId | "free"; billing: Billing | null; status: Entitlements["status"]; endsAt: string | null; renewsAt?: string | null; fromSubscription?: boolean; cancellable: boolean };

const planOf = (id: PlanId) => PLANS.find((p) => p.id === id)!;
const label = (id: PlanId, b: Billing) => `${planOf(id).name}, ${b === "anual" ? "anual" : "mensual"}`;
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long" }) : null);
const REASONS = ["Es muy caro para mí", "No lo estoy usando", "No veo resultados", "Problemas técnicos", "Otro motivo"];

export function SubscriptionManager({ current, intent, payments, demo }: { current: Current; intent: CheckoutIntent | null; payments: boolean; demo: boolean }) {
  const checkout = useCheckout();
  // Un plan sin periodicidad (cortesía, equipo o asignado a mano) cuenta como "actual" en mensual y anual.
  const isCurrent = (p: PlanId, b: Billing) => current.plan === p && (current.billing === b || current.billing === null) && current.status !== "canceling";
  // Cambiar desde un plan anual pagado: no hay prorrateo. Lo explicamos ANTES de mandar a pagar.
  const [confirm, setConfirm] = useState<{ plan: PlanId; billing: Billing } | null>(null);
  const annualPaid = current.fromSubscription === true && current.billing === "anual" && current.plan !== "free" && (current.status === "active" || current.status === "trialing" || current.status === "past_due");
  const choose = (p: PlanId, b: Billing) => { if (annualPaid) setConfirm({ plan: p, billing: b }); else checkout.start(p, b); };
  const confirmRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (confirm) { confirmRef.current?.focus(); confirmRef.current?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); } }, [confirm]);
  const showIntent = intent && !isCurrent(intent.plan, intent.billing);

  // La intención ya se mostró: limpiamos la cookie para no insistir en cada visita.
  useEffect(() => {
    try { document.cookie = `${INTENT_COOKIE}=; path=/; max-age=0; samesite=lax`; } catch { /* sin cookies */ }
  }, []);

  const paid = current.plan !== "free" && current.status !== "canceled" && current.status !== "expired";
  // Sin plan (prueba o vencida): anual primero y el plan completo anual destacado como recomendado.
  const options = PLANS.flatMap((p) => (["anual", "mes"] as const).map((b) => ({ p, b }))).filter(({ p, b }) => !isCurrent(p.id, b))
    .sort((x, y) => (paid ? 0 : Number(y.b === "anual") - Number(x.b === "anual")));
  const recommended = paid ? null : "completo.anual";
  const disabled = !payments || Boolean(checkout.busy);

  return (
    <>
      {showIntent && (
        <section className="rounded-[1.5rem] bg-ink text-white p-5 sm:p-6 shadow-lift" aria-labelledby="intent-title">
          <h2 id="intent-title" className="text-xl font-extrabold">Estás a un paso: {label(intent.plan, intent.billing)}</h2>
          <p className="text-white/70"><b className="text-white tabular-nums">{usd(planOf(intent.plan).price[intent.billing])}</b> {intent.billing === "anual" ? "/año" : "/mes"}. Cancela cuando quieras.</p>
          {paid && <p className="mt-2 text-sm text-white/70">Reemplaza tu plan actual en cuanto se confirme el pago (sin prorrateo).</p>}
          <button type="button" disabled={disabled} onClick={() => choose(intent.plan, intent.billing)} data-cta="manager-intent" className="btn-banana mt-4 w-full h-13" aria-busy={checkout.busy === `${intent.plan}.${intent.billing}`}>
            {checkout.busy === `${intent.plan}.${intent.billing}` ? <><CircleNotch weight="bold" className="size-5 animate-spin" />Preparando tu pago…</> : <>Continuar al pago<ArrowRight weight="bold" className="size-5" /></>}
          </button>
          {!payments && <p className="mt-2 text-sm text-white/70">{demo ? "Modo demo: no se procesan pagos." : "Los pagos aún no están activos."}</p>}
        </section>
      )}

      {confirm && (
        <div ref={confirmRef} tabIndex={-1} role="alertdialog" aria-labelledby="sin-prorrateo" className="outline-none rounded-2xl border-2 border-ember/40 bg-ember/5 p-4 space-y-3 animate-fade">
            <p id="sin-prorrateo" className="font-extrabold text-ink">Antes de cambiar tu plan anual</p>
            <p className="text-sm text-body">Ya pagaste tu año{fmtDate(current.renewsAt ?? current.endsAt) ? <> hasta el <b>{fmtDate(current.renewsAt ?? current.endsAt)}</b></> : null}. Si cambias a <b>{label(confirm.plan, confirm.billing)}</b>, el nuevo plan empieza hoy con su propio cobro y lo que queda del año <b>no se reembolsa ni se descuenta</b> (no hay prorrateo).</p>
            <p className="text-sm text-muted">Si prefieres no perder ese tiempo, cancela la renovación abajo y elige el nuevo plan cuando termine tu año.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="button" onClick={() => setConfirm(null)} className="btn-primary h-11 flex-1">Mejor espero</button>
              <button type="button" disabled={disabled} onClick={() => { const c = confirm; setConfirm(null); checkout.start(c.plan, c.billing); }} className="btn-ghost h-11 flex-1">Cambiar de todas formas</button>
            </div>
          </div>
        )}
      {checkout.error && <p role="alert" className="rounded-2xl bg-bad/5 border border-bad/20 p-3 text-sm font-semibold text-bad">{checkout.error}</p>}

      <section className="card p-5 sm:p-6" aria-labelledby="cambiar">
        <h2 id="cambiar" className="font-extrabold text-ink">{paid ? "Cambiar de plan" : "Elige tu plan"}</h2>
        {paid && current.fromSubscription && <p className="mt-1 text-sm text-muted">El nuevo plan empieza al confirmar el pago y reemplaza al actual (sin prorrateo).</p>}
        {paid && !current.fromSubscription && <p className="mt-1 text-sm text-muted">Tu plan actual no tiene cobros. Si eliges un plan de pago, empieza al confirmar el pago.</p>}

        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {options.map(({ p, b }) => {
            const key = `${p.id}.${b}`;
            const up = current.plan === "entreno" && p.id === "completo";
            const down = current.plan === "completo" && p.id === "entreno";
            const hot = key === recommended;
            return (
              <li key={key}>
                <button type="button" disabled={disabled} onClick={() => choose(p.id, b)} aria-busy={checkout.busy === key} data-cta={`manager-${p.id}-${b}`}
                  className={`pressable w-full text-left rounded-2xl border-2 p-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-banana/50 disabled:opacity-50 ${hot ? "border-ink bg-banana-soft" : "border-line bg-white hover:border-ink"}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-bold text-ink">{p.name}</span>
                    {up && <span className="chip h-6 bg-peel/10 text-peel">Mejorar</span>}
                    {down && <span className="chip h-6 bg-line text-muted">Bajar</span>}
                    {hot && <span className="chip h-6 bg-ink text-banana">Recomendado</span>}
                    {b === "anual" && !up && !down && !hot && <span className="chip h-6 bg-banana-soft text-banana-ink">−{annualSavingPct(p)} %</span>}
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2 text-sm text-muted">
                    <span>{b === "anual" ? "Anual" : "Mensual"}: <b className="text-ink tabular-nums">{usd(p.price[b])}</b>{b === "anual" ? "/año" : "/mes"}{b === "anual" && <span className="block text-xs tabular-nums">Equivale a {money(perMonthAnnual(p))} al mes, ahorras {annualSavingPct(p)} %</span>}</span>
                    {checkout.busy === key ? <CircleNotch weight="bold" className="size-4 shrink-0 animate-spin" /> : <ArrowRight weight="bold" className="size-4 shrink-0" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {!payments && demo && <p className="mt-3 text-sm text-muted">Modo demo: los botones de pago están desactivados.</p>}
        {!paid && (
          <ul className="mt-4 grid gap-1.5 text-xs font-semibold text-muted sm:grid-cols-3">
            <li className="flex items-center gap-1.5"><Lock weight="duotone" aria-hidden className="size-4 shrink-0 text-peel" />Pago seguro con ONVO Pay</li>
            <li className="flex items-center gap-1.5"><ArrowCounterClockwise weight="duotone" aria-hidden className="size-4 shrink-0 text-peel" />Cancela cuando quieras</li>
            <li className="flex items-center gap-1.5"><Scroll weight="duotone" aria-hidden className="size-4 shrink-0 text-peel" />8 días hábiles de retracto</li>
          </ul>
        )}
      </section>

      {current.cancellable && current.plan !== "free" && current.billing && (
        <CancelFlow plan={current.plan} billing={current.billing} endsAt={current.endsAt} onOffer={choose} offerBusy={checkout.busy} payments={payments} />
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
