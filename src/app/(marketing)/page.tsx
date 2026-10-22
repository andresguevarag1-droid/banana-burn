import Link from "next/link";
import { ArrowRight, Banana, BananaFlame, Barbell, BowlFood, BrandIcon, Brain, Check, DeviceMobile, Lock, Moon, Repeat, ShieldCheck, TrendDown, X } from "@/components/icons";
import { Phone } from "@/components/phone";
import { Pricing } from "@/components/pricing";
import { PLANS, perMonthAnnual, usd } from "@/lib/plans";
import { DAY_NAMES, planWeek } from "@/lib/engine";
import { Faq, Marker } from "./parts";

const [ENTRENO, COMPLETO] = PLANS;
const FROM = usd(perMonthAnnual(ENTRENO));

const PILLARS = [
  { icon: Barbell, t: "Fuerza que quema", d: "4 días de básicos (sentadilla, banca, peso muerto, dominadas) cerca del fallo, tempo 3-1-1. Pierdes grasa sin perder músculo." },
  { icon: Repeat, t: "Nunca la misma rutina", d: "Cada día es distinto al de ayer y al de mañana, y los accesorios rotan cada semana." },
  { icon: Brain, t: "IA que se adapta", d: "Si subiste reps, sube el peso. Si te estancaste, ajusta. Lee tu peso semanal y corrige tus calorías sola." },
  { icon: BowlFood, t: "Comida de aquí", d: "Gallo pinto, casado, plátano, pollo y frijoles. Proteína de 1,6 a 2,2 g/kg y carbos antes de entrenar." },
  { icon: Moon, t: "Recupera en serio", d: "Sueño de 7 a 9 h y de 8 a 12 mil pasos. Te recuerda pesarte y medirte en el momento justo." },
  { icon: BananaFlame, t: "Engancha como juego", d: "XP, niveles, rachas, récords personales y retos semanales que te hacen volver." },
];

const COMPARE: [string, boolean, boolean][] = [
  ["100 % en español latino", true, false],
  ["Rutina distinta cada día, sin repetir", true, false],
  ["Progresión automática de cargas", true, true],
  ["Coach IA que ajusta calorías con tu peso real", true, false],
  ["Base de comidas de Costa Rica y LATAM", true, false],
  ["Pago con SINPE Móvil, tarjeta o Apple Pay", true, false],
];

const FAQ = [
  ["¿Necesito experiencia en el gym?", "No. Cada ejercicio trae animación, técnica y errores comunes. La primera semana es de calibración: el app aprende tus pesos."],
  ["¿Cuánto peso voy a bajar?", "Un ritmo sano es entre 0,5 y 1 % de tu peso por semana. Banana Burn mide tu tendencia real y ajusta para que llegues a tu meta sin perder músculo."],
  ["¿Sirve si entreno en casa?", "Sí. Eliges el equipo que tienes y el plan cambia a variantes con mancuernas, bandas o peso corporal."],
  ["¿Mis datos están seguros?", "Tus datos de salud son privados, cifrados y solo tuyos. Puedes exportarlos o borrar tu cuenta cuando quieras (Ley 8968)."],
  ["¿Cuánto cuesta?", `${ENTRENO.name}: ${usd(ENTRENO.price.mes)} al mes o ${usd(ENTRENO.price.anual)} al año. ${COMPLETO.name}: ${usd(COMPLETO.price.mes)} al mes o ${usd(COMPLETO.price.anual)} al año. Con el plan anual pagas la mitad.`],
  ["¿Cómo pago?", "Tarjeta, SINPE Móvil o Apple Pay. Cancelas con un toque, sin letra pequeña."],
] as const;

const SCREENS = [
  ["/landing/hoy.png", BananaFlame, "Hoy", "Tu rutina del día, tu racha y tus metas de proteína, agua y pasos de un vistazo."],
  ["/landing/entreno.png", Barbell, "En el gym", "Te dice cuánto levantar en cada serie, cuenta tu descanso y celebra tus récords."],
  ["/landing/nutricion.png", BowlFood, "Comida tica", "Registra gallo pinto o un casado en 2 toques y ve cuánto te queda del día."],
  ["/landing/progreso.png", TrendDown, "Progreso real", "Tu tendencia de peso y tu fuerza. La IA ajusta calorías cada semana."],
] as const;

