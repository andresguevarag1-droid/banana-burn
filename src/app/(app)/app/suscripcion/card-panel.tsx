"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowCounterClockwise, CalendarCheck, CheckCircle, CircleNotch, CreditCard, Gift, WarningCircle } from "@/components/icons";
import { FunnelTracker } from "@/components/analytics";
import { CardForm, type CardSaved } from "@/components/pagos/card-form";
import { PlanPicker, type PlanChoice } from "@/components/pagos/plan-picker";
import { PLANS } from "@/lib/plans";
import { money } from "@/lib/copy";
import { PROMO_TERMS, PROMO_TITLE, planLine, promoChargeLine, promoPrice, type CardStep, type ChargeView } from "@/lib/trial";

type Card = { brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null; active: boolean } | null;

const priceOf = (c: PlanChoice) => PLANS.find((p) => p.id === c.plan)!.price[c.billing];
const brandName = (b: string | null) => (b ? b.charAt(0).toUpperCase() + b.slice(1) : "Tarjeta");
const cardText = (c: { brand: string | null; last4: string | null } | null | undefined) => (c?.last4 ? `${brandName(c.brand)} terminada en ${c.last4}` : "Tarjeta guardada");

async function prueba(body: Record<string, unknown>): Promise<{ ok?: boolean; error?: string; demo?: boolean; accessUntil?: string | null; cardKept?: boolean; charge?: ChargeView | null }> {
  try {
    const r = await fetch("/api/pagos/prueba", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return (await r.json().catch(() => ({ ok: false, error: "Respuesta inválida." }))) as { ok?: boolean; error?: string };
  } catch {
    return { ok: false, error: "Sin conexión. Revisa tu internet e intenta de nuevo." };
  }
}

/**
 * Tarjeta guardada y primer cobro en Mi plan (#tarjeta): empezar la prueba, agregar la tarjeta en la beta, cambiarla después
 * de un rechazo, ver cuándo y cuánto se cobra, cambiar el plan y cancelar sin costo antes del cobro.
 */
export function CardPanel({ step, charge, card, demo, payments, initial, tz, betaFirstPaid, trialEndsAt = null }: {
  step: CardStep; charge: ChargeView | null; card: Card; demo: boolean; payments: boolean; initial: PlanChoice; tz: string; betaFirstPaid: string;
  /** Fin de su prueba de 7 días (para "trial"): ese día sería el primer cobro si deja la tarjeta lista. */
  trialEndsAt?: string | null;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<PlanChoice>(charge ? { plan: charge.plan, billing: charge.billing } : initial);
  const [done, setDone] = useState<CardSaved | null>(null);
  const ref = useRef<HTMLElement>(null);
  const day = (iso: string) => new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long", timeZone: tz });
  // Llegar con #tarjeta (desde el aviso o el muro) lleva directo al formulario.
  useEffect(() => { if (location.hash === "#tarjeta") ref.current?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }, []);

  const saved = (r: CardSaved) => { setDone(r); if (!r.demo) router.refresh(); };
  const price = money(priceOf(choice));
  // 0043: en la beta o en la prueba, dejar la tarjeta lista da el 50 % del primer mes (solo mensual).
  const offer = step === "trial" || step === "beta";
  const promoNow = offer && choice.billing === "mes";
  const firstPrice = promoNow ? money(promoPrice(choice.plan)) : price;
  const off = !payments && !demo;

  if (done) {
    const ch = done.charge;
    const charged = done.outcome === "enviado";
    return (
      <section ref={ref} id="tarjeta" aria-live="polite" className="scroll-mt-24 rounded-[1.5rem] border-2 border-peel/40 bg-peel/5 p-5 sm:p-6">
        <FunnelTracker view="card_saved" props={{ step, demo, outcome: done.outcome ?? "demo" }} />
        <p className="flex items-center gap-2 text-lg font-extrabold text-ink"><CheckCircle weight="duotone" className="size-6 text-peel" />{charged ? "Listo, estamos cobrando tu plan" : "Listo, tu tarjeta quedó guardada"}</p>
        <p className="mt-2 text-sm text-body text-pretty">
          {cardText(done.card)}.{" "}
          {charged ? "En unos segundos se confirma el cobro y sigues sin cortes."
            : done.outcome === "rechazado" ? "El banco no aprobó el cobro. Prueba con otra tarjeta."
            : ch ? `Hoy no te cobramos. El ${day(ch.chargeAt)} se cobra ${planLine(ch.plan, ch.billing)} por ${money(ch.amount)}, salvo que canceles antes.`
            : `Hoy no te cobramos. Se cobra ${planLine(choice.plan, choice.billing)} por ${firstPrice} al terminar tu prueba, salvo que canceles antes.`}
        </p>
        {done.demo && <p className="mt-2 text-xs font-semibold text-banana-ink">Modo demo: no se guardó ninguna tarjeta real.</p>}
      </section>
    );
  }

  // Cobro enviado a ONVO: esperando el webhook.
  if (charge?.phase === "procesando") return <Processing refresh={!demo} />;

  // Cobro programado (prueba, beta) o cancelado antes de tiempo.
  if (step === "none" && charge && (charge.phase === "programado" || charge.phase === "cancelado")) {
    return <Scheduled charge={charge} card={card} demo={demo} payments={payments} tz={tz} onChanged={() => router.refresh()} />;
  }

  if (step === "none") return null;

  const failed = charge?.phase === "reintento" || charge?.phase === "fallido";
  const chargeDay = step === "beta" ? betaFirstPaid : trialEndsAt ? day(trialEndsAt) : null;
  const offerNote = chargeDay
    ? promoNow ? <>{promoChargeLine(chargeDay)} Monto: <b>{firstPrice}</b>; desde el segundo mes, {price} al mes. Te avisamos 2 días antes.</>
      : <><b>Hoy no te cobramos.</b> El {chargeDay} se cobran {price} del plan anual, salvo que canceles antes. Te avisamos 2 días antes.</>
    : null;
  const t = {
    trial: { title: PROMO_TITLE, sub: "Sigues con tu prueba gratis con o sin tarjeta. Si la dejas lista antes de que termine, tu primer mes cuesta la mitad.", btn: "Dejar mi tarjeta lista", note: offerNote },
    beta: { title: PROMO_TITLE, sub: `Desde el ${betaFirstPaid} la app se paga; hasta ese día todo sigue gratis. Si dejas tu tarjeta lista ahora, tu primer mes cuesta la mitad y sigues sin cortes.`, btn: "Dejar mi tarjeta lista", note: offerNote },
    pay: failed
      ? { title: "Cambia tu tarjeta", sub: charge?.retryAt && charge.testerHold ? `No pudimos cobrar tu plan. Mientras seas tester no se te cobra: lo intentaremos una vez más el ${day(charge.retryAt)}, al terminar tu mes de tester.` : charge?.retryAt ? `No pudimos cobrar tu plan. Lo intentaremos una vez más el ${day(charge.retryAt)}, o cambia tu tarjeta para seguir hoy.` : "No pudimos cobrar tu plan con tu tarjeta. Cambia la tarjeta para seguir.", btn: `Guardar tarjeta y pagar ${price}`, note: <><b>Se cobra hoy {price}.</b> {choice.billing === "anual" ? "Se renueva cada año" : "Se renueva cada mes"} hasta que canceles.</> }
      : { title: "Guarda tu tarjeta y elige tu plan", sub: "Tu acceso gratis terminó. Tu progreso sigue guardado y retomas donde ibas.", btn: `Guardar tarjeta y pagar ${price}`, note: <><b>Se cobra hoy {price}.</b> {choice.billing === "anual" ? "Se renueva cada año" : "Se renueva cada mes"} hasta que canceles.</> },
  }[step];

  return (
    <section ref={ref} id="tarjeta" aria-labelledby="tarjeta-titulo" className={`scroll-mt-24 rounded-[1.5rem] border-2 bg-white p-5 sm:p-6 space-y-4 ${failed ? "border-bad/40" : "border-ink"}`}>
      <div>
        <h2 id="tarjeta-titulo" className="flex items-center gap-2 text-xl font-extrabold text-ink text-balance">{failed ? <WarningCircle weight="duotone" className="size-6 shrink-0 text-bad" /> : step === "trial" ? <Gift weight="duotone" className="size-6 shrink-0 text-banana-ink" /> : <CreditCard weight="duotone" className="size-6 shrink-0 text-banana-ink" />}{t.title}</h2>
        <p className="mt-1 text-sm text-muted text-pretty">{t.sub}</p>
        {failed && card?.last4 && <p className="mt-2 text-sm text-body">Tarjeta actual: {cardText(card)}.</p>}
      </div>
      <PlanPicker value={choice} onChange={setChoice} promo={offer} />
      {off ? <p className="rounded-2xl bg-banana-soft p-3 text-sm font-semibold text-banana-ink">Los pagos todavía no están activos. Escríbenos a hola@bananaburn.app.</p>
        : <CardForm choice={choice} demo={demo} submitLabel={t.btn} note={t.note} onSaved={saved} />}
      {offer && <p className="text-xs text-muted text-pretty">{PROMO_TERMS}</p>}
    </section>
  );
}

function Processing({ refresh }: { refresh: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!refresh) return;
    let n = 0;
    const id = setInterval(() => { n++; router.refresh(); if (n >= 12) clearInterval(id); }, 5000);
    return () => clearInterval(id);
  }, [refresh, router]);
  return (
    <section id="tarjeta" aria-live="polite" className="scroll-mt-24 rounded-[1.5rem] border-2 border-line bg-white p-5 sm:p-6">
      <p className="flex items-center gap-2 text-lg font-extrabold text-ink"><CircleNotch weight="bold" className="size-6 animate-spin text-banana-ink motion-reduce:animate-none" />Estamos confirmando el cobro de tu plan</p>
      <p className="mt-1 text-sm text-muted text-pretty">Tu banco lo está procesando. Suele tardar unos segundos y esta página se actualiza sola. No intentes pagar de nuevo: nunca cobramos dos veces.</p>
    </section>
  );
}

