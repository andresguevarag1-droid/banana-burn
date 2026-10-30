import { LegalPage, type LegalSection } from "../legal";
import { social } from "../seo";

// Pública e igual para todos: ISR (la CDN la sirve y se regenera cada hora; nada depende de la persona).
export const revalidate = 3600;

// Página pública para pedir el borrado de la cuenta sin instalar la app (requisito de Google Play: la ficha de la tienda
// enlaza aquí). El borrado en sí vive en Perfil (DataControls → /api/cuenta/borrar → deleteAccountData).
const DESCRIPTION = "Cómo eliminar tu cuenta de Banana Burn y tus datos, desde la app, la web o por correo, y qué pasa con tus suscripciones.";
export const metadata = { title: "Eliminar tu cuenta", description: DESCRIPTION, ...social({ title: "Eliminar tu cuenta de Banana Burn", description: DESCRIPTION, path: "/eliminar-cuenta" }) };

const S: LegalSection[] = [
  { id: "app", t: "Desde la app o la web", p: [
    "Es inmediato y lo haces tú:",
    [
      "Abre Banana Burn (la app o www.bananaburn.app) y entra con tu cuenta.",
      "Ve a Perfil y baja hasta el final.",
      "Toca Borrar mi cuenta, escribe BORRAR y confirma.",
    ],
    "Si quieres una copia antes, en el mismo lugar está Descargar mis datos.",
  ] },
  { id: "correo", t: "Sin la app", p: [
    "Escríbenos a hola@bananaburn.app desde el correo de tu cuenta, con el asunto Eliminar mi cuenta. Te confirmamos por correo y la eliminamos en un plazo máximo de 30 días.",
  ] },
  { id: "datos", t: "Qué se elimina", p: [
    [
      "Tu perfil, tu plan y tus preferencias.",
      "Pesos, medidas, fotos de progreso y fotos de verificación de identidad.",
      "Entrenos, carreras, comidas, retos, publicaciones y conversaciones con tu coach.",
      "Los avisos y recordatorios dejan de llegar.",
    ],
  ] },
  { id: "conserva", t: "Qué se conserva", p: [
    "Solo el registro de los pagos que debemos guardar por obligaciones contables y tributarias, sin tu nombre ni tu correo. No se usa para nada más.",
  ] },
  { id: "suscripciones", t: "Tus suscripciones", p: [
    "Si pagas con tarjeta en la web, al borrar la cuenta cancelamos la suscripción y quitamos la tarjeta guardada: no hay más cobros.",
    "Si pagas desde la App Store o Google Play, la suscripción la administra la tienda y borrar la cuenta no la cancela. Cancélala antes en tu teléfono:",
    [
      "iPhone: Ajustes, tu nombre, Suscripciones, Banana Burn, Cancelar suscripción.",
      "Android: Google Play, tu foto, Pagos y suscripciones, Suscripciones, Banana Burn, Cancelar.",
    ],
  ] },
  { id: "quien", t: "Quién responde", p: [
    "Banana Burn es una marca de Atlas Resources SRL (Costa Rica), responsable de tus datos. En App Store y Google Play la publica Atlas Solutions LLC. Para cualquier duda sobre tus datos escríbenos a hola@bananaburn.app.",
  ] },
];

export default function Page() {
  return <LegalPage title="Eliminar tu cuenta" updated="26 de octubre de 2026" intro="Puedes eliminar tu cuenta de Banana Burn y tus datos cuando quieras. Aquí te explicamos cómo hacerlo, qué se elimina y qué pasa con tus suscripciones." sections={S} />;
}
