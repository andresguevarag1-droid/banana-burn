import Link from "next/link";
import { ArrowRight, Banana, BananaFlame, Barbell, BowlFood, BrandIcon, Brain, Check, DeviceMobile, Lock, Moon, Plus, Repeat, ShieldCheck, TrendDown, X } from "@/components/icons";
import { Phone } from "@/components/phone";
import { Pricing } from "@/components/pricing";
import { PLANS, perMonthAnnual, usd } from "@/lib/plans";
import { DAY_NAMES, planWeek } from "@/lib/engine";

const PILLARS = [
  { icon: Barbell, t: "Fuerza que quema", d: "4 días de básicos (sentadilla, banca, peso muerto, dominadas) cerca del fallo, tempo 3-1-1. Pierdes grasa sin perder músculo." },
  { icon: Repeat, t: "Nunca la misma rutina", d: "Cada día es distinto al de ayer y al de mañana, y los accesorios rotan cada semana. Cero aburrimiento." },
  { icon: Brain, t: "IA que se adapta", d: "Si subiste reps, sube el peso. Si estancaste, ajusta. Lee tu peso semanal y corrige tus calorías solo." },
  { icon: BowlFood, t: "Comida de aquí", d: "Gallo pinto, casado, plátano, pollo y frijoles. Proteína 1,6-2,2 g/kg y carbos antes de entrenar." },
  { icon: Moon, t: "Recupera en serio", d: "Sueño 7-9 h y 8-12k pasos. Te recuerda pesarte y medirte en el momento justo." },
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
  ["¿Cuánto peso voy a bajar?", "Un ritmo sano es 0,5-1 % de tu peso por semana. Banana Burn mide tu tendencia real y ajusta para que llegues a tu meta sin perder músculo."],
  ["¿Sirve si entreno en casa?", "Sí. Puedes elegir equipo disponible y el plan cambia variantes con mancuernas, bandas o peso corporal."],
  ["¿Mis datos están seguros?", "Tus datos de salud son privados, cifrados y solo tuyos. Puedes exportarlos o borrar tu cuenta cuando quieras (Ley 8968)."],
  ["¿Cuánto cuesta?", "Entreno: $9.99/mes o $59.99/año. Entreno + Nutrición: $14.99/mes o $89.99/año. Con el plan anual pagas la mitad."],
  ["¿Cómo pago?", "Tarjeta, SINPE Móvil o Apple Pay. Cancelas con un toque, sin letra pequeña."],
];

