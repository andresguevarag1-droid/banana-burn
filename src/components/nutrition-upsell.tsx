import Link from "next/link";
import { FunnelTracker } from "@/components/analytics";
import { Egg } from "@/components/icons";
import { NUTRITION_PLAN_NAME, type NutritionUpsellGoal } from "@/lib/plan-access";
import { PLANS } from "@/lib/plans";
import { usd2 } from "@/lib/num";

/** Misma propuesta en Comida y en el cierre; el cobro sigue en Mi plan. */
export function NutritionUpsell({ goal, compact = false }: { goal: NutritionUpsellGoal; compact?: boolean }) {
  const plan = PLANS.find((p) => p.id === "completo")!;
  const protein = goal === "protein";
  const Heading = compact ? "h2" : "h1";
  return (
    <section className="card p-4 sm:p-6 text-left">
      <FunnelTracker view="page_view" props={{ screen: "nutrition_upsell", placement: compact ? "workout" : "nutrition" }} />
      <span aria-hidden className="grid size-12 place-items-center rounded-2xl bg-banana-soft text-ink"><Egg className="size-7" /></span>
      <p className="eyebrow mt-4">{NUTRITION_PLAN_NAME}</p>
      <Heading className={`${compact ? "text-xl" : "text-3xl"} mt-2 font-extrabold tracking-tight text-ink text-balance`}>{compact ? "Comer para tu objetivo" : protein ? "Proteína primero para cuidar tu músculo" : "Alimenta la fuerza que estás construyendo"}</Heading>
      <p className="mt-3 text-body">{protein ? "Al bajar de peso, dale prioridad a la proteína. Con este plan ves tu meta diaria y registras lo que comes para acompañar tu entreno." : "Acompaña tu entreno con calorías y macros calculados para ti, y revisa cuánto llevas durante el día."}</p>
      {!compact && <ul className="mt-4 space-y-2 text-body"><li>Tu meta de proteína y calorías según tu objetivo.</li><li>Registro de comidas y recetas latinas.</li><li>Menú con lo que te falta hoy y ajuste semanal según tu peso.</li></ul>}
      {protein && <p className="mt-3 text-sm text-muted">Si usas GLP-1, incluye Banana Shield. No sustituye la indicación de tu médico.</p>}
      <p className="mt-4 font-bold text-ink tabular-nums">{usd2(plan.price.mes)}/mes o {usd2(plan.price.anual)}/año</p>
      <p className="mt-1 text-xs text-muted">Precios en USD, IVA incluido. El anual se paga completo. Revisa las condiciones del cambio en Mi plan.</p>
      <Link href="/app/suscripcion" data-cta={compact ? "entreno-nutricion-mejorar" : "nutricion-mejorar"} className={`${compact ? "btn-ghost" : "btn-primary"} mt-4 w-full`}>Ver cambio de plan</Link>
    </section>
  );
}
