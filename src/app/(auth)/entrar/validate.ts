// Validación de credenciales compartida por el formulario (cliente) y las acciones de servidor.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normEmail = (e: unknown) => (typeof e === "string" ? e.trim().toLowerCase() : "");

/** Error en español o null si el correo y la contraseña sirven para crear una cuenta. */
export function signupError(email: unknown, password: unknown): string | null {
  const mail = normEmail(email);
  if (!mail || mail.length > 254 || !EMAIL.test(mail)) return "Revisa que tu correo esté bien escrito.";
  if (typeof password !== "string" || password.length < 8) return "Usa al menos 8 caracteres.";
  if (password.length > 72) return "Usa como máximo 72 caracteres.";
  return null;
}
