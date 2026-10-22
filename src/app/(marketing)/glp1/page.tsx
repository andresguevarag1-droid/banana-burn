import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Phone } from "@/components/phone";

export const metadata = {
  title: "Banana Shield · Programa para personas en GLP-1",
  description: "¿Usas Ozempic, Wegovy o Mounjaro? Entreno de fuerza, proteína y hábitos para que lo que bajes sea grasa, no músculo. En español, hecho en Costa Rica.",
};

const PILLARS = [
  ["🏋️", "Fuerza que protege", "Rutinas de fuerza 3–4 días adaptadas a tu nivel y tiempo. Si hoy hay náusea, modo suave: lo importante es no soltar el músculo."],
  ["🥩", "Proteína primero", "Tu meta diaria y por comida, en porciones pequeñas que sí te entran. Recetas ticas suaves para días difíciles."],
  ["💉", "Sabe tu día de inyección", "El día de la inyección y el siguiente bajamos la intensidad y te recordamos agua, fibra y comidas pequeñas."],
  ["🛡️", "Músculo protegido", "Con tus medidas y tu fuerza calculamos cuánto de lo que bajas es grasa. Meta: al menos 3 de cada 4 kg."],
];

const FAQ = [
  ["¿Reemplaza a mi médico?", "No. Banana Shield es entreno, nutrición y hábitos que acompañan el tratamiento que te indicó tu médico. Nunca damos indicaciones de dosis ni de cambios en tu medicamento."],
  ["¿Qué medicamentos aplica?", "GLP-1 recetados como semaglutida (Ozempic, Wegovy), tirzepatida (Mounjaro, Zepbound) o liraglutida (Saxenda). No trabajamos con péptidos sin aprobación ni compuestos de mercado gris."],
  ["¿Por qué importa el músculo?", "Al bajar de peso rápido una parte puede ser músculo. Perder músculo baja tu metabolismo y tu fuerza y facilita el rebote. La fuerza y la proteína son las herramientas con más evidencia para protegerlo."],
  ["¿Y si dejo el medicamento?", "Los hábitos que construyes (fuerza, proteína, pesarte cada semana) son tu seguro. La app ajusta tus calorías con tu peso real para una transición gradual, siempre con tu médico."],
  ["¿Cuánto cuesta?", "Banana Shield está incluido en Entreno + Nutrición: $14.99/mes o $89.99/año (equivale a $7.49/mes)."],
];

