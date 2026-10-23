// Contenido compartido de las páginas públicas (inicio, precios, GLP-1): oferta, preguntas y comparación.
import { TECHNIQUE_COUNT } from "@/lib/exercise-frames";
import Link from "next/link";
import { ArrowRight, Check, Minus, X } from "@/components/icons";
import { PLANS, perMonthAnnual } from "@/lib/plans";
import { GLP1, TRIAL_DAYS, money } from "@/lib/copy";
import { offer } from "@/lib/offer";

export const [ENTRENO, COMPLETO] = PLANS;
/** Precio de entrada: Entreno con pago anual, por mes. */
export const FROM = money(perMonthAnnual(ENTRENO));
export const SIGNUP = "/entrar?modo=registro";
/** Registro con intención de Banana Shield: el plan que lo incluye queda elegido para después de la prueba. */
export const SIGNUP_GLP1 = `${SIGNUP}&programa=glp1&plan=${COMPLETO.id}&pago=anual`;
/** CTA principal, orientado al resultado; la nota de la prueba va siempre justo debajo. */
export const TRIAL_CTA = "Crear mi plan gratis";
/** Técnicas con animación de Coach Banana (hojas de fotogramas en src/lib/exercise-frames.ts). */
export const ANIMATED_TECHNIQUES = TECHNIQUE_COUNT;
/** Nota de la prueba bajo los botones de registro. Según la fecha (offer.ts): se calcula en cada render, nunca al cargar el módulo. */
export const trialNote = (now = new Date()) => offer(now).note;

/** Preguntas frecuentes. Las de la prueba y la cancelación cambian solas con el fin de la beta (offer.ts). */
export const faq = (now = new Date()): (readonly [string, string])[] => {
  const o = offer(now);
  return [
  ["¿Cómo funciona la prueba gratis?", o.faqTrial(COMPLETO.name)],
  ["¿Por qué pagar si hay rutinas gratis en internet?", `Una rutina gratis no sabe cuánto levantaste ayer, cuánto tiempo tienes hoy ni qué comiste. Banana Burn ajusta tu plan en cada sesión y cada semana. Pruébalo ${TRIAL_DAYS} días gratis y decide; con el plan anual son ${FROM} al mes.`],
  ["No tengo tiempo. ¿Me sirve?", "Sí. Eliges cuántos minutos tienes por sesión, de 15 a 60, y en los días apretados hay entrenos exprés de 10, 20 o 30 minutos sin equipo."],
  ["¿Sirve si entreno en casa o sin equipo?", "Sí. Eliges gym, casa (mancuernas o bandas) o sin equipo, y el plan cambia los ejercicios por variantes que puedes hacer con lo que tienes."],
  ["¿Necesito experiencia en el gym?", "No. Cada ejercicio trae animación y guía de técnica. La primera semana es de calibración: la app aprende tus pesos."],
  ["Uso Ozempic o Mounjaro. ¿Es para mí?", `Sí. Banana Shield, incluido en ${COMPLETO.name} y en tu prueba gratis, prioriza fuerza y proteína para que lo que bajes sea grasa y no músculo, y baja la intensidad en tu día de inyección. No damos indicaciones sobre tu medicamento: eso lo ves con tu médico.`],
  ["¿Cuánto peso voy a bajar?", "Depende de ti y de tu punto de partida, así que no prometemos un número. Un ritmo sano es de 0.5 a 1 % de tu peso por semana, y la app mide tu tendencia real para mantenerte en ese rango sin perder músculo."],
  ["¿Cómo cancelo? ¿Hay reembolso?", o.faqCancel],
  ["¿Qué diferencia hay entre los planes?", "Entreno incluye tu rutina, el peso de cada serie, Coach Banana para tus dudas de entreno, tu progreso, agua, pasos y sueño, la comunidad, los retos gratis y los niveles. Entreno + Nutrición suma tus calorías y macros, el registro de comidas, las recetas, el ajuste semanal según tu peso y Banana Shield. Los retos Premium no vienen en ningún plan: se compran aparte con un pago único."],
  ["¿Cómo pago?", "Con tarjeta de crédito o débito, procesado por ONVO Pay. Los precios están en dólares (USD) y tu banco hace la conversión si tu tarjeta es en otra moneda."],
  ["¿Mis datos están seguros?", "Tus datos de salud son privados y solo tuyos. Puedes exportarlos o borrar tu cuenta cuando quieras. Los tratamos según nuestra Política de privacidad y la ley de protección de datos de Costa Rica, donde está la empresa."],
  ["¿Es en español de verdad?", "Sí. Banana Burn está en español latino desde el primer día y pensada para Latinoamérica: los ejercicios, el coach y las comidas. No es una app traducida."],
  ["¿Tengo que descargarla de una tienda?", "No. Es una app web: la abres en el navegador y la instalas en tu pantalla de inicio, en iPhone o Android."],
  ];
};