export default function Landing() {
  const week = planWeek(0);
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-40 right-[-10%] size-[620px] rounded-full bg-banana/40 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute top-40 left-[-15%] size-[420px] rounded-full bg-ember/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-14 sm:pt-20 pb-16 grid lg:grid-cols-[1.15fr_1fr] gap-14 items-center">
          <div className="animate-rise">
            <span className="chip bg-white border border-line text-ink"><Banana className="size-4 text-banana-ink" /> Hecho en Costa Rica para LATAM</span>
            <h1 className="mt-6 text-[2.75rem] leading-[1.02] sm:text-6xl lg:text-7xl font-extrabold tracking-[-0.035em] text-ink">
              Quema grasa.<br />Gana fuerza.<br /><span className="relative inline-block"><span className="relative z-10">Cada día distinto.</span><span aria-hidden className="absolute inset-x-0 bottom-1 sm:bottom-2 h-4 sm:h-5 bg-banana -z-0 rounded" /></span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-muted max-w-xl leading-relaxed">
              Tu entrenador personal con IA te dice <b className="text-ink">qué te toca hoy en el gym</b>, cuánto levantar y qué comer. Y se ajusta solo cada semana según tus resultados.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link href="/entrar?modo=registro" className="btn-primary h-14 px-7 text-base">Crear mi plan <ArrowRight className="size-5" /></Link>
              <a href="#app" className="btn-ghost h-14 px-7 text-base">Ver cómo funciona</a>
            </div>
            <p className="mt-4 text-sm text-faint">Desde {usd(perMonthAnnual(PLANS[0]))}/mes · Listo en 2 minutos, cancela cuando quieras</p>
          </div>
          <div className="relative flex justify-center">
            <Phone src="/landing/entreno.png" alt="Reproductor de entreno de Banana Burn" className="hidden sm:block absolute w-[240px] -left-2 top-16 -rotate-6 opacity-95" />
            <Phone src="/landing/hoy.png" alt="Pantalla Hoy de Banana Burn con la rutina del día" className="relative w-[280px] sm:w-[300px] animate-floaty sm:translate-x-16" priority />
          </div>
        </div>
      </section>

      {/* STRIP */}
      <section className="border-y border-line bg-cream">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-5 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm font-semibold text-muted">
          {([[Banana, "Español real, no traducido"], [BowlFood, "Comida tica y latina"], [DeviceMobile, "SINPE Móvil"], [Barbell, "Gym o casa"], [Lock, "Datos privados"]] as const).map(([I, t]) => (
            <span key={t} className="inline-flex items-center gap-2"><I weight="duotone" className="size-5 text-banana-ink" />{t}</span>
          ))}
        </div>
      </section>

      {/* LA APP POR DENTRO */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-24">
        <div className="max-w-2xl">
          <p className="eyebrow">La app por dentro</p>
          <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-ink">Todo lo que necesitas para bajar de peso, en tu bolsillo.</h2>
        </div>
        <div tabIndex={0} role="region" aria-label="Pantallas de la app" className="mt-12 -mx-4 px-4 flex gap-6 overflow-x-auto snap-x snap-mandatory pb-6 lg:grid lg:grid-cols-4 lg:overflow-visible focus:outline-none focus-visible:ring-4 focus-visible:ring-banana">
          {([
            ["/landing/hoy.png", BananaFlame, "Hoy", "Tu rutina del día, tu racha y tus metas de proteína, agua y pasos de un vistazo."],
            ["/landing/entreno.png", Barbell, "En el gym", "Te dice cuánto levantar en cada serie, cuenta tu descanso y celebra tus récords."],
            ["/landing/nutricion.png", BowlFood, "Comida tica", "Registra gallo pinto o un casado en 2 toques y ve cuánto te queda del día."],
            ["/landing/progreso.png", TrendDown, "Progreso real", "Tu tendencia de peso y tu fuerza. La IA ajusta calorías cada semana."],
          ] as const).map(([src, I, t, d]) => (
            <figure key={src} className="snap-center shrink-0 w-[260px] lg:w-auto">
              <Phone src={src} alt={`Pantalla ${t} de Banana Burn`} />
              <figcaption className="mt-5"><p className="flex items-center gap-2 text-lg font-extrabold text-ink"><span className="grid place-items-center size-9 rounded-xl bg-banana-soft text-banana-ink"><I weight="duotone" className="size-5" /></span>{t}</p><p className="mt-1 text-muted leading-relaxed">{d}</p></figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* MÉTODO */}
      <section id="metodo" className="mx-auto max-w-6xl px-4 sm:px-6 pt-24 scroll-mt-20">
        <div className="max-w-2xl">
          <p className="eyebrow">El método</p>
          <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-ink">Ciencia de recomposición, explicada como un compa.</h2>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map(({ icon: Icon, t, d }) => (
            <div key={t} className="card p-6 hover:shadow-lift transition-shadow">
              <span className="grid place-items-center size-12 rounded-2xl bg-banana-soft text-banana-ink"><Icon weight="duotone" className="size-6" /></span>
              <h3 className="mt-5 text-lg font-bold text-ink">{t}</h3>
              <p className="mt-2 text-[17px] text-muted leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SEMANA */}
      <section id="app" className="mx-auto max-w-6xl px-4 sm:px-6 pt-24 scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="eyebrow">Tu semana</p>
            <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-ink">Abres la app y sabes exactamente qué hacer.</h2>
          </div>
          <p className="text-muted max-w-sm">Ejemplo real generado por el motor de Banana Burn. La semana siguiente, los accesorios cambian.</p>
        </div>
        <div tabIndex={0} role="region" aria-label="Semana de ejemplo" className="mt-10 -mx-4 px-4 sm:mx-0 sm:px-0 flex sm:grid sm:grid-cols-7 gap-3 overflow-x-auto snap-x pb-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-banana">
          {week.map((d) => (
            <div key={d.dow} className={`snap-start shrink-0 w-[220px] sm:w-auto rounded-3xl p-4 border ${d.tpl ? (d.tag === "Fuerza" ? "bg-banana border-banana" : d.tag === "Volumen" ? "bg-white border-line" : "bg-cream border-line") : "bg-white/50 border-dashed border-line"}`}>
              <p className="text-xs font-bold uppercase tracking-wider text-ink/75">{DAY_NAMES[d.dow]}</p>
              <p className="mt-2"><BrandIcon name={d.icon} className="size-7 text-ink" /></p>
              <p className="mt-1 font-extrabold text-ink leading-tight">{d.name}</p>
              <p className="text-xs font-semibold text-ink/75">{d.tag}</p>
              <ul className="mt-3 space-y-1 text-[12px] text-ink/80">
                {d.exercises.slice(0, 4).map((e) => <li key={e.id}>• {e.name}</li>)}
                {!d.exercises.length && <li>{d.cardio}</li>}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* COMPARACIÓN */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 pt-24">
        <div className="text-center">
          <p className="eyebrow">Por qué Banana Burn</p>
          <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-ink">Las apps gringas no te entienden.</h2>
        </div>
        <div className="mt-10 card overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] text-sm font-bold text-ink border-b border-line">
            <div className="p-4" /><div className="p-4 w-28 text-center bg-banana">Banana Burn</div><div className="p-4 w-28 text-center text-muted">Otras apps</div>
          </div>
          {COMPARE.map(([f, a, b]) => (
            <div key={f} className="grid grid-cols-[1fr_auto_auto] text-[15px] border-b border-line last:border-0">
              <div className="p-4 text-ink">{f}</div>
              <div className="p-4 w-28 grid place-items-center bg-banana/15">{a ? <Check weight="bold" className="size-5 text-peel" aria-label="Sí" /> : <X weight="bold" className="size-5 text-faint" aria-label="No" />}</div>
              <div className="p-4 w-28 grid place-items-center">{b ? <Check weight="bold" className="size-5 text-peel" aria-label="Sí" /> : <X weight="bold" className="size-5 text-faint" aria-label="No" />}</div>
            </div>
          ))}
        </div>
      </section>

      {/* GLP-1 */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-24">
        <Link href="/glp1" className="group grid gap-6 lg:grid-cols-[1fr_auto] items-center rounded-[2rem] border-2 border-ink bg-white p-8 sm:p-10 hover:shadow-lift transition">
          <div>
            <p className="eyebrow">Nuevo · Banana Shield</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink"><span className="inline-flex flex-wrap items-center gap-x-3">¿Usas Ozempic o Mounjaro? Protege tu músculo <ShieldCheck weight="duotone" className="size-9 text-banana-ink" /></span></h2>
            <p className="mt-3 text-lg text-muted max-w-2xl">Un programa de fuerza y proteína pensado para personas en GLP-1: modo suave en días de inyección, porciones pequeñas y tu “escudo de músculo”.</p>
          </div>
          <span className="btn-primary h-14 px-7 text-base">Conocer Banana Shield <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" /></span>
        </Link>
      </section>

      {/* RETO DEL FUNDADOR */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-24">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] items-center rounded-[2rem] bg-ink text-white p-8 sm:p-12">
          <div>
            <p className="eyebrow text-banana">El reto del fundador</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">De 94 a 85 kg antes del 31 de diciembre. En público.</h2>
            <p className="mt-4 text-lg text-white/70 leading-relaxed">Soy Andrés, de San José, y soy el usuario #1 de Banana Burn. La construí porque ninguna app me decía qué hacer hoy en el gym, en español y con la comida de aquí. Sígueme el reto: cada semana comparto mi peso, mi fuerza y lo que estoy comiendo.</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[["−9 kg", "meta"], ["4 días", "de gym"], ["185 g", "proteína/día"]].map(([v, l]) => (
              <div key={l} className="rounded-3xl bg-white/5 border border-white/10 p-5"><p className="text-3xl font-extrabold text-banana tabular-nums">{v}</p><p className="mt-1 text-sm text-white/60">{l}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* PRECIOS */}
      <section id="precios" className="mx-auto max-w-6xl px-4 sm:px-6 pt-24 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="eyebrow">Precios</p>
          <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-ink">Un plan para cada meta. Menos que una mensualidad de gym.</h2>
        </div>
        <Pricing />
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-4 sm:px-6 pt-24 scroll-mt-20">
        <h2 className="text-4xl font-extrabold tracking-tight text-ink text-center">Preguntas frecuentes</h2>
        <div className="mt-10 space-y-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="card group p-0 open:shadow-lift">
              <summary className="cursor-pointer list-none p-5 flex justify-between items-center font-bold text-ink">
                {q}<Plus weight="bold" className="size-5 shrink-0 transition-transform group-open:rotate-45" />
              </summary>
              <p className="px-5 pb-5 -mt-1 text-muted leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-24">
        <div className="relative overflow-hidden rounded-[2rem] bg-banana px-6 py-14 sm:p-16 text-center">
          <Banana weight="fill" className="absolute -right-10 -bottom-16 size-[220px] text-ink opacity-10 rotate-12" />
          <h2 className="relative text-4xl sm:text-5xl font-extrabold tracking-tight text-ink">Tu mejor versión empieza el lunes.<br className="hidden sm:block" /> O mejor: hoy.</h2>
          <Link href="/entrar?modo=registro" className="relative mt-8 btn-primary h-14 px-8 text-base">Crear mi plan <ArrowRight className="size-5" /></Link>
          <p className="relative mt-4 text-sm font-semibold text-ink/70">Desde {usd(perMonthAnnual(PLANS[0]))}/mes con el plan anual · cancela cuando quieras</p>
        </div>
      </section>
    </>
  );
}
