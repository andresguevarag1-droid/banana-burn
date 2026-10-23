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

/**
 * Resultado de signInWithPassword. Supabase Auth compara la contraseña antes de revisar la confirmación del correo, así
 * que "unconfirmed" solo llega con la contraseña correcta. Cualquier otro error cuenta como credenciales malas.
 */
export function loginOutcome(error: { code?: string; message?: string } | null | undefined): "ok" | "unconfirmed" | "bad" {
  if (!error) return "ok";
  if (error.code === "email_not_confirmed" || /email not confirmed/i.test(error.message ?? "")) return "unconfirmed";
  return "bad";
}

/**
 * ¿Hay que confirmar el correo antes de entrar? Con AUTH_EMAIL_CONFIRM=1 (cuando Supabase ya envía correos con SMTP propio)
 * el registro deja de crear cuentas ya confirmadas en el servidor: el formulario usa signUp normal y el enlace del correo.
 * Sin confirmar, cualquiera puede registrar el correo de otra persona con su contraseña y, si esa persona después entra
 * con Google al mismo correo, Supabase une las cuentas y quien la creó conserva la contraseña (toma de cuenta previa).
 */
export function requireEmailConfirm(env: Record<string, string | undefined> = process.env): boolean {
  return /^(1|true|si|sí|yes)$/i.test((env.AUTH_EMAIL_CONFIRM ?? "").trim());
}
