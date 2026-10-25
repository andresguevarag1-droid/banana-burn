// Secciones nuevas de la landing (oct 2026): aprender desde cero, Coach Platanita, Temporadas, GPS para correr y la
// oferta del primer mes. Todas muestran capturas REALES de la app (modo demostración). Las que dependen de una función
// que todavía no está publicada se muestran solo cuando su captura existe en public/landing: sin captura, no se dibuja
// nada (nunca un espacio vacío ni una promesa de algo que aún no existe).
import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, GraduationCap, Medal, PersonSimpleRun } from "@/components/icons";
import { Phone } from "@/components/phone";
import { COACHES } from "@/lib/coaches";
import { PROMO_PCT, promoPrice } from "@/lib/trial";
import { PLANS } from "@/lib/plans";
import { money } from "@/lib/copy";
import { SIGNUP } from "./content";

const H2 = "text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.03em] text-ink text-balance";
const LEAD = "mt-5 text-lg sm:text-xl text-muted leading-relaxed text-pretty max-w-[58ch]";

/** ¿Existe la captura? Se revisa al generar la página (la landing es estática). */
export function shot(name: string): string | null {
  try { return fs.existsSync(path.join(process.cwd(), "public", "landing", `${name}.webp`)) ? `/landing/${name}.webp` : null; } catch { return null; }
}

function Points({ items, dark = false }: { items: string[]; dark?: boolean }) {
  return (
    <ul className="mt-6 grid gap-2.5">
      {items.map((t) => (
        <li key={t} className={`flex items-start gap-3 text-[17px] font-semibold ${dark ? "text-white" : "text-ink"}`}>
          <span aria-hidden className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-banana text-ink"><Check weight="bold" className="size-3.5" /></span>{t}
        </li>
      ))}
    </ul>
  );
}

/** Te enseñamos a entrenar desde cero: el primer entreno guiado y el mini curso. Requiere aprende.webp. */
export function LearnSection() {
  const src = shot("aprende");
  if (!src) return null;
  const second = shot("primeros-pasos");
  return (
    <section aria-labelledby="aprende-t" className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-14">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-banana px-3.5 py-1.5 text-sm font-extrabold text-ink"><GraduationCap weight="duotone" aria-hidden className="size-4" />Aunque nunca hayas entrenado</p>
          <h2 id="aprende-t" className={`${H2} mt-5`}>Te enseñamos a entrenar desde cero.</h2>
          <p className={LEAD}>Al entrar, Tus primeros pasos te lleva a cada pantalla con un toque, y tu primer entreno es guiado: qué hacer, cómo anotar tu serie y para qué es el descanso. En Aprende a entrenar tienes 10 lecciones de 30 segundos, sin palabras raras.</p>
          <Points items={["Qué es una serie y una repetición", "Cuánto peso usar y cuánto descansar", "Cómo ver la técnica de cada ejercicio", "Cómo te hace progresar la app"]} />
        </div>
        <div className="relative mx-auto flex w-full max-w-[460px] justify-center gap-4">
          <Phone src={src} alt="Pantalla de Aprende a entrenar en Banana Burn" sizes="240px" className="w-[230px] sm:w-[250px]" />
          {second && <Phone src={second} alt="Tus primeros pasos en Banana Burn: una lista que te lleva a cada pantalla" sizes="200px" className="mt-14 hidden w-[200px] sm:block" />}
        </div>
      </div>
    </section>
  );
}

