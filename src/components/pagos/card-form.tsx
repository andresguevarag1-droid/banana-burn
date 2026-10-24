"use client";
import { useEffect, useId, useState } from "react";
import { CircleNotch, CreditCard, Info, Lock, WarningCircle } from "@/components/icons";
import { cardInputErrors, formatCardNumber, formatExp, onlyDigits, onvoCardBody, onvoCardError, type CardErrors, type CardInput } from "@/lib/card-input";
import type { PlanChoice } from "./plan-picker";
import type { ChargeView } from "@/lib/trial";

const ONVO_PAYMENT_METHODS = "https://api.onvopay.com/v1/payment-methods";

export type CardSaved = { demo?: boolean; card?: { brand: string | null; last4: string | null }; charge?: ChargeView | null; outcome?: string };

type Post = { ok?: boolean; error?: string; demo?: boolean; customerId?: string; publicKey?: string; card?: CardSaved["card"]; charge?: ChargeView | null; outcome?: string };

async function post(body: Record<string, unknown>): Promise<Post & { status: number }> {
  try {
    const r = await fetch("/api/pagos/tarjeta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as Post;
    return { ...j, status: r.status };
  } catch {
    return { ok: false, error: "Sin conexión. Revisa tu internet e intenta de nuevo.", status: 0 };
  }
}

type Provider = "onvo" | "tilopay";

/** ¿Hay Tilopay para tarjetas de otros países, y cuál sugiere el servidor por país? Sin respuesta: ONVO, como siempre. */
function useProvider(skip: boolean) {
  const [info, setInfo] = useState<{ available: boolean; provider: Provider }>({ available: false, provider: "onvo" });
  useEffect(() => {
    if (skip) return;
    let alive = true;
    fetch("/api/pagos/tilopay", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { available?: boolean; suggested?: string }) => { if (alive && j.available) setInfo({ available: true, provider: j.suggested === "tilopay" ? "tilopay" : "onvo" }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [skip]);
  return [info, (p: Provider) => setInfo((x) => ({ ...x, provider: p }))] as const;
}

/**
 * Formulario de tarjeta. El número, el vencimiento y el CVV van del navegador DIRECTO a ONVO con la llave publicable
 * (POST /v1/payment-methods); a nuestro servidor solo llega el ID de la tarjeta que devuelve ONVO. Nada se guarda en el
 * navegador. En modo demo se simula todo sin llamar a ONVO.
 * Tarjetas de fuera de Costa Rica (Tilopay, 0042): la persona guarda la tarjeta en la página segura de Tilopay y vuelve a
 * Mi plan. `beforeRedirect` deja guardado lo que haga falta antes de salir (la bienvenida guarda el plan).
 */
export function CardForm({ choice, demo, submitLabel, note, onSaved, beforeRedirect }: { choice: PlanChoice; demo: boolean; submitLabel: string; note: React.ReactNode; onSaved: (r: CardSaved) => void; beforeRedirect?: () => Promise<boolean> }) {
  const id = useId();
  const [c, setC] = useState<CardInput>({ holder: "", number: "", exp: "", cvv: "" });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState<null | "tarjeta" | "guardar">(null);
  const [err, setErr] = useState<string | null>(null);
  const errors: CardErrors = touched ? cardInputErrors(c) : {};
  const up = (p: Partial<CardInput>) => setC((x) => ({ ...x, ...p }));
  const [pay, setProvider] = useProvider(demo);
  const tilopay = pay.available && pay.provider === "tilopay";

  async function goTilopay(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy("tarjeta");
    if (beforeRedirect && !(await beforeRedirect())) { setBusy(null); return; }
    try {
      const r = await fetch("/api/pagos/tilopay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose: "tarjeta", plan: choice.plan, billing: choice.billing }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
      if (j.ok && j.url) { window.location.assign(j.url); return; }
      setErr(j.error ?? "No pudimos abrir la página de pago. Intenta de nuevo.");
    } catch {
      setErr("Sin conexión. Revisa tu internet e intenta de nuevo.");
    }
    setBusy(null);
  }

  const switcher = pay.available && (
    <button type="button" onClick={() => { setErr(null); setProvider(tilopay ? "onvo" : "tilopay"); }} className="tap text-sm font-semibold text-ink underline underline-offset-2">
      {tilopay ? "¿Tu tarjeta es de Costa Rica?" : "¿Tu tarjeta es de otro país?"}
    </button>
  );

  if (tilopay) {
    return (
      <form onSubmit={goTilopay} noValidate className="space-y-3" aria-describedby={`${id}-sec`}>
        <p className="flex items-start gap-2 rounded-2xl bg-banana-soft p-3 text-sm text-ink text-pretty"><CreditCard weight="duotone" aria-hidden className="mt-0.5 size-5 shrink-0" /><span>Vas a guardar tu tarjeta en la página segura de Tilopay, nuestro procesador para tarjetas de otros países. Al terminar vuelves aquí.</span></p>
        {err && <p role="alert" className="flex gap-2 rounded-2xl border border-bad/20 bg-bad/5 p-3 text-sm font-semibold text-bad"><WarningCircle weight="duotone" className="size-5 shrink-0" />{err}</p>}
        <button type="submit" disabled={Boolean(busy)} aria-busy={Boolean(busy)} className="btn-banana h-14 w-full text-base">
          {busy ? <><CircleNotch weight="bold" className="size-5 animate-spin motion-reduce:animate-none" />Abriendo la página segura…</> : submitLabel}
        </button>
        <div className="text-sm text-ink text-pretty">{note}</div>
        <div>{switcher}</div>
        <p id={`${id}-sec`} className="flex items-start gap-2 text-xs text-muted text-pretty"><Lock weight="duotone" aria-hidden className="mt-0.5 size-4 shrink-0 text-peel" />El número de tu tarjeta lo escribes en Tilopay. Banana Burn no lo ve ni lo guarda. Se cobra en dólares: si tu banco lo pide, activa las compras internacionales.</p>
      </form>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setErr(null);
    if (Object.keys(cardInputErrors(c)).length) return;
    if (demo) {
      setBusy("guardar");
      await new Promise((r) => setTimeout(r, 500));
      setBusy(null);
      setC({ holder: "", number: "", exp: "", cvv: "" });
      return onSaved({ demo: true, card: { brand: "visa", last4: onlyDigits(c.number).slice(-4) } });
    }
    setBusy("tarjeta");
    const prep = await post({ action: "preparar" });
    if (!prep.ok || !prep.customerId || !prep.publicKey) { setBusy(null); return setErr(prep.error ?? "No pudimos preparar el pago. Intenta de nuevo."); }
    // Directo a ONVO: nuestro servidor nunca ve estos datos.
    let pmId: string | null = null;
    try {
      const r = await fetch(ONVO_PAYMENT_METHODS, {
        method: "POST",
        headers: { Authorization: `Bearer ${prep.publicKey}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(onvoCardBody(c, prep.customerId)),
      });
      const j = (await r.json().catch(() => null)) as { id?: unknown } | null;
      if (!r.ok || !j || typeof j.id !== "string") { setBusy(null); return setErr(onvoCardError(j)); }
      pmId = j.id;
    } catch {
      setBusy(null);
      return setErr("No pudimos conectar con el procesador de pagos. Revisa tu conexión e intenta de nuevo.");
    }
    setBusy("guardar");
    const saved = await post({ action: "guardar", paymentMethodId: pmId, plan: choice.plan, billing: choice.billing });
    setBusy(null);
    if (!saved.ok) return setErr(saved.error ?? "No pudimos guardar tu tarjeta. Intenta de nuevo.");
    setC({ holder: "", number: "", exp: "", cvv: "" });
    onSaved({ card: saved.card, charge: saved.charge ?? null, outcome: saved.outcome });
  }

  const field = "input h-12 text-base";
  const errText = (k: keyof CardInput) => errors[k] && <span id={`${id}-${k}-e`} className="mt-1 block text-xs font-semibold text-bad">{errors[k]}</span>;
  return (
    <form onSubmit={submit} noValidate className="space-y-3" aria-describedby={`${id}-sec`}>
      {demo && <p className="flex items-start gap-2 rounded-2xl bg-ink p-3 text-sm text-white/90"><Info weight="duotone" className="mt-0.5 size-5 shrink-0 text-banana" /><span><b>Modo demo:</b> no se guarda ninguna tarjeta real ni se llama a ONVO Pay. Usa cualquier número de prueba, como 4242 4242 4242 4242.</span></p>}
      <label className="block">
        <span className="text-sm font-bold text-ink">Nombre en la tarjeta</span>
        <input value={c.holder} onChange={(e) => up({ holder: e.target.value.slice(0, 80) })} autoComplete="cc-name" className={`${field} mt-1`} aria-invalid={Boolean(errors.holder)} aria-describedby={errors.holder ? `${id}-holder-e` : undefined} />
        {errText("holder")}
      </label>
      <label className="block">
        <span className="text-sm font-bold text-ink">Número de tarjeta</span>
        <span className="relative mt-1 block">
          <input value={c.number} onChange={(e) => up({ number: formatCardNumber(e.target.value) })} inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" className={`${field} pr-12 tabular-nums`} aria-invalid={Boolean(errors.number)} aria-describedby={errors.number ? `${id}-number-e` : undefined} />
          <CreditCard weight="duotone" aria-hidden className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
        </span>
        {errText("number")}
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-bold text-ink">Vencimiento</span>
          <input value={c.exp} onChange={(e) => up({ exp: formatExp(e.target.value) })} inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" className={`${field} mt-1 tabular-nums`} aria-invalid={Boolean(errors.exp)} aria-describedby={errors.exp ? `${id}-exp-e` : undefined} />
          {errText("exp")}
        </label>
        <label className="block">
          <span className="text-sm font-bold text-ink">Código (CVV)</span>
          <input value={c.cvv} onChange={(e) => up({ cvv: onlyDigits(e.target.value).slice(0, 4) })} inputMode="numeric" autoComplete="cc-csc" placeholder="123" className={`${field} mt-1 tabular-nums`} aria-invalid={Boolean(errors.cvv)} aria-describedby={errors.cvv ? `${id}-cvv-e` : undefined} />
          {errText("cvv")}
        </label>
      </div>
      {err && <p role="alert" className="flex gap-2 rounded-2xl border border-bad/20 bg-bad/5 p-3 text-sm font-semibold text-bad"><WarningCircle weight="duotone" className="size-5 shrink-0" />{err}</p>}
      <button type="submit" disabled={Boolean(busy)} aria-busy={Boolean(busy)} className="btn-banana h-14 w-full text-base">
        {busy ? <><CircleNotch weight="bold" className="size-5 animate-spin motion-reduce:animate-none" />{busy === "tarjeta" ? "Guardando tu tarjeta…" : "Confirmando…"}</> : submitLabel}
      </button>
      <div className="text-sm text-ink text-pretty">{note}</div>
      {switcher && <div>{switcher}</div>}
      <p id={`${id}-sec`} className="flex items-start gap-2 text-xs text-muted text-pretty"><Lock weight="duotone" aria-hidden className="mt-0.5 size-4 shrink-0 text-peel" />El número de tu tarjeta va directo a ONVO Pay, nuestro procesador de pagos. Banana Burn no lo ve ni lo guarda: solo la marca y los últimos 4 dígitos.</p>
    </form>
  );
}
