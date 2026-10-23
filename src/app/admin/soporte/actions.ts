"use server";
// Soporte en el panel: responder (público) o nota interna, cambiar estado, prioridad y asignación, y ver la captura
// (enlace firmado de 60 s). Mismo patrón que el resto del panel: autoriza en el servidor (admin-perms), valida, y la base
// vuelve a validar el rol y las transiciones (admin_support_*, 0034) y escribe audit_log.
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { DEMO_MSG, fail, ok, run } from "@/lib/admin-action-kit";
import type { ActionState } from "@/app/admin/actions";
import { authorize } from "@/lib/admin-auth";
import * as val from "@/lib/admin-validate";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { deliverSupportNotices } from "@/lib/support-server";
import { MESSAGE_MAX, PRIORITIES, PRIORITY_LABEL, STATUS_LABEL, SUPPORT_STATUSES, type SupportStatus } from "@/lib/support";
import { errCode, logWarn } from "@/lib/log";

function pgMsg(e: { code?: string; message?: string } | null): string {
  if (!e) return "Error de base de datos.";
  if (e.code === "42501") return "Tu rol no puede gestionar soporte.";
  if (["42P01", "PGRST202", "PGRST205", "42883", "42703"].includes(e.code ?? "")) return "Falta aplicar la migración 0034_soporte.sql en Supabase.";
  if ((e.code === "P0001" || e.code === "22023") && e.message) return e.message.replace(/necesita_info/g, "necesitamos más información").replace(/en_proceso/g, "en proceso");
  return "Error de base de datos.";
}

/** Responde a la persona (le llega aviso, correo y push) o deja una nota interna (nunca la ve). */
export async function staffReply(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("support.tickets", fd, async ({ sb }) => {
    const ticket = val.int(fd, "ticket", { required: true, min: 1, label: "Reporte" })!;
    const body = val.text(fd, "body", { label: "Mensaje", required: true, min: 1, max: MESSAGE_MAX });
    const internal = val.bool(fd, "internal");
    const raw = val.text(fd, "status", { max: 20 });
    const status = raw ? val.oneOf(fd, "status", SUPPORT_STATUSES, { label: "Estado" }) : null;
    if (internal && status) return fail("Una nota interna no cambia el estado. Quita la nota interna o el cambio de estado.");
    if (!sb) return ok(`${internal ? "Nota interna guardada" : "Respuesta enviada"}${DEMO_MSG}`);
    const { error } = await sb.rpc("admin_support_reply", { p_ticket: ticket, p_body: body, p_internal: internal, p_status: status });
    if (error) return fail(pgMsg(error));
    if (!internal) after(() => deliverSupportNotices({ ticketId: ticket, limit: 5 }).then(() => {}));
    revalidatePath(`/admin/soporte/${ticket}`);
    revalidatePath("/admin/soporte");
    return ok(internal ? "Nota interna guardada. La persona no la ve." : `Respuesta enviada${status ? ` y estado: ${STATUS_LABEL[status as SupportStatus]}` : ""}. Le avisamos en la app, por correo y con una notificación.`);
  });
}

/** Estado, prioridad y asignación. */
export async function staffUpdate(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("support.tickets", fd, async ({ sb }) => {
    const ticket = val.int(fd, "ticket", { required: true, min: 1, label: "Reporte" })!;
    const status = val.text(fd, "status", { max: 20 }) ? val.oneOf(fd, "status", SUPPORT_STATUSES, { label: "Estado" }) : null;
    const priority = val.text(fd, "priority", { max: 20 }) ? val.oneOf(fd, "priority", PRIORITIES, { label: "Prioridad" }) : null;
    const who = val.text(fd, "assignee", { max: 40 });
    const unassign = who === "nadie";
    const assignee = who && !unassign ? (val.isUuid(who) ? who : null) : null;
    if (who && !unassign && !assignee && sb) return fail("Elige a alguien del equipo.");
    if (!sb) return ok(`Cambios guardados${priority ? `: prioridad ${PRIORITY_LABEL[priority]}` : ""}${DEMO_MSG}`);
    const { error } = await sb.rpc("admin_support_update", { p_ticket: ticket, p_status: status, p_priority: priority, p_assignee: assignee, p_unassign: unassign });
    if (error) return fail(pgMsg(error));
    after(() => deliverSupportNotices({ ticketId: ticket, limit: 5 }).then(() => {}));
    revalidatePath(`/admin/soporte/${ticket}`);
    revalidatePath("/admin/soporte");
    return ok("Cambios guardados. Quedó en auditoría.");
  });
}

const SIGNED_SECONDS = 60;
/** Demo: captura de ejemplo (SVG local, sin datos de nadie). */
const demoShot = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 400"><rect width="220" height="400" rx="24" fill="#FFF8E3"/><rect x="16" y="20" width="188" height="44" rx="12" fill="#FFD60A"/><rect x="16" y="80" width="188" height="120" rx="16" fill="#fff" stroke="#EDE3C6" stroke-width="2"/><circle cx="110" cy="140" r="18" fill="none" stroke="#1B1505" stroke-width="4" stroke-dasharray="60 30"/><text x="110" y="240" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="#6A604B">Captura de ejemplo</text></svg>`)}`;

/** Enlace firmado de 60 s a la captura. La base valida el rol y deja la auditoría (admin_support_file). */
export async function viewTicketShot(ticketId: number): Promise<{ ok: true; url: string; expiresIn: number } | { ok: false; error: string }> {
  const auth = await authorize("support.tickets");
  if (!auth.ok) return { ok: false, error: auth.error };
  if (auth.v.demo) return { ok: true, url: demoShot, expiresIn: SIGNED_SECONDS };
  if (!Number.isInteger(ticketId) || ticketId < 1) return { ok: false, error: "Reporte inválido." };
  const sb = await createClient();
  const { data, error } = await sb.rpc("admin_support_file", { p_ticket: ticketId });
  if (error || !data) return { ok: false, error: error ? pgMsg(error) : "Este reporte no tiene captura." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor para firmar la captura." };
  const { data: s, error: sErr } = await db.storage.from("soporte").createSignedUrl(String(data), SIGNED_SECONDS);
  if (sErr || !s?.signedUrl) { logWarn("soporte", "sign_failed", { kind: errCode(sErr) }); return { ok: false, error: "No pudimos abrir la captura. Intenta de nuevo." }; }
  return { ok: true, url: s.signedUrl, expiresIn: SIGNED_SECONDS };
}