/** Para ellas: programas con Coach Platanita (Pilates en casa 30 días, Banana Girl). Ya publicado. */
export function PlatanitaSection() {
  const a = shot("platanita-entreno");
  const b = shot("platanita-programa");
  if (!a) return null;
  const pl = COACHES.platanita;
  return (
    <section aria-labelledby="platanita-t" className="pt-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-10 overflow-hidden rounded-[2.25rem] bg-banana-soft p-7 sm:p-12 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
          <div>
            <p className="w-fit rounded-full bg-ink px-3.5 py-1.5 text-sm font-extrabold text-banana">Para ellas</p>
            <h2 id="platanita-t" className={`${H2} mt-5`}>Conoce a Coach Platanita.</h2>
            <p className={LEAD}>En los programas para chicas te acompaña Coach Platanita: te da la bienvenida, te enseña cada ejercicio y te responde en el chat. Glúteos, abdomen, postura y Pilates en casa con poco equipo.</p>
            <Points items={["Pilates en casa en 30 días", "Glúteos y espalda esculpidos", "Ejercicios con técnica guiada por ella"]} />
            <div className="mt-6 flex items-center gap-3">
              <Image src={pl.avatar} alt="Coach Platanita" width={64} height={64} sizes="64px" className="size-16 rounded-2xl bg-banana object-cover" />
              <p className="text-sm text-muted text-pretty">Coach Platanita aparece cuando eliges un programa para chicas.</p>
            </div>
          </div>
          <div className="relative mx-auto flex w-full max-w-[460px] justify-center gap-4">
            <Phone src={a} alt="Entrenamiento de Pilates con Coach Platanita en Banana Burn" sizes="240px" className="w-[230px] sm:w-[250px]" />
            {b && <Phone src={b} alt="Programa Pilates en casa 30 días en Banana Burn" sizes="200px" className="mt-14 hidden w-[200px] sm:block" />}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Temporadas deportivas (Running, Raquetas, Cross Training). Requiere temporadas.webp. */
export function SeasonsSection() {
  const src = shot("temporadas");
  if (!src) return null;
  const SPORTS: [string, string, string][] = [
    ["Running", "$14.99", "Fuerza para correr más rápido y sin lesiones, acomodada a tus días de carrera."],
    ["Raquetas", "$16.99", "Tenis y pádel: potencia de rotación, desplazamiento lateral y hombro fuerte."],
    ["Cross Training", "$18.99", "Fuerza, gimnasia y circuitos, con una versión más fácil de cada movimiento."],
  ];
  return (
    <section aria-labelledby="temporadas-t" className="pt-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-[2.25rem] bg-ink p-7 text-white sm:p-12 lg:p-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-banana px-3.5 py-1.5 text-sm font-extrabold text-ink"><Medal weight="duotone" aria-hidden className="size-4" />Nuevo: Temporadas</p>
              <h2 id="temporadas-t" className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.03em] text-balance">Entrena para <span className="text-banana">tu deporte</span>.</h2>
              <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-white/80 text-pretty">8 semanas en las que toda la app se enfoca en tu deporte: tus entrenamientos, tus consejos y tu coach con su ropa de deporte. Cada temporada llega mejorada con lo que más gustó en la anterior.</p>
              <ul className="mt-8 grid gap-3">
                {SPORTS.map(([t, p, d]) => (
                  <li key={t} className="flex items-start justify-between gap-4 rounded-[1.25rem] bg-white/[.06] p-4">
                    <span><span className="block text-lg font-extrabold">{t}</span><span className="block text-sm text-white/70 text-pretty">{d}</span></span>
                    <span className="shrink-0 text-right"><span className="block text-xl font-extrabold tabular-nums text-banana">{p}</span><span className="block text-xs text-white/60">pago único</span></span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm font-semibold text-banana">Incluye 1 temporada gratis en los planes anuales.</p>
            </div>
            <div className="relative mx-auto flex w-full max-w-[460px] justify-center gap-4">
              <Phone src={src} alt="Temporadas deportivas en Banana Burn" sizes="240px" className="w-[230px] sm:w-[250px]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** GPS para correr. Requiere correr.webp. */
export function RunSection() {
  const src = shot("correr");
  if (!src) return null;
  return (
    <section aria-labelledby="correr-t" className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-14">
        <div className="order-2 lg:order-1 mx-auto w-full max-w-[280px]"><Phone src={src} alt="Carrera registrada con GPS en Banana Burn" sizes="260px" /></div>
        <div className="order-1 lg:order-2">
          <p className="inline-flex items-center gap-2 rounded-full bg-banana px-3.5 py-1.5 text-sm font-extrabold text-ink"><PersonSimpleRun weight="duotone" aria-hidden className="size-4" />Para correr</p>
          <h2 id="correr-t" className={`${H2} mt-5`}>Registra tus carreras con GPS.</h2>
          <p className={LEAD}>Mapa de tu recorrido, distancia, ritmo por kilómetro y tus parciales. Tus carreras son privadas y ajustan tu plan de fuerza.</p>
        </div>
      </div>
    </section>
  );
}

/** Oferta del primer mes: 50 % menos si dejas tu tarjeta lista. Condiciones dichas claras, sin urgencia falsa. */
export function OfferBand() {
  const src = shot("oferta");
  const [entreno, completo] = PLANS;
  return (
    <section aria-labelledby="oferta-t" className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
      <div className="grid items-center gap-8 rounded-[2.25rem] bg-banana p-7 sm:p-12 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <h2 id="oferta-t" className="text-4xl sm:text-5xl font-extrabold tracking-[-0.03em] text-ink text-balance">Tu primer mes a mitad de precio.</h2>
          <p className="mt-4 max-w-[56ch] text-lg leading-relaxed text-ink/85 text-pretty">Pruebas gratis, con o sin tarjeta. Si dejas tu tarjeta lista antes de tu primer cobro, tu primer mes del plan mensual cuesta {PROMO_PCT} % menos. Ese día no se cobra nada y te avisamos 2 días antes.</p>
          <dl className="mt-6 grid grid-cols-2 gap-3 max-w-md">
            {[[entreno.name, entreno.price.mes, promoPrice("entreno")], [completo.name, completo.price.mes, promoPrice("completo")]].map(([n, full, half]) => (
              <div key={String(n)} className="rounded-2xl bg-white/70 p-4">
                <dt className="text-sm font-bold text-ink">{n}</dt>
                <dd className="mt-1"><s className="text-sm text-ink/60">{money(Number(full))}</s> <span className="text-2xl font-extrabold tabular-nums text-ink">{money(Number(half))}</span><span className="block text-xs font-semibold text-ink/70">tu primer mes</span></dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-ink/75">Una vez por cuenta. El plan anual no tiene este descuento. Cancelas cuando quieras desde Mi plan.</p>
          <Link href={SIGNUP} data-cta="oferta" className="pressable mt-6 inline-flex h-14 items-center gap-2 rounded-full bg-ink px-8 text-base font-extrabold text-banana shadow-lift hover:bg-black">Empezar gratis <ArrowRight weight="bold" className="size-5" /></Link>
        </div>
        {src && <div className="mx-auto w-full max-w-[260px]"><Phone src={src} alt="Oferta del primer mes con 50 % de descuento en Mi plan" sizes="260px" /></div>}
      </div>
    </section>
  );
}
