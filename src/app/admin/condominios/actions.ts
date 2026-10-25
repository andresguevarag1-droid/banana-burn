"use server";
// Solicitudes de condominios (0052): soporte y administración cambian el estado y las notas. Autoriza en el servidor
// (admin-perms, "leads.b2b"), valida, escribe con service_role (la tabla no tiene permisos de escritura por la API) y audita.
import { revalidatePath } from "next/cache";
import { DEMO_MSG, audit, fail, ok, run } from "@/lib/admin-action-kit";
import type { ActionState } from "@/app/admin/actions";
import * as val from "@/lib/admin-validate";
import { adminClient } from "@/lib/supabase/admin";
import { isStatus, statusLabel } from "@/lib/condominios";

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
