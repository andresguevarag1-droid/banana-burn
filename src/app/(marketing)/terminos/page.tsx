import { LegalPage, type LegalSection } from "../legal";

export const metadata = { title: "Términos y condiciones", description: "Condiciones de uso de Banana Burn: servicio, salud, suscripciones, comunidad y responsabilidad." };

const S: LegalSection[] = [
  { id: "servicio", t: "El servicio", p: [
    "Banana Burn es una aplicación web de entrenamiento y nutrición con un entrenador basado en inteligencia artificial. Te da rutinas, cargas sugeridas, metas de calorías y proteína, recetas, retos y una comunidad. Al crear una cuenta aceptas estos términos y la Política de privacidad.",
  ] },
  { id: "salud", t: "Salud y seguridad", p: [
    "Banana Burn no es un servicio médico ni sustituye la consulta con un profesional de salud. La información es general y educativa.",
    ["Consulta a tu médico antes de empezar, sobre todo si tienes una condición del corazón, presión alta, lesiones, estás embarazada o tomas medicamentos.", "Si sientes dolor de pecho, mareo, falta de aire o dolor agudo, detente de inmediato y busca atención médica. En una emergencia llama al 911.", "El programa Banana Shield acompaña a personas que usan medicamentos GLP-1 recetados por su médico. No damos indicaciones sobre dosis, cambios ni suspensión del medicamento, y no recomendamos péptidos ni compuestos no aprobados.", "Tú decides las cargas y la intensidad. Entrena con técnica correcta y dentro de tus capacidades."],
  ] },
  { id: "coach", t: "El Coach Banana", p: [
    "Las respuestas del Coach Banana se generan con inteligencia artificial y pueden contener errores. Úsalas como guía y no como diagnóstico. Hay un límite diario de mensajes para mantener el servicio disponible para todos.",
  ] },
  { id: "cuenta", t: "Tu cuenta", p: [
    "Debes ser mayor de 18 años y dar información veraz. Eres responsable del acceso a tu correo y de la actividad de tu cuenta. Podemos suspender cuentas que incumplan estos términos o pongan en riesgo a otras personas.",
  ] },
  { id: "planes", t: "Planes, pagos y renovación", p: [
    "Los planes y precios vigentes se muestran en la página de precios, en dólares estadounidenses (USD). Los pagos los procesa ONVO Pay.",
    ["Las suscripciones se renuevan automáticamente al final de cada periodo (mensual o anual) hasta que las canceles.", "Puedes cancelar cuando quieras desde Suscripción. Conservas el acceso hasta el final del periodo ya pagado y no se te vuelve a cobrar.", "Si un cobro de renovación falla, lo reintentaremos y te avisaremos; si no se resuelve, tu plan pasa a la versión gratuita.", "Si cambiamos un precio, te avisaremos con al menos 30 días de anticipación y aplicará desde tu siguiente renovación."],
  ] },
  { id: "reembolsos", t: "Reembolsos y derecho de retracto", p: [
    "Si contrataste a distancia puedes ejercer tu derecho de retracto dentro de los 8 días hábiles siguientes a la compra, conforme a la Ley N.º 7472 de Promoción de la Competencia y Defensa Efectiva del Consumidor, escribiendo a hola@bananaburn.app. Fuera de ese plazo no hacemos reembolsos proporcionales de periodos ya iniciados, salvo cuando la ley lo exija o por un error de cobro de nuestra parte.",
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
    "Estos términos se rigen por las leyes de la República de Costa Rica. Cualquier consulta o reclamo: hola@bananaburn.app. Si hacemos cambios importantes, te avisaremos antes de que entren en vigor.",
  ] },
];

export default function Page() {
  return <LegalPage title="Términos y condiciones" updated="22 de octubre de 2026" intro="Estas condiciones explican cómo funciona Banana Burn, qué puedes esperar de nosotros y qué esperamos de ti. Están escritas para leerse en cinco minutos." sections={S} />;
}
