import Link from "next/link";
import { ArrowRight, CalendarCheck, CheckCircle, List, ShieldCheck, TrendUp } from "@/components/icons";
import { SafeImage } from "@/components/safe-image";
import { Phone } from "@/components/phone";
import { COACHES, seasonCoachId } from "@/lib/coaches";
import { usd } from "@/lib/challenges";
import { SEASONS_T1, SPORTS, canEnroll, longDate, seasonStatus, type SportId } from "@/lib/seasons";
import { Faq, Marker } from "../parts";
import { faqJsonLd, ldScript, social } from "../seo";
import { SIGNUP } from "../content";

const TRIAL_CTA = "Empieza 7 días gratis";

// Página pública de las temporadas deportivas (0048). Fechas reales de la Temporada 1; sin contadores ni urgencia falsa.
export const revalidate = 3600;

const TITLE = "Temporadas deportivas: running, raquetas y cross training";
const DESCRIPTION = "Programas de 8 semanas con fechas oficiales para running, tenis y pádel, y cross training. Fuerza y potencia acomodadas a tus días de deporte, en español.";

export const metadata = { title: TITLE, description: DESCRIPTION, ...social({ title: `${TITLE} | Banana Burn`, description: DESCRIPTION, path: "/temporadas", og: { t: "Temporadas deportivas", s: "Running, raquetas y cross training: 8 semanas con fechas oficiales." } }) };

const SHOWN: { sport: SportId; sex: string }[] = [{ sport: "running", sex: "m" }, { sport: "raquetas", sex: "f" }, { sport: "cross", sex: "m" }];
const WHAT: Record<SportId, string[]> = {
  running: ["Fuerza de piernas y cadera para correr con menos lesiones", "Potencia y rigidez del tobillo para una zancada más eficiente", "Tus carreras largas y clave quedan libres de piernas pesadas"],
  raquetas: ["Desplazamientos laterales y frenadas más rápidos", "Hombro, codo y muñeca más fuertes para tu brazo dominante", "Rotación del tronco para golpear con más potencia"],
  cross: ["Fuerza base y técnica de levantamientos con escalas", "Acondicionamiento sin repetir lo que ya haces en el box", "Evitas los movimientos que no quieres hacer"],
};

const STEPS = [
  [List, "Responde el cuestionario", "Tu nivel, tus días de deporte, cuánto tiempo tienes, tu equipo, tus molestias y si tienes una competencia."],
  [CalendarCheck, "Recibe tu semana", "De 2 a 4 sesiones de 30, 45 o 60 minutos. Nada pesado de piernas el día antes de tus días clave, y recuperación el día después."],
  [TrendUp, "Entrena 8 semanas", "Base, descarga en la semana 4, potencia y una semana final para afinar. Si tienes una competencia, bajamos la carga los días antes."],
  [ShieldCheck, "Tu app cambia contigo", "Tu coach con ropa de tu deporte, consejos y comida pensados para tu temporada, y tu opinión arma la siguiente."],
] as const;

const faq = () => {
  const s = SEASONS_T1[0];
  return [
    ["¿Cuándo empieza?", `La Temporada 1 va del ${longDate(s.startsOn)} al ${longDate(s.endsOn)}. Las inscripciones cierran el ${longDate(s.enrollUntil)}, al terminar la segunda semana.`],
    ["¿Cuánto cuesta?", `Un pago único por temporada: Running ${usd(SEASONS_T1[0].priceMinor)}, Raquetas ${usd(SEASONS_T1[1].priceMinor)} y Cross Training ${usd(SEASONS_T1[2].priceMinor)}, en dólares. Se suma a tu plan o a tu prueba gratis. El plan anual incluye 1 temporada gratis por cada año pagado.`],
    ["¿Reemplaza mis entrenos de deporte?", "No. Tus carreras, partidos o clases siguen igual. La temporada agrega la fuerza y la potencia que te faltan, en los días que te quedan libres."],
    ["¿Puedo tener dos temporadas a la vez?", "No. Solo una temporada activa por persona, para que tu semana no se sobrecargue."],
    ["¿Y si tengo una molestia o lesión?", "Marcas la zona en el cuestionario y cambiamos los ejercicios que la cargan. Eso no es un diagnóstico: si hay dolor, consulta a un profesional antes de empezar."],
    ["¿Qué pasa cuando termina?", "Te quedas con tu progreso. La siguiente temporada llega con ejercicios nuevos, armados con lo que más gustó y lo que la gente cambió."],
  ] as const;
};

