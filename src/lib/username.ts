// Validación de nombres de usuario de la comunidad (pura, testeada).
const RESERVED = /^(admin|administrador|root|soporte|support|staff|moderador|mod|coach|coachbanana|banana|oficial|official|sistema|system|null|undefined)$/;

/** Devuelve el usuario normalizado o un mensaje de error. Mismo formato que el CHECK de 0009 (^[a-z0-9_.]{3,24}$). */
export function validateUsername(raw: unknown): { ok: true; username: string } | { ok: false; error: string } {
  const username = String(raw ?? "").toLowerCase().trim();
  if (!/^[a-z0-9_.]{3,24}$/.test(username)) return { ok: false, error: "Usuario: de 3 a 24 letras, números, punto o guion bajo." };
  if (/^[._]|[._]$|\.\./.test(username)) return { ok: false, error: "El usuario no puede empezar ni terminar con punto o guion bajo." };
  if (RESERVED.test(username) || /banana[._]?burn/.test(username)) return { ok: false, error: "Ese usuario no está disponible." };
  return { ok: true, username };
}
