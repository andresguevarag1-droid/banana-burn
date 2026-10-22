import { Pricing } from "@/components/pricing";
import { Banana } from "@/components/icons";

export const metadata = { title: "Precios" };

export default function Precios() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-16">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <p className="eyebrow">Precios</p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-ink"><span className="inline-flex items-center gap-3">Elige tu plan <Banana weight="fill" className="size-10 text-banana-ink" /></span></h1>
        <p className="mt-4 text-lg text-muted">Entrena con tu coach IA, o súmale el plan de nutrición para bajar de peso más rápido.</p>
      </div>
      <Pricing />
    </section>
  );
}