export default function TemporadasLanding() {
  const today = new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 10);
  const FAQ = faq();
  const season = SEASONS_T1[0];
  const enrollmentOpen = canEnroll(season, today);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={ldScript(faqJsonLd(FAQ))} />
      <section className="bg-banana">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-16 pb-12">
        <p className="chip h-8 w-fit bg-ink text-banana">Temporada 1</p>
        <h1 className="mt-4 max-w-3xl text-[2.4rem] leading-[1.05] sm:text-6xl font-extrabold tracking-[-0.035em] text-ink text-balance">Entrena para <Marker>tu deporte</Marker><br /> no solo para el gym</h1>
        <p className="mt-5 max-w-2xl text-lg sm:text-xl text-body leading-relaxed text-pretty">8 semanas con fechas oficiales para running, raquetas o cross training. Trabaja fuerza y potencia en tus días libres, sin desplazar tus carreras, partidos o clases.</p>
        <p className="mt-5 font-bold text-ink">{enrollmentOpen ? "Inscripciones hasta el " : "Inscripciones cerradas desde el "}<time dateTime={season.enrollUntil}>{longDate(season.enrollUntil)}</time>.</p>
        <p className="mt-2 text-sm text-body">Del {longDate(season.startsOn)} al {longDate(season.endsOn)}. El calendario es el mismo para todos.</p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
          <Link href={SIGNUP} data-cta="temporadas-hero" className="btn-primary h-14 px-7 text-base w-full sm:w-auto">{TRIAL_CTA} <ArrowRight className="size-5" /></Link>
          <a href="#deportes" className="tap font-semibold text-ink underline decoration-line decoration-2 underline-offset-4 hover:decoration-ink">Ver las temporadas</a>
        </div>
        <p className="mt-3 text-sm text-ink">Sin tarjeta. Cancelas cuando quieras.</p>
        <Link href={SIGNUP} className="tap mt-1 inline-flex items-center text-sm font-semibold text-ink underline underline-offset-4">Continuar sin tarjeta</Link>
        </div>
      </section>

      <section id="deportes" className="mx-auto max-w-6xl px-4 sm:px-6 py-12" aria-labelledby="elige-temporada">
        <h2 id="elige-temporada" className="text-3xl font-extrabold tracking-tight text-ink">Elige tu deporte</h2>
        <p className="mt-3 text-body">Un pago único en USD por temporada. Necesitas un plan activo de Banana Burn o tu prueba gratis; la temporada se compra aparte.</p>
        <div className="mt-5 rounded-3xl border border-line bg-banana-soft p-5 text-ink">
          <p className="font-extrabold">El plan anual incluye 1 temporada deportiva gratis</p>
          <p className="mt-1 text-sm">Por cada año pagado. Si ya tienes un plan anual vigente y no has usado tu temporada incluida, puedes elegirla sin pagar de nuevo.</p>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
        {SHOWN.map(({ sport, sex }) => {
          const info = SPORTS[sport];
          const s = SEASONS_T1.find((x) => x.sport === sport)!;
          const coach = COACHES[seasonCoachId(sport, sex)];
          const open = canEnroll(s, today) && seasonStatus(s, today) !== "terminada";
          return (
            <article key={sport} className="card overflow-hidden flex flex-col">
              <div className="relative aspect-[4/3]" style={{ backgroundColor: info.accentSoft }}>
                <SafeImage src={coach.hello} alt={`${coach.name} con ropa de ${info.name.toLowerCase()}`} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-contain object-bottom p-3 mix-blend-multiply" />
              </div>
              <div className="flex flex-1 flex-col gap-3 p-5">
                <span className="chip h-7 w-fit text-white" style={{ backgroundColor: info.accent }}>{info.mode}</span>
                <h2 className="text-2xl font-extrabold tracking-tight text-ink">{info.name}</h2>
                <p className="text-body text-pretty">{info.tagline}</p>
                <ul className="space-y-2 text-sm text-body">{WHAT[sport].map((w) => <li key={w} className="flex gap-2"><CheckCircle weight="duotone" className="mt-0.5 size-5 shrink-0" style={{ color: info.accent }} />{w}</li>)}</ul>
                <div className="mt-auto border-t border-line pt-3">
                  <p className="text-3xl font-extrabold tabular-nums text-ink">{usd(s.priceMinor)} <span className="text-sm font-semibold text-muted">pago único</span></p>
                  <p className="text-sm text-muted">{open ? `Inscripciones hasta el ${longDate(s.enrollUntil)}` : "Inscripciones cerradas"}</p>
                  {open && <Link href={`/app/temporadas/${s.slug}`} data-cta={`temporadas-comprar-${sport}`} className="tap mt-3 flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-line px-4 text-sm font-bold text-ink hover:bg-banana-soft">Comprar {info.name}<ArrowRight aria-hidden className="size-5 shrink-0" /></Link>}
                </div>
              </div>
            </article>
          );
        })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-16" aria-labelledby="run-plus">
        <div className="grid items-center gap-8 rounded-[2.25rem] bg-[#FFEDD5] p-7 sm:p-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 id="run-plus" className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">La Temporada Running trae Banana Run completo</h2>
            <p className="mt-4 text-body text-pretty">Además de la fuerza: tu plan de carrera hasta tu 5K, 10K, 21K, 42K o trail, tus ritmos, sesiones guiadas con voz, tabla de ritmos y técnica de carrera.</p>
            <Link href="/running" data-cta="temporadas-running" className="tap mt-6 inline-flex min-h-12 items-center gap-2 font-semibold text-ink underline underline-offset-4">Conoce Banana Run <ArrowRight className="size-4" /></Link>
          </div>
          <div className="mx-auto flex w-full max-w-[420px] justify-center gap-4"><Phone src="/landing/running-plan.webp" alt="Plan de carrera con km por semana y tus ritmos" sizes="200px" className="w-[190px]" /><Phone src="/landing/running-guiada.webp" alt="Modo carrera km por km" sizes="200px" className="mt-10 hidden w-[180px] sm:block" /></div>
        </div>
      </section>

      <section className="bg-cream py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">Cómo funciona</h2>
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([Icon, t, d], k) => (
              <li key={t} className="card p-5 space-y-2">
                <span className="grid size-11 place-items-center rounded-2xl bg-banana text-ink"><Icon weight="duotone" className="size-6" /></span>
                <h3 className="font-extrabold text-ink">{k + 1}. {t}</h3>
                <p className="text-sm text-body text-pretty">{d}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-2xl text-body text-pretty">Para entrenarla necesitas tu plan de Banana Burn o la prueba gratis. <b className="text-ink">El plan anual incluye 1 temporada deportiva gratis</b> por cada año pagado.</p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <Faq items={FAQ} id="faq-temporadas" />
        <div className="mt-8 rounded-3xl bg-banana p-6">
          <h2 className="text-2xl font-extrabold text-ink">Prueba tu plan antes de sumar una temporada</h2>
          <Link href={SIGNUP} data-cta="temporadas-final" className="btn-primary mt-5 min-h-12">{TRIAL_CTA} <ArrowRight aria-hidden className="size-5" /></Link>
          <p className="mt-3 text-sm text-ink">Sin tarjeta. Cancelas cuando quieras. La prueba no incluye la compra de una temporada.</p>
          <Link href={SIGNUP} className="tap mt-1 inline-flex items-center text-sm font-semibold text-ink underline underline-offset-4">Continuar sin tarjeta</Link>
        </div>
      </section>
    </>
  );
}
