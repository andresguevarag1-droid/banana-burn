// 0066: página del condominio con tarjeta (piloto Soho Paradisus). Cuenta la app con Coach Banana y El Nuevo en el
// gimnasio del condominio (escenas de Higgsfield, personajes aprobados del libro de marca) y el recorrido con capturas
// reales (AppTour). La oferta: primero se prueba SIN tarjeta (CONDO_TRY_DAYS). Si le gusta, deja la tarjeta y sigue gratis
// con todo incluido hasta el último día; desde el día del cobro, el plan elegido a precio normal. Dos estados: "nuevo"
// (todavía no entra) y "probando" (ya entra sin tarjeta: se le pide la tarjeta para seguir). Libro de marca: tú, sin emojis,
// sin rayas largas, sin cadenas con "·".
import Image from "next/image";
import { AppTour } from "@/app/(marketing)/app-tour";
import { ArrowRight, Barbell, Buildings, ChatCircle, Check, CheckCircle, ForkKnife, Lock, Question, Sparkle, type PhosphorIcon } from "@/components/icons";
import { CONDO_TRY_DAYS } from "@/lib/condos";
import { TECHNIQUE_COUNT } from "@/lib/exercise-frames";
import { PLANS, usd } from "@/lib/plans";
import { CondoCard } from "./condo-card";

const UGC = "https://d8j0ntlcm91z4.cloudfront.net/user_3KlOTMXim7g88SAyF4A03SG6JZ6/";
/** Escenas en un gimnasio de condominio (9:16). */
const SCENE = {
  juntos: `${UGC}hf_20261030_053039_48320df7-cb6a-475f-b521-539b0a30f22c.png`,
  perdido: `${UGC}hf_20261104_011229_1be5f338-0165-4354-bc52-38f1e0b74418.png`,
  celular: `${UGC}hf_20261104_011228_680ad92e-7bd5-4140-b496-1f1a74875c42.png`,
  sentadilla: `${UGC}hf_20261027_222601_4e6e31b5-8b3b-4141-a596-3551a09ebea7.png`,
  flex: `${UGC}hf_20261027_222623_baae04c2-c774-46a3-a330-60f9a66edea3.png`,
};

const H2 = "text-3xl sm:text-4xl font-extrabold tracking-[-0.02em] text-ink text-balance";
const LEAD = "mt-4 text-lg leading-relaxed text-pretty";

