import Link from "next/link";
import { parseIntent } from "@/lib/checkout-intent";
import { FAIL_MESSAGE, canRetry, isFailKind } from "@/lib/pago-fallo";
import { RetryPay } from "@/components/pagos/retry-pay";

/**
 * Vuelta de Tilopay (#296): qué pasó en palabras simples (?motivo=) y, si el pago no se completó, reintentar el mismo plan y
 * periodo con un toque (?para=pago&plan=&pago=). Sin confirmar no ofrece reintentar: podría cobrarse dos veces.
 */
export function TilopayNotice({ notice, motivo: raw, para, plan, pago, demo }: { notice: { ok: boolean; text: string }; motivo?: string; para?: string; plan?: string; pago?: string; demo: boolean }) {
  const motivo = isFailKind(raw) ? raw : null;
  const text = motivo && (!notice.ok || motivo === "sin_confirmar") ? FAIL_MESSAGE[motivo] : notice.text;
  const retry = !notice.ok && !demo && para === "pago" && (!motivo || canRetry(motivo)) ? parseIntent(plan, pago) : null;
  return (
    <div role="status" className={`rounded-2xl p-3 text-sm font-semibold text-pretty ${notice.ok ? "bg-peel/10 text-ink" : "bg-bad/10 text-bad"}`}>
      <p>{text}</p>
      {retry && <RetryPay plan={retry.plan} billing={retry.billing} provider="tilopay" />}
      {!notice.ok && para === "tarjeta" && <a href="#tarjeta" className="tap mt-2 inline-flex min-h-11 items-center text-ink underline underline-offset-2">Intentar de nuevo con tu tarjeta</a>}
      {motivo === "sin_confirmar" && <Link href="/app/suscripcion" className="tap mt-2 inline-flex min-h-11 items-center text-ink underline underline-offset-2">Ver si ya se confirmó</Link>}
    </div>
  );
}
