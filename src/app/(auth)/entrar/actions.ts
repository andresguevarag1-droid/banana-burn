"use server";
import { headers } from "next/headers";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { memoryRateLimit } from "@/lib/security";
import { dbRateLimitAll, keyPart } from "@/lib/security/db-rate-limit";
import { loginOutcome, normEmail, signupError } from "./validate";

// Acceso sin correo de confirmación: si producción no tiene SMTP, el correo de confirmación nunca llega y la persona
// queda fuera. Con la llave service_role creamos (o confirmamos) la cuenta en el servidor y el navegador entra con
// su contraseña de inmediato. Sin esa llave, el formulario usa el registro normal de Supabase.

export type AuthResult = { ok: true } | { ok: false; error: string; fallback?: boolean };

async function limited(kind: string, email: string, admin: ReturnType<typeof adminClient>) {
  const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  // Primer freno por instancia: 10 intentos por IP y 5 por correo cada 10 minutos.
  if (!memoryRateLimit(`${kind}:ip:${ip}`, 10, 600_000) || !memoryRateLimit(`${kind}:mail:${email}`, 5, 600_000)) return true;
  // Freno compartido entre instancias (0023): el registro crea cuentas confirmadas sin pasar por los límites de Supabase Auth.
  // Holgado por IP: en datos móviles de Latinoamérica muchas personas comparten IP (CGNAT).
  const ipKey = keyPart(ip), mailKey = keyPart(email);
  return !(await dbRateLimitAll(admin, [
    { key: `${kind}:ip:${ipKey}`, windowSec: 3600, max: 20 },
    { key: `${kind}:ipd:${ipKey}`, windowSec: 86400, max: 100 },
    { key: `${kind}:mail:${mailKey}`, windowSec: 3600, max: 10 },
  ]));
}

const TOO_MANY = "Demasiados intentos. Espera unos minutos e intenta de nuevo.";

async function findUserByEmail(admin: NonNullable<ReturnType<typeof adminClient>>, email: string) {
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
  if (!admin) return { ok: false, error: "", fallback: true };
  if (await limited("signup", mail, admin)) return { ok: false, error: TOO_MANY };
  const { error } = await admin.auth.admin.createUser({ email: mail, password, email_confirm: true });
  if (!error) return { ok: true };
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
  if (!admin || !mail || typeof password !== "string" || !password) return { ok: false, error: "", fallback: true };
  if (await limited("confirm", mail, admin)) return { ok: false, error: TOO_MANY };
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
