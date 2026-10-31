import Link from "next/link";
import { ArrowRight, CalendarCheck, CheckCircle, Flag, Medal, SpeakerHigh, Timer, TrendUp } from "@/components/icons";
import { Phone } from "@/components/phone";
import { SafeImage } from "@/components/safe-image";
import { COACHES, seasonCoachId } from "@/lib/coaches";
import { usd } from "@/lib/challenges";
import { SEASONS_T1, longDate } from "@/lib/seasons";
import { StickyCta } from "../sticky-cta";
import { PLANS } from "@/lib/plans";
import { usd2 } from "@/lib/num";
import { Faq } from "../parts";
import { faqJsonLd, ldScript, social } from "../seo";
import { SIGNUP } from "../content";

// Landing para corredores (anuncios de running). Fechas y precio reales de la Temporada Running; capturas reales de la app.
export const revalidate = 3600;

const TITLE = "Banana Run: tu plan de carrera, tus ritmos y tu fuerza para correr";
const DESCRIPTION = "Plan de carrera para 5K, 10K, 21K, 42K o trail, con tus ritmos, sesiones guiadas con voz, tabla de ritmos para el día de la carrera y fuerza en casa o en el gimnasio. En español.";
export const metadata = { title: TITLE, description: DESCRIPTION, ...social({ title: `${TITLE} | Banana Burn`, description: DESCRIPTION, path: "/running", og: { t: "Ritmo con GPS y fuerza para correr", s: "Plan de carrera, ritmos, voz y fuerza para corredores." } }) };

