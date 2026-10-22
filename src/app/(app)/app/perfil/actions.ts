"use server";
import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/env";
import { getEntitlements } from "@/lib/entitlements";

export async function updateTraining(input: { days: number; equipment: "gym" | "casa" | "mixto" | "ninguno"; mode: "acelerada" | "recomp" | "fuerza"; level: "principiante" | "intermedio" | "avanzado"; minutes: number | null }) {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Inicia sesión." };
  if (![3, 4, 5, 6].includes(input.days) || !["gym", "casa", "mixto", "ninguno"].includes(input.equipment) || !["acelerada", "recomp", "fuerza"].includes(input.mode) || !["principiante", "intermedio", "avanzado"].includes(input.level) || (input.minutes != null && ![15, 20, 30, 45, 60].includes(input.minutes))) return { ok: false, error: "Datos inválidos." };
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const a = await sb.from("profiles").update({ train_days: input.days, equipment: input.equipment, level: input.level, session_minutes: input.minutes }).eq("id", v.id);
  const b = await sb.from("goals").update({ mode: input.mode }).eq("user_id", v.id).eq("active", true);
  if (a.error || b.error) return { ok: false, error: "No se pudo guardar." };
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function updateGlp1(input: { on: boolean; med: "semaglutida" | "tirzepatida" | "liraglutida" | "otro"; dow: number | null }) {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Inicia sesión." };
  if (!["semaglutida", "tirzepatida", "liraglutida", "otro"].includes(input.med) || (input.dow != null && !(input.dow >= 0 && input.dow <= 6))) return { ok: false, error: "Datos inválidos." };
  if (v.demo) return { ok: true, demo: true };
  if (input.on && !(await getEntitlements(v)).nutrition) return { ok: false, error: "Banana Shield está incluido en Entreno + Nutrición." };
  const sb = await createClient();
  const { data: prev } = await sb.from("profiles").select("glp1,glp1_since").eq("id", v.id).maybeSingle();
  const { error } = await sb.from("profiles").update({
    glp1: input.on, glp1_med: input.on ? input.med : null, glp1_injection_dow: input.on ? input.dow : null,
    glp1_since: input.on ? (prev?.glp1 ? prev.glp1_since : new Date().toISOString().slice(0, 10)) : null,
  }).eq("id", v.id);
  if (error) return { ok: false, error: "No se pudo guardar." };
  revalidatePath("/app", "layout");
  return { ok: true };
}

// ───────────── Cuenta ─────────────

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;

export async function updateName(name: string): Promise<{ ok: boolean; demo?: boolean; error?: string }> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  const full = String(name ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (full.length < 2) return { ok: false, error: "Escribe tu nombre (mínimo 2 letras)." };
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const { error } = await sb.from("profiles").update({ full_name: full }).eq("id", v.id);
  if (error) return { ok: false, error: "No pudimos guardar tu nombre. Intenta de nuevo." };
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Cambio de correo: Supabase manda un enlace de confirmación; el cambio se aplica al abrirlo. */
export async function requestEmailChange(email: string): Promise<{ ok: boolean; demo?: boolean; error?: string }> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  const next = String(email ?? "").trim().toLowerCase();
  if (!EMAIL.test(next) || next.length > 254) return { ok: false, error: "Ese correo no parece válido." };
  if (next === v.email.toLowerCase()) return { ok: false, error: "Ese ya es tu correo." };
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const { error } = await sb.auth.updateUser({ email: next }, { emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent("/app/perfil#cuenta")}` });
  if (error) return { ok: false, error: /already|registered|exists/i.test(error.message) ? "Ese correo ya tiene una cuenta." : /rate|seconds/i.test(error.message) ? "Espera un minuto antes de intentarlo de nuevo." : "No pudimos iniciar el cambio. Intenta de nuevo." };
  return { ok: true };
}

/** Enlace para cambiar la contraseña (llega al correo de la cuenta y vuelve a /app/perfil para escribir la nueva). */
export async function sendPasswordLink(): Promise<{ ok: boolean; demo?: boolean; error?: string }> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const { error } = await sb.auth.resetPasswordForEmail(v.email, { redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent("/app/perfil?clave=nueva#cuenta")}` });
  if (error) return { ok: false, error: /rate|seconds/i.test(error.message) ? "Ya te enviamos un enlace. Espera un minuto para pedir otro." : "No pudimos enviar el enlace. Intenta de nuevo." };
  return { ok: true };
}

/** Nueva contraseña (después de abrir el enlace del correo, con la sesión que abre ese enlace). */
export async function setNewPassword(password: string): Promise<{ ok: boolean; demo?: boolean; error?: string }> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró. Pide un enlace nuevo." };
  const pw = String(password ?? "");
  if (pw.length < 8 || pw.length > 72 || !/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return { ok: false, error: "Usa al menos 8 caracteres, con letras y números." };
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const { error } = await sb.auth.updateUser({ password: pw });
  if (error) return { ok: false, error: /reauth|recent/i.test(error.message) ? "Por seguridad, abre de nuevo el enlace del correo y escribe tu contraseña." : /weak|pwned|leaked/i.test(error.message) ? "Esa contraseña es muy débil o aparece en filtraciones. Prueba otra." : /same/i.test(error.message) ? "Elige una contraseña distinta de la anterior." : "No pudimos cambiar la contraseña. Intenta de nuevo." };
  return { ok: true };
}
