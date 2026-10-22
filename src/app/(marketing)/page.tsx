import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowCounterClockwise, ArrowRight, Banana, BananaFlame, Barbell, BowlFood, Check, Clock, Lock, Minus, MonkeyBanana, Scales, ShieldCheck, Syringe, Target, X,
} from "@/components/icons";
import { Phone } from "@/components/phone";
import { Pricing } from "@/components/pricing";
import { PLANS, annualSavingPct, perMonthAnnual, usd } from "@/lib/plans";
import { Faq, Marker } from "./parts";
import { StickyCta } from "./sticky-cta";
import { appJsonLd, social } from "./seo";

const [ENTRENO, COMPLETO] = PLANS;
const FROM = usd(perMonthAnnual(ENTRENO));
const SAVE = Math.max(...PLANS.map(annualSavingPct));
const SIGNUP = "/entrar?modo=registro";

const TITLE = "Banana Burn: entrenador personal con IA para bajar grasa";
const DESCRIPTION = `Rutina de gym o casa, el peso exacto de cada serie y comida latina de verdad, ajustados cada semana a tu peso real. Tu coach IA en español, desde ${FROM} al mes.`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  ...social({ title: TITLE, description: DESCRIPTION, path: "/" }),
};

/* Entrada tipo quiz. El onboarding hoy solo lee `programa=glp1` (cookie en /entrar);
   `objetivo` viaja en la URL para cuando el wizard de /bienvenida lo preseleccione. */
const GOALS: { label: string; href: string; cta: string; icon: React.ComponentType<{ weight?: "duotone"; className?: string; "aria-hidden"?: boolean }> }[] = [
  { label: "Bajar grasa rápido", href: `${SIGNUP}&objetivo=grasa`, cta: "quiz-grasa", icon: BananaFlame },
  { label: "Bajar grasa y ganar músculo", href: `${SIGNUP}&objetivo=recomp`, cta: "quiz-recomp", icon: Scales },
  { label: "Ganar fuerza", href: `${SIGNUP}&objetivo=fuerza`, cta: "quiz-fuerza", icon: Barbell },
  { label: "Uso Ozempic o Mounjaro", href: `${SIGNUP}&programa=glp1`, cta: "quiz-glp1", icon: Syringe },
];

const PAINS = [
  ["Llegas al gym y no sabes qué hacer.", "Das vueltas, copias al de la máquina de al lado y te vas con la sensación de que no sirvió de nada."],
  ["Tu rutina es genérica y nunca cambia.", "El PDF o el video de TikTok no saben cuánto levantaste la semana pasada ni cuánto tiempo tienes hoy."],
  ["La dieta no se parece a lo que comes.", "Te piden salmón, quinoa y kale. Tú comes arroz con pollo, frijoles, tortillas o patacones, y se puede bajar de peso así."],
] as const;

const STEPS = [
  ["/landing/objetivo.png", "Cuéntanos tu objetivo", "Tu peso, tu meta, cuántos días entrenas, con qué equipo (gym, casa o nada) y cuánto tiempo tienes. Toma unos 2 minutos."],
  ["/landing/hoy2.png", "Abre la app y haz lo que toca hoy", "Tu rutina del día con series, repeticiones y el peso de cada serie. ¿Día apretado? Hay entrenos exprés de 10, 20 o 30 minutos."],
  ["/landing/progreso.png", "Registra y deja que se ajuste solo", "Si completas tus repeticiones, sube el peso. Cada semana el plan lee tu peso real y corrige el rumbo."],
] as const;