const TRIAL_CTA = "Empieza 7 días gratis";

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
  ["¿Qué incluye la prueba de 7 días?", "Puedes probar tu plan de entrenamiento sin tarjeta. La compra de la Temporada Running no está incluida: se paga aparte. Al terminar, eliges tu plan desde Mi plan."],
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
      <section className="bg-banana">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 pt-6 pb-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <p className="chip h-8 w-fit bg-ink text-banana">Banana Run</p>
          <h1 className="mt-4 text-[2.4rem] leading-[1.05] sm:text-6xl font-extrabold tracking-[-0.035em] text-ink text-balance">Tu ritmo por kilómetro. Fuerza para correr.</h1>
          <p className="mt-4 max-w-2xl text-base sm:text-xl text-body leading-relaxed text-pretty">Mide tu ritmo con el GPS del celular y trabaja fuerza para cuidar tus piernas, en casa o en el gimnasio.</p>
          <div data-sticky-anchor className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href={SIGNUP} data-cta="running-hero" className="btn-primary h-14 px-7 text-base w-full sm:w-auto">{TRIAL_CTA} <ArrowRight aria-hidden className="size-5" /></Link>
          </div>
          <p className="mt-2 text-sm text-ink">Sin tarjeta. Cancelas cuando quieras.</p>
          <Link href={SIGNUP} data-cta="running-sin-tarjeta" className="tap flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4">Continuar sin tarjeta</Link>
          <p className="mt-2 text-sm font-semibold text-ink">Temporada Running: {usd(RUN.priceMinor)} pago único. Incluida en el plan anual.</p>
        </div>
        <div className="relative mx-auto flex w-full max-w-[480px] items-end justify-center gap-4">
          <Phone src="/landing/running-hub.webp" alt="Banana Run: empieza tu carrera con tu coach en ropa de correr" priority sizes="240px" className="w-[220px] sm:w-[250px]" />
          <Phone src="/landing/running-guiada.webp" alt="Modo carrera: kilómetro 1, ritmo objetivo 5:27 y tu ritmo actual" sizes="200px" className="mb-10 hidden w-[200px] sm:block" />
        </div>
      </div>
      </section>

      <section id="como" className="bg-cream py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">Banana Run completo con la Temporada Running</h2>
          <p className="mt-4 max-w-2xl text-body">El GPS, tu historial y tus kilómetros de la semana vienen en todos los planes. La temporada suma el plan de carrera, los ritmos y la fuerza específica para tu 5K, 10K, 21K, 42K o trail.</p>
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
        <p className="mt-3 text-body">Capturas reales con un ejemplo de 21K y meta de 1:55:00. Tu plan y tus ritmos dependen de tu carrera y tu nivel.</p>
        <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-4">
          {[["running-semana", "Tu semana: km contra tu meta, rachas y la cuenta regresiva a tu carrera"], ["running-plan", "Tu plan: km por semana y tus ritmos de fácil, tempo y series"], ["running-ritmos", "Tu tabla de ritmos para el día de la carrera"], ["running-guiada-platanita", "Modo carrera con Coach Platanita: tu ritmo km por km"]].map(([src, alt]) => (
            <figure key={src} className="space-y-2"><Phone src={`/landing/${src}.webp`} alt={alt} sizes="(max-width: 640px) 45vw, 240px" /><figcaption className="text-sm text-body text-pretty">{alt}</figcaption></figure>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid items-center gap-8 overflow-hidden rounded-[2.25rem] bg-ink p-7 text-white sm:p-12 lg:grid-cols-[1fr_1.2fr]">
          <div className="relative mx-auto aspect-square w-full max-w-[320px] rounded-[2rem] bg-banana-soft"><SafeImage src={coach.hello} alt={`${coach.name} con ropa de correr`} fill sizes="320px" className="object-contain object-bottom p-4 mix-blend-multiply" /></div>
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-balance">Se suma a tu entrenamiento, no lo reemplaza</h2>
            <ul className="mt-6 space-y-3 text-white/85">
              {["Corres con tu club o tu entrenador: armamos la fuerza alrededor de tus días.", "Corres solo: te damos el plan completo con tus ritmos.", "Entrenas en casa o en el gimnasio: la fuerza se adapta a tu equipo.", "Cada carrera con GPS ajusta tu plan: si faltó la larga o te pasaste de km, lo acomodamos."].map((x) => <li key={x} className="flex gap-3"><CheckCircle weight="duotone" className="mt-0.5 size-5 shrink-0 text-banana" />{x}</li>)}
            </ul>
            <p className="mt-6 text-sm font-semibold text-banana">Temporada Running {usd(RUN.priceMinor)}, pago único. Los planes anuales la incluyen gratis.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6" aria-labelledby="precio-running">
        <h2 id="precio-running" className="text-3xl font-extrabold text-ink">Una temporada o un año de entrenamiento</h2>
        <p className="mt-3 text-body">Precios en USD. Para entrenar la temporada necesitas un plan activo o tu prueba gratis.</p>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <article className="card p-6">
            <h3 className="text-xl font-extrabold text-ink">Temporada Running</h3>
            <p className="mt-3 text-3xl font-extrabold tabular-nums text-ink">US{usd(RUN.priceMinor)} <span className="text-sm font-semibold">pago único</span></p>
            <p className="mt-3 text-body">Del <time dateTime={RUN.startsOn}>{longDate(RUN.startsOn)}</time> al <time dateTime={RUN.endsOn}>{longDate(RUN.endsOn)}</time>.</p>
            <p className="mt-2 text-sm text-body">Inscripciones hasta el <time dateTime={RUN.enrollUntil}>{longDate(RUN.enrollUntil)}</time>.</p>
            <p className="mt-3 text-body">Incluye Banana Run completo y fuerza organizada alrededor de tus carreras.</p>
            <p className="mt-2 text-sm text-muted"><s>Suscripción al plan de Banana Burn incluida</s></p>
          </article>
          <article className="rounded-3xl bg-ink p-6 text-paper">
            <h3 className="text-xl font-extrabold">Anual: 1 temporada deportiva gratis</h3>
            <p className="mt-3 text-sm">Por cada año pagado. Puedes elegir Running si no has usado tu temporada incluida.</p>
            {PLANS.map((plan) => <p key={plan.id} className="mt-4 font-bold">{plan.name}: <span className="tabular-nums">US{usd2(plan.price.anual)}</span> al año</p>)}
            <p className="mt-4 text-sm">Entreno incluye fuerza y progreso. Entreno + Nutrición agrega calorías, macros y registro de comidas.</p>
            <p className="mt-3 text-sm"><s>Nutrición en el plan Entreno</s></p>
            <Link href="/precios" data-cta="running-precios" className="tap mt-3 inline-flex min-h-11 items-center text-banana underline underline-offset-4">Comparar los planes anuales</Link>
          </article>
        </div>
      </section>

      <section data-sticky-hide className="mx-auto max-w-3xl px-4 pb-36 sm:px-6 md:pb-16">
        <Faq items={FAQ} id="faq-running" />
        <div className="mt-8 rounded-3xl bg-banana p-6">
          <h2 className="text-2xl font-extrabold text-ink">Empieza con tu fuerza. Después elige tu temporada.</h2>
          <Link href={SIGNUP} data-cta="running-final" className="btn-primary mt-5 min-h-12">{TRIAL_CTA}<ArrowRight aria-hidden className="size-5" /></Link>
          <p className="mt-3 text-sm text-ink">Sin tarjeta. La prueba no incluye la compra de la temporada.</p>
          <Link href={SIGNUP} className="tap flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4">Continuar sin tarjeta</Link>
        </div>
      </section>
      <StickyCta note="7 días gratis. Sin tarjeta."><div className="flex flex-col items-center"><Link href={SIGNUP} data-cta="running-sticky" className="btn-primary min-h-12 px-4 text-sm">{TRIAL_CTA}</Link><Link href={SIGNUP} className="flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4">Continuar sin tarjeta</Link></div></StickyCta>
    </>
  );
}
