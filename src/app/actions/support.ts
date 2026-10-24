"use server";
// "Reportar un problema" (0034): crear un caso, responder, confirmar que se resolvió o reabrir. La base valida dueño,
// estado, largo y límites otra vez; aquí además se frena el spam con rate_hit (compartido entre instancias).
// Nunca se registra el contenido ni datos de la persona en los logs: solo códigos.
import { after } from "next/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient, getViewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { dbRateLimit, keyPart } from "@/lib/security/db-rate-limit";
import { getEntitlements } from "@/lib/entitlements";
import { deployId } from "@/lib/version";
import { feedbackPage } from "@/lib/testers";
import { deviceLabel, MESSAGE_MAX, ticketError, ticketNumber } from "@/lib/support";
import { deliverSupportNotices } from "@/lib/support-server";
import { errCode, logError } from "@/lib/log";
import { isUuid } from "@/lib/security";
import { limitError } from "@/lib/security/limits";

export type SupportResult = { ok: boolean; error?: string; id?: number; number?: string; demo?: boolean };

const ORIGINS = ["perfil", "menu", "tester", "hoy", "soporte"] as const;
const SHOT = /^[0-9a-f-]{36}\/captura-[a-z0-9]{1,16}\.(jpg|png|webp)$/i;

function dbError(e: { code?: string; message?: string }): string {
  if (e.code === "P0001" && e.message) return e.message.slice(0, 160);
  if (e.code === "42501") return "No encontramos ese reporte.";
  if (["PGRST202", "42883", "42P01"].includes(e.code ?? "")) return "Los reportes todavía no están activos. Escríbenos a hola@bananaburn.app.";
  return "No se pudo enviar. Intenta de nuevo en un momento.";
}

/** Crea un caso. El contexto técnico lo arma el servidor: pantalla, versión, dispositivo y navegador en palabras, plan. */
export async function createTicket(input: { category: string; title: string; body: string; page?: string | null; origin?: string | null; attachment?: string | null }): Promise<SupportResult> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  const i = { category: String(input.category ?? ""), title: String(input.title ?? "").slice(0, 200), body: String(input.body ?? "").slice(0, 5000) };
  const err = ticketError(i);
  if (err) return { ok: false, error: err };
  if (v.demo) return { ok: true, id: 101, number: ticketNumber(101), demo: true };
  const attachment = input.attachment ? String(input.attachment) : null;
  if (attachment && (!SHOT.test(attachment) || attachment.split("/")[0] !== v.id)) return { ok: false, error: "No pudimos usar la captura. Adjúntala de nuevo." };
  if (!(await dbRateLimit(adminClient(), `soporte:caso:${keyPart(v.id)}`, 3600, 5))) return { ok: false, error: "Ya enviaste varios reportes hace poco. Responde en uno de ellos si tienes algo más." };
  try {
    const ent = await getEntitlements(v).catch(() => null);
    const ua = (await headers()).get("user-agent");
    const origin = ORIGINS.find((o) => o === input.origin) ?? "soporte";
    const context: Record<string, string> = { device: deviceLabel(ua), origin };
    const page = feedbackPage(input.page);
    if (page) context.page = page;
    if (deployId()) context.version = deployId().slice(0, 12);
    if (ent) context.plan = ent.trial ? "prueba" : ent.plan;
    const sb = await createClient();
    const { data, error } = await sb.rpc("support_create_ticket", { p_category: i.category, p_title: i.title.trim(), p_body: i.body.trim(), p_context: context, p_attachment: attachment });
    if (error) {
      if (error.code !== "P0001") logError("soporte", "create_failed", { code: error.code });
      return { ok: false, error: dbError(error) };
    }
    const id = Number(data);
    after(() => deliverSupportNotices({ ticketId: id, limit: 5 }).then(() => {}));
    revalidatePath("/app/soporte");
    return { ok: true, id, number: ticketNumber(id) };
  } catch (e) {
    logError("soporte", "create_failed", { kind: errCode(e) });
    return { ok: false, error: "No se pudo enviar. Intenta de nuevo en un momento." };
  }
}

/** La persona responde en su caso abierto. */
export async function replyTicket(ticketId: number, body: string): Promise<SupportResult> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  const text = String(body ?? "").trim();
  if (!text) return { ok: false, error: "Escribe tu mensaje." };
  if (text.length > MESSAGE_MAX) return { ok: false, error: `Tu mensaje puede tener hasta ${MESSAGE_MAX.toLocaleString("es-419")} caracteres.` };
  if (!Number.isInteger(ticketId) || ticketId < 1) return { ok: false, error: "No encontramos ese reporte." };
  if (v.demo) return { ok: true, demo: true };
  if (!(await dbRateLimit(adminClient(), `soporte:msg:${keyPart(v.id)}`, 3600, 20))) return { ok: false, error: "Enviaste muchos mensajes seguidos. Espera un momento." };
  const sb = await createClient();
  const { error } = await sb.rpc("support_reply", { p_ticket: ticketId, p_body: text });
  if (error) return { ok: false, error: dbError(error) };
  revalidatePath(`/app/soporte/${ticketId}`);
  return { ok: true };
}

/** "Ya se resolvió" (queda cerrado) o "Reabrir" (hasta 7 días después). */
export async function ticketAction(ticketId: number, action: "confirmar" | "reabrir"): Promise<SupportResult> {
  const v = await getViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  { const lim = v.demo ? null : await limitError("registro", v.id); if (lim) return { ok: false, error: lim }; }
  if (!Number.isInteger(ticketId) || ticketId < 1 || (action !== "confirmar" && action !== "reabrir")) return { ok: false, error: "Acción inválida." };
  if (v.demo) return { ok: true, demo: true };
  const sb = await createClient();
  const { error } = await sb.rpc("support_user_action", { p_ticket: ticketId, p_action: action });
  if (error) return { ok: false, error: dbError(error) };
  revalidatePath(`/app/soporte/${ticketId}`);
  revalidatePath("/app/soporte");
  return { ok: true };
}

/** Borra una captura que se subió pero no llegó a enviarse (la propia carpeta: lo permite la política del bucket). */
export async function discardShot(path: string): Promise<{ ok: boolean }> {
  const v = await getViewer();
  if (!v || v.demo || !SHOT.test(path) || path.split("/")[0] !== v.id || !isUuid(v.id)) return { ok: false };
  const { error } = await (await createClient()).storage.from("soporte").remove([path]);
  return { ok: !error };
}
