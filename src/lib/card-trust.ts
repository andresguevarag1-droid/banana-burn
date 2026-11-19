// Confianza para dejar la tarjeta (#323): cómo funciona la prueba, pago seguro, preguntas del cobro y quién está detrás.
// Solo desde CARD_REQUIRED_FROM (cardRequiredNow): antes, la prueba no pide tarjeta y nada de esto se muestra.
// Todo sale de los datos reales: precios de plans.ts y trial.ts, días de la prueba y del aviso, términos (/terminos).
// Nunca guardes estos textos en constantes de módulo: se calculan en cada render (las páginas públicas son ISR de 1 h).
import { PLANS } from "./plans";
import { TRIAL_DAYS } from "./copy";
import { PROMO_PCT, REMINDER_DAYS_BEFORE, promoPrice } from "./trial";
import { cardRequiredNow } from "./card-required";
import { FIRST_HOME_MIN } from "./engine";
import { fmtMoney } from "./i18n/format";
import type { Locale } from "./i18n/locale";

const [ENTRENO, COMPLETO] = PLANS;
/** Día del cobro (el 8) y del aviso por correo (el 6). */
export const CHARGE_DAY = TRIAL_DAYS + 1;
export const NOTICE_DAY = CHARGE_DAY - REMINDER_DAYS_BEFORE;

export type CardTrust = {
  /** Título del bloque "Así funciona tu prueba". */
  title: string;
  /** Los 4 pasos: etiqueta corta ("Hoy", "Días 1 a 7"…), título y detalle. */
  steps: [string, string, string][];
  /** La línea bajo la línea de tiempo. */
  cancel: string;
  /** Versión de una línea, junto al formulario de tarjeta (bienvenida) y al registro (/entrar). */
  oneLine: string;
  /** Fila "Pago seguro": texto y marcas aceptadas. */
  secure: string;
  brands: string;
  /** Línea chica debajo de cada botón de registro. */
  underCta: string;
  /** Quién está detrás: completa (portada) y corta (anuncio). */
  company: string;
  companyShort: string;
  /** Preguntas frecuentes del cobro. */
  faq: [string, string][];
};

/** Textos de confianza del registro con tarjeta, o null antes de CARD_REQUIRED_FROM. */
export const cardTrust = (locale: Locale = "es-419", now = new Date()): CardTrust | null => (cardRequiredNow(now) ? trustCopy(locale) : null);