const H2 = "text-4xl sm:text-5xl font-extrabold tracking-tight text-ink text-balance";

export default function Landing() {
  const week = planWeek(0);
  return (
    <>
      {/* HERO: cabe en el primer pantallazo de escritorio */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-16 lg:pt-0 pb-16 lg:pb-0 grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-10 items-center lg:min-h-[min(calc(100dvh-4rem),760px)]">
        <div className="animate-rise lg:py-10">
          <h1 className="text-[2.75rem] leading-[1.02] sm:text-6xl lg:text-[3.6rem] font-extrabold tracking-[-0.035em] text-ink text-balance">
            Quema grasa. Gana fuerza. <Marker>Cada día distinto.</Marker>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted max-w-[34rem] leading-relaxed text-pretty">
            Tu entrenador personal con IA te dice <b className="text-ink">qué te toca hoy en el gym</b>, cuánto levantar y qué comer. Y se ajusta solo cada semana según tus resultados.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link href="/entrar?modo=registro" className="btn-primary h-14 px-7 text-base w-full sm:w-auto">Crear mi plan <ArrowRight className="size-5" /></Link>
            <a href="#app" className="tap font-semibold text-ink underline decoration-line decoration-2 underline-offset-4 transition-[text-decoration-color] duration-150 hover:decoration-ink">Ver cómo funciona</a>
          </div>
          <p className="mt-5 text-sm text-muted">Desde {FROM} al mes. Listo en 2 minutos y cancelas cuando quieras.</p>
        </div>

        <div className="relative isolate grid place-items-center py-10 sm:py-12 lg:py-0 lg:h-[min(calc(100dvh-8rem),680px)]">
          <div aria-hidden className="absolute inset-x-0 inset-y-0 sm:inset-x-8 lg:inset-x-0 lg:inset-y-6 -z-10 rounded-[2rem] bg-banana" />
          <Banana aria-hidden weight="fill" className="absolute right-6 bottom-6 -z-10 size-40 text-ink opacity-[.07] rotate-12" />
          <Phone src="/landing/entreno.png" alt="" className="hidden md:block absolute w-[190px] left-[8%] top-[16%] -rotate-6" />
          <Phone src="/landing/hoy.png" alt="Pantalla Hoy de Banana Burn con la rutina del día" className="relative w-[240px] sm:w-[260px] lg:w-[clamp(220px,calc((100dvh-12rem)*0.44),280px)] md:translate-x-14" priority />
        </div>
      </section>

      {/* PRUEBAS RÁPIDAS */}
      <section className="mt-6 lg:mt-10 border-y border-line bg-cream">
        <ul className="mx-auto max-w-6xl px-4 sm:px-6 py-5 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm font-semibold text-muted">
          {([[Banana, "Español real, no traducido"], [BowlFood, "Comida tica y latina"], [DeviceMobile, "SINPE Móvil"], [Barbell, "Gym o casa"], [Lock, "Datos privados"]] as const).map(([I, t]) => (
            <li key={t} className="inline-flex items-center gap-2"><I weight="duotone" className="size-5 text-banana-ink" />{t}</li>
          ))}
        </ul>
      </section>

      {/* LA APP POR DENTRO: galería de capturas reales */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-24">
        <h2 className={`${H2} max-w-2xl`}>Todo lo que necesitas para bajar de peso, en tu bolsillo.</h2>
        <div tabIndex={0} role="region" aria-label="Pantallas de la app" className="mt-12 -mx-4 px-4 flex gap-6 overflow-x-auto snap-x snap-mandatory pb-6 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible rounded-3xl focus:outline-none focus-visible:ring-4 focus-visible:ring-banana">
          {SCREENS.map(([src, I, t, d]) => (
            <figure key={src} className="snap-center shrink-0 w-[250px] lg:w-auto">
              <Phone src={src} alt={`Pantalla ${t} de Banana Burn`} />
              <figcaption className="mt-5">
                <p className="flex items-center gap-2 text-lg font-extrabold text-ink"><I weight="duotone" className="size-5 text-banana-ink" />{t}</p>
                <p className="mt-1 text-muted leading-relaxed text-pretty">{d}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* MÉTODO: lista editorial, sin tarjetas */}
      <section id="metodo" className="mx-auto max-w-6xl px-4 sm:px-6 pt-24 scroll-mt-20 grid gap-10 lg:grid-cols-[1fr_1.7fr] lg:gap-16">
        <div className="lg:sticky lg:top-24 self-start">
          <h2 className={`${H2} lg:text-[2.6rem] lg:leading-[1.1]`}>Ciencia de recomposición, explicada como un compa.</h2>
          <p className="mt-4 text-lg text-muted text-pretty max-w-md">Lo que funciona para bajar grasa sin perder músculo, convertido en una rutina que sabes seguir.</p>
        </div>
        <dl className="grid sm:grid-cols-2 gap-x-10">
          {PILLARS.map(({ icon: Icon, t, d }) => (
            <div key={t} className="border-t border-line py-6">
              <dt className="flex items-center gap-3 text-lg font-extrabold text-ink"><Icon weight="duotone" className="size-6 shrink-0 text-banana-ink" />{t}</dt>
              <dd className="mt-2 text-muted leading-relaxed text-pretty">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* SEMANA */}
      <section id="app" className="mx-auto max-w-6xl px-4 sm:px-6 pt-24 scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <h2 className={`${H2} max-w-2xl`}>Abres la app y sabes exactamente qué hacer.</h2>
          <p className="text-muted max-w-xs text-pretty">Semana real generada por el motor de Banana Burn. La siguiente, los accesorios cambian.</p>
        </div>
        <div tabIndex={0} role="region" aria-label="Semana de ejemplo" className="mt-10 -mx-4 px-4 sm:mx-0 sm:px-0 flex sm:grid sm:grid-cols-7 gap-3 overflow-x-auto snap-x pb-2 rounded-3xl focus:outline-none focus-visible:ring-4 focus-visible:ring-banana">
          {week.map((d) => (
            <div key={d.dow} className={`snap-start shrink-0 w-[200px] sm:w-auto rounded-3xl p-4 border ${d.tpl ? (d.tag === "Fuerza" ? "bg-banana border-banana" : d.tag === "Volumen" ? "bg-white border-line" : "bg-cream border-line") : "bg-transparent border-dashed border-line"}`}>
              <p className="text-xs font-bold uppercase tracking-wider text-ink/75">{DAY_NAMES[d.dow]}</p>
              <BrandIcon name={d.icon} className="mt-3 size-7 text-ink" />
              <p className="mt-2 font-extrabold text-ink leading-tight text-balance">{d.name}</p>
              <p className="text-xs font-semibold text-ink/75">{d.tag}</p>
              <ul className="mt-3 space-y-1.5 text-[13px] leading-snug text-ink/80">
                {d.exercises.slice(0, 4).map((e) => <li key={e.id}>{e.name}</li>)}
                {!d.exercises.length && <li>{d.cardio}</li>}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* COMPARACIÓN */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-24 grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16 items-start">
        <div>
          <h2 className={H2}>Las apps gringas no te entienden.</h2>
          <p className="mt-4 text-lg text-muted text-pretty max-w-md">Están pensadas para otro idioma, otra comida y otra forma de pagar. Banana Burn nació aquí.</p>
        </div>
        <div className="rounded-3xl border border-line bg-white overflow-hidden">
          <div className="grid grid-cols-[1fr_5.5rem_5.5rem] sm:grid-cols-[1fr_8rem_8rem] text-sm font-bold text-ink border-b border-line">
            <div className="p-4" />
            <div className="p-4 grid place-items-center text-center bg-banana leading-tight">Banana Burn</div>
            <div className="p-4 grid place-items-center text-center text-muted leading-tight">Otras apps</div>
          </div>
          {COMPARE.map(([f, a, b]) => (
            <div key={f} className="grid grid-cols-[1fr_5.5rem_5.5rem] sm:grid-cols-[1fr_8rem_8rem] text-[15px] border-b border-line last:border-0">
              <div className="p-4 text-ink text-pretty">{f}</div>
              <div className="p-4 grid place-items-center bg-banana/15">{a ? <Check weight="bold" className="size-5 text-peel" aria-label="Sí" /> : <X weight="bold" className="size-5 text-faint" aria-label="No" />}</div>
              <div className="p-4 grid place-items-center">{b ? <Check weight="bold" className="size-5 text-peel" aria-label="Sí" /> : <X weight="bold" className="size-5 text-faint" aria-label="No" />}</div>
            </div>
          ))}
        </div>
      </section>

      {/* GLP-1 */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-24">
        <Link href="/glp1" className="group grid gap-6 sm:grid-cols-[auto_1fr] lg:grid-cols-[auto_1fr_auto] items-center rounded-[2rem] border-2 border-ink bg-white p-6 sm:p-10 transition-shadow duration-200 hover:shadow-lift focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-banana">
          <span className="grid place-items-center size-16 rounded-2xl bg-banana text-ink"><ShieldCheck weight="duotone" className="size-9" /></span>
          <div>
            <p className="eyebrow">Banana Shield</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">¿Usas Ozempic o Mounjaro? Protege tu músculo.</h2>
            <p className="mt-3 text-lg text-muted max-w-2xl text-pretty">Fuerza y proteína pensadas para personas en GLP-1: modo suave en días de inyección, porciones pequeñas y tu escudo de músculo.</p>
          </div>
          <span className="inline-flex items-center gap-2 font-bold text-ink sm:col-start-2 lg:col-start-auto">Conocer Banana Shield <ArrowRight weight="bold" className="size-5 transition-transform duration-200 ease-[cubic-bezier(.23,1,.32,1)] group-hover:translate-x-1" /></span>
        </Link>
      </section>

      {/* RETO DEL FUNDADOR */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-24">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end rounded-[2rem] bg-ink text-white p-8 sm:p-12">
          <div>
            <p className="eyebrow text-banana">El reto del fundador</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-balance">De 94 a 85 kg antes del 31 de diciembre. En público.</h2>
            <p className="mt-4 text-lg text-white/75 leading-relaxed text-pretty max-w-[60ch]">Soy Andrés, de San José, y soy el usuario #1 de Banana Burn. La construí porque ninguna app me decía qué hacer hoy en el gym, en español y con la comida de aquí. Sígueme el reto: cada semana comparto mi peso, mi fuerza y lo que estoy comiendo.</p>
          </div>
          <dl className="grid grid-cols-3 divide-x divide-white/15 border-t border-white/15 pt-6">
            {[["−9 kg", "meta"], ["4 días", "de gym"], ["185 g", "proteína al día"]].map(([v, l]) => (
              <div key={l} className="px-4 first:pl-0 last:pr-0">
                <dt className="sr-only">{l}</dt>
                <dd className="text-2xl sm:text-3xl font-extrabold text-banana tabular-nums whitespace-nowrap">{v}</dd>
                <dd className="mt-1 text-sm text-white/70">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* PRECIOS */}
      <section id="precios" className="mx-auto max-w-6xl px-4 sm:px-6 pt-24 scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className={H2}>Un plan para cada meta. Menos que una mensualidad de gym.</h2>
        </div>
        <Pricing />
      </section>

      <Faq id="faq" items={FAQ} />

      {/* CTA FINAL */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-24">
        <div className="rounded-[2rem] bg-banana px-6 py-14 sm:p-16 text-center">
          <h2 className={`${H2} max-w-3xl mx-auto`}>Mañana entras al gym sabiendo exactamente qué hacer.</h2>
          <Link href="/entrar?modo=registro" className="mt-8 btn-primary h-14 px-8 text-base">Crear mi plan <ArrowRight className="size-5" /></Link>
          <p className="mt-4 text-sm font-semibold text-ink/75">Desde {FROM} al mes con el plan anual. Cancelas cuando quieras.</p>
        </div>
      </section>
    </>
  );
}