function Scene({ src, alt, className = "", priority = false }: { src: string; alt: string; className?: string; priority?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-[1.5rem] bg-banana-soft shadow-[0_18px_40px_-18px_rgba(27,21,5,0.45)] ${className}`}>
      <Image src={src} alt={alt} fill priority={priority} sizes="(min-width: 768px) 360px, 92vw" className="object-cover" />
    </div>
  );
}

function Ticks({ items, pain = false }: { items: string[]; pain?: boolean }) {
  return (
    <ul className="mt-5 space-y-3 text-[16px]">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-3">
          {pain
            ? <span aria-hidden className="mt-2 size-2.5 shrink-0 rounded-full bg-ember" />
            : <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-ink text-banana"><Check weight="bold" className="size-3.5" /></span>}
          <span className="text-pretty">{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function CardCondoLanding({ code, name, freeDay, chargeDay, viewer, cardReady, trying }: {
  code: string; name: string; freeDay: string; chargeDay: string;
  viewer: { email: string | null; demo: boolean; onboarded: boolean } | null; cardReady: boolean;
  /** Ya prueba sin tarjeta: hasta qué día (null: su prueba terminó). */
  trying: { until: string | null } | null;
}) {
  const [entreno, completo] = [PLANS.find((p) => p.id === "entreno")!, PLANS.find((p) => p.id === "completo")!];
  const tryCta = `Probar gratis ${CONDO_TRY_DAYS} días`;
  const btn = (dark: boolean) => `${dark ? "btn-banana" : "btn-primary"} h-14! px-7! text-base!`;
  // Sin cuenta: registro (vuelve aquí ya vinculado). Con cuenta y sin vínculo: el botón la vincula (POST del mismo sitio).
  const Join = ({ dark = false }: { dark?: boolean }) =>
    viewer ? (
      <form action={`/c/${code}/activar`} method="post"><button type="submit" className={btn(dark)}>{tryCta} <ArrowRight weight="bold" className="size-5" /></button></form>
    ) : (
      <a href={`/c/${code}/activar`} className={btn(dark)}>{tryCta} <ArrowRight weight="bold" className="size-5" /></a>
    );
  const train = viewer && !viewer.onboarded ? "Armar mi plan" : "Ir a mi entreno";

  const PERKS: [PhosphorIcon, string, string][] = [
    [Barbell, "Tu plan de cada semana", "Series, repeticiones y el peso de cada serie, con las máquinas del gimnasio del condominio o en casa."],
    [Sparkle, "Técnica animada", `${TECHNIQUE_COUNT} técnicas animadas por Coach Banana para que nunca entrenes a ciegas.`],
    [ChatCircle, "Coach Banana 24/7", "Resuelve tus dudas a cualquier hora, con tu plan y tus entrenos a la vista."],
    [ForkKnife, "Plan de comidas", "Calorías, proteína y comidas para tu meta, con la comida latina que ya comes."],
  ];

  return (
    <>
      {/* Portada */}
      <section className="relative overflow-hidden rounded-[2rem] bg-banana">
        <div className="grid items-center gap-8 p-6 sm:p-10 md:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-[13px] font-bold text-banana"><Buildings weight="fill" className="size-4" />Solo para vecinos de {name}</p>
            {trying ? (
              <>
                <h1 className="mt-5 text-[2.3rem] font-extrabold leading-[1.04] tracking-tight text-ink text-balance sm:text-5xl">
                  {trying.until ? <>Ya estás dentro. Pruébalo gratis hasta el {trying.until}.</> : <>Tu prueba terminó. Sigue gratis hasta el {freeDay}.</>}
                </h1>
                <p className="mt-4 text-lg leading-relaxed text-ink/85 text-pretty">
                  {trying.until
                    ? <>Entrena hoy en el gimnasio del condominio. Si te gusta, deja tu tarjeta y <b className="text-ink">sigues gratis con todo incluido hasta el {freeDay}</b>. Hoy no se cobra nada.</>
                    : <>Deja tu tarjeta y <b className="text-ink">sigues gratis con todo incluido hasta el {freeDay}</b>. No se cobra nada hasta el {chargeDay}. Tu progreso está guardado.</>}
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                  {trying.until
                    ? <><a href="/app" className={btn(false)}>{train} <ArrowRight weight="bold" className="size-5" /></a><a href="#activar" className="tap inline-flex h-12 items-center justify-center px-2 font-bold text-ink underline decoration-ink/30 underline-offset-4">Dejar mi tarjeta y seguir gratis</a></>
                    : <a href="#activar" className={btn(false)}>Seguir gratis hasta el {freeDay} <ArrowRight weight="bold" className="size-5" /></a>}
                </div>
              </>
            ) : (
              <>
                <h1 className="mt-5 text-[2.3rem] font-extrabold leading-[1.04] tracking-tight text-ink text-balance sm:text-5xl">
                  El gimnasio del condominio, ahora con entrenador.
                </h1>
                <p className="mt-4 text-lg leading-relaxed text-ink/85 text-pretty">
                  Banana Burn es tu entrenador personal en el celular. <b className="text-ink">Pruébalo {CONDO_TRY_DAYS} días gratis, sin tarjeta.</b> Si te gusta, dejas tu tarjeta y sigues gratis hasta el {freeDay}.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Join />
                  {!viewer && <a href={`/c/${code}/activar?cuenta=1`} className="tap inline-flex h-12 items-center justify-center px-2 font-bold text-ink underline decoration-ink/30 underline-offset-4">Ya tengo cuenta</a>}
                </div>
                {viewer && <p className="mt-3 text-sm text-ink/75">Se activa en la cuenta con la que entraste: {viewer.email}.</p>}
              </>
            )}
            <ul className="mt-6 flex flex-wrap gap-2 text-[13px] font-bold text-ink">
              {["Sin tarjeta para probar", `Gratis hasta el ${freeDay}`, "Cancelas cuando quieras"].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5"><CheckCircle weight="fill" className="size-4" />{t}</li>
              ))}
            </ul>
          </div>
          <Scene src={SCENE.juntos} priority alt="Coach Banana con el brazo sobre El Nuevo en el gimnasio de un condominio" className="mx-auto aspect-[4/5] w-full max-w-[360px]" />
        </div>
      </section>

      {/* El problema */}
      <section className="mt-16 grid items-center gap-8 md:grid-cols-[0.9fr_1.1fr]">
        <Scene src={SCENE.perdido} alt="El Nuevo, con su mochila, usando una máquina del gimnasio al revés" className="order-2 mx-auto aspect-[4/5] w-full max-w-[340px] md:order-1" />
        <div className="order-1 md:order-2">
          <p className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-banana-ink"><Question weight="bold" className="size-4" />Te presentamos a El Nuevo</p>
          <h2 className={`${H2} mt-2`}>Tienes gimnasio en el condominio y no sabes por dónde empezar.</h2>
          <p className={LEAD}>Lo pagas en el mantenimiento, bajas un par de veces y no sabes qué máquina usar ni cuánto peso poner. Te pasa a ti y le pasaba a El Nuevo.</p>
          <Ticks pain items={["Copias rutinas de videos que no son para ti", "No sabes si lo estás haciendo bien", "Vas una semana y lo dejas"]} />
        </div>
      </section>

      {/* La solución */}
      <section className="mt-16 grid items-center gap-8 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-banana-ink"><Sparkle weight="bold" className="size-4" />Entonces llegó Coach Banana</p>
          <h2 className={`${H2} mt-2`}>Abres la app y sabes exactamente qué hacer hoy.</h2>
          <ol className="mt-6 space-y-4">
            {[
              ["Le cuentas tu meta", "Bajar de peso, ganar músculo o las dos. Y dónde entrenas: el gimnasio del condominio, tu casa o sin equipo."],
              ["Te da el entreno de hoy", "Cada ejercicio con sus series, repeticiones y el peso exacto. Si lo completas, la próxima vez sube."],
              ["Te enseña y te acompaña", "Técnica animada en cada ejercicio y un coach que responde tus dudas a cualquier hora."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-banana text-lg font-extrabold tabular-nums text-ink">{i + 1}</span>
                <div><h3 className="font-extrabold text-ink">{t}</h3><p className="mt-0.5 text-[15px] text-pretty">{d}</p></div>
              </li>
            ))}
          </ol>
        </div>
        <Scene src={SCENE.celular} alt="Coach Banana le muestra la app en el celular a El Nuevo" className="mx-auto aspect-[4/5] w-full max-w-[340px]" />
      </section>

      {/* Recorrido real */}
      <section className="mt-16">
        <h2 className={H2}>Así se ve por dentro.</h2>
        <p className={LEAD}>Pantallas reales de la app. Toca cada una.</p>
        <div className="mt-8"><AppTour /></div>
      </section>

      {/* Qué incluye */}
      <section className="mt-16">
        <h2 className={H2}>Todo incluido, desde el primer día.</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {PERKS.map(([I, t, d]) => (
            <li key={t} className="card flex gap-4 p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-banana-soft text-banana-ink"><I weight="duotone" className="size-6" /></span>
              <div><h3 className="font-extrabold text-ink">{t}</h3><p className="mt-0.5 text-[15px] text-pretty">{d}</p></div>
            </li>
          ))}
        </ul>
      </section>

      {/* Cómo funciona */}
      <section className="mt-16 grid items-center gap-8 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.5rem] bg-white p-6 ring-1 ring-line sm:p-8">
          <h2 className="text-2xl font-extrabold text-ink">Cómo funciona</h2>
          <ol className="mt-5 space-y-4">
            {[
              ["Pruébalo sin tarjeta", `Creas tu cuenta en 2 minutos y entrenas hoy. Tienes ${CONDO_TRY_DAYS} días con todo incluido, sin dejar tarjeta.`],
              ["Si te gusta, deja tu tarjeta", `Sigues gratis con todo incluido hasta el ${freeDay}. Hoy no se cobra nada.`],
              [`Desde el ${chargeDay}, solo si sigues`, `Se cobra el plan que elegiste: ${entreno.name} ${usd(entreno.price.mes)} o ${completo.name} ${usd(completo.price.mes)} al mes. Te avisamos 2 días antes y cancelas cuando quieras desde Mi plan.`],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-base font-extrabold tabular-nums text-banana">{i + 1}</span>
                <div><h3 className="font-extrabold text-ink">{t}</h3><p className="mt-0.5 text-[15px] text-pretty">{d}</p></div>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm text-muted text-pretty">Si no dejas tu tarjeta, al terminar tu prueba simplemente se pausa tu acceso. No se cobra nada y tu progreso queda guardado.</p>
        </div>
        <Scene src={SCENE.sentadilla} alt="El Nuevo hace una sentadilla con mancuerna mientras Coach Banana lo revisa" className="mx-auto aspect-[4/5] w-full max-w-[320px]" />
      </section>

      {/* Cierre: probar (nuevo) o dejar la tarjeta (probando) */}
      <section id="activar" className="mt-16 scroll-mt-6 overflow-hidden rounded-[2rem] bg-ink text-white">
        <div className="grid items-center gap-8 p-6 sm:p-10 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            {trying ? (
              <>
                <h2 className="text-3xl font-extrabold tracking-tight text-banana text-balance sm:text-4xl">¿Te gustó? Sigue gratis hasta el {freeDay}.</h2>
                <p className="mt-4 text-lg text-white/85 text-pretty">Deja tu tarjeta y elige el plan que seguiría desde el {chargeDay}. Hoy no se cobra nada.</p>
                {cardReady ? (
                  <form action={`/c/${code}/activar`} method="post" className="mt-7">
                    <button type="submit" className="btn-banana h-14! w-full px-7! text-base! sm:w-auto">Seguir gratis hasta el {freeDay} <ArrowRight weight="bold" className="size-5" /></button>
                    <p className="mt-3 text-sm text-white/75">Tu tarjeta ya está lista.</p>
                  </form>
                ) : (
                  <div className="text-body"><CondoCard code={code} demo={!!viewer?.demo} freeDay={freeDay} chargeDay={chargeDay} /></div>
                )}
              </>
            ) : (
              <>
                <h2 className="text-3xl font-extrabold tracking-tight text-banana text-balance sm:text-4xl">Tu primer entreno te espera en el gimnasio de {name}.</h2>
                <p className="mt-4 text-lg text-white/85 text-pretty">Pruébalo {CONDO_TRY_DAYS} días gratis, sin tarjeta. Si te gusta, sigues gratis hasta el {freeDay}.</p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Join dark />
                  {!viewer && <a href={`/c/${code}/activar?cuenta=1`} className="tap inline-flex h-12 items-center justify-center px-2 font-bold text-white underline decoration-white/40 underline-offset-4">Ya tengo cuenta</a>}
                </div>
              </>
            )}
          </div>
          <Scene src={SCENE.flex} alt="El Nuevo y Coach Banana sacan bíceps juntos en el gimnasio" className="mx-auto aspect-[4/5] w-full max-w-[320px]" />
        </div>
      </section>

      <p className="mt-8 flex items-start gap-3 text-[15px] text-pretty"><Lock weight="duotone" className="mt-0.5 size-5 shrink-0 text-banana-ink" />Tus datos son privados. La administración del condominio solo ve cuántos residentes se unieron, nunca tu peso, tus entrenos ni tu comida.</p>
    </>
  );
}
