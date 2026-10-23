import { LegalPage, type LegalSection } from "../legal";
import { social } from "../seo";
import { TRIAL_DAYS } from "@/lib/copy";
import { BETA_ENDS_AT, betaLive } from "@/lib/plans";

const TZ = "America/Costa_Rica";
const day = (ms: number) => new Date(ms).toLocaleDateString("es-419", { day: "numeric", month: "long", year: "numeric", timeZone: TZ });

/**
 * Prueba gratis. Hasta el fin de la beta se muestran las dos reglas (la de hoy y la que empieza el 1 de noviembre), para
 * avisar el cambio antes de que entre en vigor; desde esa fecha solo la nueva. Se calcula en cada render (revalidate = 3600).
 */
function trialSection(now = new Date()): LegalSection {
  const end = Date.parse(BETA_ENDS_AT);
  const lastFree = day(end - 1), firstPaid = day(end);
  const rules = [
    `Al crear tu cuenta eliges un plan y guardas una tarjeta de crédito o débito. Ese día no se te cobra nada: tienes ${TRIAL_DAYS} días de prueba gratis con todas las funciones, incluida la nutrición y Banana Shield, sin importar el plan que elegiste.`,
    [
      `El día ${TRIAL_DAYS}, al cumplirse los ${TRIAL_DAYS} días desde que guardaste la tarjeta, se cobra el plan que elegiste, salvo que canceles antes. El cobro lo procesa ONVO Pay en dólares (USD) y desde ahí la suscripción se renueva cada mes o cada año hasta que la canceles.`,
      "Te avisamos 2 días antes del cobro por correo, y también en la app y por notificación si las tienes activadas. En Mi plan siempre ves la fecha y el monto del cobro.",
      `Puedes cancelar sin costo desde Mi plan en cualquier momento antes del cobro: no se cobra nada y sigues con acceso hasta el final de los ${TRIAL_DAYS} días. Al cancelar eliges si quitamos tu tarjeta guardada o si la conservamos.`,
      "Si el cobro no pasa, el acceso queda en pausa (no se borra nada), te avisamos y lo intentamos una sola vez más al día siguiente. Puedes cambiar tu tarjeta en Mi plan cuando quieras; el cobro se hace en ese momento.",
      "La prueba gratis es una por persona y solo para cuentas nuevas.",
      "El número de tu tarjeta va directo de tu navegador a ONVO Pay y nunca pasa por nuestros servidores. Solo guardamos la marca, los últimos 4 dígitos y el vencimiento para mostrártelos.",
    ],
  ] as LegalSection["p"];
  if (!betaLive(now)) return { id: "prueba", t: "Prueba gratis y primer cobro", p: [...rules, `Las cuentas creadas durante la versión de prueba (hasta el ${lastFree}) ya tuvieron su acceso gratis y no reciben días adicionales: para seguir usando la app eligen un plan y pagan.`] };
  return { id: "prueba", t: "Versión de prueba, prueba gratis y primer cobro", p: [
    `Hasta el ${lastFree} Banana Burn está en versión de prueba: todas las cuentas tienen acceso completo y gratis, y no pedimos tarjeta.`,
    `Desde el ${firstPaid} se cobran los planes. Si ya tienes cuenta, puedes guardar tu tarjeta antes de esa fecha: no se cobra nada al guardarla y el ${firstPaid} se cobra el plan que elegiste, salvo que canceles antes. Si no la guardas, desde el ${firstPaid} verás la pantalla de planes hasta que guardes una tarjeta y pagues. Las cuentas creadas durante la versión de prueba no reciben días gratis adicionales.`,
    `Para las cuentas nuevas desde el ${firstPaid} aplica lo siguiente:`,
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
    "Las respuestas del Coach Banana se generan con inteligencia artificial y pueden contener errores. Úsalas como guía y no como diagnóstico. Hay un límite diario de mensajes para mantener el servicio disponible para todos.",
  ] },
  { id: "cuenta", t: "Tu cuenta", p: [
    "Debes ser mayor de 18 años y dar información veraz. Eres responsable del acceso a tu correo y de la actividad de tu cuenta. Podemos suspender cuentas que incumplan estos términos o pongan en riesgo a otras personas.",
  ] },
  { id: "prueba", t: "Prueba gratis", p: [] },
  { id: "planes", t: "Planes, pagos y renovación", p: [
    "Los planes y precios vigentes se muestran en la página de precios, en dólares estadounidenses (USD). Los pagos los procesa ONVO Pay. Si tu tarjeta es en otra moneda, tu banco hace la conversión y puede cobrar comisiones propias.",
    ["Las suscripciones se renuevan automáticamente al final de cada periodo (mensual o anual) hasta que las canceles.", "Puedes cancelar cuando quieras desde Mi suscripción. Conservas el acceso hasta el final del periodo ya pagado y no se te vuelve a cobrar.", "Si un cobro de renovación falla, lo reintentaremos y te avisaremos. Si no se resuelve, el acceso se pausa hasta que actualices tu pago o elijas un plan; tus datos quedan guardados.", "Si cambiamos un precio, te avisaremos con al menos 30 días de anticipación y aplicará desde tu siguiente renovación."],
  ] },
  { id: "reembolsos", t: "Reembolsos y derecho de retracto", p: [
    "Si contrataste a distancia puedes ejercer tu derecho de retracto dentro de los 8 días hábiles siguientes a la compra, conforme a la Ley N.º 7472 de Promoción de la Competencia y Defensa Efectiva del Consumidor, escribiendo a hola@bananaburn.app. Fuera de ese plazo no hacemos reembolsos proporcionales de periodos ya iniciados, salvo cuando la ley lo exija o por un error de cobro de nuestra parte.",
    `Cuando el primer cobro se hace al terminar la prueba gratis, los 8 días hábiles se cuentan desde ese cobro (el día ${TRIAL_DAYS}), no desde que guardaste la tarjeta.`,
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
  return <LegalPage title="Términos y condiciones" updated="23 de octubre de 2026" intro="Estas condiciones explican cómo funciona Banana Burn, qué puedes esperar de nosotros y qué esperamos de ti. Están escritas para leerse en cinco minutos." sections={S} />;
}
