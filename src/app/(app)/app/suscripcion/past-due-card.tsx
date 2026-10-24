"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "@/components/icons";
import { CardForm } from "@/components/pagos/card-form";
import type { PlanChoice } from "@/components/pagos/plan-picker";

/**
 * Renovación rechazada (past_due): cambiar la tarjeta con que se renueva el plan, aquí mismo (#tarjeta, el enlace del
 * correo de pago rechazado). Al guardarla se reintenta el cobro en ese momento (trial-billing.ts → replaceCard).
 */
export function PastDueCard({ choice }: { choice: PlanChoice }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  if (done) return <p role="status" className="mt-4 flex items-start gap-2 rounded-2xl bg-peel/10 p-3 text-sm font-semibold text-ink"><CheckCircle weight="fill" aria-hidden className="mt-0.5 size-5 shrink-0 text-peel" />Listo, tu tarjeta quedó guardada. Intentamos el cobro con ella y te avisamos el resultado.</p>;
  return (
    <div id="tarjeta" className="mt-4 scroll-mt-24">
      <CardForm choice={choice} demo={false} submitLabel="Cambiar tarjeta y pagar" note={<>Guardamos la tarjeta nueva y, en ese momento, intentamos de nuevo el cobro de tu plan con ella. Quitamos la anterior.</>} onSaved={() => { setDone(true); router.refresh(); }} />
    </div>
  );
}
