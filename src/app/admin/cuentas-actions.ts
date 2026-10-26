"use server";
// Acciones del superadmin sobre una cuenta (0056). Mismo patrón que actions.ts: autoriza el rol EN EL SERVIDOR en cada
// acción ("users.manage", solo superadmin, con su propio tope de frecuencia), valida la entrada y pide motivo.
// Lo que vive en la base pasa por una RPC SECURITY DEFINER que vuelve a validar el rol y audita en la misma transacción.
// Lo que vive en Auth (correo, bloqueo del inicio de sesión, sesiones, correos de acceso) usa service_role solo aquí,
// y se audita en public.audit_log con antes y después. Nunca se muestran ni se fijan contraseñas, ni tokens en pantalla.
import { revalidatePath } from "next/cache";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { DEMO_MSG, audit, fail, ok, run, type SB } from "@/lib/admin-action-kit";
import type { ActionState } from "@/app/admin/actions";
import type { Viewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import * as val from "@/lib/admin-validate";
import { ValidationError } from "@/lib/admin-validate";
import { cleanCountry, cleanEmail, cleanName, checkXpDelta, compExpiry, isManualBadge, notSelf, type CompChoice } from "@/lib/admin-manage";
import { SITE_URL, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { correoCambiado } from "@/lib/email/templates";
import { cancelAtPeriodEndFor } from "@/lib/billing";
import { cancelTrial } from "@/lib/trial-billing";
import { fmtDate } from "@/lib/admin-format";
import { errCode, logError } from "@/lib/log";

const BAN_FOREVER = "876000h"; // 100 años: Supabase no tiene "para siempre"

function pgMsg(e: { code?: string; message?: string } | null): string {
  if (!e) return "Error de base de datos.";
  if (e.code === "42501") return "La base de datos rechazó la acción: solo un superadmin puede hacerla.";
  if (["42P01", "PGRST202", "PGRST205", "42883", "42703"].includes(e.code ?? "")) return "Falta aplicar la migración 0056_admin_cuentas.sql en Supabase.";
  if ((e.code === "P0001" || e.code === "22023") && e.message) return e.message;
  return "Error de base de datos.";
}

const confirmed = (fd: FormData) => {
  if (!val.bool(fd, "confirm")) throw new ValidationError("Confirma la acción marcando la casilla.");
};
const reasonOf = (fd: FormData) => val.text(fd, "reason", { label: "Motivo", required: true, min: 4, max: 300 });
const targetOf = (fd: FormData) => val.id(fd, "target", { uuid: true, label: "Usuario" });
const slugOf = (fd: FormData) => {
  const s = val.text(fd, "slug", { label: "Reto o temporada", required: true, max: 60 });
  if (!/^[a-z0-9-]{1,60}$/.test(s)) throw new ValidationError("Reto o temporada inválido.");
  return s;
};
const refresh = (target: string) => { revalidatePath(`/admin/usuarios/${target}`); revalidatePath("/admin/usuarios"); };

function needAdmin() {
  const admin = adminClient();
  if (!admin) throw new ValidationError("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
  return admin;
}

/** Cliente sin sesión (llave pública): manda los correos de Supabase (mismas plantillas que usa la persona). */
function publicAuth() {
  return createSupabase(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

async function targetAuth(id: string) {
  const { data, error } = await needAdmin().auth.admin.getUserById(id);
  if (error || !data.user) throw new ValidationError("No encontramos esa cuenta en Auth.");
  return data.user;
}

/** El superadmin no se aplica acciones de cuenta a sí mismo (ni a otro superadmin las de acceso, salvo con su propio rol). */
async function targetRole(sb: SB, id: string): Promise<string | null> {
  const { data } = await sb.from("profiles").select("role").eq("id", id).maybeSingle();
  return (data?.role as string | undefined) ?? null;
}

function asViewer(id: string): Viewer {
  return { demo: false, id, email: "", name: "", role: "free", plan: "free", onboarded: true, tz: "America/Costa_Rica", country: null };
}

// ─────────── Datos de la cuenta ───────────

export async function updateProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("users.manage", fd, async ({ sb }) => {
    const target = targetOf(fd);
    const name = cleanName(val.text(fd, "full_name", { label: "Nombre", required: true, max: 120 }));
    if (!name.ok) return fail(name.error);
    const country = cleanCountry(val.text(fd, "country", { max: 2 }));
    if (!country.ok) return fail(country.error);
    const reason = reasonOf(fd);
    confirmed(fd);
    if (!sb) return ok(`Datos guardados${DEMO_MSG}`);
    const { error } = await sb.rpc("admin_update_profile", { p_target: target, p_full_name: name.value, p_country: country.value, p_reason: reason });
    if (error) return fail(pgMsg(error));
    refresh(target);
    return ok("Datos guardados. Quedó en auditoría.");
  });
}

// ─────────── Correo y acceso ───────────

/**
 * Cambia el correo de inicio de sesión. "ahora": el superadmin ya verificó a la persona (perdió su correo viejo, lo
 * escribió mal al registrarse) y queda confirmado de una vez. "confirmar": le llega un enlace al correo nuevo y el
 * cambio se completa cuando lo abre (el enlace nunca se muestra en el panel).
 */
export async function changeEmail(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("users.manage", fd, async ({ v, sb }) => {
    const target = targetOf(fd);
    const self = notSelf(v.id, target, "email");
    if (!self.ok) return fail(self.error);
    const mode = val.oneOf(fd, "mode", ["ahora", "confirmar"] as const, { label: "Cómo cambiarlo" });
    const reason = reasonOf(fd);
    confirmed(fd);
    if (!sb) return ok(`Correo cambiado${DEMO_MSG}`);
    const user = await targetAuth(target);
    const email = cleanEmail(val.text(fd, "email", { label: "Correo nuevo", required: true, max: 254 }), user.email ?? null);
    if (!email.ok) return fail(email.error);
    const admin = needAdmin();
    const { data: taken } = await admin.rpc("auth_user_id_by_email", { p_email: email.value });
    if (taken && taken !== target) return fail("Ese correo ya tiene otra cuenta.");
    const before = { email: user.email ?? null };
    if (mode === "ahora") {
      const { error } = await admin.auth.admin.updateUserById(target, { email: email.value, email_confirm: true });
      if (error) return fail(/already|registered|exists/i.test(error.message) ? "Ese correo ya tiene otra cuenta." : "Supabase no aceptó el cambio. Intenta de nuevo.");
      await audit(sb, v, "user.email_change", target, { mode, reason, before, after: { email: email.value } });
      await sendEmail(email.value, correoCambiado({ name: String(user.user_metadata?.full_name ?? ""), email: email.value, pending: false }), { idempotencyKey: `correo-cambiado:${target}:${email.value}` }).catch(() => null);
      refresh(target);
      return ok(`Listo: la cuenta ahora entra con ${email.value}. Le avisamos a ese correo. Quedó en auditoría.`);
    }
    const { data, error } = await admin.auth.admin.generateLink({ type: "email_change_new", email: user.email ?? "", newEmail: email.value });
    const hashed = (data?.properties as { hashed_token?: string } | undefined)?.hashed_token;
    if (error || !hashed) return fail(/already|registered|exists/i.test(error?.message ?? "") ? "Ese correo ya tiene otra cuenta." : "No pudimos preparar el enlace. Usa \"Cambiar ahora\" si ya verificaste a la persona.");
    const link = `${SITE_URL}/auth/callback?token_hash=${encodeURIComponent(hashed)}&type=email_change&next=${encodeURIComponent("/app/perfil#cuenta")}`;
    const sent = await sendEmail(email.value, correoCambiado({ name: String(user.user_metadata?.full_name ?? ""), email: email.value, pending: true, link }), { idempotencyKey: `correo-confirmar:${target}:${email.value}:${Math.floor(Date.now() / 3_600_000)}` });
    await audit(sb, v, "user.email_change_requested", target, { mode, reason, before, after: { pending_email: email.value }, sent: sent.ok });
    refresh(target);
    return sent.ok
      ? ok(`Le enviamos el enlace a ${email.value}. El correo cambia cuando lo abra (vence en 1 hora). Quedó en auditoría.`)
      : fail("Preparamos el cambio pero el correo no salió (revisa Resend). Puedes usar \"Cambiar ahora\".");
  });
}

/** Correos de ayuda para entrar: enlace para crear una contraseña nueva, enlace para entrar o confirmación del registro. */
export async function sendAccessEmail(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("users.manage", fd, async ({ v, sb }) => {
    const target = targetOf(fd);
    const kind = val.oneOf(fd, "kind", ["clave", "entrar", "confirmar"] as const, { label: "Tipo de correo" });
    const reason = reasonOf(fd);
    confirmed(fd);
    const what = { clave: "el enlace para crear una contraseña nueva", entrar: "el enlace para entrar", confirmar: "la confirmación del registro" }[kind];
    if (!sb) return ok(`Enviamos ${what}${DEMO_MSG}`);
    const user = await targetAuth(target);
    if (!user.email) return fail("La cuenta no tiene correo.");
    const pub = publicAuth();
    const next = `${SITE_URL}/auth/callback?next=${encodeURIComponent(kind === "clave" ? "/app/perfil?clave=nueva#cuenta" : "/app")}`;
    const { error } = kind === "clave"
      ? await pub.auth.resetPasswordForEmail(user.email, { redirectTo: next })
      : kind === "confirmar"
        ? (user.email_confirmed_at ? { error: { message: "ya confirmado" } } : await pub.auth.resend({ type: "signup", email: user.email, options: { emailRedirectTo: next } }))
        : await pub.auth.signInWithOtp({ email: user.email, options: { shouldCreateUser: false, emailRedirectTo: next } });
    if (error) {
      if (error.message === "ya confirmado") return fail("Ese correo ya está confirmado. Envía el enlace para entrar.");
      return fail(/rate|seconds|security purposes/i.test(error.message) ? "Ya se envió un correo hace poco. Espera un minuto." : "Supabase no envió el correo. Intenta de nuevo.");
    }
    await audit(sb, v, `user.access_email`, target, { kind, reason, to: user.email });
    refresh(target);
    return ok(`Enviamos ${what} a ${user.email}. Que revise también Correo no deseado. Quedó en auditoría.`);
  });
}

/** Cierra todas las sesiones de la cuenta (celular, computadora): tiene que volver a entrar. */
export async function signOutEverywhere(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("users.manage", fd, async ({ v, sb }) => {
    const target = targetOf(fd);
    const self = notSelf(v.id, target, "signout");
    if (!self.ok) return fail(self.error);
    const reason = reasonOf(fd);
    confirmed(fd);
    if (!sb) return ok(`Sesiones cerradas${DEMO_MSG}`);
    const { data, error } = await needAdmin().rpc("admin_sign_out_all", { p_target: target });
    if (error) return fail(pgMsg(error));
    await audit(sb, v, "user.sign_out_all", target, { reason, before: { sessions: Number(data ?? 0) }, after: { sessions: 0 } });
    refresh(target);
    return ok(`Listo: cerramos ${Number(data ?? 0)} ${Number(data) === 1 ? "sesión" : "sesiones"}. Tendrá que entrar de nuevo. Quedó en auditoría.`);
  });
}

/**
 * Bloquea la cuenta: no puede iniciar sesión (Supabase), se cierran sus sesiones y la app la rechaza (profiles.blocked_at).
 * No cancela cobros: si tiene un plan que se renueva, cancela la renovación aparte. Desbloquear lo revierte todo.
 */
export async function setBlocked(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("users.manage", fd, async ({ v, sb }) => {
    const target = targetOf(fd);
    const block = val.oneOf(fd, "block", ["si", "no"] as const, { label: "Acción" }) === "si";
    if (block) { const self = notSelf(v.id, target, "block"); if (!self.ok) return fail(self.error); }
    const reason = reasonOf(fd);
    confirmed(fd);
    if (!sb) return ok(`${block ? "Cuenta bloqueada" : "Cuenta desbloqueada"}${DEMO_MSG}`);
    if (block && (await targetRole(sb, target)) === "superadmin") return fail("Para bloquear a otro superadmin, primero cámbiale el rol.");
    const admin = needAdmin();
    const { error } = await sb.rpc("admin_set_blocked", { p_target: target, p_block: block, p_reason: reason });
    if (error) return fail(pgMsg(error));
    const { error: banErr } = await admin.auth.admin.updateUserById(target, { ban_duration: block ? BAN_FOREVER : "none" });
    let closed = 0;
    if (block) {
      const { data } = await admin.rpc("admin_sign_out_all", { p_target: target });
      closed = Number(data ?? 0);
    }
    if (banErr) {
      logError("admin-manage", "ban_failed", { kind: errCode(banErr) });
      await audit(sb, v, "user.ban_failed", target, { block });
      refresh(target);
      return fail(block ? "La app ya la rechaza, pero Supabase no bloqueó el inicio de sesión. Intenta de nuevo." : "La app ya la acepta, pero Supabase sigue bloqueando el inicio de sesión. Intenta de nuevo.");
    }
    await audit(sb, v, block ? "user.auth_ban" : "user.auth_unban", target, { sessions_closed: closed });
    refresh(target);
    return ok(block ? `Cuenta bloqueada: no puede entrar y cerramos ${closed} ${closed === 1 ? "sesión" : "sesiones"}. Quedó en auditoría.` : "Cuenta desbloqueada: ya puede entrar de nuevo. Quedó en auditoría.");
  });
}

// ─────────── Plan ───────────

/** Plan de cortesía (también sirve para extender la prueba): días rápidos, una fecha o sin vencimiento. */
export async function grantPlan(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("users.manage", fd, async ({ v, sb }) => {
    const target = targetOf(fd);
    const plan = val.oneOf(fd, "plan", ["entreno", "completo"] as const, { label: "Plan" });
    const pick = val.oneOf(fd, "duration", ["7", "30", "90", "365", "fecha", "siempre"] as const, { label: "Duración" });
    const choice: CompChoice = pick === "siempre" ? { kind: "siempre" } : pick === "fecha" ? { kind: "fecha", date: val.text(fd, "date", { max: 10 }) } : { kind: "dias", days: Number(pick) };
    const exp = compExpiry(choice);
    if (!exp.ok) return fail(exp.error);
    const stopCharge = val.bool(fd, "stop_charge");
    const reason = reasonOf(fd);
    confirmed(fd);
    const until = pick === "siempre" ? "sin vencimiento" : `hasta el ${fmtDate(exp.iso)}`;
    if (!sb) return ok(`Plan de cortesía ${until}${DEMO_MSG}`);
    const { error } = await sb.rpc("admin_grant_comp_long", { p_target: target, p_plan: plan, p_expires: exp.iso, p_reason: reason });
    if (error) return fail(pgMsg(error));
    let note = "";
    if (stopCharge) {
      try {
        await cancelTrial(asViewer(target), true);
        await audit(sb, v, "user.charge_cancel", target, { reason, by: "cortesia", before: { charge: "programado" }, after: { charge: "cancelado" } });
        note = " Cancelamos su cobro programado (la tarjeta queda guardada).";
      } catch (e) {
        note = e instanceof Error && /No tienes un cobro programado/.test(e.message) ? "" : " Ojo: no pudimos cancelar su cobro programado; cancélalo abajo.";
      }
    }
    refresh(target);
    return ok(`Plan de cortesía ${until}.${note} Quedó en auditoría.`);
  });
}

/** Corta la renovación del plan pagado: conserva el acceso hasta el fin del periodo. No reembolsa. */
export async function cancelRenewal(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("users.manage", fd, async ({ v, sb }) => {
    const target = targetOf(fd);
    const reason = reasonOf(fd);
    confirmed(fd);
    if (!sb) return ok(`Renovación cancelada${DEMO_MSG}`);
    try {
      const { endsAt } = await cancelAtPeriodEndFor(target, `panel: ${reason}`);
      await audit(sb, v, "user.renewal_cancel", target, { reason, before: { renews: true }, after: { renews: false, access_until: endsAt } });
      refresh(target);
      return ok(`Renovación cancelada. Conserva su acceso${endsAt ? ` hasta el ${fmtDate(endsAt)}` : ""}. Quedó en auditoría.`);
    } catch (e) {
      return fail(e instanceof Error && /No tienes una suscripción/.test(e.message) ? "No tiene un plan que se renueve." : e instanceof Error && e.message ? e.message : "No pudimos cancelar la renovación.");
    }
  });
}

/** Cancela el cobro programado de la prueba o de la beta (la tarjeta queda guardada). Le llega el aviso de siempre. */
export async function cancelScheduledCharge(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("users.manage", fd, async ({ v, sb }) => {
    const target = targetOf(fd);
    const reason = reasonOf(fd);
    confirmed(fd);
    if (!sb) return ok(`Cobro programado cancelado${DEMO_MSG}`);
    try {
      const r = await cancelTrial(asViewer(target), true);
      await audit(sb, v, "user.charge_cancel", target, { reason, before: { charge: "programado" }, after: { charge: "cancelado", access_until: r.accessUntil } });
      refresh(target);
      return ok("Cobro programado cancelado. Le avisamos por correo. Quedó en auditoría.");
    } catch (e) {
      return fail(e instanceof Error && e.message ? e.message.replace("No tienes un cobro", "No tiene un cobro").replace("tu cobro", "su cobro") : "No pudimos cancelar el cobro.");
    }
  });
}

// ─────────── Temporadas y retos ───────────

/** Da acceso gratis (cortesía) a una temporada, programa o reto de pago. Ignora el cierre de inscripciones. */
export async function grantAccess(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("users.manage", fd, async ({ sb }) => {
    const target = targetOf(fd);
    const slug = slugOf(fd);
    const reason = reasonOf(fd);
    confirmed(fd);
    if (!sb) return ok(`Acceso otorgado${DEMO_MSG}`);
    const { error } = await sb.rpc("admin_grant_challenge", { p_target: target, p_slug: slug, p_reason: reason });
    if (error) return fail(pgMsg(error));
    refresh(target);
    return ok("Acceso otorgado: ya puede empezarlo desde la app. Quedó en auditoría.");
  });
}

export async function revokeAccess(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("users.manage", fd, async ({ sb }) => {
    const target = targetOf(fd);
    const slug = slugOf(fd);
    const reason = reasonOf(fd);
    confirmed(fd);
    if (!sb) return ok(`Acceso quitado${DEMO_MSG}`);
    const { data, error } = await sb.rpc("admin_revoke_challenge", { p_target: target, p_slug: slug, p_reason: reason });
    if (error) return fail(pgMsg(error));
    refresh(target);
    return ok(data === "compra" ? "Acceso quitado. Era una compra: si corresponde, reembolsa en ONVO o Tilopay. Quedó en auditoría." : "Acceso quitado. Quedó en auditoría.");
  });
}

export async function resetProgress(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("users.manage", fd, async ({ sb }) => {
    const target = targetOf(fd);
    const slug = slugOf(fd);
    const reason = reasonOf(fd);
    confirmed(fd);
    if (!sb) return ok(`Progreso reiniciado${DEMO_MSG}`);
    const { error } = await sb.rpc("admin_reset_challenge", { p_target: target, p_slug: slug, p_reason: reason });
    if (error) return fail(pgMsg(error));
    refresh(target);
    return ok("Progreso reiniciado: empieza de cero cuando lo abra. El XP ganado se queda. Quedó en auditoría.");
  });
}

export async function resetIntake(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("users.manage", fd, async ({ sb }) => {
    const target = targetOf(fd);
    const slug = slugOf(fd);
    const reason = reasonOf(fd);
    confirmed(fd);
    if (!sb) return ok(`Cuestionario reiniciado${DEMO_MSG}`);
    const { error } = await sb.rpc("admin_reset_season_intake", { p_target: target, p_slug: slug, p_reason: reason });
    if (error) return fail(pgMsg(error));
    refresh(target);
    return ok("Cuestionario reiniciado: lo vuelve a llenar al abrir la temporada. Quedó en auditoría.");
  });
}

// ─────────── Insignias y XP ───────────

export async function setBadge(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("users.manage", fd, async ({ sb }) => {
    const target = targetOf(fd);
    const badge = val.text(fd, "badge", { label: "Insignia", required: true, max: 80 });
    if (!isManualBadge(badge)) return fail("Esa insignia no se puede cambiar a mano.");
    const mode = val.oneOf(fd, "mode", ["otorgada", "quitada", "ninguna"] as const, { label: "Acción" });
    const reason = reasonOf(fd);
    confirmed(fd);
    const msg = { otorgada: "Insignia otorgada", quitada: "Insignia quitada", ninguna: "Insignia de vuelta a lo calculado" }[mode];
    if (!sb) return ok(`${msg}${DEMO_MSG}`);
    const { error } = await sb.rpc("admin_set_badge", { p_target: target, p_badge: badge, p_mode: mode, p_reason: reason });
    if (error) return fail(pgMsg(error));
    refresh(target);
    return ok(`${msg}. Quedó en auditoría.`);
  });
}

export async function adjustXp(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("users.manage", fd, async ({ sb }) => {
    const target = targetOf(fd);
    const delta = val.int(fd, "delta", { label: "XP", required: true, min: -20000, max: 20000 })!;
    const total = val.int(fd, "total", { min: 0 }) ?? 0;
    const chk = checkXpDelta(delta, total);
    if (!chk.ok) return fail(chk.error);
    const reason = reasonOf(fd);
    confirmed(fd);
    if (!sb) return ok(`XP ajustado${DEMO_MSG}`);
    const { data, error } = await sb.rpc("admin_adjust_xp", { p_target: target, p_delta: delta, p_reason: reason });
    if (error) return fail(pgMsg(error));
    refresh(target);
    return ok(`XP ajustado: ahora tiene ${Number(data ?? 0).toLocaleString("es-419")} XP. Quedó en auditoría.`);
  });
}
