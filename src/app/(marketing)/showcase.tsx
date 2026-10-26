// Lo que hace distinto a Banana Burn, justo después de "Es para ti si…": que en los primeros dos deslizamientos quede
// claro que no es otra app de rutinas. Todo lo que se afirma aquí existe hoy en la app (revisado en el código, oct 2026):
//   - progresión automática: engine/index.ts prescribe() (doble progresión, −10 % tras 2 sesiones flojas, descarga)
//   - técnica animada: TECHNIQUE_COUNT y LIB_COUNT
//   - Coach Banana: coach.ts recibe plan, peso, entrenos y, con Nutrición, la comida
//   - Temporadas (seasons.ts), GPS (/app/correr), Aprende a entrenar, Banana Shield, Platanita, retos y comunidad
// Capturas reales en modo demostración (public/landing). Sin testimonios, contadores ni superlativos que no se puedan probar.
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BowlFood, Check, PersonSimpleRun, ShieldCheck, Users } from "@/components/icons";
import { ExerciseMotion } from "@/components/exercise-motion";
import { LIB_COUNT } from "@/lib/library";
import { ANIMATED_TECHNIQUES, SIGNUP, SIGNUP_GLP1 } from "./content";
import { shot } from "./new-sections";

const n419 = (n: number) => n.toLocaleString("es-419");

/** Pantalla real recortada por abajo: muestra lo importante sin ocupar un teléfono entero de alto. */
function Screen({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="mx-auto w-[230px] rounded-t-[2.2rem] bg-ink p-2 pb-0 shadow-lift sm:w-[250px]">
      <div className="relative aspect-[390/560] overflow-hidden rounded-t-[1.75rem] bg-cream">
        <Image src={src} alt={alt} fill sizes="250px" className="object-cover object-top" />
      </div>
    </div>
  );
}

type Big = { n: string; tag: string; t: string; d: string; visual: React.ReactNode };

function bigCards(): Big[] {
  const entreno = shot("entreno-top") ?? "/landing/entreno.png";
  const coach = "/landing/coach.png";
  const seasons = shot("temporadas");
  const cards: Big[] = [
    {
      n: "01", tag: "Progresión automática", t: "Tu plan se ajusta solo.",
      d: "Anotas tus series y Banana Burn decide el peso de la próxima vez. Si dos sesiones salen flojas, baja 10 % y vuelves a subir.",
      visual: <Screen src={entreno} alt="Pantalla de entreno de Banana Burn con la serie, el peso y las repeticiones" />,
    },
    {
      n: "02", tag: "Técnica animada", t: "Ves cómo se hace cada ejercicio.",
      d: `${n419(ANIMATED_TECHNIQUES)} técnicas animadas por Coach Banana y ${n419(LIB_COUNT)} ejercicios con guía paso a paso. Nada de adivinar.`,
      visual: (
        <div className="mx-auto flex h-full max-w-[300px] flex-col justify-end">
          <ExerciseMotion anim="deadlift" mus="Glúteos, femorales y espalda" cues={["Espalda neutra", "Barra pegada al cuerpo", "Empuja el piso"]} className="aspect-square w-full" />
        </div>
      ),
    },
    {
      n: "03", tag: "Coach Banana 24/7", t: "Tu entrenador te responde a cualquier hora.",
      d: "Conoce tu plan, tu peso y tus entrenos. Con Entreno + Nutrición, también lo que comiste. Pregúntale lo que quieras.",
      visual: <Screen src={coach} alt="Chat con Coach Banana dentro de la app" />,
    },
  ];
  const aprende = shot("aprende");
  if (aprende) {
    cards.push({
      n: "04", tag: "Desde cero", t: "Te enseñamos a entrenar, paso a paso.",
      d: "Tu primer entreno es guiado y en Aprende a entrenar tienes 10 lecciones de 30 segundos: series, peso, descanso y técnica.",
      visual: <Screen src={aprende} alt="Pantalla de Aprende a entrenar en Banana Burn" />,
    });
  }
  if (seasons) {
    cards.push({
      n: String(cards.length + 1).padStart(2, "0"), tag: "Temporadas deportivas", t: "Si haces deporte, la app se transforma.",
      d: "Running, Raquetas y Cross Training: 8 semanas donde todo gira alrededor de tus días de carrera o de partido.",
      visual: <Screen src={seasons} alt="Temporadas deportivas de Banana Burn" />,
    });
  }
  return cards;
}

