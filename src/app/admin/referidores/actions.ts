"use server";
// Programa de referidores (0051): solo superadmin. Autoriza en el servidor (admin-perms), valida la entrada, escribe con
// service_role (las tablas no tienen permisos de escritura por la API) y deja todo en audit_log.
import { revalidatePath } from "next/cache";
import { DEMO_MSG, audit, fail, ok, run } from "@/lib/admin-action-kit";
import type { ActionState } from "@/app/admin/actions";
import * as val from "@/lib/admin-validate";
import { ValidationError } from "@/lib/admin-validate";
import { adminClient } from "@/lib/supabase/admin";
import { normalizeAffCode, sanitizeTiers } from "@/lib/affiliates";
import { addAdjustment, cancelPayout, createInvite, grantAffiliate, markPayoutPaid, reverseCommission, runPayouts } from "@/lib/affiliates-server";
import { money } from "@/lib/admin-format";

const CAP = "affiliates.manage" as const;
const db = () => {
  const a = adminClient();
  if (!a) throw new ValidationError("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
  return a;
};
const refresh = (id?: string) => { revalidatePath("/admin/referidores"); if (id) revalidatePath(`/admin/referidores/${id}`); };
const code = (fd: FormData, required = false) => {
  const raw = val.text(fd, "code", { label: "Código", max: 20 });
  if (!raw) { if (required) throw new ValidationError("Escribe el código."); return null; }
  const c = normalizeAffCode(raw);
  if (!c) throw new ValidationError("El código debe tener de 3 a 20 letras minúsculas, números o guiones (sin guion al inicio ni al final).");
  return c;
};
const confirmed = (fd: FormData) => { if (!val.bool(fd, "confirm")) throw new ValidationError("Confirma la acción marcando la casilla."); };

/** Invitación de un solo uso por correo (vence en 14 días). El enlace se muestra una sola vez. */
export async function inviteAffiliate(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(CAP, fd, async ({ v, sb }) => {
    const email = val.text(fd, "email", { label: "Correo", required: true, max: 254 });
    const c = code(fd);
    if (!sb) return ok(`Invitación creada${DEMO_MSG}`);
    const { link, expiresAt } = await createInvite(db(), email, c, v.id);
    await audit(sb, v, "referidor.invitar", email.toLowerCase(), { code: c, expiresAt });
    refresh();
    return ok(`Invitación creada. Envíale este enlace (vence en 14 días, un solo uso): ${link}`);
  });
}

/** Hace referidor a una cuenta existente (por correo). */
export async function assignAffiliate(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(CAP, fd, async ({ v, sb }) => {
    const email = val.text(fd, "email", { label: "Correo", required: true, max: 254 }).toLowerCase();
    const c = code(fd);
    if (!sb) return ok(`Ahora es referidor${DEMO_MSG}`);
    const a = db();
    const { data: uid, error } = await a.rpc("auth_user_id_by_email", { p_email: email });
    if (error || !uid) return fail("No hay una cuenta con ese correo. Usa una invitación para que se registre primero.");
    const assigned = await grantAffiliate(a, String(uid), v.id, c);
    await audit(sb, v, "referidor.asignar", String(uid), { code: assigned });
    const { sendAffiliateEmail } = await import("@/lib/email");
    await sendAffiliateEmail({ userId: String(uid), key: `bienvenida/${uid}`, kind: "bienvenida", code: assigned }).catch(() => null);
    refresh(String(uid));
    return ok(`Listo: ahora es referidor con el código ${assigned}.`);
  });
}

/** Asigna desde la ficha de un usuario. */
export async function assignAffiliateById(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(CAP, fd, async ({ v, sb }) => {
    const target = val.id(fd, "target", { uuid: true, label: "Usuario" });
    if (!sb) return ok(`Ahora es referidor${DEMO_MSG}`);
    const assigned = await grantAffiliate(db(), target, v.id, null);
    await audit(sb, v, "referidor.asignar", target, { code: assigned });
    const { sendAffiliateEmail } = await import("@/lib/email");
    await sendAffiliateEmail({ userId: target, key: `bienvenida/${target}`, kind: "bienvenida", code: assigned }).catch(() => null);
    refresh(target);
    revalidatePath(`/admin/usuarios/${target}`);
    return ok(`Listo: ahora es referidor con el código ${assigned}.`);
  });
}

/** Revoca: conserva lo ganado (se sigue pagando), pero corta la atribución y las comisiones nuevas. */
export async function revokeAffiliate(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(CAP, fd, async ({ v, sb }) => {
    const target = val.id(fd, "target", { uuid: true, label: "Referidor" });
    const reason = val.text(fd, "reason", { label: "Motivo", required: true, min: 4, max: 300 });
    confirmed(fd);
    if (!sb) return ok(`Referidor revocado${DEMO_MSG}`);
    const now = new Date().toISOString();
    const { error } = await db().from("affiliates").update({ active: false, revoked_at: now, revoked_by: v.id, updated_at: now }).eq("user_id", target);
    if (error) return fail("No se pudo revocar.");
    await db().from("comp_grants").update({ revoked_at: now, revoked_by: v.id }).eq("user_id", target).eq("source", "afiliado").is("revoked_at", null);
    await audit(sb, v, "referidor.revocar", target, { reason });
    refresh(target);
    return ok("Revocado. Lo ya ganado se mantiene; no habrá comisiones nuevas.");
  });
}

export async function reactivateAffiliate(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(CAP, fd, async ({ v, sb }) => {
    const target = val.id(fd, "target", { uuid: true, label: "Referidor" });
    if (!sb) return ok(`Reactivado${DEMO_MSG}`);
    const c = await grantAffiliate(db(), target, v.id, null);
    await audit(sb, v, "referidor.reactivar", target, { code: c });
    refresh(target);
    return ok("Reactivado.");
  });
}

export async function setAffiliateCode(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(CAP, fd, async ({ v, sb }) => {
    const target = val.id(fd, "target", { uuid: true, label: "Referidor" });
    const c = code(fd, true)!;
    if (!sb) return ok(`Código guardado${DEMO_MSG}`);
    const { error } = await db().from("affiliates").update({ code: c, updated_at: new Date().toISOString() }).eq("user_id", target);
    if (error) return fail(error.code === "23505" ? "Ese código ya lo usa otro referidor." : "No se pudo guardar el código.");
    await audit(sb, v, "referidor.codigo", target, { code: c });
    refresh(target);
    return ok(`Código guardado: ${c}. Los enlaces con el código anterior dejan de funcionar.`);
  });
}

export async function saveAffiliateSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(CAP, fd, async ({ v, sb }) => {
    const n = (k: string, label: string, min: number, max: number) => val.num(fd, k, { label, min, max, required: true })!;
    const tiers = sanitizeTiers([1, 2, 3, 4].map((i) => ({ min: Number(fd.get(`tier${i}_min`)), rate: Number(fd.get(`tier${i}_rate`)) })));
    if (tiers.length !== 4) return fail("Revisa los niveles: cada uno necesita un mínimo de referidos (1 o más) y un porcentaje (1 a 100).");
    const row = {
      onvo_fee_pct: n("onvo_fee_pct", "Comisión de ONVO (%)", 0, 20), onvo_fee_fixed_minor: Math.round(n("onvo_fee_fixed", "Fijo de ONVO ($)", 0, 5) * 100),
      tilopay_fee_pct: n("tilopay_fee_pct", "Comisión de Tilopay (%)", 0, 20), tilopay_fee_fixed_minor: Math.round(n("tilopay_fee_fixed", "Fijo de Tilopay ($)", 0, 5) * 100),
      tax_pct: n("tax_pct", "Impuesto (%)", 0, 40), hold_days: Math.round(n("hold_days", "Días de espera", 0, 120)),
      min_payout_minor: Math.round(n("min_payout", "Pago mínimo ($)", 0, 1000) * 100), cookie_days: Math.round(n("cookie_days", "Días de la cookie", 1, 365)),
      tiers, perk_min: tiers[tiers.length - 1].min, updated_at: new Date().toISOString(), updated_by: v.id,
    };
    if (!sb) return ok(`Ajustes guardados${DEMO_MSG}`);
    const { error } = await db().from("affiliate_settings").update(row).eq("id", 1);
    if (error) return fail("No se pudieron guardar los ajustes.");
    await audit(sb, v, "referidor.ajustes", "programa", row);
    refresh();
    return ok("Ajustes guardados. Aplican a los pagos nuevos; las líneas anteriores no cambian.");
  });
}

