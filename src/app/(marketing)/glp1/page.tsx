import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Barbell, Egg, ShieldCheck, Drop } from "@/components/icons";
import { Phone } from "@/components/phone";
import { Pricing } from "@/components/pricing";
import { ANNUAL_SEASON_NOTE, PLANS } from "@/lib/plans";
import { TRIAL_DAYS, money } from "@/lib/copy";
import { offer } from "@/lib/offer";
import { Faq } from "../parts";
import { StickyCta } from "../sticky-cta";
import { faqJsonLd, ldScript, social } from "../seo";
import { SIGNUP_GLP1 } from "../content";

export const revalidate = 3600;
const TITLE = "Banana Shield: fuerza para quienes bajan con GLP-1";
const DESCRIPTION = "Fuerza, proteína y hábitos para ayudar a conservar músculo durante la pérdida de peso. Prueba Banana Shield 7 días gratis, sin tarjeta. No sustituye la indicación de tu médico.";
const CTA = `Empieza ${TRIAL_DAYS} días gratis`;
const MEDICAL = "No sustituye la indicación de tu médico.";
const COMPLETO = PLANS.find((p) => p.id === "completo")!;
export const metadata = { title: TITLE, description: DESCRIPTION, ...social({ title: TITLE, description: DESCRIPTION, path: "/glp1", og: { t: "Fuerza para cuidar el músculo", s: "Para quienes bajan con GLP-1. 7 días gratis, sin tarjeta. No sustituye la indicación de tu médico.", v: "edad" } }) };

const PILLARS = [
  [Barbell, "Fuerza con una guía", "Rutinas según nivel, tiempo y equipo, animaciones de técnica y registro de cargas. La progresión usa los entrenos registrados para orientar la siguiente sesión."],
  [Egg, "Proteína repartida en el día", "Metas diarias y por comida, registro de alimentos latinos y recetas. Banana Shield muestra también una referencia de calorías mínimas."],
  [Drop, "Hábitos en Hoy", "Referencias de agua y fibra, registro de náuseas y orientación para los días de inyección y el día siguiente, según lo configurado en el perfil."],
  [ShieldCheck, "Seguimiento con contexto", "La guía combina peso, medidas y fuerza. La primera calificación requiere al menos dos mediciones y cuatro semanas de datos; es una estimación, no una medición clínica de músculo."],
] as const;

function Start({ location }: { location: "hero" | "final" }) {
  return <div><Link href={SIGNUP_GLP1} data-cta={`glp1-${location}`} className="btn-primary min-h-12 w-full sm:w-auto">{CTA}<ArrowRight aria-hidden className="size-5" /></Link><Link href={SIGNUP_GLP1} data-cta={`glp1-${location}`} className="tap mt-1 flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4">Continuar sin tarjeta</Link></div>;
}

