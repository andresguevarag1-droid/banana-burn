import Link from "next/link";
import { ArrowRight, CalendarCheck, CheckCircle, Flag, Medal, SpeakerHigh, Timer, TrendUp } from "@/components/icons";
import { Phone } from "@/components/phone";
import { SafeImage } from "@/components/safe-image";
import { COACHES, seasonCoachId } from "@/lib/coaches";
import { usd } from "@/lib/challenges";
import { SEASONS_T1, longDate } from "@/lib/seasons";
import { Faq, Marker } from "../parts";
import { faqJsonLd, ldScript, social } from "../seo";
import { FaqCta, SIGNUP, TRIAL_CTA } from "../content";

// Landing para corredores (anuncios de running). Fechas y precio reales de la Temporada Running; capturas reales de la app.
export const revalidate = 3600;

const TITLE = "Banana Run: tu plan de carrera, tus ritmos y tu fuerza para correr";
const DESCRIPTION = "Plan de carrera para 5K, 10K, 21K, 42K o trail, con tus ritmos, sesiones guiadas con voz, tabla de ritmos para el día de la carrera y fuerza en casa o en el gimnasio. En español.";
export const metadata = { title: TITLE, description: DESCRIPTION, ...social({ title: `${TITLE} | Banana Burn`, description: DESCRIPTION, path: "/running", og: { t: "Corre más rápido y sin lesiones", s: "Plan de carrera, ritmos, voz y fuerza para corredores." } }) };

const RUN = SEASONS_T1.find((s) => s.sport === "running")!;

const FEATURES = [
  [CalendarCheck, "Tu plan hasta la línea de salida", "Eliges tu carrera y tu meta. Te armamos las semanas: base, construcción, pico y afinar, con fáciles, tempo, series y tu carrera larga."],
  [TrendUp, "Tus ritmos de verdad", "Calculados con un resultado reciente o con tus mejores tramos con GPS. Te decimos con amabilidad si tu meta es realista para el tiempo que queda."],
  [SpeakerHigh, "Sesiones guiadas con voz", "Cada tramo en grande, lo que falta y tu ritmo contra el objetivo. La voz te avisa cada cambio y cada kilómetro."],
  [Flag, "Listo para el día de la carrera", "Semana de carrera día por día, tabla de ritmos para guardar, calentamiento y modo carrera km por km."],
  [Medal, "Fuerza que no choca con tus carreras", "En casa o en el gimnasio. Nunca piernas pesadas el día de tus series o tu larga, ni el día antes."],
  [Timer, "Técnica y marcas", "Skipping, carioca, saltos de tobillo y estiramientos con la animación de tu coach. Tus mejores 1, 5, 10 y 21 km."],
] as const;

const faq = () => [
  ["¿Sirve si ya tengo un plan de mi club o mi entrenador?", "Sí. Marcas \"Ya tengo plan de carrera\" y los días que haces series o tempo. Banana Burn solo arma tu fuerza, movilidad y técnica alrededor de esos días, sin chocar."],
  ["¿Necesito un reloj?", "No. Registras tus carreras con el GPS de tu teléfono, con la app abierta y la pantalla encendida. Tus recorridos son privados."],
  ["¿Cuánto cuesta?", `La Temporada Running cuesta ${usd(RUN.priceMinor)}, pago único, y se suma a tu plan o a tu prueba gratis. El plan anual incluye 1 temporada gratis. El GPS, tu historial y tus km de la semana vienen en todos los planes.`],
  ["¿Cuándo empieza?", `La Temporada 1 va del ${longDate(RUN.startsOn)} al ${longDate(RUN.endsOn)}, con inscripciones hasta el ${longDate(RUN.enrollUntil)}. Tu plan de carrera arranca el día que eliges tu carrera.`],
  ["¿Para qué distancias?", "5K, 10K, medio maratón, maratón y trail. Desde tu primera carrera hasta bajar tu marca."],
  ["¿Y si me lesiono o me duele algo?", "Marcas tus molestias y cambiamos los ejercicios que cargan esa zona. Si algo duele de forma distinta a la fatiga normal, descansa y consulta a un profesional de salud."],
] as const;