/** Preguntas de /precios: las de dinero primero. */
export const pricingFaq = (now = new Date()) => { const f = faq(now); return [0, 7, 8, 1, 5, 10].map((i) => f[i]); };

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
  ["Corrige tu técnica en persona", "Con animaciones", true, false, false],
  [PAY_ROW, `${TRIAL_DAYS} días gratis, luego desde ${FROM} al mes`, "Por sesión o paquete", "Suscripción", "Pago único"],
];

/** Banana Burn lleva la marca más fuerte (círculo tinta con check banana); las demás opciones, una marca discreta. */
function MarkCell({ v, ours }: { v: Mark; ours: boolean }) {
  if (v === true) return ours
    ? <><span aria-hidden className="grid place-items-center size-8 rounded-full bg-ink"><Check weight="bold" className="size-4.5 text-banana" /></span><span className="sr-only">Sí</span></>
    : <><Check weight="regular" aria-hidden className="size-5 text-muted" /><span className="sr-only">Sí</span></>;
  if (v === false) return <><X weight="bold" aria-hidden className="size-5 text-faint" /><span className="sr-only">No</span></>;
  return ours
    ? <span className="text-sm font-extrabold text-ink text-balance">{v}</span>
    : <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted"><Minus weight="bold" aria-hidden className="size-4 shrink-0 text-faint" />{v}</span>;
}

export function Compare({ heading = "h2" }: { heading?: "h2" | "h3" }) {
  const H = heading;
  return (
    <section id="comparar" aria-labelledby="comparar-titulo" className="mx-auto max-w-6xl px-4 sm:px-6 pt-24 scroll-mt-20">
      <div className="max-w-3xl">
        <H id="comparar-titulo" className="text-4xl sm:text-5xl font-extrabold tracking-tight text-ink text-balance">Lo que te da cada opción, sin adornos.</H>
        <p className="mt-4 text-lg text-muted leading-relaxed text-pretty max-w-[60ch]">Un entrenador en persona es lo mejor para corregir tu técnica. Banana Burn te da casi todo lo demás todos los días, en español y con tu comida, por mucho menos de lo que cuesta un entrenador cada mes.</p>
      </div>
      <p aria-hidden className="mt-8 flex items-center gap-1.5 text-sm font-semibold text-muted md:hidden">Desliza la tabla para ver las otras opciones <ArrowRight weight="bold" className="size-4" /></p>
      <div tabIndex={0} role="region" aria-label="Tabla comparativa" className="relative mt-3 md:mt-10 overflow-x-auto rounded-3xl border border-line bg-white focus:outline-none focus-visible:ring-4 focus-visible:ring-banana">
        <table className="w-full min-w-[680px] border-collapse text-left">
          <caption className="sr-only">Comparación de Banana Burn con un entrenador personal, apps extranjeras y un PDF de rutina</caption>
          <thead>
            <tr className="border-b border-line text-sm font-bold text-ink">
              <td className="sticky left-0 z-10 bg-white p-4 w-[30%]" />
              {COLS.map((c, i) => <th key={c} scope="col" className={`p-4 text-center leading-tight ${i === 0 ? "bg-banana text-base font-extrabold" : "text-muted"}`}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([f, ...vals]) => (
              <tr key={f} className="border-b border-line last:border-0">
                <th scope="row" className="sticky left-0 z-10 bg-white p-4 text-[15px] font-semibold text-ink text-pretty">{f}</th>
                {vals.map((v, i) => (
                  <td key={i} className={`p-4 text-center ${i === 0 ? "bg-banana/20" : ""}`}>
                    <span className="inline-flex justify-center">{f === PAY_ROW && i > 0 ? <span className="text-sm font-semibold text-muted">{v}</span> : <MarkCell v={v} ours={i === 0} />}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export { GLP1 };

/** CTA que acompaña al título de las preguntas frecuentes en escritorio. */
export function FaqCta({ href = SIGNUP, cta }: { href?: string; cta: string }) {
  return (
    <div className="mt-8 hidden lg:block rounded-3xl bg-banana-soft p-6">
      <p className="font-extrabold text-ink text-balance">La mejor respuesta es probarlo.</p>
      <p className="mt-1 text-sm text-ink/75 text-pretty">{trialNote()}{offer().faqCtaExtra}</p>
      <Link href={href} data-cta={cta} className="mt-4 btn-primary h-12 px-5">{TRIAL_CTA} <ArrowRight className="size-4" /></Link>
    </div>
  );
}