type Feature = { src: string; alt: string; title: string; body: string; points: string[]; tag?: string };
const FEATURES: Feature[] = [
  {
    src: "/landing/entreno.png", alt: "Pantalla de entrenamiento con el peso y las repeticiones de cada serie",
    title: "Entras al gym sabiendo exactamente qué levantar.",
    body: "Cada serie trae el peso y las repeticiones que te tocan. Si las completas, la próxima vez sube. Si te estancas, el plan ajusta.",
    points: ["Gym, casa o sin equipo, de 10 a 60 minutos", "Animación de técnica en cada ejercicio", "Rutina distinta cada día y accesorios que rotan cada semana", "Descanso cronometrado y récords personales"],
  },
  {
    src: "/landing/nutricion.png", alt: "Pantalla de comida con calorías y proteína restantes del día",
    title: "Bajas de peso comiendo arroz con pollo.",
    body: "Calorías y proteína calculadas para ti, con la comida que ya comes. Registras tu almuerzo en dos toques y ves cuánto te queda del día.",
    points: ["Comida latina de verdad: arroz con pollo, frijoles, tortillas, ceviche, patacones, gallo pinto", "Recetas e ideas de menú para cada día", "Tus calorías se ajustan cada semana con tu peso real"],
    tag: `Incluido en ${COMPLETO.name}`,
  },
  {
    src: "/landing/progreso.png", alt: "Pantalla de progreso con la tendencia de peso",
    title: "Ves tu progreso real aunque la báscula se ponga terca.",
    body: "El peso sube y baja por agua y sal. Banana Burn te muestra la tendencia, que es lo que cuenta, junto con tu fuerza, tus medidas y tus fotos.",
    points: ["Tendencia de peso, no el número del día", "Medidas y fotos de progreso privadas", "Fuerza por ejercicio, semana a semana"],
  },
];

type Mark = true | false | string;
const PAY_ROW = "Cómo se paga";
const COLS = ["Banana Burn", "Entrenador personal", "Apps extranjeras", "PDF de rutina"] as const;
/* Comparación cualitativa y honesta, incluida la fila donde el entrenador en persona gana.
   Sin precios de mercado: la landing es para toda LATAM y las tarifas de entrenadores varían por país;
   no hay una fuente regional confiable (búsquedas del 22/10/2026), así que no damos cifras. */
const ROWS: [string, Mark, Mark, Mark, Mark][] = [
  ["Te dice qué hacer cada día", true, true, true, "Siempre lo mismo"],
  ["Ajusta tu plan con tus resultados", true, true, "Algunas", false],
  ["En español latino, con comida latina", true, true, false, "Depende"],
  ["Te responde a cualquier hora", true, "En su horario", "Algunas, en inglés", false],
  ["Corrige tu técnica en persona", "Animaciones", true, false, false],
  [PAY_ROW, `Desde ${FROM} al mes`, "Por sesión o paquete", "Suscripción", "Pago único"],
];

const FAQ = [
  ["¿Por qué pagar si hay rutinas gratis en internet?", `Una rutina gratis no sabe cuánto levantaste ayer, cuánto tiempo tienes hoy ni qué comiste. Banana Burn ajusta tu plan en cada sesión y cada semana. Con el plan anual son ${FROM} al mes.`],
  ["No tengo tiempo. ¿Me sirve?", "Sí. Eliges cuántos minutos tienes, de 15 a 60, y en los días apretados hay entrenos exprés de 10, 20 o 30 minutos sin equipo."],
  ["¿Sirve si entreno en casa o sin equipo?", "Sí. Eliges gym, casa (mancuernas o bandas) o sin equipo, y el plan cambia los ejercicios por variantes que puedes hacer con lo que tienes."],
  ["¿Necesito experiencia en el gym?", "No. Cada ejercicio trae animación y guía de técnica. La primera semana es de calibración: la app aprende tus pesos."],
  ["Uso Ozempic o Mounjaro. ¿Es para mí?", `Sí. Banana Shield, incluido en ${COMPLETO.name}, prioriza fuerza y proteína para que lo que bajes sea grasa y no músculo, y baja la intensidad en tu día de inyección. No damos indicaciones sobre tu medicamento: eso lo ves con tu médico.`],
  ["¿Cuánto peso voy a bajar?", "Depende de ti y de tu punto de partida, así que no prometemos un número. Un ritmo sano es de 0,5 a 1 % de tu peso por semana, y la app mide tu tendencia real para mantenerte en ese rango sin perder músculo."],
  ["¿Cómo cancelo? ¿Hay reembolso?", "Cancelas cuando quieras desde Mi plan y conservas el acceso hasta el final del periodo pagado. Además tienes 8 días hábiles de derecho de retracto desde la compra, según la Ley 7472."],
  ["¿Cómo pago?", "Con tarjeta de crédito o débito, procesado por ONVO Pay. Los precios están en dólares (USD)."],
  ["¿Mis datos están seguros?", "Tus datos de salud son privados y solo tuyos. Puedes exportarlos o borrar tu cuenta cuando quieras, conforme a la Ley 8968 de protección de datos."],
  ["¿Es en español de verdad?", "Sí. Banana Burn está en español latino desde el primer día y pensada para Latinoamérica: los ejercicios, el coach y las comidas. No es una app traducida."],
  ["¿Tengo que descargarla de una tienda?", "No. Es una app web: la abres en el navegador y la instalas en tu pantalla de inicio, en iPhone o Android."],
] as const;

