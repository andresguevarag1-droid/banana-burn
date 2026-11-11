// en-US: textos de la oferta (src/lib/offer.ts), en sus tres etapas (beta, prueba sin tarjeta y tarjeta al registrarse).
import { TRIAL_DAYS } from "@/lib/plans";

const D = TRIAL_DAYS;
const P = 50; // PROMO_PCT (src/lib/trial.ts); offer-en.test.ts avisa si cambia.

export const OFFER: Record<string, string> = {
  // Comunes
  "Después, desde {price} al mes.": "Then from {price}/month.",
  [`${D} días gratis`]: `${D} days free`,
  [`Prueba gratis ${D} días`]: `Try it free for ${D} days`,
  "gratis, con todo incluido": "free, everything included",
  [`Prueba ${D} días gratis con todo incluido.`]: `Try it free for ${D} days, everything included.`,
  [`Prueba gratis de ${D} días con todo incluido.`]: `${D}-day free trial with everything included.`,
  // Beta
  [`${D} días gratis con todo incluido.`]: `${D} days free, everything included.`,
  "Cancela cuando quieras desde Mi plan.": "Cancel anytime from My plan.",
  "Pruebas todo antes de pagar": "Try everything before you pay",
  [`Pruébalo ${D} días gratis con todo incluido. Después eliges tu plan; con el pago anual ahorras {pct} % e incluye 1 temporada deportiva gratis.`]:
    `Try it free for ${D} days with everything included. Then pick your plan. Pay yearly and save {pct}%, plus 1 free sports season.`,
  "En la prueba tienes todo incluido.": "Your trial includes everything.",
  [`Creas tu cuenta y tienes ${D} días con todo incluido: entreno, Coach Banana, nutrición y Banana Shield. Al terminar eliges Entreno o {plan}; si todavía no eliges, tu progreso queda guardado para cuando vuelvas.`]:
    `Create your account and get ${D} days with everything included: workouts, Coach Banana, nutrition and Banana Shield. When it ends, pick Training or {plan}. If you're not ready yet, your progress stays saved for when you come back.`,
  "Desde Mi plan, sin llamadas. Si ya pagas un plan, lo cancelas cuando quieras desde Mi plan y conservas el acceso hasta el final del periodo pagado. Además tienes 8 días hábiles de derecho de retracto desde la compra.":
    "From My plan, no phone calls. If you're on a paid plan, cancel anytime from My plan and keep access until the end of the period you paid for. You also have 8 business days after a purchase to change your mind.",
  "Pruebas todo antes de pagar, incluida la nutrición y Banana Shield. Cancelas cuando quieras desde Mi plan, sin llamadas.":
    "Try everything before you pay, including nutrition and Banana Shield. Cancel anytime from My plan, no phone calls.",
  "Todo incluido": "Everything included",
  "Al terminar eliges si sigues.": "When it ends, you decide whether to keep going.",
  // Tarjeta al registrarse (desde el 1 de diciembre de 2026)
  [`${D} días gratis con todo incluido. Hoy no se cobra nada.`]: `${D} days free, everything included. You won't be charged today.`,
  [`Tu primer mes cuesta ${P} % menos.`]: `Your first month is ${P}% off.`,
  "Pruebas todo antes de pagar y te avisamos antes del cobro": "Try everything before you pay, and we'll remind you before any charge",
  [`Pruébalo ${D} días gratis con todo incluido. Dejas tu tarjeta al registrarte, hoy no se cobra nada y tu primer mes cuesta ${P} % menos; con el pago anual ahorras {pct} % e incluye 1 temporada deportiva gratis.`]:
    `Try it free for ${D} days with everything included. Add your card when you sign up, pay nothing today, and get ${P}% off your first month. Pay yearly and save {pct}%, plus 1 free sports season.`,
  [`En la prueba tienes todo incluido. Al terminar se cobra tu primer mes mensual con ${P} % de descuento, salvo que canceles antes.`]:
    `Your trial includes everything. When it ends, your first monthly payment is ${P}% off, unless you cancel before.`,
  [`Creas tu cuenta, dejas tu tarjeta con Entreno o {plan} y tienes ${D} días con todo incluido (entreno, Coach Banana, nutrición y Banana Shield). Hoy no te cobramos: te avisamos 2 días antes y el día ${D + 1} se cobra tu primer mes con ${P} % de descuento (plan mensual), salvo que canceles antes desde Mi plan.`]:
    `Create your account, add your card with Training or {plan}, and get ${D} days with everything included (workouts, Coach Banana, nutrition and Banana Shield). We don't charge you today: we remind you 2 days before, and on day ${D + 1} your first month is charged at ${P}% off (monthly plan), unless you cancel before from My plan.`,
  "Desde Mi plan, sin llamadas. Si cancelas antes del final de la prueba, no se cobra nada y sigues con acceso hasta ese día. Si ya pagas un plan, lo cancelas cuando quieras y conservas el acceso hasta el final del periodo pagado. Además tienes 8 días hábiles de derecho de retracto desde cada compra.":
    "From My plan, no phone calls. Cancel before your trial ends and you pay nothing, with access until that day. If you're on a paid plan, cancel anytime and keep access until the end of the period you paid for. You also have 8 business days after each purchase to change your mind.",
  "Pruebas todo antes de pagar, incluida la nutrición y Banana Shield. Te avisamos 2 días antes del cobro y cancelas sin costo antes de esa fecha.":
    "Try everything before you pay, including nutrition and Banana Shield. We remind you 2 days before the charge, and you can cancel for free before then.",
  [`${P} % el primer mes`]: `${P}% off your first month`,
  [`Hoy no se cobra nada y tu primer mes cuesta ${P} % menos.`]: `You pay nothing today and your first month is ${P}% off.`,
  [`Prueba gratis de ${D} días con todo incluido. Al registrarse se deja la tarjeta: ese día no se cobra nada, hay aviso 2 días antes y al terminar la prueba se cobra el plan elegido, con ${P} % de descuento en el primer mes del plan mensual. Se cancela sin costo antes desde Mi plan.`]:
    `${D}-day free trial with everything included. You add your card at signup: nothing is charged that day, you get a reminder 2 days before, and when the trial ends the plan you picked is charged, with ${P}% off the first month of the monthly plan. Cancel for free before then from My plan.`,
  // Prueba sin tarjeta (desde el fin de la beta)
  [`${D} días gratis con todo incluido, sin tarjeta.`]: `${D} days free, everything included. No card needed.`,
  [`Si dejas tu tarjeta lista, tu primer mes cuesta ${P} % menos.`]: `Add your card early and your first month is ${P}% off.`,
  [`Prueba ${D} días gratis con todo incluido, sin tarjeta.`]: `Try it free for ${D} days, everything included. No card needed.`,
  "Pruebas todo antes de pagar, sin tarjeta": "Try everything before you pay, no card needed",
  "gratis, sin tarjeta": "free, no card needed",
  [`Pruébalo ${D} días gratis con todo incluido, sin tarjeta. Si dejas tu tarjeta lista, tu primer mes cuesta ${P} % menos; con el pago anual ahorras {pct} % e incluye 1 temporada deportiva gratis.`]:
    `Try it free for ${D} days with everything included, no card needed. Add your card early and your first month is ${P}% off. Pay yearly and save {pct}%, plus 1 free sports season.`,
  [`En la prueba tienes todo incluido, sin tarjeta. Si la dejas lista antes de que termine, tu primer mes mensual cuesta ${P} % menos.`]:
    `Your trial includes everything, no card needed. Add your card before it ends and your first monthly payment is ${P}% off.`,
  [`Creas tu cuenta y tienes ${D} días con todo incluido (entreno, Coach Banana, nutrición y Banana Shield), sin tarjeta. Si quieres, dejas tu tarjeta lista con Entreno o {plan} mensual: hoy no te cobramos, te avisamos 2 días antes y al terminar la prueba se cobra tu primer mes con ${P} % de descuento, salvo que canceles antes desde Mi plan. Si no la dejas, al terminar eliges tu plan y tu progreso queda guardado.`]:
    `Create your account and get ${D} days with everything included (workouts, Coach Banana, nutrition and Banana Shield), no card needed. If you want, add your card with Training or {plan} monthly: we don't charge you today, we remind you 2 days before, and when the trial ends your first month is ${P}% off, unless you cancel before from My plan. If you don't, you pick your plan when it ends and your progress stays saved.`,
  "Desde Mi plan, sin llamadas. Si dejaste tu tarjeta lista y cancelas antes del final de la prueba, no se cobra nada y sigues con acceso hasta ese día. Si ya pagas un plan, lo cancelas cuando quieras y conservas el acceso hasta el final del periodo pagado. Además tienes 8 días hábiles de derecho de retracto desde cada compra.":
    "From My plan, no phone calls. If you added your card and cancel before your trial ends, you pay nothing and keep access until that day. If you're on a paid plan, cancel anytime and keep access until the end of the period you paid for. You also have 8 business days after each purchase to change your mind.",
  [`${D} días gratis, sin tarjeta`]: `${D} days free, no card needed`,
  "Pruebas todo antes de pagar, incluida la nutrición y Banana Shield. Si dejas tu tarjeta lista, te avisamos 2 días antes del cobro y cancelas sin costo antes de esa fecha.":
    "Try everything before you pay, including nutrition and Banana Shield. If you add your card, we remind you 2 days before the charge and you can cancel for free before then.",
  "Sin tarjeta": "No card needed",
  [`Prueba gratis de ${D} días con todo incluido, sin tarjeta. Opcional: quien deja su tarjeta lista antes de su primer cobro y nunca pagó un plan recibe ${P} % de descuento en su primer mes del plan mensual; ese día no se cobra nada, hay aviso 2 días antes del cobro y se cancela sin costo antes desde Mi plan.`]:
    `${D}-day free trial with everything included, no card needed. Optional: anyone who adds a card before their first charge and never paid for a plan gets ${P}% off the first month of the monthly plan. Nothing is charged that day, there's a reminder 2 days before, and you can cancel for free before then from My plan.`,
};
