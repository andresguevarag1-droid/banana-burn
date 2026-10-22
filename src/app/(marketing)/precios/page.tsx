import { Pricing } from "@/components/pricing";

export const metadata = { title: "Precios" };

export default function Precios() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-16">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-ink text-balance">Elige tu plan</h1>
        <p className="mt-4 text-lg text-muted text-pretty">Entrena con tu coach IA, o súmale el plan de nutrición para bajar de peso más rápido.</p>
      </div>
      <Pricing />
    </section>
  );
}
