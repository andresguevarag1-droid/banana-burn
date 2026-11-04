"use client";
// 0066: condominio con tarjeta. La persona elige el plan que se cobrará cuando termine su acceso gratis y deja la tarjeta.
// El servidor decide si aplica el condominio (saveCard con `condo`): programa el cobro para esa fecha a precio normal y la
// vincula. Al terminar se recarga la página, que ya muestra el acceso activo.
import { useState } from "react";
import { CardForm } from "@/components/pagos/card-form";
import { PlanPicker, type PlanChoice } from "@/components/pagos/plan-picker";
import { PLANS } from "@/lib/plans";
import { money } from "@/lib/copy";

export function CondoCard({ code, demo, freeDay, chargeDay }: { code: string; demo: boolean; freeDay: string; chargeDay: string }) {
  const [choice, setChoice] = useState<PlanChoice>({ plan: "entreno", billing: "mes" });
  const price = PLANS.find((p) => p.id === choice.plan)!.price[choice.billing];
  const period = choice.billing === "mes" ? "al mes" : "al año";
  return (
    <div className="mt-7 space-y-4 rounded-[1.5rem] bg-white p-5 ring-1 ring-ink/10 sm:p-6">
      <div>
        <h2 className="text-xl font-extrabold text-ink">Elige tu plan desde el {chargeDay}</h2>
        <p className="mt-1 text-[15px] text-pretty">Hasta el {freeDay} tienes todo incluido gratis, elijas el que elijas.</p>
      </div>
      <PlanPicker value={choice} onChange={setChoice} />
      <CardForm
        choice={choice}
        demo={demo}
        condo={code}
        submitLabel="Activar gratis con mi tarjeta"
        note={<>Hoy no se cobra nada. El {chargeDay} se cobra {money(price)} {period}, salvo que canceles antes desde Mi plan. Te avisamos 2 días antes.</>}
        onSaved={() => { window.location.assign(`/c/${code}`); }}
      />
    </div>
  );
}