const SMALL: { icon: typeof Check; t: string; d: string; tag?: string; href?: string }[] = [
  { icon: ShieldCheck, t: "Banana Shield", d: "Si bajas rápido o usas GLP-1, cuida tu músculo. Con la guía de tu médico.", href: SIGNUP_GLP1 },
  { icon: BowlFood, t: "Comida latina", d: "Del gallo pinto al combo de comida rápida, sin dietas locas.", tag: "Entreno + Nutrición" },
  { icon: PersonSimpleRun, t: "GPS para correr", d: "Distancia, ritmo y parciales por kilómetro." },
  { icon: Users, t: "Retos y comunidad", d: "Niveles, insignias y gente que va en lo mismo." },
];

const ALL_IN_ONE = [
  "Qué entrenar cada día",
  "El peso exacto de cada serie",
  "La técnica de cada ejercicio",
  "Respuestas a cualquier hora",
  "Un plan que sube contigo",
  "En casa o en el gym",
];

export function Showcase() {
  const cards = bigCards();
  return (
    <section id="lo-mejor" aria-labelledby="lo-mejor-t" className="scroll-mt-20 pt-16 sm:pt-24">
      <div className="bg-ink py-14 text-white sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="w-fit rounded-full bg-banana px-3.5 py-1.5 text-sm font-extrabold text-ink">No es otra app de rutinas</p>
          <h2 id="lo-mejor-t" className="mt-5 max-w-4xl text-4xl font-extrabold tracking-[-0.03em] text-balance sm:text-5xl lg:text-6xl">
            Un entrenador que piensa por ti, <span className="text-banana">no una lista de ejercicios.</span>
          </h2>
          <p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-white/70 text-pretty sm:text-xl">Esto es lo que vas a usar todos los días.<span className="lg:hidden"> Desliza para verlo.</span></p>
        </div>

        {/* Celular: tarjetas que se deslizan de lado (el desplazamiento queda dentro de la sección). Escritorio: 2 x 2. */}
        <ul tabIndex={0} aria-label="Lo que hace distinto a Banana Burn" className="mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 [scrollbar-width:none] sm:px-6 lg:mx-auto lg:grid lg:max-w-6xl lg:grid-cols-3 lg:gap-4 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
          {cards.map((c) => (
            <li key={c.n} className="flex w-[86%] max-w-[420px] shrink-0 snap-center flex-col overflow-hidden rounded-[2rem] bg-white/[.06] ring-1 ring-white/10 lg:w-auto lg:max-w-none">
              <div className="p-6 sm:p-7">
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-extrabold tabular-nums text-banana">{c.n}</span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/85">{c.tag}</span>
                </div>
                <h3 className="mt-4 text-2xl font-extrabold leading-tight text-balance sm:text-[1.7rem]">{c.t}</h3>
                <p className="mt-2 leading-relaxed text-white/70 text-pretty">{c.d}</p>
              </div>
              <div className="mt-auto bg-banana px-6 pt-6">{c.visual}</div>
            </li>
          ))}
        </ul>

        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ul className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {SMALL.map(({ icon: I, t, d, tag, href }) => {
              const body = (
                <>
                  <span className="grid size-10 place-items-center rounded-2xl bg-banana text-ink"><I weight="duotone" aria-hidden className="size-6" /></span>
                  <h3 className="mt-3 font-extrabold leading-tight text-balance sm:text-lg">{t}</h3>
                  <p className="mt-1 text-sm leading-snug text-white/70 text-pretty sm:text-base">{d}</p>
                  {tag && <p className="mt-2 text-xs font-bold text-banana">Incluido en {tag}</p>}
                  {href && <p className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-banana">Empezar <ArrowRight weight="bold" aria-hidden className="size-4" /></p>}
                </>
              );
              const cls = "flex h-full flex-col rounded-[1.5rem] bg-white/[.06] p-4 ring-1 ring-white/10 sm:p-5";
              return <li key={t}>{href ? <Link href={href} data-cta="lo-mejor-shield" className={`${cls} transition-colors duration-200 hover:bg-white/[.1]`}>{body}</Link> : <div className={cls}>{body}</div>}</li>;
            })}
          </ul>

          <div className="mt-10 rounded-[2rem] bg-banana p-6 text-ink sm:p-8">
            <h3 className="text-2xl font-extrabold text-balance sm:text-3xl">Lo que harías con un entrenador personal, en una sola app.</h3>
            <ul className="mt-5 grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {ALL_IN_ONE.map((t) => (
                <li key={t} className="flex items-center gap-2.5 text-[17px] font-bold">
                  <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-banana"><Check weight="bold" className="size-3.5" /></span>{t}
                </li>
              ))}
            </ul>
            <Link href={SIGNUP} data-cta="lo-mejor" className="pressable mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink px-8 text-base font-extrabold text-banana shadow-lift hover:bg-black sm:w-auto">
              Crear mi plan gratis <ArrowRight weight="bold" className="size-5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
