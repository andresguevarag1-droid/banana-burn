// Textos de la oferta según la fecha (BETA_ENDS_AT). Hasta el fin de la beta: la prueba sin tarjeta, igual que siempre.
// Desde el fin de la beta: la tarjeta se guarda, hoy no se cobra y el día 7 se cobra el plan, salvo que se cancele antes.
// Las páginas públicas se regeneran cada hora (revalidate = 3600), así que el cambio sale solo en la primera hora del
// 1 de noviembre. Nunca guardes estos textos en constantes de módulo: se calculan en cada render.
import { betaLive } from "./plans";
import { TRIAL_DAYS } from "./copy";
import { TRIAL_CARD_LINE } from "./trial";

export type Offer = {
  /** ¿Ya se pide tarjeta? */
  card: boolean;
  /** Nota bajo los botones de registro. */
  note: string;
  /** Lo que sigue a la nota con el precio de entrada, p. ej. "Después, desde $5.00 al mes." */
  from: (price: string) => string;
  /** Frase extra en la tarjeta de preguntas frecuentes. */
  faqCtaExtra: string;
  /** Final de las descripciones para buscadores ("Prueba 7 días gratis, sin tarjeta."). */
  seo: string;
  /** Garantía corta junto al botón final del inicio. */
  riskLine: string;
  /** Etiqueta de la cifra "7 días". */
  statLabel: string;
  /** Introducción de la sección de precios. */
  pricingIntro: (savePct: number) => string;
  /** Precios: lo que pasa en la prueba. */
  pricingTrial: string;
  /** Pregunta frecuente: "¿Cómo funciona la prueba gratis?". */
  faqTrial: (planName: string) => string;
  /** Pregunta frecuente: "¿Cómo cancelo? ¿Hay reembolso?". */
  faqCancel: string;
  /** Garantía de los planes (título y detalle). */
  guarantee: [string, string];
  /** Dos marcas cortas bajo el registro. */
  signupChecks: [string, string];
  /** Línea de la pantalla de entrar. */
  signupLine: string;
  /** Imagen para compartir. */
  ogLine: string;
  /** llms.txt. */
  llms: string;
};

export function offer(now = new Date()): Offer {
  if (betaLive(now)) {
    return {
      card: false,
      note: `${TRIAL_DAYS} días gratis con todo incluido. Sin tarjeta.`,
      from: (p) => `Después, desde ${p} al mes.`,
      faqCtaExtra: " Sin cobros automáticos al terminar.",
      seo: `Prueba ${TRIAL_DAYS} días gratis, sin tarjeta.`,
      riskLine: "Sin tarjeta y sin cobros automáticos",
      statLabel: "gratis, sin tarjeta",
      pricingIntro: (s) => `Pruébalo ${TRIAL_DAYS} días gratis con todo incluido y sin tarjeta. Después eliges tu plan; con el pago anual ahorras ${s} %.`,
      pricingTrial: "En la prueba tienes todo incluido y no pedimos tarjeta.",
      faqTrial: (n) => `Creas tu cuenta y tienes ${TRIAL_DAYS} días con todo incluido: entreno, Coach Banana, nutrición y Banana Shield. No pedimos tarjeta, así que no hay cobros sorpresa. Al terminar eliges Entreno o ${n}; si todavía no eliges, tu progreso queda guardado para cuando vuelvas.`,
      faqCancel: "Durante la prueba no hay nada que cancelar, porque no pedimos tarjeta. Si ya pagas un plan, lo cancelas cuando quieras desde Mi suscripción y conservas el acceso hasta el final del periodo pagado. Además tienes 8 días hábiles de derecho de retracto desde la compra.",
      guarantee: [`${TRIAL_DAYS} días gratis, sin tarjeta`, "Pruebas todo antes de pagar, incluida la nutrición y Banana Shield. Como no pedimos tarjeta, no hay cobros sorpresa cuando termina."],
      signupChecks: ["Sin tarjeta", "Sin cobros automáticos"],
      signupLine: "Sin tarjeta. Al terminar eliges si sigues.",
      ogLine: `Prueba gratis ${TRIAL_DAYS} días, sin tarjeta`,
      llms: `Prueba gratis de ${TRIAL_DAYS} días con todo incluido, sin tarjeta.`,
    };
  }
  return {
    card: true,
    note: TRIAL_CARD_LINE,
    from: (p) => `Planes desde ${p} al mes.`,
    faqCtaExtra: " Te avisamos 2 días antes del cobro.",
    seo: `Prueba ${TRIAL_DAYS} días gratis: hoy no te cobramos y cancelas sin costo antes del día ${TRIAL_DAYS}.`,
    riskLine: `Hoy no te cobramos: cancela antes del día ${TRIAL_DAYS} sin costo`,
    statLabel: "gratis, cancela sin costo",
    pricingIntro: (s) => `${TRIAL_CARD_LINE} Con el pago anual ahorras ${s} %.`,
    pricingTrial: `En la prueba tienes todo incluido. Guardas tu tarjeta, hoy no te cobramos y el día ${TRIAL_DAYS} se cobra tu plan, salvo que canceles antes.`,
    faqTrial: (n) => `Creas tu cuenta, eliges Entreno o ${n} y guardas tu tarjeta. Hoy no te cobramos: tienes ${TRIAL_DAYS} días con todo incluido (entreno, Coach Banana, nutrición y Banana Shield). Te avisamos 2 días antes y el día ${TRIAL_DAYS} se cobra el plan que elegiste, salvo que canceles antes desde Mi plan.`,
    faqCancel: `Desde Mi plan, sin llamadas. Si cancelas antes del día ${TRIAL_DAYS} no se cobra nada y sigues con acceso hasta el final de la prueba. Si ya pagas un plan, lo cancelas cuando quieras y conservas el acceso hasta el final del periodo pagado. Además tienes 8 días hábiles de derecho de retracto desde cada compra.`,
    guarantee: [`${TRIAL_DAYS} días gratis, hoy no te cobramos`, `Pruebas todo antes de pagar, incluida la nutrición y Banana Shield. Te avisamos 2 días antes del cobro y si cancelas antes del día ${TRIAL_DAYS} no se cobra nada.`],
    signupChecks: ["Hoy no te cobramos", `Cancela antes del día ${TRIAL_DAYS}`],
    signupLine: TRIAL_CARD_LINE,
    ogLine: `Prueba gratis ${TRIAL_DAYS} días`,
    llms: `Prueba gratis de ${TRIAL_DAYS} días con todo incluido: se guarda la tarjeta, ese día no se cobra y el día ${TRIAL_DAYS} se cobra el plan elegido, salvo que se cancele antes. Aviso 2 días antes del cobro.`,
  };
}