const UGC_BASE = "https://d8j0ntlcm91z4.cloudfront.net/user_3KlOTMXim7g88SAyF4A03SG6JZ6/";
/** Escenas ilustrativas (persona real + Coach Banana en caricatura). No son clientes ni testimonios. */
const SCENES: [string, string][] = [
  ["hf_20261022_153719_0be6b29d-ae57-4937-a122-798fdf72baa4", "En el gym: te corrige la técnica en cada serie."],
  ["hf_20261022_155001_e82f1d0e-5f20-4eba-9039-6f62a9d79152", "En la casa: sin equipo y sin excusas."],
  ["hf_20261022_155041_f2cc4028-cb3a-48a8-ade4-3d6edcbbf98f", "En la cocina: comida latina que cuadra con tu meta."],
  ["hf_20261022_155041_44c51456-065c-44b4-95dc-135b1585a69a", "En el parque: te marca el ritmo."],
  ["hf_20261022_155042_171fc15e-6a39-489f-a615-de397a0bcec2", "A cualquier edad: cargas a tu nivel."],
  ["hf_20261022_155003_11f3b250-6cbe-4354-ab64-49e1d65832ec", "Cada récord se celebra."],
];

const H2 = "text-4xl sm:text-5xl font-extrabold tracking-tight text-ink text-balance";
const LEAD = "mt-4 text-lg text-muted leading-relaxed text-pretty max-w-[60ch]";

function MarkCell({ v, strong }: { v: Mark; strong?: boolean }) {
  if (v === true) return <><Check weight="bold" aria-hidden className={`size-5 ${strong ? "text-ink" : "text-peel"}`} /><span className="sr-only">Sí</span></>;
  if (v === false) return <><X weight="bold" aria-hidden className="size-5 text-faint" /><span className="sr-only">No</span></>;
  return <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted"><Minus weight="bold" aria-hidden className="size-4 shrink-0 text-faint" />{v}</span>;
}

