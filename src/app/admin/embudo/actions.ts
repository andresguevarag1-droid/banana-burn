"use server";
// Embudo de plata (#279, 0068): el gasto en anuncios de una semana, escrito a mano. Con el cliente del admin (RLS: solo
// is_admin escribe en ad_spend_weeks). Queda en audit_log. El resto de /admin/embudo es solo lectura.
import { revalidatePath } from "next/cache";
import { DEMO_MSG, audit, fail, ok, run } from "@/lib/admin-action-kit";
import type { ActionState } from "@/app/admin/actions";
import { ValidationError } from "@/lib/admin-validate";
import { crWeeks, parseUsd } from "@/lib/embudo-plata";
import { usd2 } from "@/lib/num";

export async function saveAdSpend(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("metrics.revenue", fd, async ({ v, sb }) => {
    const week = String(fd.get("week") ?? "");
    if (!crWeeks().some((w) => w.key === week)) throw new ValidationError("Elige una de las últimas 8 semanas.");
    const minor = parseUsd(String(fd.get("amount") ?? ""));
    if (minor === null) throw new ValidationError("Escribe el gasto en USD, por ejemplo 120 o 120.50.");
    if (!sb) return ok(`Gasto guardado${DEMO_MSG}`);
    const { error } = await sb.from("ad_spend_weeks").upsert({ week_start: week, amount_minor: minor, updated_by: v.id, updated_at: new Date().toISOString() });
    if (error) return fail("No se pudo guardar. Revisa que la migración 0068_embudo_plata.sql esté aplicada.");
    await audit(sb, v, "embudo.gasto_anuncios", week, { amount_minor: minor });
    revalidatePath("/admin/embudo");
    return ok(`Gasto de la semana guardado: ${usd2(minor / 100)}.`);
  });
}