export default function RunningLanding() {
  const FAQ = faq();
  const coach = COACHES[seasonCoachId("running", "m")];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={ldScript(faqJsonLd(FAQ))} />
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.15fr_1fr] animate-rise">
        <div>
          <p className="chip h-8 w-fit bg-ink text-banana">Banana Run</p>
          <h1 className="mt-4 text-[2.4rem] leading-[1.05] sm:text-6xl font-extrabold tracking-[-0.035em] text-ink text-balance">Corre más rápido y <Marker>sin lesiones</Marker></h1>
          <p className="mt-5 max-w-2xl text-lg sm:text-xl text-muted leading-relaxed text-pretty">Tu plan de carrera semana a semana, tus ritmos, sesiones guiadas con voz y la fuerza que te falta, en casa o en el gimnasio. Para tu 5K, 10K, 21K, 42K o trail.</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link href={SIGNUP} data-cta="running-hero" className="btn-primary h-14 px-7 text-base w-full sm:w-auto">{TRIAL_CTA} <ArrowRight className="size-5" /></Link>
            <a href="#como" className="tap font-semibold text-ink underline decoration-line decoration-2 underline-offset-4 hover:decoration-ink">Ver cómo funciona</a>
          </div>
          <p className="mt-5 text-sm font-semibold text-ink">Temporada Running: {usd(RUN.priceMinor)} pago único. Incluida en el plan anual.</p>
        </div>
        <div className="relative mx-auto flex w-full max-w-[480px] items-end justify-center gap-4">
          <Phone src="/landing/running-hub.webp" alt="Banana Run: empieza tu carrera con tu coach en ropa de correr" priority sizes="240px" className="w-[220px] sm:w-[250px]" />
          <Phone src="/landing/running-guiada.webp" alt="Modo carrera: kilómetro 1, ritmo objetivo 5:27 y tu ritmo actual" sizes="200px" className="mb-10 hidden w-[200px] sm:block" />
        </div>
      </section>

      <section id="como" className="bg-cream py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">Todo lo que tu carrera necesita</h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([Icon, t, d]) => (
              <li key={t} className="card space-y-2 p-5">
                <span className="grid size-11 place-items-center rounded-2xl bg-banana text-ink"><Icon weight="duotone" className="size-6" /></span>
                <h3 className="font-extrabold text-ink">{t}</h3>
                <p className="text-sm text-body text-pretty">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="pantallas">
        <h2 id="pantallas" className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">Así se ve en tu teléfono</h2>
        <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-4">
          {[["running-semana", "Tu semana: km contra tu meta, rachas y la cuenta regresiva a tu carrera"], ["running-plan", "Tu plan: km por semana y tus ritmos de fácil, tempo y series"], ["running-ritmos", "Tu tabla de ritmos para el día de la carrera"], ["running-guiada-platanita", "Modo carrera con Coach Platanita: tu ritmo km por km"]].map(([src, alt]) => (
            <figure key={src} className="space-y-2"><Phone src={`/landing/${src}.webp`} alt={alt} sizes="(max-width: 640px) 45vw, 240px" /><figcaption className="text-sm text-body text-pretty">{alt}</figcaption></figure>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid items-center gap-8 overflow-hidden rounded-[2.25rem] bg-ink p-7 text-white sm:p-12 lg:grid-cols-[1fr_1.2fr]">
          <div className="relative mx-auto aspect-square w-full max-w-[320px] rounded-[2rem] bg-[#FFEDD5]"><SafeImage src={coach.hello} alt={`${coach.name} con ropa de correr`} fill sizes="320px" className="object-contain object-bottom p-4 mix-blend-multiply" /></div>
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-balance">Se suma a tu entrenamiento, no lo reemplaza</h2>
            <ul className="mt-6 space-y-3 text-white/85">
              {["Corres con tu club o tu entrenador: armamos la fuerza alrededor de tus días.", "Corres solo: te damos el plan completo con tus ritmos.", "Entrenas en casa o en el gimnasio: la fuerza se adapta a tu equipo.", "Cada carrera con GPS ajusta tu plan: si faltó la larga o te pasaste de km, lo acomodamos."].map((x) => <li key={x} className="flex gap-3"><CheckCircle weight="duotone" className="mt-0.5 size-5 shrink-0 text-banana" />{x}</li>)}
            </ul>
            <p className="mt-6 text-sm font-semibold text-banana">Temporada Running {usd(RUN.priceMinor)}, pago único. Los planes anuales la incluyen gratis.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <Faq items={FAQ} id="faq-running" />
        <div className="mt-8"><FaqCta href={SIGNUP} cta={TRIAL_CTA} /></div>
      </section>
    </>
  );
}