export default function Glp1Landing() {
  const o = offer();
  const FAQ = [
    ["¿Qué es Banana Shield?", `Es el programa de fuerza, nutrición y hábitos de Banana Burn para quienes bajan con GLP-1. Se activa desde el perfil y está incluido en la prueba y en ${COMPLETO.name}. ${MEDICAL}`],
    ["¿La proteína y el entreno garantizan conservar músculo?", `No hay un resultado garantizado. La fuerza y una ingesta adecuada de proteína ayudan a cuidar la masa muscular; las necesidades y los resultados varían. ${MEDICAL}`],
    ["¿Sirve para empezar a entrenar?", "La rutina se adapta al nivel, al equipo y al tiempo disponible e incluye animaciones de técnica. La frecuencia y la intensidad deben ajustarse a las indicaciones del equipo médico."],
    ["¿Cuánto cuesta después de la prueba?", `Banana Shield está incluido en ${COMPLETO.name}: ${money(COMPLETO.price.anual)} al año o ${money(COMPLETO.price.mes)} al mes, en USD. El plan Entreno no incluye Banana Shield ni nutrición.`],
    ["¿Hace falta guardar tarjeta?", `No. Puedes continuar sin tarjeta durante los ${TRIAL_DAYS} días gratis. Al terminar, eliges y pagas un plan para seguir; tu progreso queda guardado. Si guardas tarjeta, el cobro es automático salvo que canceles antes desde Mi plan.`],
    ["¿Reemplaza la atención médica?", `No damos indicaciones de dosis ni cambios en el tratamiento. Banana Shield ofrece entrenamiento y seguimiento de hábitos. ${MEDICAL}`],
  ] as const;
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={ldScript(faqJsonLd(FAQ))} />
    <section id="hero" className="bg-banana">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-6 sm:px-6 sm:py-12 md:grid-cols-[1fr_240px]">
        <div>
          <p className="text-sm font-bold text-ink">Para quienes bajan con GLP-1</p>
          <h1 className="mt-3 max-w-2xl text-[2rem] leading-[1.1] font-extrabold tracking-tight text-ink text-balance sm:text-5xl">Fuerza para cuidar el músculo mientras baja el peso</h1>
          <p className="mt-3 max-w-xl text-body text-pretty">Banana Shield reúne rutina, proteína y hábitos para ayudar a conservar músculo, con una guía cada día.</p>
          <p className="mt-4 font-bold text-ink">{TRIAL_DAYS} días gratis, sin tarjeta</p>
          <div data-sticky-anchor className="mt-3"><Start location="hero" /></div>
          <p className="text-sm text-ink">Cancelas cuando quieras desde Mi plan.</p>
          <p className="mt-2 text-sm font-semibold text-ink">{MEDICAL}</p>
        </div>
        <Image src="/brand/mascota-sola.webp" alt="Coach Banana, guía de entrenamiento" width={240} height={300} sizes="240px" className="hidden h-[300px] w-[240px] object-contain md:block" />
      </div>
    </section>

    <section id="como" aria-labelledby="shield-title" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 scroll-mt-20">
      <h2 id="shield-title" className="text-3xl font-extrabold tracking-tight text-ink">Qué hace Banana Shield hoy</h2>
      <p className="mt-3 max-w-2xl text-body">Incluido en la prueba y en {COMPLETO.name}. Activa el programa desde tu perfil para ver sus metas y orientación.</p>
      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_240px]">
        <ul className="grid gap-4 sm:grid-cols-2">{PILLARS.map(([Icon, title, detail]) => <li key={title} className="card p-5"><Icon aria-hidden className="size-7 text-banana-ink" /><h3 className="mt-3 text-lg font-extrabold text-ink">{title}</h3><p className="mt-2 text-body text-pretty">{detail}</p></li>)}</ul>
        <figure><Phone src="/landing/entreno-top.webp" alt="Pantalla real de Entreno con los ejercicios del día" sizes="220px" className="mx-auto w-[220px]" /><figcaption className="mt-3 text-center text-xs text-muted">Entreno en la app. Datos de ejemplo; no muestra el modo Banana Shield.</figcaption></figure>
      </div>
      <p className="mt-5 text-sm font-semibold text-ink">{MEDICAL}</p>
    </section>

    <section aria-labelledby="habitos-title" className="bg-ink text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 id="habitos-title" className="text-3xl font-extrabold tracking-tight">Dos hábitos para cuidar la fuerza</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div><h3 className="text-2xl font-extrabold text-banana tabular-nums">1.2 a 1.6 g de proteína por kg al día</h3><p className="mt-3 text-white/85">Referencia durante la pérdida de peso, repartida en comidas. El equipo médico debe individualizar la meta, especialmente si hay restricciones de proteína.</p></div>
          <div><h3 className="text-2xl font-extrabold text-banana tabular-nums">Fuerza 3 veces por semana</h3><p className="mt-3 text-white/85">Una referencia para organizar la semana, ajustando la rutina al nivel, la recuperación y las indicaciones médicas.</p></div>
        </div>
        <p className="mt-6 font-semibold">{MEDICAL}</p>
        <p className="mt-3 text-xs text-white/75">Referencia: Mozaffarian D et al. Nutritional priorities to support GLP-1 therapy for obesity. Obesity, 2025. ACLM, ASN, OMA y The Obesity Society.</p>
      </div>
    </section>

    <section id="planes" aria-labelledby="planes-title" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h2 id="planes-title" className="text-3xl font-extrabold tracking-tight text-ink">Prueba primero. Elige después.</h2>
      <p className="mt-3 text-body">Banana Shield está en {COMPLETO.name}. {o.pricingTrial}</p>
      <p className="mt-4 mb-8 rounded-2xl bg-banana-soft p-4 font-bold text-ink">Anual: {ANNUAL_SEASON_NOTE.toLowerCase()} por cada año pagado.</p>
      <Pricing recommended="completo" trialGuarantee={o.guarantee} trialLabel={CTA} />
      <Link href={SIGNUP_GLP1} data-cta="glp1-banda" className="tap mt-3 flex min-h-11 items-center justify-center font-semibold text-ink underline underline-offset-4">Continuar sin tarjeta</Link>
      <p className="mt-3 text-sm font-semibold text-ink">{MEDICAL}</p>
    </section>

    <Faq id="preguntas" items={FAQ} />
    <section data-sticky-hide className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
      <div className="rounded-[2rem] bg-banana p-6 sm:p-12">
        <h2 className="text-3xl font-extrabold tracking-tight text-ink">Empieza con tu próxima sesión de fuerza</h2>
        <p className="mt-3 mb-5 text-body">Prueba la rutina, el registro de comidas y Banana Shield antes de elegir un plan.</p>
        <Start location="final" />
        <p className="mt-3 text-sm font-semibold text-ink">{MEDICAL}</p>
      </div>
    </section>
    <StickyCta note="7 días gratis"><div className="flex flex-col items-center"><Link href={SIGNUP_GLP1} data-cta="glp1-sticky" className="btn-primary min-h-12 px-4 text-sm">{CTA}</Link><Link href={SIGNUP_GLP1} data-cta="glp1-sticky" className="flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4">Continuar sin tarjeta</Link></div></StickyCta>
  </>;
}
