import { LegalPage, type LegalSection } from "../legal";
import { social } from "../seo";

const DESCRIPTION = "Cómo Banana Burn trata tus datos personales y de salud: qué recopilamos, para qué, con quién los compartimos y cómo ejercer tus derechos.";
export const metadata = { title: "Política de privacidad", description: DESCRIPTION, ...social({ title: "Política de privacidad de Banana Burn", description: DESCRIPTION, path: "/privacidad" }) };

const S: LegalSection[] = [
  { id: "responsable", t: "Quién es responsable de tus datos", p: [
    // TODO(dueño): agregar la cédula jurídica de Atlas Resources SRL cuando esté confirmada (p. ej. "cédula jurídica 3-102-…").
    "El responsable de la base de datos es Atlas Resources SRL, sociedad costarricense con domicilio en San José, Costa Rica, que opera la aplicación Banana Burn. Para cualquier asunto de privacidad escríbenos a hola@bananaburn.app.",
  ] },
  { id: "datos", t: "Qué datos recopilamos", p: [
    "Solo pedimos lo necesario para crear tu plan y acompañarte:",
    ["Cuenta: nombre, correo electrónico y, si entras con Google, tu foto de perfil.", "Perfil físico: fecha de nacimiento, sexo, estatura, peso, peso meta, nivel, días y equipo para entrenar.", "Progreso: pesajes, medidas corporales, fotos de progreso, entrenos, series, cargas y récords.", "Alimentación y hábitos: comidas registradas, agua, pasos, sueño, energía, náuseas y fibra.", "Programa Banana Shield (opcional): que usas un medicamento GLP-1, cuál y el día de aplicación.", "Comunidad: publicaciones, comentarios, reacciones, seguidores, reportes, tus insignias y tu nivel de perfil (calculado con tus programas, certificados, nivel y racha).", "Verificación de identidad (opcional): fotos de tu documento y una selfie, que borramos al decidir (ver más abajo).", "Pagos: plan, estado de la suscripción e identificadores de ONVO Pay. Nunca vemos ni guardamos los datos de tu tarjeta.", "Uso técnico: dispositivo, navegador y registros de error necesarios para que la app funcione y sea segura."],
  ] },
  { id: "sensibles", t: "Datos de salud (datos sensibles)", p: [
    "El peso, las medidas, las fotos, la alimentación y el uso de medicamentos son datos sensibles según la Ley N.º 8968. Los tratamos únicamente con tu consentimiento expreso, que das al crear tu plan, y solo para personalizar tu entrenamiento y nutrición.",
    "Las fotos de progreso son privadas: se guardan en un almacenamiento cerrado y solo tú puedes verlas mediante enlaces temporales. No aparecen en la comunidad ni las ve nuestro equipo salvo que tú nos lo pidas para soporte.",
  ] },
  { id: "identidad", t: "Verificación de identidad (opcional)", p: [
    "Si quieres el sello Verificado, nos envías una foto del frente de tu documento de identidad (cédula, DIMEX, pasaporte o el documento de tu país), una selfie sosteniéndolo y tu nombre como aparece en él. Es voluntario y lo haces con tu consentimiento expreso.",
    ["Para qué: solo para confirmar que eres una persona real y mostrar el sello Verificado en tu perfil y junto a tu nombre en la comunidad.", "Nunca te pedimos ni guardamos el número completo del documento: solo el tipo de documento, el país y sus últimos 3 caracteres.", "Las fotos van a un almacenamiento privado. Solo una persona de soporte las ve, con enlaces que vencen en 60 segundos, y cada apertura queda registrada.", "Al aprobar o rechazar, borramos las fotos y tu nombre del documento. Si no alcanzamos a revisarlo, se borran a los 30 días.", "Después guardamos solo el resultado, quién lo revisó, las fechas y, si se rechazó, el motivo.", "Puedes retirar tu verificación cuando quieras desde Mi perfil: borramos todo lo que quede y pierdes el sello."],
  ] },
  { id: "uso", t: "Para qué usamos tus datos", p: [
    ["Calcular tus calorías, proteína y rutina, y ajustarlas cada semana según tu progreso.", "Darte respuestas del Coach Banana con el contexto de tu plan.", "Enviarte recordatorios y resúmenes que tú elijas, y correos sobre tu cuenta y tus pagos.", "Mostrar tu actividad en la comunidad solo según la privacidad que configures.", "Prevenir abuso, fraude y accesos no autorizados.", "Mejorar la app con métricas agregadas que no te identifican."],
    "Medir y mejorar nuestros anuncios en Instagram y Facebook (ver Meta más abajo).",
    "No vendemos tus datos. Nunca compartimos con anunciantes tus datos de salud, tu peso, tus comidas ni tus fotos.",
  ] },
  { id: "terceros", t: "Con quién los compartimos", p: [
    "Trabajamos con proveedores que procesan datos por cuenta nuestra y bajo contrato:",
    ["Supabase: base de datos, autenticación y almacenamiento de fotos.", "Vercel: alojamiento de la aplicación.", "Anthropic: genera las respuestas del Coach Banana. Le enviamos tu mensaje y un resumen de tu plan, sin tu correo.", "Resend: envío de correos.", "ONVO Pay: procesamiento de pagos en Costa Rica.", "Meta Platforms (Instagram y Facebook): con el Meta Pixel y su API de Conversiones medimos qué anuncios llevan a una visita, un registro o una suscripción. Meta recibe la página visitada, el tipo de evento (por ejemplo, registro o suscripción y su precio), tu dirección IP, tu navegador y sus propias cookies. No recibe tu correo, tu nombre ni ningún dato de salud."],
    "Algunos de estos proveedores almacenan datos fuera de tu país y de Costa Rica (principalmente en Estados Unidos). Al aceptar esta política autorizas esa transferencia, que hacemos con medidas de seguridad equivalentes a las exigidas por la ley costarricense.",
  ] },
  { id: "derechos", t: "Tus derechos", p: [
    "Puedes ejercer en cualquier momento tus derechos de acceso, rectificación, cancelación (eliminación) y oposición, y retirar tu consentimiento:",
    ["Descargar todos tus datos desde Perfil (Descargar mis datos).", "Corregir tus datos desde Perfil.", "Borrar tu cuenta desde Perfil (Borrar mi cuenta): eliminamos tus datos y fotos de forma definitiva.", "Escribir a hola@bananaburn.app; respondemos en un máximo de 5 días hábiles."],
    "Si consideras que no atendimos tu solicitud, puedes acudir a la Agencia de Protección de Datos de los Habitantes (PRODHAB).",
  ] },
  { id: "conservacion", t: "Cuánto tiempo los guardamos", p: [
    "Guardamos tus datos mientras tu cuenta esté activa. Si la borras, los eliminamos en un plazo máximo de 30 días, salvo los registros de pagos que debamos conservar por obligaciones contables o tributarias.",
  ] },
  { id: "seguridad", t: "Cómo los protegemos", p: [
    "Usamos conexiones cifradas, control de acceso por usuario en la base de datos, fotos privadas con enlaces temporales y acceso restringido del equipo según su función. Ningún sistema es infalible: si ocurre un incidente que afecte tus datos, te avisaremos y lo comunicaremos a la PRODHAB según la ley.",
  ] },
  { id: "menores", t: "Menores de edad", p: [
    "Banana Burn es solo para personas mayores de 18 años. Si detectamos una cuenta de una persona menor de edad, la eliminamos.",
  ] },
  { id: "cookies", t: "Cookies y almacenamiento local", p: [
    "Usamos cookies y almacenamiento local necesarios para mantener tu sesión, recordar preferencias de la app y proteger la cuenta.",
    "Además, el Meta Pixel guarda cookies de Meta (_fbp y _fbc) para medir los anuncios. Puedes bloquearlas desde la configuración de tu navegador o con un bloqueador de anuncios, y administrar tus preferencias de anuncios en tu cuenta de Meta; la app funciona igual.",
  ] },
  { id: "cambios", t: "Cambios a esta política", p: [
    "Si hacemos cambios importantes te avisaremos en la app o por correo antes de que entren en vigor.",
  ] },
];

export default function Page() {
  return <LegalPage title="Política de privacidad" updated="24 de octubre de 2026" intro="Tus datos de salud son tuyos. Esta política explica qué datos usamos, para qué, con quién los compartimos y cómo ejercer tus derechos. Como la empresa está en Costa Rica, se rige por la Ley N.º 8968 de Protección de la Persona frente al Tratamiento de sus Datos Personales y su reglamento, sin perjuicio de los derechos que te dé la ley de tu país." sections={S} />;
}