export async function runPayoutsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(CAP, fd, async ({ v, sb }) => {
    confirmed(fd);
    if (!sb) return ok(`Pagos generados${DEMO_MSG}`);
    const r = await runPayouts(db(), v.id);
    await audit(sb, v, "referidor.pagos_generar", "programa", r);
    refresh();
    return ok(r.created ? `${r.created} pago${r.created === 1 ? "" : "s"} por ${money(r.total / 100)}. Sin método de pago: ${r.skippedNoMethod}. Bajo el mínimo: ${r.skippedLow}.` : `No hay pagos para generar. Sin método de pago: ${r.skippedNoMethod}. Bajo el mínimo: ${r.skippedLow}.`);
  });
}

export async function markPaidAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(CAP, fd, async ({ v, sb }) => {
    const id = val.int(fd, "payout", { label: "Pago", min: 1, required: true })!;
    const reference = val.text(fd, "reference", { label: "Referencia", required: true, min: 3, max: 120 });
    const date = val.date(fd, "paid_on", { label: "Fecha", required: true })!;
    if (!sb) return ok(`Marcado como pagado${DEMO_MSG}`);
    await markPayoutPaid(db(), id, reference, date, v.id).catch((e) => { throw new ValidationError(e instanceof Error ? e.message : "No se pudo marcar."); });
    await audit(sb, v, "referidor.pago_marcado", String(id), { reference, date });
    refresh();
    return ok("Pago marcado como hecho. El referidor ya lo ve en su panel.");
  });
}

