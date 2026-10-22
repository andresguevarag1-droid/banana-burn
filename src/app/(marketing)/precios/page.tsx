import { Pricing } from "@/components/pricing";
import { PLANS, perMonthAnnual, usd } from "@/lib/plans";
import { social } from "../seo";

const TITLE = "Precios";
const DESCRIPTION = `Entreno desde ${usd(perMonthAnnual(PLANS[0]))} al mes con el plan anual, o súmale nutrición con comida latina de verdad. Cancela cuando quieras y paga seguro con ONVO Pay.`;

export const metadata = { title: TITLE, description: DESCRIPTION, ...social({ title: "Precios de Banana Burn", description: DESCRIPTION, path: "/precios" }) };

export default function Precios() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-16">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-ink text-balance">Elige tu plan</h1>
        <p className="mt-4 text-lg text-muted text-pretty">Entrena con tu coach IA, o súmale el plan de nutrición para bajar de peso más rápido. El plan anual sale a mitad de precio.</p>
      </div>
      <h2 className="sr-only">Planes</h2>
      <Pricing />
    </section>
  );
}