export default function Landing() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd()).replace(/</g, "\\u003c") }} />

      {/* 1. HERO: resultado + mecanismo + para quién, un CTA y confianza inmediata */}
      <section id="hero" className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-16 lg:pt-0 pb-14 lg:pb-0 grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-10 items-center lg:min-h-[min(calc(100dvh-4rem),760px)]">
        <div className="animate-rise lg:py-10">
          <h1 className="text-[2.6rem] leading-[1.03] sm:text-6xl lg:text-[3.5rem] font-extrabold tracking-[-0.035em] text-ink text-balance">
            Baja grasa sin perder músculo. <Marker>Tu coach IA te dice qué hacer hoy.</Marker>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted max-w-[34rem] leading-relaxed text-pretty">
            Para quien quiere resultados en el gym sin adivinar: <b className="text-ink">el peso exacto de cada serie</b>, rutina a tu nivel y comida latina de verdad. Se ajusta cada semana a tu peso real.
          </p>
          <div data-sticky-anchor className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link href={SIGNUP} data-cta="hero" className="btn-primary h-14 px-7 text-base w-full sm:w-auto">Crear mi plan <ArrowRight className="size-5" /></Link>
            <a href="#como-funciona" data-cta="hero-secundario" className="tap font-semibold text-ink underline decoration-line decoration-2 underline-offset-4 transition-[text-decoration-color] duration-150 hover:decoration-ink">Ver cómo funciona</a>
          </div>
          <p className="mt-5 text-sm font-semibold text-ink">Desde {FROM} al mes con el plan anual.</p>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            {([[Clock, "Listo en 2 minutos"], [ArrowCounterClockwise, "Cancela cuando quieras"], [Lock, "Pago seguro con ONVO Pay"]] as const).map(([I, t]) => (
              <li key={t} className="inline-flex items-center gap-1.5"><I weight="duotone" aria-hidden className="size-4 text-banana-ink" />{t}</li>
            ))}
          </ul>
        </div>

        <div className="relative isolate grid place-items-center py-10 sm:py-12 lg:py-0 lg:h-[min(calc(100dvh-8rem),680px)]">
          <div aria-hidden className="absolute inset-0 sm:inset-x-8 lg:inset-x-0 lg:inset-y-6 -z-10 rounded-[2rem] bg-banana" />
          <Banana aria-hidden weight="fill" className="absolute right-6 bottom-6 -z-10 size-40 text-ink opacity-[.07] rotate-12" />
          <Phone src="/landing/entreno.png" alt="" className="hidden md:block absolute w-[190px] left-[8%] top-[16%] -rotate-6" />
          <Phone src="/landing/hoy2.png" alt="Pantalla Hoy de Banana Burn con la rutina del día y la racha" className="relative w-[230px] sm:w-[260px] lg:w-[clamp(220px,calc((100dvh-12rem)*0.44),280px)] md:translate-x-14" priority />
        </div>
      </section>

      {/* 2. QUIZ: micro-compromiso, cada objetivo entra directo al registro */}
      <section aria-labelledby="objetivo" className="border-y border-line bg-cream">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10">
          <div>
            <h2 id="objetivo" className="text-2xl font-extrabold tracking-tight text-ink">¿Qué quieres lograr?</h2>
            <p className="mt-1 text-sm text-muted">Elige uno y empieza tu plan en 2 minutos.</p>
          </div>
          <ul className="mt-5 flex flex-wrap gap-3">
            {GOALS.map(({ label, href, cta, icon: I }) => (
              <li key={cta}>
                <Link href={href} data-cta={cta} className="pressable group inline-flex items-center gap-2.5 h-12 pl-3 pr-4 rounded-full border-2 border-line bg-white font-bold text-[15px] text-ink hover:border-ink">
                  <span className="grid place-items-center size-8 rounded-full bg-banana-soft text-banana-ink transition-colors duration-150 group-hover:bg-banana group-hover:text-ink"><I weight="duotone" aria-hidden className="size-5" /></span>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3. PROBLEMA: la realidad del gym en LATAM, y la salida */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-24 grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-16 items-start">
        <div className="lg:sticky lg:top-24">
          <h2 className={H2}>Si el gym no te ha funcionado, no es falta de ganas.</h2>
          <p className={LEAD}>Te falta un plan que piense por ti. Banana Burn decide qué entrenar, cuánto levantar y qué comer, con lo que ya tienes y con la comida que ya comes.</p>
        </div>
        <ul className="border-t border-line">
          {PAINS.map(([t, d]) => (
            <li key={t} className="flex gap-4 border-b border-line py-6">
              <span aria-hidden className="grid place-items-center size-9 shrink-0 rounded-full bg-ember/10 text-ember-ink"><X weight="bold" className="size-4" /></span>
              <div>
                <p className="text-lg font-extrabold text-ink text-balance">{t}</p>
                <p className="mt-1 text-muted leading-relaxed text-pretty max-w-[60ch]">{d}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 3b. COACH EN ACCIÓN: escenas con el mono entrenando a gente real (ilustrativas) */}
      <section aria-labelledby="coach-accion" className="pt-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 grid gap-4 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <h2 id="coach-accion" className={H2}>Un coach que no te quita el ojo de encima.</h2>
          <p className="text-lg text-muted leading-relaxed text-pretty max-w-[52ch]">Coach Banana te cuenta el tempo, te corrige la técnica y te avisa cuándo volver a la barra. En el gym, en la casa o en el parque.</p>
        </div>
        <ul tabIndex={0} aria-label="Escenas de Coach Banana entrenando" className="mt-10 flex gap-3 overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-ink snap-x snap-mandatory px-4 pb-2 [scrollbar-width:none] sm:mx-auto sm:max-w-6xl sm:px-6 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible">
          {SCENES.map(([id, t], i) => (
            <li key={id} className={`relative shrink-0 w-[78%] snap-center overflow-hidden rounded-[1.5rem] bg-cream aspect-[4/5] sm:w-auto ${i === 0 ? "lg:col-span-2 lg:row-span-2 lg:aspect-auto" : ""}`}>
              <Image src={`${UGC_BASE}${id}.png`} alt={t} fill sizes={i === 0 ? "(min-width: 1024px) 760px, 80vw" : "(min-width: 1024px) 380px, 80vw"} className="object-cover" />
              <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 via-ink/40 to-transparent px-4 pb-4 pt-12 text-[15px] font-bold leading-snug text-white text-balance">{t}</p>
            </li>
          ))}
        </ul>
        <p className="mx-auto max-w-6xl px-4 sm:px-6 mt-3 text-xs text-faint">Escenas ilustrativas creadas para mostrar cómo te acompaña el coach.</p>
      </section>

      {/* 4. CÓMO FUNCIONA: 3 pasos concretos con pantallas reales */}
      <section id="como-funciona" className="mx-auto max-w-6xl px-4 sm:px-6 pt-24 scroll-mt-20">
        <h2 className={`${H2} max-w-2xl`}>Tu plan listo hoy. Tus resultados, semana a semana.</h2>
        <ol className="mt-12 grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-x-16 lg:gap-y-0">
          {STEPS.map(([src, t, d], i) => (
            <li key={t} className={`grid grid-cols-[auto_1fr] gap-x-5 gap-y-6 sm:grid-cols-[auto_1fr_180px] sm:items-center lg:col-start-1 lg:grid-cols-[auto_1fr] lg:border-b lg:border-line lg:py-8 lg:first:pt-0 ${i === 0 ? "lg:row-start-1" : i === 1 ? "lg:row-start-2" : "lg:row-start-3"}`}>
              <span aria-hidden className="grid place-items-center size-11 rounded-full bg-ink text-banana text-lg font-extrabold tabular-nums">{i + 1}</span>
              <div>
                <h3 className="text-xl font-extrabold text-ink text-balance">{t}</h3>
                <p className="mt-1.5 text-muted leading-relaxed text-pretty max-w-[52ch]">{d}</p>
              </div>
              <Phone src={src} alt={`Paso ${i + 1}: ${t}`} sizes="200px" className="col-span-2 sm:col-span-1 justify-self-center w-[180px] lg:hidden" />
            </li>
          ))}
          <li aria-hidden className="hidden lg:block lg:col-start-2 lg:row-start-1 lg:row-span-3">
            <div className="relative isolate h-full min-h-[560px] rounded-[2rem] bg-cream border border-line overflow-hidden">
              <Phone src="/landing/objetivo.png" alt="" sizes="220px" className="absolute w-[210px] left-[6%] top-12 -rotate-6" />
              <Phone src="/landing/progreso.png" alt="" sizes="220px" className="absolute w-[210px] right-[6%] top-12 rotate-6" />
              <Phone src="/landing/hoy2.png" alt="" sizes="260px" className="absolute w-[240px] left-1/2 -translate-x-1/2 top-24" />
            </div>
          </li>
        </ol>
      </section>

      {/* 5. RESULTADOS, NO FUNCIONES: titular de beneficio + pantalla que lo prueba */}
      <section aria-label="Lo que logras con Banana Burn" className="mx-auto max-w-6xl px-4 sm:px-6 pt-24 space-y-20 lg:space-y-28">
        {FEATURES.map((f, i) => (
          <div key={f.src} className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-center">
            <div className={i % 2 ? "lg:order-2" : ""}>
              {f.tag && <span className="chip bg-ink text-white"><BowlFood weight="duotone" aria-hidden className="size-4 text-banana" />{f.tag}</span>}
              <h2 className={`${f.tag ? "mt-4 " : ""}text-3xl sm:text-[2.6rem] sm:leading-[1.1] font-extrabold tracking-tight text-ink text-balance`}>{f.title}</h2>
              <p className={LEAD}>{f.body}</p>
              <ul className="mt-6 space-y-3">
                {f.points.map((p) => <li key={p} className="flex gap-3 text-[17px] text-ink"><Check weight="bold" aria-hidden className="mt-0.5 size-5 shrink-0 text-peel" /><span className="text-pretty">{p}</span></li>)}
              </ul>
            </div>
            <div className={`relative isolate grid place-items-center rounded-[2rem] py-10 sm:py-14 ${i === 1 ? "bg-ink" : i === 2 ? "bg-cream border border-line" : "bg-banana"}`}>
              <Phone src={f.src} alt={f.alt} sizes="(max-width: 640px) 240px, 280px" className="w-[230px] sm:w-[270px]" />
            </div>
          </div>
        ))}

        <div className="grid gap-5 lg:grid-cols-2">
          <article className="flex flex-col rounded-[2rem] bg-banana-soft overflow-hidden">
            <div className="p-7 sm:p-10">
              <h2 className="text-3xl font-extrabold tracking-tight text-ink text-balance">Un coach que te contesta a las 11 de la noche.</h2>
              <p className="mt-3 text-ink/80 leading-relaxed text-pretty max-w-[52ch]">Pregúntale qué cambiar si te duele el hombro, si no hay máquina libre o si te estancaste. Conoce tu plan y tus entrenos.</p>
              <p className="mt-3 text-sm text-ink/70 text-pretty">Es IA: puede equivocarse y no sustituye consejo médico.</p>
            </div>
            <div className="mt-auto h-[300px] overflow-hidden px-10"><Phone src="/landing/coach.png" alt="Chat con el Coach Banana" sizes="280px" className="mx-auto w-[260px]" /></div>
          </article>
          <article className="flex flex-col rounded-[2rem] bg-ink text-white overflow-hidden">
            <div className="p-7 sm:p-10">
              <h2 className="text-3xl font-extrabold tracking-tight text-balance">Vuelves mañana porque engancha.</h2>
              <p className="mt-3 text-white/80 leading-relaxed text-pretty max-w-[52ch]">Rachas, niveles, retos de 30 días y una comunidad donde compartes tus entrenos al estilo Strava. Constancia sin fuerza de voluntad.</p>
              <p className="mt-3 text-sm text-white/70">Captura con perfiles de demostración.</p>
            </div>
            <div className="mt-auto h-[300px] overflow-hidden px-10"><Phone src="/landing/comunidad.png" alt="Comunidad de Banana Burn con entrenos compartidos" sizes="280px" className="mx-auto w-[260px]" /></div>
          </article>
        </div>
        <p className="text-sm text-muted">Capturas reales de la app en modo demo, con datos de ejemplo.</p>
      </section>

      {/* 6. COMPARACIÓN honesta */}
      <section id="comparar" className="mx-auto max-w-6xl px-4 sm:px-6 pt-24 scroll-mt-20">
        <div className="max-w-3xl">
          <h2 className={H2}>Lo que te da cada opción, sin adornos.</h2>
          <p className={LEAD}>Un entrenador en persona es lo mejor para corregir tu técnica. Banana Burn te da casi todo lo demás todos los días, en español y con tu comida, por mucho menos de lo que cuesta un entrenador cada mes.</p>
        </div>
        <p aria-hidden className="mt-8 flex items-center gap-1.5 text-sm font-semibold text-muted md:hidden">Desliza la tabla para ver las otras opciones <ArrowRight weight="bold" className="size-4" /></p>
        <div tabIndex={0} role="region" aria-label="Tabla comparativa" className="relative mt-3 md:mt-10 overflow-x-auto rounded-3xl border border-line bg-white focus:outline-none focus-visible:ring-4 focus-visible:ring-banana">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <caption className="sr-only">Comparación de Banana Burn con un entrenador personal, apps extranjeras y un PDF de rutina</caption>
            <thead>
              <tr className="border-b border-line text-sm font-bold text-ink">
                <td className="sticky left-0 z-10 bg-white p-4 w-[34%]" />
                {COLS.map((c, i) => <th key={c} scope="col" className={`p-4 text-center leading-tight ${i === 0 ? "bg-banana" : "text-muted"}`}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([f, ...vals]) => (
                <tr key={f} className="border-b border-line last:border-0">
                  <th scope="row" className="sticky left-0 z-10 bg-white p-4 text-[15px] font-semibold text-ink text-pretty">{f}</th>
                  {vals.map((v, i) => (
                    <td key={i} className={`p-4 text-center ${i === 0 ? "bg-banana/15" : ""}`}>
                      <span className="inline-flex justify-center">{f === PAY_ROW ? <span className={`text-sm ${i === 0 ? "font-extrabold text-ink" : "font-semibold text-muted"}`}>{v}</span> : <MarkCell v={v} strong={i === 0} />}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 7. SEGMENTO GLP-1 */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-24">
        <Link href="/glp1" data-cta="glp1-banda" className="group grid gap-6 sm:grid-cols-[auto_1fr] lg:grid-cols-[auto_1fr_auto] items-center rounded-[2rem] border-2 border-ink bg-white p-6 sm:p-10 transition-shadow duration-200 hover:shadow-lift focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-banana">
          <span className="grid place-items-center size-16 rounded-2xl bg-banana text-ink"><ShieldCheck weight="duotone" aria-hidden className="size-9" /></span>
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">¿Usas Ozempic o Mounjaro? Protege tu músculo.</h2>
            <p className="mt-3 text-lg text-muted max-w-2xl text-pretty">Banana Shield: fuerza y proteína pensadas para personas en GLP-1, con modo suave en tu día de inyección y porciones que sí te entran.</p>
          </div>
          <span className="inline-flex items-center gap-2 font-bold text-ink sm:col-start-2 lg:col-start-auto">Conocer Banana Shield <ArrowRight weight="bold" className="size-5 transition-transform duration-200 ease-[cubic-bezier(.23,1,.32,1)] group-hover:translate-x-1" /></span>
        </Link>
      </section>

      {/* 8. FUNDADOR: autoridad y cercanía, sin testimonios inventados */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-24">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end rounded-[2rem] bg-ink text-white p-8 sm:p-12">
          <div>
            <MonkeyBanana aria-hidden className="size-12 text-banana" />
            <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-balance">De 94 a 85 kg antes del 31 de diciembre. En público.</h2>
            <p className="mt-4 text-lg text-white/80 leading-relaxed text-pretty max-w-[60ch]">Soy Andrés, de San José, Costa Rica, y soy el usuario #1 de Banana Burn. La construí porque ninguna app me decía qué hacer hoy en el gym, en español y con la comida que como todos los días.</p>
            <p className="mt-4 text-white/80 leading-relaxed text-pretty max-w-[60ch]">Banana Burn está en beta: la estamos puliendo con sus primeros usuarios. Lo que me escribas a <a href="mailto:hola@bananaburn.app" className="font-semibold text-banana underline underline-offset-2">hola@bananaburn.app</a> me llega directo.</p>
          </div>
          <dl className="grid grid-cols-3 divide-x divide-white/15 border-t border-white/15 pt-6">
            {[["−9 kg", "meta"], ["4 días", "de gym"], ["185 g", "proteína al día"]].map(([v, l]) => (
              <div key={l} className="px-4 first:pl-0 last:pr-0 flex flex-col-reverse">
                <dt className="mt-1 text-sm text-white/75">{l}</dt>
                <dd className="text-2xl sm:text-3xl font-extrabold text-banana tabular-nums"><span className="whitespace-nowrap">{v}</span></dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 9. PRECIOS con anual anclado + reversión de riesgo */}
      <section id="precios" className="mx-auto max-w-6xl px-4 sm:px-6 pt-24 scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className={H2}>Elige tu plan. El anual sale a mitad de precio.</h2>
          <p className="mt-4 text-lg text-muted text-pretty">Los dos incluyen tu rutina diaria, la progresión automática y el coach IA. Con el pago anual ahorras {SAVE} %.</p>
        </div>
        <Pricing />
      </section>

      {/* 10. OBJECIONES */}
      <Faq id="faq" items={FAQ} />

      {/* 11. CTA FINAL */}
      <section data-sticky-hide className="mx-auto max-w-6xl px-4 sm:px-6 pt-24">
        <div className="rounded-[2rem] bg-banana px-6 py-14 sm:p-16 text-center">
          <Target weight="duotone" aria-hidden className="mx-auto size-12 text-ink" />
          <h2 className={`${H2} mt-4 max-w-3xl mx-auto`}>Mañana entras al gym sabiendo exactamente qué hacer.</h2>
          <Link href={SIGNUP} data-cta="final" className="mt-8 btn-primary h-14 px-8 text-base">Crear mi plan <ArrowRight className="size-5" /></Link>
          <p className="mt-4 text-sm font-semibold text-ink/80">Desde {FROM} al mes con el plan anual. Cancela cuando quieras.</p>
        </div>
      </section>

      <StickyCta note={`Tu plan en 2 minutos. Desde ${FROM} al mes.`}><Link href={SIGNUP} data-cta="sticky" className="btn-primary h-12 px-5 shrink-0">Crear mi plan <ArrowRight className="size-4" /></Link></StickyCta>
    </>
  );
}

