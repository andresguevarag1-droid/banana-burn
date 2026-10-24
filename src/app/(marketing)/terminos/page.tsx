import { LegalPage, type LegalSection } from "../legal";
import { social } from "../seo";
import { TRIAL_DAYS } from "@/lib/copy";
import { BETA_ENDS_AT, BETA_GRACE_UNTIL, PLANS, betaLive } from "@/lib/plans";
import { money } from "@/lib/copy";
import { PROMO_PCT, PROMO_TERMS, promoPrice } from "@/lib/trial";

const ENTRENO = PLANS.find((p) => p.id === "entreno")!;

const TZ = "America/Costa_Rica";
const day = (ms: number) => new Date(ms).toLocaleDateString("es-419", { day: "numeric", month: "long", year: "numeric", timeZone: TZ });

/**
 * Prueba gratis, tarjeta opcional y 50 % del primer mes (0043). Hasta el fin de la beta se muestran las reglas de la beta
 * y las de las cuentas nuevas desde el 1 de noviembre; desde esa fecha, las nuevas y el cierre de la beta. Las cuentas de la
 * beta siguen gratis 7 días después del lanzamiento (BETA_GRACE_UNTIL, 0045). Se calcula en cada render.
 */
function trialSection(now = new Date()): LegalSection {
  const launch = Date.parse(BETA_ENDS_AT), grace = Date.parse(BETA_GRACE_UNTIL);
  const lastBeta = day(launch - 1), launchDay = day(launch);
  const lastFree = day(grace - 1), firstPaid = day(grace);
  const promo = [
    `Dejar tu tarjeta lista es opcional. Si la guardas antes de tu primer cobro y nunca pagaste un plan, tu primer mes del plan mensual cuesta ${PROMO_PCT} % menos (por ejemplo, ${money(promoPrice("entreno"))} en vez de ${money(ENTRENO.price.mes)}). ${PROMO_TERMS}`,
    "El día que guardas la tarjeta no se te cobra nada. Te avisamos 2 días antes del cobro por correo, y también en la app y por notificación si las tienes activadas. En Mi plan siempre ves la fecha y el monto del cobro.",
    "Puedes cancelar sin costo desde Mi plan en cualquier momento antes del cobro: no se cobra nada y sigues con acceso hasta el final de tu prueba. Al cancelar eliges si quitamos tu tarjeta guardada o si la conservamos.",
    "Si el cobro no pasa, el acceso queda en pausa (no se borra nada), te avisamos y lo intentamos una sola vez más al día siguiente. Puedes cambiar tu tarjeta en Mi plan cuando quieras; el cobro se hace en ese momento.",
    "Desde el segundo mes se cobra el precio normal del plan y la suscripción se renueva cada mes o cada año hasta que la canceles.",
    "El número de tu tarjeta lo escribes en la página de nuestro procesador de pagos (ONVO Pay para tarjetas de Costa Rica, Tilopay para tarjetas de otros países) y nunca pasa por nuestros servidores. Solo guardamos la marca, los últimos 4 dígitos y el vencimiento para mostrártelos.",
  ];
  const rules = [
    `Al crear tu cuenta tienes ${TRIAL_DAYS} días de prueba gratis desde el registro, con todas las funciones, incluida la nutrición y Banana Shield, sin tarjeta. Al terminar, si no elegiste un plan, verás la pantalla de planes; tus datos quedan guardados.`,
    [`Si dejas tu tarjeta lista durante la prueba, el primer cobro es el día en que termina tu prueba (${TRIAL_DAYS} días después del registro), salvo que canceles antes. Guardar la tarjeta no alarga la prueba.`, ...promo, "La prueba gratis es una por persona y solo para cuentas nuevas."],
  ] as LegalSection["p"];
  if (!betaLive(now)) return { id: "prueba", t: "Prueba gratis, tarjeta y primer cobro", p: [...rules, `Las cuentas creadas durante la versión de prueba (hasta el ${lastBeta}) tienen acceso completo y gratis hasta el ${lastFree}, sin tarjeta. Si dejan su tarjeta lista antes, el primer cobro es el ${firstPaid}, con el ${PROMO_PCT} % de descuento en el primer mes si es mensual, salvo que cancelen antes. Si no la dejan, desde el ${firstPaid} ven la pantalla de planes hasta que elijan uno y paguen. No reciben días gratis adicionales después del ${lastFree}.`] };
  return { id: "prueba", t: "Versión de prueba, prueba gratis y primer cobro", p: [
    `Hasta el ${lastBeta} Banana Burn está en versión de prueba: todas las cuentas tienen acceso completo y gratis, sin tarjeta. Banana Burn se lanza el ${launchDay}, y las cuentas creadas durante la versión de prueba siguen con acceso completo y gratis hasta el ${lastFree}.`,
    `Desde el ${firstPaid} se cobran los planes a esas cuentas. Si ya tienes cuenta, puedes dejar tu tarjeta lista antes de esa fecha: no se cobra nada al guardarla y el ${firstPaid} se cobra el plan que elegiste (con el ${PROMO_PCT} % de descuento en tu primer mes si es mensual), salvo que canceles antes. Si no la guardas, desde el ${firstPaid} verás la pantalla de planes hasta que elijas uno y pagues. Las cuentas creadas durante la versión de prueba no reciben días gratis adicionales después del ${lastFree}.`,
    [...promo],
    `Para las cuentas nuevas desde el ${launchDay} aplica lo siguiente:`,
    ...rules,
  ] };
}

