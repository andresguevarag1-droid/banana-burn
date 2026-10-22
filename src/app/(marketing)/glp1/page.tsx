import Link from "next/link";
import { ArrowRight, Barbell, Drop, Egg, Monkey, ShieldCheck, Sun, Syringe } from "@/components/icons";
import { Phone } from "@/components/phone";
import { PLANS, perMonthAnnual, usd } from "@/lib/plans";
import { Faq, Marker } from "../parts";
import { StickyCta } from "../sticky-cta";
import { social } from "../seo";

const COMPLETO = PLANS[1];

const TITLE = "Banana Shield, el programa para personas en GLP-1";
const DESCRIPTION = "¿Usas Ozempic, Wegovy o Mounjaro? Entreno de fuerza, proteína y hábitos para que lo que bajes sea grasa, no músculo. En español, para Latinoamérica.";
const SIGNUP = "/entrar?modo=registro&programa=glp1";

export const metadata = { title: TITLE, description: DESCRIPTION, ...social({ title: `${TITLE} | Banana Burn`, description: DESCRIPTION, path: "/glp1" }) };

const PILLARS = [
  [Barbell, "Fuerza que protege", "Rutinas de fuerza de 3 a 4 días adaptadas a tu nivel y tiempo. Si hoy hay náusea, modo suave: lo importante es no soltar el músculo."],
  [Egg, "Proteína primero", "Tu meta diaria y por comida, en porciones pequeñas que sí te entran. Recetas latinas suaves para días difíciles."],
  [Syringe, "Sabe tu día de inyección", "El día de la inyección y el siguiente bajamos la intensidad y te recordamos agua, fibra y comidas pequeñas."],
  [ShieldCheck, "Músculo protegido", "Con tus medidas y tu fuerza calculamos cuánto de lo que bajas es grasa. Meta: al menos 3 de cada 4 kg."],
] as const;

const FAQ = [
  ["¿Reemplaza a mi médico?", "No. Banana Shield es entreno, nutrición y hábitos que acompañan el tratamiento que te indicó tu médico. Nunca damos indicaciones de dosis ni de cambios en tu medicamento."],
  ["¿Qué medicamentos aplica?", "GLP-1 recetados como semaglutida (Ozempic, Wegovy), tirzepatida (Mounjaro, Zepbound) o liraglutida (Saxenda). No trabajamos con péptidos sin aprobación ni compuestos de mercado gris."],
  ["¿Por qué importa el músculo?", "Al bajar de peso rápido una parte puede ser músculo. Perder músculo baja tu metabolismo y tu fuerza y facilita el rebote. La fuerza y la proteína son las herramientas con más evidencia para protegerlo."],
  ["¿Y si dejo el medicamento?", "Los hábitos que construyes (fuerza, proteína, pesarte cada semana) son tu seguro. La app ajusta tus calorías con tu peso real para una transición gradual, siempre con tu médico."],
  ["¿Cuánto cuesta?", `Banana Shield está incluido en ${COMPLETO.name}: ${usd(COMPLETO.price.mes)} al mes o ${usd(COMPLETO.price.anual)} al año (equivale a ${usd(perMonthAnnual(COMPLETO))} al mes).`],
] as const;

