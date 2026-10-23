"use server";
// Acciones del panel para testers de la beta. Mismo patrón que regalos-actions.ts: autoriza el rol en el servidor
// (admin-perms), valida la entrada y llama una función SECURITY DEFINER que vuelve a validar el rol y escribe audit_log.
import { revalidatePath } from "next/cache";
import { DEMO_MSG, audit, fail, ok, run } from "@/lib/admin-action-kit";
import type { ActionState } from "@/app/admin/actions";
import * as val from "@/lib/admin-validate";
import { ValidationError } from "@/lib/admin-validate";
import { deliverTesterNotices } from "@/lib/testers-server";
import { isEmailConfigured } from "@/lib/email/send";
import { fmtDate } from "@/lib/admin-format";
import { TESTER_DAYS } from "@/lib/testers";

function pgMsg(e: { code?: string; message?: string } | null): string {
  if (!e) return "Error de base de datos.";
  if (e.code === "42501") return "La base de datos rechazó la acción: permisos insuficientes.";
  if (["42P01", "PGRST202", "PGRST205", "42883", "42703"].includes(e.code ?? "")) return "Falta aplicar la migración 0029_testers.sql en Supabase.";
  if ((e.code === "P0001" || e.code === "22023") && e.message) return e.message;
  return "Error de base de datos.";
}

const confirmed = (fd: FormData) => {
  if (!val.bool(fd, "confirm")) throw new ValidationError("Confirma la acción marcando la casilla.");
};

/** Hace tester por 30 días desde ahora (o renueva). Aviso en la app, correo y push si los activó. */
export async function setTester(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("users.tester", fd, async ({ v, sb }) => {
    const target = val.id(fd, "target", { uuid: true, label: "Usuario" });
    const reason = val.text(fd, "reason", { label: "Motivo", required: true, min: 4, max: 300 });
    confirmed(fd);
    if (target === v.id) return fail("No puedes hacerte tester a ti mismo.");
    const until = new Date(Date.now() + TESTER_DAYS * 864e5).toISOString();
    if (!sb) return ok(`Ahora es tester hasta el ${fmtDate(until)}${DEMO_MSG}`);
    const { error } = await sb.rpc("admin_set_tester", { p_target: target, p_reason: reason });
    if (error) return fail(pgMsg(error));
    const d = await deliverTesterNotices({ userId: target, limit: 5 });
    revalidatePath(`/admin/usuarios/${target}`);
    revalidatePath("/admin/usuarios");
    const channels = ["en la app", isEmailConfigured() && d.email ? "por correo" : null, d.push ? "con una notificación" : null].filter(Boolean).join(", ").replace(/, ([^,]*)$/, " y $1");
    return ok(`Listo: es tester hasta el ${fmtDate(until)}. Le avisamos ${channels}. Quedó en auditoría.`);
  });
}

/** Quita el estado de tester antes de tiempo (y su acceso de cortesía). */
export async function revokeTester(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("users.tester", fd, async ({ sb }) => {
    const target = val.id(fd, "target", { uuid: true, label: "Usuario" });
    const reason = val.text(fd, "reason", { label: "Motivo", required: true, min: 4, max: 300 });
    confirmed(fd);
    if (!sb) return ok(`Ya no es tester${DEMO_MSG}`);
    const { data, error } = await sb.rpc("admin_revoke_tester", { p_target: target, p_reason: reason });
    if (error) return fail(pgMsg(error));
    revalidatePath(`/admin/usuarios/${target}`);
    revalidatePath("/admin/usuarios");
    return Number(data ?? 0) > 0 ? ok("Listo: ya no es tester y su mes de cortesía terminó. Quedó en auditoría.") : fail("Esta persona no tenía un mes de tester vigente.");
  });
}

/** Marca un reporte de la app como nuevo, visto o resuelto. */
export async function setFeedbackStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("feedback.manage", fd, async ({ v, sb }) => {
    const id = val.int(fd, "id", { required: true, min: 1, label: "Reporte" })!;
    const status = val.oneOf(fd, "status", ["nuevo", "visto", "resuelto"] as const, { label: "Estado" });
    const label = { nuevo: "nuevo", visto: "visto", resuelto: "resuelto" }[status];
    if (!sb) return ok(`Reporte marcado como ${label}${DEMO_MSG}`);
    const { data, error } = await sb.from("feedback_reports").update({ status }).eq("id", id).select("user_id").maybeSingle();
    if (error) return fail(pgMsg(error));
    if (!data) return fail("Reporte no encontrado.");
    await audit(sb, v, "feedback.status", `feedback:${id}`, { status, user: data.user_id });
    revalidatePath("/admin/usuarios/testers");
    revalidatePath(`/admin/usuarios/${data.user_id}`);
    return ok(`Reporte marcado como ${label}.`);
  });
}
