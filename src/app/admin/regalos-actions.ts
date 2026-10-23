"use server";
// Acciones del panel para regalos de meses y referidos. Mismo patrón que actions.ts: autoriza el rol en el servidor
// (admin-perms), valida la entrada, llama una función SECURITY DEFINER que vuelve a validar el rol y escribe audit_log.
import { revalidatePath } from "next/cache";
import { DEMO_MSG, fail, ok, run } from "@/lib/admin-action-kit";
import type { ActionState } from "@/app/admin/actions";
import * as val from "@/lib/admin-validate";
import { ValidationError } from "@/lib/admin-validate";
import { GIFT_BULK_MAX, GIFT_MAX_MONTHS, GIFT_MESSAGE_MAX, monthsLabel, planLabel } from "@/lib/gifts";
import { deliverPendingGifts } from "@/lib/gifts-server";
import { isEmailConfigured } from "@/lib/email/send";

function pgMsg(e: { code?: string; message?: string } | null): string {
  if (!e) return "Error de base de datos.";
  if (e.code === "42501") return "La base de datos rechazó la acción: permisos insuficientes.";
  if (["42P01", "PGRST202", "PGRST205", "42883", "42703"].includes(e.code ?? "")) return "Falta aplicar la migración 0025_regalos_referidos.sql en Supabase.";
  if ((e.code === "P0001" || e.code === "22023") && e.message) return e.message;
  return "Error de base de datos.";
}

const confirmed = (fd: FormData) => {
  if (!val.bool(fd, "confirm")) throw new ValidationError("Confirma la acción marcando la casilla.");
};

/** Meses: una opción rápida (1, 3, 6, 12) o "otro" con un número de 1 a 24. */
function monthsOf(fd: FormData): number {
  const pick = val.text(fd, "months", { label: "Meses", required: true, max: 5 });
  const n = pick === "otro" ? val.int(fd, "months_custom", { label: "Meses", required: true, min: 1, max: GIFT_MAX_MONTHS }) : Number(pick);
  if (!Number.isInteger(n) || n! < 1 || n! > GIFT_MAX_MONTHS) throw new ValidationError(`Los meses van de 1 a ${GIFT_MAX_MONTHS}.`);
  return n!;
}

function giftInput(fd: FormData) {
  return {
    plan: val.oneOf(fd, "plan", ["entreno", "completo"] as const, { label: "Plan" }),
    months: monthsOf(fd),
    message: val.text(fd, "message", { label: "Mensaje", max: GIFT_MESSAGE_MAX }) || null,
    reason: val.text(fd, "reason", { label: "Motivo", required: true, min: 4, max: 300 }),
  };
}

/** Regala N meses de un plan a una persona. Se apilan con lo que ya tenga. Aviso, correo y push. */
export async function giftMonths(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("users.gift", fd, async ({ sb }) => {
    const target = val.id(fd, "target", { uuid: true, label: "Usuario" });
    const g = giftInput(fd);
    confirmed(fd);
    const what = `${monthsLabel(g.months)} de ${planLabel(g.plan)}`;
    if (!sb) return ok(`Regalaste ${what}${DEMO_MSG}`);
    const { error } = await sb.rpc("admin_gift_months", { p_target: target, p_plan: g.plan, p_months: g.months, p_message: g.message, p_reason: g.reason });
    if (error) return fail(pgMsg(error));
    const d = await deliverPendingGifts({ userId: target, limit: 5 });
    revalidatePath(`/admin/usuarios/${target}`);
    const channels = ["en la app", isEmailConfigured() && d.email ? "por correo" : null, d.push ? "con una notificación" : null].filter(Boolean).join(", ").replace(/, ([^,]*)$/, " y $1");
    return ok(`Listo: ${what}. Le avisamos ${channels}. Quedó en auditoría.`);
  });
}

const UUIDS = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** El mismo regalo a varias personas: casillas de la lista (`ids`) o ids pegados en el campo de texto. */
export async function giftMonthsBulk(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("users.gift", fd, async ({ sb }) => {
    const picked = fd.getAll("ids").map(String);
    const pasted = val.text(fd, "pasted", { max: 40_000 }).match(UUIDS) ?? [];
    const ids = [...new Set([...picked, ...pasted].map((x) => x.toLowerCase()).filter(val.isUuid))];
    if (!ids.length) return fail("Elige al menos una persona.");
    if (ids.length > GIFT_BULK_MAX) return fail(`Máximo ${GIFT_BULK_MAX} personas por vez.`);
    const g = giftInput(fd);
    confirmed(fd);
    const what = `${monthsLabel(g.months)} de ${planLabel(g.plan)}`;
    if (!sb) return ok(`Regalaste ${what} a ${ids.length.toLocaleString("es-419")} ${ids.length === 1 ? "persona" : "personas"}${DEMO_MSG}`);
    const { data, error } = await sb.rpc("admin_gift_months_bulk", { p_targets: ids, p_plan: g.plan, p_months: g.months, p_message: g.message, p_reason: g.reason });
    if (error) return fail(pgMsg(error));
    await deliverPendingGifts({ limit: GIFT_BULK_MAX });
    revalidatePath("/admin/usuarios");
    const n = Number(data ?? 0);
    return ok(`Listo: ${what} para ${n.toLocaleString("es-419")} ${n === 1 ? "persona" : "personas"}${n < ids.length ? ` (${ids.length - n} no existen)` : ""}. Quedó en auditoría.`);
  });
}

/** Revoca una recompensa de referidos por fraude: quita sus meses y descarta a los referidos de ese grupo. */
export async function revokeReferralReward(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("referrals.manage", fd, async ({ sb }) => {
    const target = val.id(fd, "target", { uuid: true, label: "Usuario" });
    const reward = val.int(fd, "reward", { required: true, min: 1, label: "Recompensa" })!;
    const reason = val.text(fd, "reason", { label: "Motivo", required: true, min: 4, max: 300 });
    confirmed(fd);
    if (!sb) return ok(`Recompensa revocada${DEMO_MSG}`);
    const { error } = await sb.rpc("admin_revoke_referral_reward", { p_reward: reward, p_reason: reason });
    if (error) return fail(pgMsg(error));
    revalidatePath(`/admin/usuarios/${target}`);
    return ok("Recompensa revocada: sus meses ya no cuentan. Quedó en auditoría.");
  });
}

/** Revisa un referido "en revisión": aprobar (vuelve a contar) o descartar. */
export async function reviewReferral(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("referrals.manage", fd, async ({ sb }) => {
    const target = val.id(fd, "target", { uuid: true, label: "Usuario" });
    const referral = val.int(fd, "referral", { required: true, min: 1, label: "Referido" })!;
    const approve = val.oneOf(fd, "decision", ["aprobar", "descartar"] as const, { label: "Decisión" }) === "aprobar";
    const reason = val.text(fd, "reason", { label: "Motivo", required: true, min: 4, max: 300 });
    confirmed(fd);
    if (!sb) return ok(`${approve ? "Referido aprobado" : "Referido descartado"}${DEMO_MSG}`);
    const { error } = await sb.rpc("admin_review_referral", { p_referral: referral, p_approve: approve, p_reason: reason });
    if (error) return fail(pgMsg(error));
    if (approve) await deliverPendingGifts({ userId: target, limit: 5 });
    revalidatePath(`/admin/usuarios/${target}`);
    return ok(approve ? "Aprobado: vuelve a contar para sus recompensas. Quedó en auditoría." : "Descartado: no cuenta para recompensas. Quedó en auditoría.");
  });
}