export default function Glp1Landing() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-40 -right-20 size-[560px] rounded-full bg-banana/40 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-14 pb-16 grid lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
          <div className="animate-rise">
            <span className="chip bg-ink text-white"><ShieldCheck className="size-4 text-banana" />Banana Shield · para personas en GLP-1</span>
            <h1 className="mt-6 text-[2.6rem] leading-[1.03] sm:text-6xl font-extrabold tracking-[-0.035em] text-ink">¿Usas Ozempic o Mounjaro?<br /><span className="relative inline-block"><span className="relative z-10">Baja grasa, no músculo.</span><span aria-hidden className="absolute inset-x-0 bottom-1 sm:bottom-2 h-4 sm:h-5 bg-banana -z-0 rounded" /></span></h1>
            <p className="mt-6 text-lg sm:text-xl text-muted leading-relaxed max-w-xl">El medicamento te quita el hambre. <b className="text-ink">Banana Shield</b> se encarga de que lo que pierdas sea grasa: fuerza a tu medida, proteína que sí te entra y un plan que sabe cuál es tu día de inyección.</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link href="/entrar?modo=registro&programa=glp1" className="btn-primary h-14 px-7 text-base">Activar Banana Shield <ArrowRight className="size-5" /></Link>
              <a href="#como" className="btn-ghost h-14 px-7 text-base">Cómo funciona</a>
            </div>
            <p className="mt-4 text-sm text-muted">Incluido en Entreno + Nutrición · desde $7.49/mes · en español</p>
          </div>
          <div className="flex justify-center"><Phone src="/landing/hoy.png" alt="Banana Burn en el teléfono" className="w-[280px] animate-floaty" priority /></div>
        </div>
      </section>

      <section className="border-y border-line bg-ink text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 grid gap-6 sm:grid-cols-3 text-center">
          <div><p className="text-4xl font-extrabold text-banana">~1 de 4</p><p className="mt-1 text-white/70">kg perdidos con GLP-1 puede ser masa magra si no se protege¹</p></div>
          <div><p className="text-4xl font-extrabold text-banana">1,2–1,6 g/kg</p><p className="mt-1 text-white/70">de proteína al día recomiendan los expertos durante la pérdida de peso²</p></div>
          <div><p className="text-4xl font-extrabold text-banana">Fuerza</p><p className="mt-1 text-white/70">la proteína sola no basta: el entrenamiento de fuerza es necesario²</p></div>
        </div>
      </section>

      <section id="como" className="mx-auto max-w-6xl px-4 sm:px-6 pt-20 scroll-mt-20">
        <p className="eyebrow">Cómo funciona</p>
        <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-ink max-w-3xl">Tu medicamento hace su parte. Banana Shield hace la otra.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {PILLARS.map(([e, t, d]) => (
            <div key={t} className="card p-6"><p className="text-3xl">{e}</p><h3 className="mt-3 text-xl font-extrabold text-ink">{t}</h3><p className="mt-2 text-[17px] text-muted leading-relaxed">{d}</p></div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-20">
        <div className="rounded-[2rem] bg-banana p-8 sm:p-12 grid gap-8 lg:grid-cols-2 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">Un día con Banana Shield 🍌</h2>
            <ul className="mt-6 space-y-3 text-[17px] text-ink">
              <li>☀️ <b>Desayuno pequeño con 30 g de proteína</b> (huevos en taza, 3 minutos)</li>
              <li>🏋️ <b>Fuerza 30–45 min</b>, o modo suave si es día de inyección</li>
              <li>🥩 <b>Proteína primero</b> en cada comida, porciones que sí te entran</li>
              <li>💧 <b>Agua y fibra</b> marcadas en tus anillos de Hoy</li>
              <li>🛡️ <b>Tu escudo de músculo</b> se actualiza con tus medidas</li>
            </ul>
          </div>
          <div className="rounded-3xl bg-white p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Coach Banana</p>
            <p className="mt-2 text-lg text-ink">“Hoy es tu día de inyección 💉. Entrena en modo suave (25 min) y prioriza 30 g de proteína en el almuerzo. Si no puedes retener líquidos, llama a tu médico.”</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 sm:px-6 pt-20">
        <h2 className="text-4xl font-extrabold tracking-tight text-ink text-center">Preguntas frecuentes</h2>
        <div className="mt-8 space-y-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="card group p-0 open:shadow-lift">
              <summary className="cursor-pointer list-none p-5 flex justify-between items-center font-bold text-ink">{q}<span className="text-xl transition-transform group-open:rotate-45" aria-hidden>+</span></summary>
              <p className="px-5 pb-5 -mt-1 text-muted leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-20">
        <div className="rounded-[2rem] bg-ink text-white px-6 py-14 sm:p-16 text-center">
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight">Que cada kilo que bajes valga la pena.</h2>
          <Link href="/entrar?modo=registro&programa=glp1" className="mt-8 btn-banana h-14 px-8 text-base">Activar Banana Shield <ArrowRight className="size-5" /></Link>
          <p className="mt-4 text-sm text-white/70">Incluido en Entreno + Nutrición · cancela cuando quieras</p>
        </div>
      </section>

      <aside className="mx-auto max-w-4xl px-4 sm:px-6 pt-12 text-xs text-muted space-y-1">
        <p>¹ Noronha JC et al. <i>Optimizing GLP-1 therapies for obesity and diabetes management.</i> Obesity Pillars, 2025 (meta-análisis citado: ~25 % del peso perdido fue masa magra).</p>
        <p>² Mozaffarian D et al. <i>Nutritional priorities to support GLP-1 therapy for obesity.</i> Obesity, 2025 — ACLM, ASN, OMA y The Obesity Society.</p>
        <p>Banana Burn no vende ni receta medicamentos y no reemplaza la atención médica. Ozempic®, Wegovy®, Mounjaro®, Zepbound® y Saxenda® son marcas de sus respectivos dueños; Banana Burn no está afiliado a ellos.</p>
      </aside>
    </>
  );
}
