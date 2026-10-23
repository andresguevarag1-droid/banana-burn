// Qué tipo de falla vio la persona, para darle el mensaje y la salida correctos. Sin depender del navegador.

export type ErrorKind = "stale" | "offline" | "generic";

/**
 * Señales de que el navegador quedó con una versión vieja después de un deploy: piezas de JavaScript
 * que ya no existen en el servidor o acciones de servidor que cambiaron de id.
 */
const STALE = /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|dynamically imported module|Failed to find Server Action|Server Action .* was not found|This request might be from an older or newer deployment/i;

export function errorKind(e: { name?: string; message?: string } | null | undefined, online = true): ErrorKind {
  const text = `${e?.name ?? ""} ${e?.message ?? ""}`;
  if (STALE.test(text)) return "stale";
  if (!online) return "offline";
  if (/Failed to fetch|NetworkError|Load failed|network connection was lost/i.test(text)) return "offline";
  return "generic";
}

export const ERROR_COPY: Record<ErrorKind, { title: string; body: string; action: string }> = {
  stale: { title: "Hay una versión nueva de Banana Burn.", body: "Actualizamos la app mientras la usabas. Recarga para seguir con la versión nueva. Tus datos están a salvo.", action: "Actualizar ahora" },
  offline: { title: "Estás sin conexión.", body: "No pudimos cargar esta pantalla porque no hay señal. Tus datos están a salvo. Prueba de nuevo cuando vuelva la conexión.", action: "Intentar de nuevo" },
  generic: { title: "No pudimos cargar esta pantalla.", body: "Puede ser la conexión o un tropiezo de nuestro lado. Tus datos están a salvo. Prueba otra vez en un momento.", action: "Intentar de nuevo" },
};
