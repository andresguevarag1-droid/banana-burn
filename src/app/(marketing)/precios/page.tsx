import { Pricing } from "@/components/pricing";

export const metadata = { title: "Precios" };

export default function Precios() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-16">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <p className="eyebrow">Precios</p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-ink">Menos que un batido al mes 🥤</h1>
        <p className="mt-4 text-lg text-muted">Paga con tarjeta, SINPE Móvil o Apple Pay. Cancela cuando quieras.</p>
      </div>
      <Pricing />
    </section>
  );
}
