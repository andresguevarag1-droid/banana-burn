// Mensajes del chat del coach según lo que respondió el servidor. Puro y testeado.

/** Texto que el servidor agrega al final cuando el stream se corta a mitad de respuesta. */
export const CUT_SUFFIX = "Se cortó la respuesta. Intenta de nuevo.";
/** Respuesta del servidor cuando se acaba el cupo del día (llega como texto normal, status 200). */
export const LIMIT_TEXT = "Llegaste al límite de mensajes de hoy. Mañana seguimos.";

export type ChatError = { text: string; retry: boolean };

/** Error legible por status HTTP. `body` es el texto que mandó el servidor (si lo hay). */
export function errorFor(status: number | null, body = ""): ChatError {
  const server = body.trim().slice(0, 200);
  if (status === null) return { text: "No pudimos conectar con el coach. Revisa tu conexión e intenta de nuevo.", retry: true };
  if (status === 401) return { text: "Tu sesión expiró. Vuelve a entrar para seguir hablando con el coach.", retry: false };
  if (status === 403) return { text: "No pudimos verificar esta página. Recárgala e intenta de nuevo.", retry: false };
  if (status === 413) return { text: "Tu mensaje es muy largo. Resúmelo un poco y vuelve a enviarlo.", retry: false };
  if (status === 400) return { text: "No pudimos leer tu mensaje. Escríbelo de nuevo.", retry: false };
  if (status === 429) return { text: "Vas muy rápido. Espera un momento e intenta de nuevo.", retry: true };
  if (status === 503) return { text: server || "El coach no está disponible ahora. Intenta en un momento.", retry: !/configurando/i.test(server) };
  return { text: "El coach tuvo un problema al responder. Intenta de nuevo.", retry: true };
}

/** Separa una respuesta cortada del aviso que agrega el servidor. */
export function splitCut(text: string): { content: string; cut: boolean } {
  const t = text.trimEnd();
  if (!t.endsWith(CUT_SUFFIX)) return { content: text, cut: false };
  return { content: t.slice(0, -CUT_SUFFIX.length).trimEnd(), cut: true };
}

/** Mensajes que nunca se reenvían al modelo (avisos locales como el límite diario). */
export const isLocalOnly = (m: { role: string; content: string }) => m.role === "assistant" && (m.content.trim() === LIMIT_TEXT || !m.content.trim());