/** Los mismos textos sin mirar la fecha: para el paso de la tarjeta de la bienvenida, que ya sabe si la cuenta la necesita. */
export function trustCopy(locale: Locale = "es-419"): CardTrust {
  const m = (n: number) => fmtMoney(n, locale);
  const [e1, c1, ea, ca] = [m(promoPrice("entreno")), m(promoPrice("completo")), m(ENTRENO.price.anual), m(COMPLETO.price.anual)];
  if (locale === "en-US") {
    const charge = `Your plan is charged: monthly with your first month at ${PROMO_PCT}% off (${e1} Training or ${c1} Training + Nutrition), or yearly (${ea} or ${ca}). USD, tax included.`;
    return {
      title: "How your trial works",
      steps: [
        ["Today", "Pick your plan and add your card", "Nothing is charged today."],
        [`Days 1 to ${TRIAL_DAYS}`, "Everything included", `Your first workout takes ${FIRST_HOME_MIN} min, and you can do it at home.`],
        [`Day ${NOTICE_DAY}`, "We email you", "We remind you before the charge, with the date and the amount."],
        [`Day ${CHARGE_DAY}`, "Your plan starts", charge],
      ],
      cancel: `Cancel in 2 taps from My plan. If you cancel before day ${CHARGE_DAY}, you pay nothing.`,
      oneLine: `Nothing is charged today. We email you on day ${NOTICE_DAY} and charge on day ${CHARGE_DAY}. Cancel before then and you pay nothing.`,
      secure: "You pay with ONVO (Costa Rican cards) or Tilopay (other countries). Your card details are stored by the payment processor, not by Banana Burn. Encrypted connection.",
      brands: "Visa and Mastercard",
      underCta: `${TRIAL_DAYS} days free · Nothing charged today · Cancel anytime`,
      company: "Banana Burn is run by Atlas Resources SRL, a company in Costa Rica. Email us at hola@bananaburn.app and a real person will answer.",
      companyShort: "Banana Burn is run by Atlas Resources SRL (Costa Rica). Questions: hola@bananaburn.app.",
      faq: [
        ["Will I be charged today?", `No. Today you pick your plan and add your card, but nothing is charged. You get ${TRIAL_DAYS} days with everything included, and on day ${CHARGE_DAY} your plan is charged: monthly with your first month at ${PROMO_PCT}% off (${e1} Training or ${c1} Training + Nutrition), or yearly (${ea} or ${ca}). Prices in USD, tax included.`],
        ["Will you remind me before charging?", `Yes. On day ${NOTICE_DAY}, ${REMINDER_DAYS_BEFORE} days before the charge, we email you the date and the amount. You can always see them in My plan too.`],
        ["How do I cancel?", `Go to My plan, tap Cancel at no cost and then Confirm cancellation. No calls, no emails. If you cancel before day ${CHARGE_DAY}, nothing is charged and you keep access until your trial ends. If you already pay for a plan, you keep access until the end of the period you paid for.`],
        ["What if I change my mind after paying?", "You have 8 business days from each purchase to withdraw (right of withdrawal under Costa Rica's Law 7472). Email hola@bananaburn.app and we refund your payment. Outside that window we don't give prorated refunds for periods already started, unless the law requires it or we made a billing mistake."],
        ["Is it safe to add my card?", "Yes. You pay with ONVO (Costa Rican cards) or Tilopay (other countries). Your card details are stored by the payment processor, not by Banana Burn, and travel over an encrypted connection. We accept Visa and Mastercard."],
        ["Does it work if I've never been to a gym?", "Yes, it's built for starting from zero. Your first workout is guided step by step, every exercise has an animated demo, and during the first week Coach Banana learns your weights."],
        ["Can I train at home?", `Yes. Choose home with dumbbells or bands, or no equipment, and your plan uses what you have. Your first workout takes ${FIRST_HOME_MIN} min and you can do it at home.`],
      ],
    };
  }
  const charge = `Se cobra tu plan: mensual con el primer mes al ${PROMO_PCT} % (${e1} Entreno o ${c1} ${COMPLETO.name}), o anual (${ea} o ${ca}). USD, IVA incluido.`;
  return {
    title: "Así funciona tu prueba",
    steps: [
      ["Hoy", "Eliges tu plan y dejas tu tarjeta", "Hoy no se cobra nada."],
      [`Días 1 a ${TRIAL_DAYS}`, "Todo incluido", `Tu primer entreno dura ${FIRST_HOME_MIN} min, también en casa.`],
      [`Día ${NOTICE_DAY}`, "Te avisamos por correo", "Antes del cobro, con la fecha y el monto."],
      [`Día ${CHARGE_DAY}`, "Empieza tu plan", charge],
    ],
    cancel: `Cancelas en 2 toques desde Mi plan. Si cancelas antes del día ${CHARGE_DAY}, no pagas nada.`,
    oneLine: `Hoy no se cobra nada. Te avisamos por correo el día ${NOTICE_DAY} y el cobro es el día ${CHARGE_DAY}. Si cancelas antes, no pagas nada.`,
    secure: "Pagas con ONVO (tarjetas de Costa Rica) o Tilopay (otros países). Los datos de tu tarjeta los guarda el procesador, no Banana Burn. Conexión cifrada.",
    brands: "Visa y Mastercard",
    underCta: `${TRIAL_DAYS} días gratis · Hoy no se cobra nada · Cancelas cuando quieras`,
    company: "Banana Burn es de Atlas Resources SRL, una empresa de Costa Rica. Escríbenos a hola@bananaburn.app; te responde una persona.",
    companyShort: "Banana Burn es de Atlas Resources SRL, de Costa Rica. Dudas: hola@bananaburn.app.",
    faq: [
      ["¿Me cobran hoy?", `No. Hoy eliges tu plan y dejas tu tarjeta, pero no se cobra nada. Tienes ${TRIAL_DAYS} días con todo incluido y el día ${CHARGE_DAY} se cobra tu plan: mensual con tu primer mes al ${PROMO_PCT} % (${e1} en Entreno o ${c1} en ${COMPLETO.name}) o anual (${ea} o ${ca}). Precios en dólares (USD), IVA incluido.`],
      ["¿Me avisan antes de cobrar?", `Sí. El día ${NOTICE_DAY}, ${REMINDER_DAYS_BEFORE} días antes del cobro, te escribimos por correo con la fecha y el monto. También los ves siempre en Mi plan.`],
      ["¿Cómo cancelo?", `En Mi plan tocas Cancelar sin costo y luego Confirmar cancelación. Sin llamadas ni correos. Si cancelas antes del día ${CHARGE_DAY}, no se cobra nada y sigues con acceso hasta el final de tu prueba. Si ya pagas un plan, conservas el acceso hasta el final del periodo pagado.`],
      ["¿Y si me arrepiento después de pagar?", "Tienes 8 días hábiles desde cada compra para ejercer tu derecho de retracto, según la Ley 7472 de Costa Rica. Escríbenos a hola@bananaburn.app y te devolvemos el pago. Fuera de ese plazo no hacemos reembolsos proporcionales de periodos ya iniciados, salvo que la ley lo exija o por un error de cobro nuestro."],
      ["¿Es seguro poner mi tarjeta?", "Sí. Pagas con ONVO (tarjetas de Costa Rica) o Tilopay (otros países). Los datos de tu tarjeta los guarda el procesador, no Banana Burn, y viajan por una conexión cifrada. Aceptamos Visa y Mastercard."],
      ["¿Sirve si nunca he ido a un gym?", "Sí, está hecha para empezar de cero. Tu primer entreno es guiado paso a paso, cada ejercicio trae su animación y la primera semana Coach Banana aprende tus pesos."],
      ["¿Puedo entrenar en casa?", `Sí. Eliges casa con mancuernas o bandas, o sin equipo, y el plan usa lo que tienes. Tu primer entreno dura ${FIRST_HOME_MIN} min y también lo puedes hacer en casa.`],
    ],
  };
}

/** Preguntas del cobro primero y después las demás, sin repetir temas. Antes de la fecha, la lista queda igual. */
export function withTrustFaq(items: readonly (readonly [string, string])[], trust: CardTrust | null, drop: readonly string[]): (readonly [string, string])[] {
  if (!trust) return [...items];
  return [...trust.faq, ...items.filter(([q]) => !drop.includes(q))];
}