function Scheduled({ charge, card, demo, payments, tz, onChanged }: { charge: ChargeView; card: Card; demo: boolean; payments: boolean; tz: string; onChanged: () => void }) {
  const day = (iso: string) => new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long", year: "numeric", timeZone: tz });
  const [view, setView] = useState<"idle" | "plan" | "tarjeta" | "cancelar" | "cancelado">(charge.phase === "cancelado" ? "cancelado" : "idle");
  const [choice, setChoice] = useState<PlanChoice>({ plan: charge.plan, billing: charge.billing });
  const [removeCard, setRemoveCard] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [until, setUntil] = useState<string | null>(charge.phase === "cancelado" ? charge.trialEndsAt : null);
  const [keptCard, setKeptCard] = useState<boolean>(card?.active ?? false);
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (view !== "idle") head.current?.focus(); }, [view]);
  const beta = charge.kind === "beta";
  const trialLive = Date.parse(charge.trialEndsAt) > Date.now();

  async function act(body: Record<string, unknown>, next: typeof view) {
    setBusy(true); setErr(null);
    const r = await prueba(body);
    setBusy(false);
    if (!r.ok) return setErr(r.error ?? "No pudimos hacer el cambio. Intenta de nuevo.");
    if (body.action === "cancelar") { setUntil(r.accessUntil ?? (trialLive ? charge.trialEndsAt : null)); setKeptCard(r.demo ? !removeCard : Boolean(r.cardKept)); }
    setView(next);
    if (!r.demo) onChanged();
  }

  if (view === "cancelado") {
    return (
      <section id="tarjeta" aria-live="polite" className="scroll-mt-24 card p-5 sm:p-6 space-y-3">
        <h2 ref={head} tabIndex={-1} className="text-lg font-extrabold text-ink outline-none flex items-center gap-2"><CheckCircle weight="duotone" className="size-6 text-peel" />Cancelaste tu plan: no se te cobrará</h2>
        <p className="text-sm text-body text-pretty">{until && trialLive ? <>Sigues con todo incluido hasta el <b>{day(until)}</b>. </> : null}{keptCard ? `Tu tarjeta sigue guardada (${cardText(card)}).` : "Quitamos tu tarjeta guardada."} Tu progreso queda guardado.</p>
        {demo && <p className="text-xs font-semibold text-banana-ink">Modo demo: no se canceló nada real.</p>}
        {err && <p role="alert" className="text-sm font-semibold text-bad">{err}</p>}
        {trialLive && keptCard && (
          <button type="button" disabled={busy} onClick={() => act({ action: "reanudar" }, "idle")} className="btn-primary h-12 w-full sm:w-auto" aria-busy={busy}>
            {busy ? <CircleNotch weight="bold" className="size-4 animate-spin motion-reduce:animate-none" /> : <ArrowCounterClockwise weight="bold" className="size-4" />}Cambié de opinión: seguir con mi plan
          </button>
        )}
        {trialLive && !keptCard && (payments || demo) && (
          <details className="rounded-2xl border border-line p-4">
            <summary className="tap flex min-h-11 cursor-pointer items-center font-bold text-ink">Cambié de opinión: volver a mi plan</summary>
            <div className="mt-3"><CardForm choice={{ plan: charge.plan, billing: charge.billing }} demo={demo} submitLabel="Guardar tarjeta y seguir" note={<>No se cobra nada ahora. El {day(charge.chargeAt)} se cobra {planLine(charge.plan, charge.billing)} por {money(charge.amount)}, salvo que canceles antes.</>} onSaved={() => { setView("idle"); if (!demo) onChanged(); }} /></div>
          </details>
        )}
      </section>
    );
  }

  return (
    <section id="tarjeta" aria-labelledby="cobro-titulo" className="scroll-mt-24 rounded-[1.5rem] border-2 border-ink bg-white p-5 sm:p-6 space-y-4">
      <div>
        <p className="text-sm font-semibold text-muted">{charge.testerHold ? "Mes de tester" : charge.moved ? "Cobro programado" : beta ? "Versión de prueba" : "Prueba gratis"}</p>
        <h2 id="cobro-titulo" ref={head} tabIndex={-1} className="mt-0.5 text-xl font-extrabold text-ink outline-none text-balance">{charge.testerHold ? `Sin cobros hasta el ${day(charge.chargeAt)}` : charge.moved ? `Se cobra el ${day(charge.chargeAt)}` : beta ? `Todo gratis hasta el ${day(new Date(Date.parse(charge.chargeAt) - 1).toISOString())}` : `Todo incluido hasta el ${day(charge.trialEndsAt)}`}</h2>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="col-span-2 rounded-2xl bg-banana-soft p-3"><dt className="flex items-center gap-1.5 text-xs font-semibold text-banana-ink"><CalendarCheck weight="duotone" className="size-4" />Se cobra el</dt><dd className="mt-0.5 text-lg font-extrabold text-ink">{day(charge.chargeAt)}{charge.daysToCharge > 0 ? <span className="text-sm font-semibold text-muted">, en {charge.daysToCharge} {charge.daysToCharge === 1 ? "día" : "días"}</span> : null}</dd></div>
        <div className="rounded-2xl bg-paper p-3"><dt className="text-xs font-semibold text-muted">Plan</dt><dd className="font-bold text-ink">{planLine(charge.plan, charge.billing)}</dd></div>
        <div className="rounded-2xl bg-paper p-3"><dt className="text-xs font-semibold text-muted">Monto</dt><dd className="font-bold tabular-nums text-ink">{money(charge.amount)} USD{charge.promo ? <span className="block text-xs font-semibold text-muted">Primer mes con 50 %. Luego {money(charge.fullAmount)} al mes</span> : null}</dd></div>
        <div className="col-span-2 rounded-2xl bg-paper p-3"><dt className="text-xs font-semibold text-muted">Tarjeta</dt><dd className="font-bold text-ink">{cardText(card)}{card?.expMonth && card.expYear ? <span className="font-semibold text-muted">, vence {String(card.expMonth).padStart(2, "0")}/{String(card.expYear).slice(-2)}</span> : null}</dd></div>
      </dl>
      <p className="text-sm text-body text-pretty">{charge.testerHold ? <><b>Mientras seas tester no se te cobra nada.</b> Tu cobro pasó al {day(charge.chargeAt)}, cuando termina tu mes de tester, salvo que canceles antes.</>
        : charge.moved ? <><b>Tu cobro quedó para el {day(charge.chargeAt)}.</b> Puedes cancelar sin costo antes de esa fecha.</>
        : <><b>Hoy no te cobramos.</b> El {day(charge.chargeAt)} se cobra {charge.promo ? "tu primer mes con 50 % de descuento" : "tu plan"}, salvo que canceles antes.</>} Te avisamos 2 días antes.</p>
      {demo && <p className="text-xs font-semibold text-banana-ink">Modo demo: datos de ejemplo, no hay ninguna tarjeta real.</p>}

      {view === "idle" && (
        <div className="grid gap-2 sm:grid-cols-3">
          <button type="button" onClick={() => setView("plan")} disabled={!charge.canChangePlan} className="btn-ghost h-12">Cambiar plan</button>
          <button type="button" onClick={() => setView("tarjeta")} disabled={!payments && !demo} className="btn-ghost h-12">Cambiar tarjeta</button>
          <button type="button" onClick={() => setView("cancelar")} disabled={!charge.canCancel} className="btn-ghost h-12 text-bad">Cancelar sin costo</button>
        </div>
      )}

      {view === "plan" && (
        <div className="space-y-3 rounded-2xl border border-line p-4">
          <p className="font-extrabold text-ink">¿Qué plan se cobra el {day(charge.chargeAt)}?</p>
          {/* Con el 50 % ganado, los mensuales muestran el precio del primer mes (el servidor lo vuelve a calcular). */}
          <PlanPicker value={choice} onChange={setChoice} disabled={busy} promo={charge.promoEarned} />
          {err && <p role="alert" className="text-sm font-semibold text-bad">{err}</p>}
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="button" onClick={() => setView("idle")} className="btn-ghost h-12 sm:flex-1">Volver</button>
            <button type="button" disabled={busy || (choice.plan === charge.plan && choice.billing === charge.billing)} onClick={() => act({ action: "plan", ...choice }, "idle")} className="btn-primary h-12 sm:flex-1" aria-busy={busy}>{busy ? <CircleNotch weight="bold" className="size-4 animate-spin motion-reduce:animate-none" /> : null}Guardar cambio</button>
          </div>
        </div>
      )}

      {view === "tarjeta" && (
        <div className="space-y-3 rounded-2xl border border-line p-4">
          <p className="font-extrabold text-ink">Cambiar la tarjeta del cobro</p>
          <CardForm choice={{ plan: charge.plan, billing: charge.billing }} demo={demo} submitLabel="Guardar tarjeta" note={<>No se cobra nada ahora. El {day(charge.chargeAt)} se cobra con la tarjeta nueva y quitamos la anterior.</>} onSaved={() => { setView("idle"); if (!demo) onChanged(); }} />
          <button type="button" onClick={() => setView("idle")} className="btn-ghost h-12 w-full">Volver</button>
        </div>
      )}

      {view === "cancelar" && (
        <div role="alertdialog" aria-labelledby="cancelar-titulo" className="space-y-3 rounded-2xl border-2 border-bad/30 bg-bad/5 p-4">
          <p id="cancelar-titulo" className="font-extrabold text-ink">¿Cancelar antes del cobro?</p>
          <p className="text-sm text-body text-pretty">No se cobra nada. {trialLive && !beta ? <>Sigues con todo incluido hasta el <b>{day(charge.trialEndsAt)}</b>.</> : null} Tu progreso queda guardado.</p>
          <label className="flex min-h-11 items-start gap-3 text-sm text-body cursor-pointer">
            <input type="checkbox" checked={removeCard} onChange={(e) => setRemoveCard(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-ink" />
            <span>Quitar también mi tarjeta guardada ({cardText(card)}). Si la dejas, puedes volver a tu plan sin escribirla de nuevo.</span>
          </label>
          {err && <p role="alert" className="text-sm font-semibold text-bad">{err}</p>}
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="button" onClick={() => setView("idle")} className="btn-primary h-12 sm:flex-1">Mejor no</button>
            <button type="button" disabled={busy} onClick={() => act({ action: "cancelar", keepCard: !removeCard }, "cancelado")} className="btn h-12 sm:flex-1 bg-bad text-white" aria-busy={busy}>{busy ? <CircleNotch weight="bold" className="size-4 animate-spin motion-reduce:animate-none" /> : null}Confirmar cancelación</button>
          </div>
        </div>
      )}
    </section>
  );
}
