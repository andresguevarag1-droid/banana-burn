// Textos de la oferta según la fecha (BETA_ENDS_AT). Hasta el fin de la beta: todo gratis (la oferta de la tarjeta vive
// dentro de la app: quien la deja lista paga 50 % menos su primer mes, cobrado al fin de la beta).
// Desde el fin de la beta (0043): 7 días gratis sin tarjeta; dejarla lista es opcional y da el 50 % del primer mes.
// Desde el 1 de enero de 2027 (#269, cardRequiredNow): la tarjeta se deja al registrarse; 7 días gratis y el día 8 se cobra
// el primer mes con el 50 %. Ningún texto dice "sin tarjeta" desde ese día.
// Las páginas públicas se regeneran cada hora (revalidate = 3600), así que el cambio sale solo en la primera hora del
// 1 de noviembre. Nunca guardes estos textos en constantes de módulo: se calculan en cada render.
import { betaLive } from "./plans";
import { TRIAL_DAYS } from "./copy";
import { PROMO_PCT } from "./trial";
import { cardRequiredNow } from "./card-required";

export type Offer = {
  /** ¿Ya terminó la beta? (desde ahí la prueba son 7 días desde el registro, sin tarjeta). */
  card: boolean;
  /** #269: ¿la tarjeta se pide al registrarse? (desde el 1 de enero de 2027). */
  cardRequired: boolean;
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
      cardRequired: false,
      note: `${TRIAL_DAYS} días gratis con todo incluido.`,
      from: (p) => `Después, desde ${p} al mes.`,
      faqCtaExtra: " Cancela cuando quieras desde Mi plan.",
      seo: `Prueba ${TRIAL_DAYS} días gratis con todo incluido.`,
      riskLine: "Pruebas todo antes de pagar",
      statLabel: "gratis, con todo incluido",
      pricingIntro: (s) => `Pruébalo ${TRIAL_DAYS} días gratis con todo incluido. Después eliges tu plan; con el pago anual ahorras ${s} % e incluye 1 temporada deportiva gratis.`,
      pricingTrial: "En la prueba tienes todo incluido.",
      faqTrial: (n) => `Creas tu cuenta y tienes ${TRIAL_DAYS} días con todo incluido: entreno, Coach Banana, nutrición y Banana Shield. Al terminar eliges Entreno o ${n}; si todavía no eliges, tu progreso queda guardado para cuando vuelvas.`,
      faqCancel: "Desde Mi plan, sin llamadas. Si ya pagas un plan, lo cancelas cuando quieras desde Mi plan y conservas el acceso hasta el final del periodo pagado. Además tienes 8 días hábiles de derecho de retracto desde la compra.",
      guarantee: [`${TRIAL_DAYS} días gratis`, "Pruebas todo antes de pagar, incluida la nutrición y Banana Shield. Cancelas cuando quieras desde Mi plan, sin llamadas."],
      signupChecks: [`${TRIAL_DAYS} días gratis`, "Todo incluido"],
      signupLine: "Al terminar eliges si sigues.",
      ogLine: `Prueba gratis ${TRIAL_DAYS} días`,
      llms: `Prueba gratis de ${TRIAL_DAYS} días con todo incluido.`,
    };
  }
  // #269: desde el 1 de enero de 2027 la tarjeta se deja al registrarse. Hoy no se cobra nada; el día 8 se cobra el primer
  // mes con el 50 % (solo plan mensual; el anual va a precio normal).
  if (cardRequiredNow(now)) {
    return {
      card: true,
      cardRequired: true,
      note: `${TRIAL_DAYS} días gratis con todo incluido. Hoy no se cobra nada.`,
      from: (p) => `Después, desde ${p} al mes.`,
      faqCtaExtra: ` Tu primer mes cuesta ${PROMO_PCT} % menos.`,
      seo: `Prueba ${TRIAL_DAYS} días gratis con todo incluido.`,
      riskLine: "Pruebas todo antes de pagar y te avisamos antes del cobro",
      statLabel: "gratis, con todo incluido",
      pricingIntro: (s) => `Pruébalo ${TRIAL_DAYS} días gratis con todo incluido. Dejas tu tarjeta al registrarte, hoy no se cobra nada y tu primer mes cuesta ${PROMO_PCT} % menos; con el pago anual ahorras ${s} % e incluye 1 temporada deportiva gratis.`,
      pricingTrial: `En la prueba tienes todo incluido. Al terminar se cobra tu primer mes mensual con ${PROMO_PCT} % de descuento, salvo que canceles antes.`,
      faqTrial: (n) => `Creas tu cuenta, dejas tu tarjeta con Entreno o ${n} y tienes ${TRIAL_DAYS} días con todo incluido (entreno, Coach Banana, nutrición y Banana Shield). Hoy no te cobramos: te avisamos 2 días antes y el día ${TRIAL_DAYS + 1} se cobra tu primer mes con ${PROMO_PCT} % de descuento (plan mensual), salvo que canceles antes desde Mi plan.`,
      faqCancel: `Desde Mi plan, sin llamadas. Si cancelas antes del final de la prueba, no se cobra nada y sigues con acceso hasta ese día. Si ya pagas un plan, lo cancelas cuando quieras y conservas el acceso hasta el final del periodo pagado. Además tienes 8 días hábiles de derecho de retracto desde cada compra.`,
      guarantee: [`${TRIAL_DAYS} días gratis`, `Pruebas todo antes de pagar, incluida la nutrición y Banana Shield. Te avisamos 2 días antes del cobro y cancelas sin costo antes de esa fecha.`],
      signupChecks: [`${TRIAL_DAYS} días gratis`, `${PROMO_PCT} % el primer mes`],
      signupLine: `Hoy no se cobra nada y tu primer mes cuesta ${PROMO_PCT} % menos.`,
      ogLine: `Prueba gratis ${TRIAL_DAYS} días`,
      llms: `Prueba gratis de ${TRIAL_DAYS} días con todo incluido. Al registrarse se deja la tarjeta: ese día no se cobra nada, hay aviso 2 días antes y al terminar la prueba se cobra el plan elegido, con ${PROMO_PCT} % de descuento en el primer mes del plan mensual. Se cancela sin costo antes desde Mi plan.`,
    };
  }
  // Desde el fin de la beta (0043): 7 días gratis sin tarjeta desde el registro. Dejar la tarjeta lista es opcional y da el
  // 50 % del primer mes (solo plan mensual).
  return {
    card: true,
    cardRequired: false,
    note: `${TRIAL_DAYS} días gratis con todo incluido, sin tarjeta.`,
    from: (p) => `Después, desde ${p} al mes.`,
    faqCtaExtra: ` Si dejas tu tarjeta lista, tu primer mes cuesta ${PROMO_PCT} % menos.`,
    seo: `Prueba ${TRIAL_DAYS} días gratis con todo incluido, sin tarjeta.`,
    riskLine: "Pruebas todo antes de pagar, sin tarjeta",
    statLabel: "gratis, sin tarjeta",
    pricingIntro: (s) => `Pruébalo ${TRIAL_DAYS} días gratis con todo incluido, sin tarjeta. Si dejas tu tarjeta lista, tu primer mes cuesta ${PROMO_PCT} % menos; con el pago anual ahorras ${s} % e incluye 1 temporada deportiva gratis.`,
    pricingTrial: `En la prueba tienes todo incluido, sin tarjeta. Si la dejas lista antes de que termine, tu primer mes mensual cuesta ${PROMO_PCT} % menos.`,
    faqTrial: (n) => `Creas tu cuenta y tienes ${TRIAL_DAYS} días con todo incluido (entreno, Coach Banana, nutrición y Banana Shield), sin tarjeta. Si quieres, dejas tu tarjeta lista con Entreno o ${n} mensual: hoy no te cobramos, te avisamos 2 días antes y al terminar la prueba se cobra tu primer mes con ${PROMO_PCT} % de descuento, salvo que canceles antes desde Mi plan. Si no la dejas, al terminar eliges tu plan y tu progreso queda guardado.`,
    faqCancel: `Desde Mi plan, sin llamadas. Si dejaste tu tarjeta lista y cancelas antes del final de la prueba, no se cobra nada y sigues con acceso hasta ese día. Si ya pagas un plan, lo cancelas cuando quieras y conservas el acceso hasta el final del periodo pagado. Además tienes 8 días hábiles de derecho de retracto desde cada compra.`,
    guarantee: [`${TRIAL_DAYS} días gratis, sin tarjeta`, `Pruebas todo antes de pagar, incluida la nutrición y Banana Shield. Si dejas tu tarjeta lista, te avisamos 2 días antes del cobro y cancelas sin costo antes de esa fecha.`],
    signupChecks: [`${TRIAL_DAYS} días gratis`, "Sin tarjeta"],
    signupLine: `Si dejas tu tarjeta lista, tu primer mes cuesta ${PROMO_PCT} % menos.`,
    ogLine: `Prueba gratis ${TRIAL_DAYS} días`,
    llms: `Prueba gratis de ${TRIAL_DAYS} días con todo incluido, sin tarjeta. Opcional: quien deja su tarjeta lista antes de su primer cobro y nunca pagó un plan recibe ${PROMO_PCT} % de descuento en su primer mes del plan mensual; ese día no se cobra nada, hay aviso 2 días antes del cobro y se cancela sin costo antes desde Mi plan.`,
  };
}
