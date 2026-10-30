"use server";
import { headers } from "next/headers";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { clientIpFrom } from "@/lib/security";
import { hitLimit } from "@/lib/security/limits";
import { attributeNewAccount } from "@/lib/attribution-server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email";
import { loginOutcome, normEmail, requireEmailConfirm, signupError } from "./validate";

// Acceso sin correo de confirmación: si producción no tiene SMTP, el correo de confirmación nunca llega y la persona
// queda fuera. Con la llave service_role creamos (o confirmamos) la cuenta en el servidor y el navegador entra con
// su contraseña de inmediato. Sin esa llave, el formulario usa el registro normal de Supabase.

export type AuthResult = { ok: true } | { ok: false; error: string; fallback?: boolean };

/** Freno por red y por correo (reglas auth:* en src/lib/security/limits.ts): basta que uno se pase. */
/** Freno por red y por correo (reglas auth:* en src/lib/security/limits.ts): basta que uno se pase. */
async function limited(kind: "entrar" | "registro", email: string) {
  const ip = clientIpFrom(await headers());
  const [byIp, byMail] = await Promise.all([hitLimit(`auth:${kind}:ip`, `ip:${ip}`), hitLimit(`auth:${kind}:correo`, email)]);
  return !byIp.ok || !byMail.ok;
}

const TOO_MANY = "Demasiados intentos. Espera unos minutos e intenta de nuevo.";

async function findUserByEmail(admin: NonNullable<ReturnType<typeof adminClient>>, email: string) {
  // Con 0040: una búsqueda con índice en vez de recorrer la lista de Auth de a 1000 (con miles de cuentas era lento).
  const { data: id, error } = await admin.rpc("auth_user_id_by_email", { p_email: email });
  if (!error) {
    if (typeof id !== "string") return null;
    const { data } = await admin.auth.admin.getUserById(id);
    return data.user ?? null;
  }
  // Sin 0040 (la función no existe): el recorrido de antes.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const u = data.users.find((x) => x.email?.toLowerCase() === email);
    if (u) return u;
    if (data.users.length < 1000) return null;
  }
  return null;
}

/**
 * Prueba la contraseña con un cliente anónimo sin sesión persistente (no toca las cookies).
 * Supabase Auth valida la contraseña ANTES de mirar si el correo está confirmado: "unconfirmed" implica contraseña correcta.
 */
async function passwordCheck(email: string, password: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return "bad" as const;
  const sb = createSupabase(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (!error) await sb.auth.signOut().catch(() => {});
  return loginOutcome(error);
}

/** Crea la cuenta ya confirmada. `fallback: true` = no hay service_role: el cliente usa signUp normal. */
export async function signUpConfirmed(email: string, password: string): Promise<AuthResult> {
  const mail = normEmail(email);
  const invalid = signupError(mail, password);
  if (invalid) return { ok: false, error: invalid };
  const admin = adminClient();
  // Sin service_role, o con confirmación de correo obligatoria (AUTH_EMAIL_CONFIRM=1): registro normal con correo.
  if (!admin || requireEmailConfirm()) return { ok: false, error: "", fallback: true };
  if (await limited("registro", mail)) return { ok: false, error: TOO_MANY };
  const { data, error } = await admin.auth.admin.createUser({ email: mail, password, email_confirm: true });
  if (!error) {
    // Invitación (/r/<código>): se atribuye aquí, en el servidor, al crear la cuenta. Nunca bloquea el registro.
    if (data.user) await attributeNewAccount(data.user.id, mail);
    return { ok: true };
  }
  if (/already|registered|exists/i.test(error.message)) return { ok: false, error: "Ya existe una cuenta con ese correo. Entra con tu contraseña." };
  if (/password/i.test(error.message)) return { ok: false, error: "Esa contraseña es muy débil. Usa al menos 8 caracteres, con letras y números." };
  return { ok: false, error: "No pudimos crear tu cuenta. Intenta de nuevo en un momento." };
}

/**
 * Supabase responde "Email not confirmed" cuando la cuenta existe sin confirmar. Primero verificamos la contraseña en el
 * servidor y SOLO si es correcta confirmamos la cuenta; después el cliente reintenta entrar. Con una contraseña
 * equivocada no se confirma nada (antes se confirmaba cualquier cuenta pendiente con solo conocer el correo).
 */
export async function confirmAndCheck(email: string, password: string): Promise<AuthResult> {
  const mail = normEmail(email);
  const admin = adminClient();
  if (!admin || requireEmailConfirm() || !mail || typeof password !== "string" || !password) return { ok: false, error: "", fallback: true };
  if (await limited("entrar", mail)) return { ok: false, error: TOO_MANY };
  const BAD = { ok: false as const, error: "Correo o contraseña incorrectos." };
  const first = await passwordCheck(mail, password);
  if (first === "ok") return { ok: true };
  if (first !== "unconfirmed") return BAD;
  const user = await findUserByEmail(admin, mail);
  if (!user) return BAD;
  if (!user.email_confirmed_at) {
    const { error } = await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
    if (error) return { ok: false, error: "No pudimos confirmar tu cuenta. Escríbenos a hola@bananaburn.app." };
  }
  return (await passwordCheck(mail, password)) === "ok" ? { ok: true } : BAD;
}

/**
 * Después de entrar con Google o Apple desde la app nativa (signInWithIdToken: no pasa por /auth/callback), lo mismo
 * que hace el callback: correo de bienvenida y atribución de invitaciones. Idempotente: el correo sale una vez por
 * persona (claimOnce) y la base solo atribuye cuentas de menos de 72 h.
 */
export async function afterSocialSignIn(): Promise<void> {
  const sb = await createServerClient();
  const { data } = await sb.auth.getUser();
  const user = data.user;
  if (!user) return;
  await sendWelcomeEmail({ userId: user.id, to: user.email ?? undefined }).catch(() => {});
  await attributeNewAccount(user.id, user.email).catch(() => {});
}
