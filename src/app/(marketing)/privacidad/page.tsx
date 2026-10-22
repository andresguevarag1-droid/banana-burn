import { LegalPage, type LegalSection } from "../legal";

export const metadata = { title: "Política de privacidad", description: "Cómo Banana Burn trata tus datos personales y de salud conforme a la Ley 8968 de Costa Rica." };

const S: LegalSection[] = [
  { id: "responsable", t: "Quién es responsable de tus datos", p: [
    "El responsable de la base de datos es [razón social y cédula jurídica], con domicilio en San José, Costa Rica, que opera la aplicación Banana Burn. Para cualquier asunto de privacidad escríbenos a hola@bananaburn.app.",
  ] },
  { id: "datos", t: "Qué datos recopilamos", p: [
    "Solo pedimos lo necesario para crear tu plan y acompañarte:",
    ["Cuenta: nombre, correo electrónico y, si entras con Google, tu foto de perfil.", "Perfil físico: fecha de nacimiento, sexo, estatura, peso, peso meta, nivel, días y equipo para entrenar.", "Progreso: pesajes, medidas corporales, fotos de progreso, entrenos, series, cargas y récords.", "Alimentación y hábitos: comidas registradas, agua, pasos, sueño, energía, náuseas y fibra.", "Programa Banana Shield (opcional): que usas un medicamento GLP-1, cuál y el día de aplicación.", "Comunidad: publicaciones, comentarios, reacciones, seguidores y reportes.", "Pagos: plan, estado de la suscripción e identificadores de ONVO Pay. Nunca vemos ni guardamos los datos de tu tarjeta.", "Uso técnico: dispositivo, navegador y registros de error necesarios para que la app funcione y sea segura."],
  ] },
  { id: "sensibles", t: "Datos de salud (datos sensibles)", p: [
    "El peso, las medidas, las fotos, la alimentación y el uso de medicamentos son datos sensibles según la Ley N.º 8968. Los tratamos únicamente con tu consentimiento expreso, que das al crear tu plan, y solo para personalizar tu entrenamiento y nutrición.",
    "Las fotos de progreso son privadas: se guardan en un almacenamiento cerrado y solo tú puedes verlas mediante enlaces temporales. No aparecen en la comunidad ni las ve nuestro equipo salvo que tú nos lo pidas para soporte.",
  ] },
  { id: "uso", t: "Para qué usamos tus datos", p: [
    ["Calcular tus calorías, proteína y rutina, y ajustarlas cada semana según tu progreso.", "Darte respuestas del Coach Banana con el contexto de tu plan.", "Enviarte recordatorios y resúmenes que tú elijas, y correos sobre tu cuenta y tus pagos.", "Mostrar tu actividad en la comunidad solo según la privacidad que configures.", "Prevenir abuso, fraude y accesos no autorizados.", "Mejorar la app con métricas agregadas que no te identifican."],
    "No vendemos tus datos ni los usamos para publicidad de terceros.",
  ] },
  { id: "terceros", t: "Con quién los compartimos", p: [
    "Trabajamos con proveedores que procesan datos por cuenta nuestra y bajo contrato:",
    ["Supabase: base de datos, autenticación y almacenamiento de fotos.", "Vercel: alojamiento de la aplicación.", "Anthropic: genera las respuestas del Coach Banana. Le enviamos tu mensaje y un resumen de tu plan, sin tu correo.", "Resend: envío de correos.", "ONVO Pay: procesamiento de pagos en Costa Rica."],
    "Algunos de estos proveedores almacenan datos fuera de Costa Rica (principalmente en Estados Unidos). Al aceptar esta política autorizas esa transferencia, que hacemos con medidas de seguridad equivalentes a las exigidas por la ley costarricense.",
  ] },
  { id: "derechos", t: "Tus derechos", p: [
    "Puedes ejercer en cualquier momento tus derechos de acceso, rectificación, cancelación (eliminación) y oposición, y retirar tu consentimiento:",
    ["Descargar todos tus datos desde Perfil, en la sección Tu cuenta.", "Corregir tus datos desde Perfil.", "Borrar tu cuenta desde Perfil: eliminamos tus datos y fotos de forma definitiva.", "Escribir a hola@bananaburn.app; respondemos en un máximo de 5 días hábiles."],
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
    "Usamos solo cookies y almacenamiento local necesarios para mantener tu sesión, recordar preferencias de la app y proteger la cuenta. No usamos cookies de publicidad.",
  ] },
  { id: "cambios", t: "Cambios a esta política", p: [
    "Si hacemos cambios importantes te avisaremos en la app o por correo antes de que entren en vigor.",
  ] },
];

export default function Page() {
  return <LegalPage title="Política de privacidad" updated="22 de octubre de 2026" intro="Tus datos de salud son tuyos. Esta política explica qué datos usamos, para qué, con quién los compartimos y cómo ejercer tus derechos, conforme a la Ley N.º 8968 de Protección de la Persona frente al Tratamiento de sus Datos Personales de Costa Rica y su reglamento." sections={S} />;
}