export default function Glp1Landing() {
  const from = usd(perMonthAnnual(COMPLETO));
  return (
    <>
      <section id="hero" className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-16 lg:pt-0 pb-16 lg:pb-0 grid lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-10 items-center lg:min-h-[min(calc(100dvh-4rem),760px)]">
        <div className="animate-rise lg:py-10">
          <span className="chip bg-ink text-white"><ShieldCheck weight="duotone" className="size-4 text-banana" />Banana Shield para personas en GLP-1</span>
          <h1 className="mt-6 text-[2.6rem] leading-[1.03] sm:text-6xl lg:text-[3.4rem] font-extrabold tracking-[-0.035em] text-ink text-balance">¿Usas Ozempic o Mounjaro?<br /> <Marker>Baja grasa, no músculo.</Marker></h1>
          <p className="mt-6 text-lg sm:text-xl text-muted leading-relaxed max-w-[34rem] text-pretty">El medicamento te quita el hambre. <b className="text-ink">Banana Shield</b> se encarga de que lo que pierdas sea grasa: fuerza a tu medida, proteína que sí te entra y un plan que sabe cuál es tu día de inyección.</p>
          <div data-sticky-anchor className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link href={SIGNUP} data-cta="glp1-hero" className="btn-primary h-14 px-7 text-base w-full sm:w-auto">Crear mi plan <ArrowRight className="size-5" /></Link>
            <a href="#como" className="tap font-semibold text-ink underline decoration-line decoration-2 underline-offset-4 transition-[text-decoration-color] duration-150 hover:decoration-ink">Cómo funciona</a>
          </div>
          <p className="mt-5 text-sm text-muted text-pretty">Incluido en {COMPLETO.name}, desde {from} al mes con el plan anual. Cancela cuando quieras y paga seguro con ONVO Pay.</p>
        </div>
        <div className="relative isolate grid place-items-center py-10 sm:py-12 lg:py-0 lg:h-[min(calc(100dvh-8rem),680px)]">
          <div aria-hidden className="absolute inset-0 sm:inset-x-8 lg:inset-x-0 lg:inset-y-6 -z-10 rounded-[2rem] bg-ink" />
          <ShieldCheck aria-hidden weight="fill" className="absolute right-6 bottom-6 -z-10 size-40 text-banana opacity-[.12]" />
          <Phone src="/landing/hoy2.png" alt="Pantalla Hoy de Banana Burn" className="relative w-[240px] sm:w-[260px] lg:w-[clamp(220px,calc((100dvh-12rem)*0.44),280px)]" priority />
        </div>
      </section>

      {/* DATOS: alineados a la izquierda, con su fuente */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-16 lg:pt-20">
        <dl className="grid gap-8 sm:grid-cols-3 sm:gap-0 sm:divide-x divide-line border-y border-line py-8">
          {([["~1 de 4", "kg perdidos con GLP-1 puede ser masa magra si no se protege.", "¹"], [<>1,2 a 1,6 g/kg</>, "de proteína al día recomiendan los expertos durante la pérdida de peso.", "²"], ["Fuerza", "La proteína sola no basta: el entrenamiento de fuerza es necesario.", "²"]] as const).map(([v, l, ref], i) => (
            <div key={i} className="sm:px-8 sm:first:pl-0 sm:last:pr-0">
              <dt className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink tabular-nums">{v}</dt>
              <dd className="mt-2 text-muted text-pretty">{l}<sup className="ml-0.5">{ref}</sup></dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="como" className="mx-auto max-w-6xl px-4 sm:px-6 pt-20 scroll-mt-20 grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
        <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-ink text-balance">Tu medicamento hace su parte. Banana Shield hace la otra.</h2>
        <ol className="space-y-3">
          {PILLARS.map(([I, t, d]) => (
            <li key={t} className="flex gap-5 rounded-3xl bg-white border border-line p-5 sm:p-6">
              <span className="grid place-items-center size-12 shrink-0 rounded-2xl bg-banana-soft text-banana-ink"><I weight="duotone" className="size-6" /></span>
              <div><h3 className="text-lg font-extrabold text-ink">{t}</h3><p className="mt-1 text-muted leading-relaxed text-pretty">{d}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-20">
        <div className="rounded-[2rem] bg-banana p-8 sm:p-12 grid gap-8 lg:grid-cols-2 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">Un día con Banana Shield</h2>
            <ul className="mt-6 space-y-3 text-[17px] text-ink">
              {([
                [Sun, <><b>Desayuno pequeño con 30 g de proteína</b> (huevos en taza, 3 minutos)</>],
                [Barbell, <><b>Fuerza de 30 a 45 min</b>, o modo suave si es día de inyección</>],
                [Egg, <><b>Proteína primero</b> en cada comida, en porciones que sí te entran</>],
                [Drop, <><b>Agua y fibra</b> marcadas en tus anillos de Hoy</>],
                [ShieldCheck, <><b>Tu escudo de músculo</b> se actualiza con tus medidas</>],
              ] as const).map(([I, txt], i) => (
                <li key={i} className="flex items-start gap-3"><I weight="duotone" className="size-6 shrink-0 mt-0.5" /><span className="text-pretty">{txt}</span></li>
              ))}
            </ul>
          </div>
          <figure className="rounded-3xl bg-white p-6">
            <figcaption className="flex items-center gap-2 text-sm font-bold text-muted"><Monkey className="size-5 text-banana-ink" />Coach Banana</figcaption>
            <blockquote className="mt-2 text-lg text-ink text-pretty">“Hoy es tu día de inyección. Entrena en modo suave (25 min) y prioriza 30 g de proteína en el almuerzo. Si no puedes retener líquidos, llama a tu médico.”</blockquote>
          </figure>
        </div>
      </section>

      <Faq items={FAQ} />

      <section data-sticky-hide className="mx-auto max-w-6xl px-4 sm:px-6 pt-20">
        <div className="rounded-[2rem] bg-ink text-white px-6 py-14 sm:p-16 text-center">
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-balance">Que cada kilo que bajes valga la pena.</h2>
          <Link href={SIGNUP} data-cta="glp1-final" className="mt-8 btn-banana shadow-none h-14 px-8 text-base">Crear mi plan <ArrowRight className="size-5" /></Link>
          <p className="mt-4 text-sm text-white/75">Incluido en {COMPLETO.name}, desde {from} al mes con el plan anual. Cancela cuando quieras.</p>
        </div>
      </section>

      <aside aria-label="Fuentes" className="mx-auto max-w-6xl px-4 sm:px-6 pt-12 text-xs text-muted space-y-1 [&>p]:max-w-[80ch]">
        <p>¹ Noronha JC et al. <i>Optimizing GLP-1 therapies for obesity and diabetes management.</i> Obesity Pillars, 2025 (meta-análisis citado: ~25 % del peso perdido fue masa magra).</p>
        <p>² Mozaffarian D et al. <i>Nutritional priorities to support GLP-1 therapy for obesity.</i> Obesity, 2025. ACLM, ASN, OMA y The Obesity Society.</p>
        <p>Las capturas de la app muestran datos de ejemplo.</p>
        <p>Banana Burn no vende ni receta medicamentos y no reemplaza la atención médica. Ozempic®, Wegovy®, Mounjaro®, Zepbound® y Saxenda® son marcas de sus respectivos dueños; Banana Burn no está afiliado a ellos.</p>
      </aside>
      <StickyCta note={`Banana Shield, desde ${from} al mes.`}><Link href={SIGNUP} data-cta="glp1-sticky" className="btn-primary h-12 px-5 shrink-0">Crear mi plan <ArrowRight className="size-4" /></Link></StickyCta>
    </>
  );
}