const DESCRIPTION = `Condiciones de uso de Banana Burn: servicio, salud, prueba gratis de ${TRIAL_DAYS} días y primer cobro, suscripciones, comunidad y responsabilidad.`;
export const metadata = { title: "Términos y condiciones", description: DESCRIPTION, ...social({ title: "Términos y condiciones de Banana Burn", description: DESCRIPTION, path: "/terminos" }) };

/** La sección "prueba" se arma en cada render con trialSection() (depende de la fecha). */
const SECTIONS: LegalSection[] = [
  { id: "servicio", t: "El servicio", p: [
    // TODO(dueño): agregar la cédula jurídica de Atlas Resources SRL cuando esté confirmada.
    "Banana Burn es una aplicación web de entrenamiento y nutrición con un entrenador basado en inteligencia artificial, operada por Atlas Resources SRL, sociedad costarricense con domicilio en San José, Costa Rica. Te da rutinas, cargas sugeridas, metas de calorías y proteína, recetas, retos y una comunidad. Al crear una cuenta aceptas estos términos y la Política de privacidad.",
  ] },
  { id: "salud", t: "Salud y seguridad", p: [
    "Banana Burn no es un servicio médico ni sustituye la consulta con un profesional de salud. La información es general y educativa.",
    ["Consulta a tu médico antes de empezar, sobre todo si tienes una condición del corazón, presión alta, lesiones, estás embarazada o tomas medicamentos.", "Si sientes dolor de pecho, mareo, falta de aire o dolor agudo, detente de inmediato y busca atención médica. En una emergencia llama al número de emergencias de tu país.", "El programa Banana Shield acompaña a personas que usan medicamentos GLP-1 recetados por su médico. No damos indicaciones sobre dosis, cambios ni suspensión del medicamento, y no recomendamos péptidos ni compuestos no aprobados.", "Tú decides las cargas y la intensidad. Entrena con técnica correcta y dentro de tus capacidades."],
  ] },
  { id: "coach", t: "El Coach Banana", p: [
    "Las respuestas del Coach Banana se generan con inteligencia artificial y pueden contener errores. Úsalas como guía y no como diagnóstico. Hay un límite de preguntas por día y por mes según tu plan, que se muestra en la pantalla del coach, para mantener el servicio disponible para todos.",
  ] },
  { id: "cuenta", t: "Tu cuenta", p: [
    "Debes ser mayor de 18 años y dar información veraz. Eres responsable del acceso a tu correo y de la actividad de tu cuenta. Podemos suspender cuentas que incumplan estos términos o pongan en riesgo a otras personas.",
  ] },
  { id: "prueba", t: "Prueba gratis", p: [] },
  { id: "planes", t: "Planes, pagos y renovación", p: [
    "Los planes y precios vigentes se muestran en la página de precios, en dólares estadounidenses (USD). Los pagos los procesa ONVO Pay (tarjetas de Costa Rica) o Tilopay (tarjetas de otros países). Si tu tarjeta es en otra moneda, tu banco hace la conversión y puede cobrar comisiones propias.",
    ["Las suscripciones se renuevan automáticamente al final de cada periodo (mensual o anual) hasta que las canceles.", "Puedes cancelar cuando quieras desde Mi plan. Conservas el acceso hasta el final del periodo ya pagado y no se te vuelve a cobrar.", "Si un cobro de renovación falla, lo reintentaremos y te avisaremos. Si no se resuelve, el acceso se pausa hasta que actualices tu pago o elijas un plan; tus datos quedan guardados.", "Si cambiamos un precio, te avisaremos con al menos 30 días de anticipación y aplicará desde tu siguiente renovación."],
  ] },
  { id: "reembolsos", t: "Reembolsos y derecho de retracto", p: [
    "Si contrataste a distancia puedes ejercer tu derecho de retracto dentro de los 8 días hábiles siguientes a la compra, conforme a la Ley N.º 7472 de Promoción de la Competencia y Defensa Efectiva del Consumidor, escribiendo a hola@bananaburn.app. Fuera de ese plazo no hacemos reembolsos proporcionales de periodos ya iniciados, salvo cuando la ley lo exija o por un error de cobro de nuestra parte.",
    "Cuando el primer cobro se hace al terminar la prueba gratis, los 8 días hábiles se cuentan desde ese cobro, no desde que guardaste la tarjeta.",
  ] },
  { id: "comunidad", t: "Reglas de la comunidad", p: [
    "La comunidad existe para motivarnos. No se permite:",
    ["Acoso, discriminación, contenido sexual o violento.", "Promover dietas extremas, purgas, ayunos peligrosos, esteroides o fármacos para bajar de peso.", "Vender productos, publicar enlaces de spam o hacerte pasar por otra persona.", "Publicar datos o fotos de otras personas sin su permiso."],
    "Puedes reportar cualquier publicación o comentario. Nuestro equipo revisa los reportes y puede ocultar contenido o suspender cuentas.",
  ] },
  { id: "contenido", t: "Tu contenido y el nuestro", p: [
    "Lo que publicas sigue siendo tuyo; nos das permiso para mostrarlo dentro de la app según la privacidad que elijas. La marca Banana Burn, el diseño, las rutinas, recetas, ilustraciones y el software nos pertenecen y no puedes copiarlos ni revenderlos.",
  ] },
  { id: "responsabilidad", t: "Disponibilidad y responsabilidad", p: [
    "Trabajamos para que la app esté siempre disponible, pero puede haber interrupciones por mantenimiento o fallas de proveedores. En la medida que permita la ley, no somos responsables por lesiones derivadas de ejercicios realizados sin seguir estas indicaciones, ni por daños indirectos. Nada en estos términos limita los derechos que te da la ley de protección al consumidor.",
  ] },
  { id: "ley", t: "Ley aplicable y contacto", p: [
    "Estos términos se rigen por las leyes de la República de Costa Rica, sin perjuicio de los derechos que te dé la ley de protección al consumidor de tu país. Cualquier consulta o reclamo: hola@bananaburn.app. Si hacemos cambios importantes, te avisaremos antes de que entren en vigor.",
  ] },
];

export default function Page() {
  const S = SECTIONS.map((x) => (x.id === "prueba" ? trialSection() : x));
  return <LegalPage title="Términos y condiciones" updated="24 de octubre de 2026" intro="Estas condiciones explican cómo funciona Banana Burn, qué puedes esperar de nosotros y qué esperamos de ti. Están escritas para leerse en cinco minutos." sections={S} />;
}