export async function cancelPayoutAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(CAP, fd, async ({ v, sb }) => {
    const id = val.int(fd, "payout", { label: "Pago", min: 1, required: true })!;
    confirmed(fd);
    if (!sb) return ok(`Pago anulado${DEMO_MSG}`);
    await cancelPayout(db(), id).catch((e) => { throw new ValidationError(e instanceof Error ? e.message : "No se pudo anular."); });
    await audit(sb, v, "referidor.pago_anulado", String(id));
    refresh();
    return ok("Pago anulado. Su saldo vuelve a quedar disponible.");
  });
}

export async function reverseLineAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(CAP, fd, async ({ v, sb }) => {
    const id = val.int(fd, "line", { label: "Línea", min: 1, required: true })!;
    const target = val.id(fd, "target", { uuid: true, label: "Referidor" });
    const reason = val.text(fd, "reason", { label: "Motivo", required: true, min: 4, max: 300 });
    confirmed(fd);
    if (!sb) return ok(`Comisión revertida${DEMO_MSG}`);
    const r = await reverseCommission(db(), id, reason, v.id);
    await audit(sb, v, "referidor.revertir", String(id), { reason, result: r });
    refresh(target);
    return ok(r === "revertida" ? "Comisión revertida." : r === "ajuste" ? "Ya estaba pagada: se descontará del próximo pago." : r === "ya" ? "Ya estaba revertida." : "No existe esa línea.");
  });
}

export async function adjustAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(CAP, fd, async ({ v, sb }) => {
    const target = val.id(fd, "target", { uuid: true, label: "Referidor" });
    const amount = val.num(fd, "amount", { label: "Monto ($)", min: -10000, max: 10000, required: true })!;
    const reason = val.text(fd, "reason", { label: "Motivo", required: true, min: 4, max: 300 });
    const minor = Math.round(amount * 100);
    if (!minor) return fail("El monto no puede ser 0.");
    if (!sb) return ok(`Ajuste guardado${DEMO_MSG}`);
    await addAdjustment(db(), target, minor, reason, v.id);
    await audit(sb, v, "referidor.ajuste", target, { amountMinor: minor, reason });
    refresh(target);
    return ok(`Ajuste de ${money(minor / 100)} guardado.`);
  });
}
