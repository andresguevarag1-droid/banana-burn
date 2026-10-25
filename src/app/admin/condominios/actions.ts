"use server";
// Solicitudes de condominios (0052): soporte y administración cambian el estado y las notas. Autoriza en el servidor
// (admin-perms, "leads.b2b"), valida, escribe con service_role (la tabla no tiene permisos de escritura por la API) y audita.
import { revalidatePath } from "next/cache";
import { DEMO_MSG, audit, fail, ok, run } from "@/lib/admin-action-kit";
import type { ActionState } from "@/app/admin/actions";
import * as val from "@/lib/admin-validate";
import { adminClient } from "@/lib/supabase/admin";
import { isStatus, statusLabel } from "@/lib/condominios";
import { CONDO_FREE_DAYS, condoCodeFromName, condoLink, condoStatusLabel, isCondoStatus, normalizeCondoCode, type CondoRow } from "@/lib/condos";
import { syncCondoMembers } from "@/lib/condos-server";

export async function updateCondoLead(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("leads.b2b", fd, async ({ v, sb }) => {
    const id = Number(val.text(fd, "id", { label: "Solicitud", required: true, max: 20 }));
    if (!Number.isSafeInteger(id) || id <= 0) return fail("Solicitud no válida.");
    const status = val.text(fd, "status", { label: "Estado", required: true, max: 20 });
    if (!isStatus(status)) return fail("Elige un estado válido.");
    const notes = val.text(fd, "notes", { label: "Notas", max: 2000 }) || null;
    if (!sb) return ok(`Guardado${DEMO_MSG}`);
    const db = adminClient();
    if (!db) return fail("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
    const { data, error } = await db.from("b2b_leads").update({ status, notes }).eq("id", id).select("id").maybeSingle();
    if (error || !data) return fail("No se pudo guardar. Revisa que la solicitud exista.");
    await audit(sb, v, "condominio.actualizar", String(id), { status });
    revalidatePath("/admin/condominios");
    return ok(`Guardado: ${statusLabel(status)}.`);
  });
}

// ───────────── Condominios afiliados (0053) ─────────────
// Crear un condominio, cambiar su estado (mes gratis, activo con plan y fecha pagada, terminado) y sus datos. Escribe con
// service_role, audita y, al activarlo, pasa de una vez a sus residentes al plan que paga el condominio.

const PLANS_OK = ["entreno", "completo"] as const;

export async function createCondo(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("leads.b2b", fd, async ({ v, sb }) => {
    const name = val.text(fd, "name", { label: "Nombre del condominio", required: true, min: 2, max: 80 });
    const company = val.text(fd, "admin_company", { label: "Administradora", max: 100 }) || null;
    const units = val.int(fd, "units", { label: "Unidades", min: 1, max: 20000 });
    const rawCode = val.text(fd, "code", { label: "Código", max: 30 });
    const leadId = val.int(fd, "lead_id", { label: "Solicitud", min: 1, max: 1e12 });
    const code = rawCode ? normalizeCondoCode(rawCode) : condoCodeFromName(name);
    if (!code) return fail("El código lleva de 3 a 30 letras minúsculas, números o guiones (sin guion al inicio ni al final).");
    if (!sb) return ok(`Creado: ${condoLink(code)}${DEMO_MSG}`);
    const db = adminClient();
    if (!db) return fail("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
    const now = new Date();
    // Si el código propuesto ya existe, se prueba con -2, -3… (solo cuando no lo escribió el staff).
    for (let i = 1; i <= 9; i++) {
      const tryCode = i === 1 ? code : `${code.slice(0, 27)}-${i}`;
      const { data, error } = await db.from("condos").insert({
        code: tryCode, name, admin_company: company, units, lead_id: leadId, status: "mes_gratis",
        free_starts_at: now.toISOString(), free_ends_at: new Date(now.getTime() + CONDO_FREE_DAYS * 864e5).toISOString(), created_by: v.id,
      }).select("id").single();
      if (!error && data) {
        await audit(sb, v, "condominio.crear", String((data as { id: number }).id), { code: tryCode });
        revalidatePath("/admin/condominios");
        return ok(`Condominio creado. Su enlace: ${condoLink(tryCode)}`);
      }
      if (error?.code === "23505" && !rawCode) continue;
      if (error?.code === "23505") return fail("Ese código ya lo usa otro condominio. Elige otro.");
      if (error?.code === "23503") return fail("La solicitud elegida no existe.");
      if (error?.code === "42P01" || error?.code === "PGRST205") return fail("Falta la migración 0053_condominios_afiliados.sql.");
      return fail("No se pudo crear el condominio.");
    }
    return fail("No encontramos un código libre. Escribe uno.");
  });
}

export async function updateCondo(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("leads.b2b", fd, async ({ v, sb }) => {
    const id = val.int(fd, "id", { label: "Condominio", required: true, min: 1, max: 1e12 })!;
    const status = val.text(fd, "status", { label: "Estado", required: true, max: 20 });
    if (!isCondoStatus(status)) return fail("Elige un estado válido.");
    const name = val.text(fd, "name", { label: "Nombre", required: true, min: 2, max: 80 });
    const company = val.text(fd, "admin_company", { label: "Administradora", max: 100 }) || null;
    const units = val.int(fd, "units", { label: "Unidades", min: 1, max: 20000 });
    const notes = val.text(fd, "notes", { label: "Notas", max: 2000 }) || null;
    const freeEnds = val.date(fd, "free_ends_at", { label: "Fin del mes gratis" });
    const planRaw = val.text(fd, "paid_plan", { max: 20 });
    const paidPlan = (PLANS_OK as readonly string[]).includes(planRaw) ? (planRaw as (typeof PLANS_OK)[number]) : null;
    const paidUntil = val.date(fd, "paid_until", { label: "Pagado hasta" });
    if (status === "activo" && (!paidPlan || !paidUntil)) return fail("Para activarlo, elige el plan que paga el condominio y hasta qué fecha está pagado.");
    if (!sb) return ok(`Guardado${DEMO_MSG}`);
    const db = adminClient();
    if (!db) return fail("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
    const patch: Record<string, unknown> = { status, name, admin_company: company, units, notes, paid_plan: paidPlan, paid_until: paidUntil };
    if (freeEnds) patch.free_ends_at = freeEnds;
    const { data, error } = await db.from("condos").update(patch).eq("id", id).select("id,code,name,status,free_starts_at,free_ends_at,paid_plan,paid_until").maybeSingle();
    if (error?.code === "23514") return fail("Revisa las fechas: el fin del mes gratis va después del inicio.");
    if (error || !data) return fail("No se pudo guardar. Revisa que el condominio exista.");
    const c = data as CondoRow;
    const r = status === "activo" ? await syncCondoMembers(db, c).catch(() => ({ synced: 0, notices: 0, errors: 1 })) : null;
    await audit(sb, v, "condominio.actualizar", String(id), { status, paid_plan: paidPlan, paid_until: paidUntil, synced: r?.synced ?? 0 });
    revalidatePath("/admin/condominios");
    return ok(`Guardado: ${condoStatusLabel(status)}.${r && r.synced ? ` ${r.synced} residente${r.synced === 1 ? "" : "s"} con el plan del condominio.` : ""}`);
  });
}
