"use server";
// Testimonios (#238, 0065): aprobar cuáles se usan. Con el cliente del admin (RLS: solo is_admin actualiza approved_at, y
// la base rechaza aprobar una opinión sin permiso para publicarla). Queda en audit_log.
import { revalidatePath } from "next/cache";
import { DEMO_MSG, audit, fail, ok, run } from "@/lib/admin-action-kit";
import type { ActionState } from "@/app/admin/actions";
import { ValidationError } from "@/lib/admin-validate";

export async function setTestimonialApproval(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("testimonials.manage", fd, async ({ v, sb }) => {
    const id = Number(fd.get("id"));
    if (!Number.isSafeInteger(id) || id <= 0) throw new ValidationError("Opinión inválida.");
    const approve = fd.get("approve") === "1";
    if (!sb) return ok(`${approve ? "Aprobada" : "Aprobación quitada"}${DEMO_MSG}`);
    const { data, error } = await sb.from("testimonials").update({ approved_at: approve ? new Date().toISOString() : null }).eq("id", id).select("id");
    if (error) return fail(error.code === "23514" ? "Esa persona no dio permiso para publicar su opinión." : "No se pudo guardar. Revisa que la migración 0065_testimonios.sql esté aplicada.");
    if (!data?.length) return fail("No encontramos esa opinión.");
    await audit(sb, v, approve ? "testimonio.aprobar" : "testimonio.quitar", String(id));
    revalidatePath("/admin/testimonios");
    return ok(approve ? "Aprobada: ya se puede usar." : "Aprobación quitada.");
  });
}
