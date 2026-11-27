"use server";
// #332: envía la siguiente tanda de la campaña "primer mes al 50 %". Solo admin (marketing.campaign) y solo al tocar el botón.
import { revalidatePath } from "next/cache";
import { DEMO_MSG, audit, fail, ok, run } from "@/lib/admin-action-kit";
import type { ActionState } from "@/app/admin/actions";
import * as val from "@/lib/admin-validate";
import { ValidationError } from "@/lib/admin-validate";
import { adminClient } from "@/lib/supabase/admin";
import { isEmailConfigured } from "@/lib/email/send";
import { sendCampaignBatch } from "@/lib/campana-50-server";
import { BATCH_SIZE, CAMPAIGN } from "@/lib/campana-50";

export async function sendCampaign50(_: ActionState, fd: FormData): Promise<ActionState> {
  return run("marketing.campaign", fd, async ({ v, sb }) => {
    if (!val.bool(fd, "confirm")) throw new ValidationError("Confirma el envío marcando la casilla.");
    if (!sb) return ok(`Enviarías hasta ${BATCH_SIZE} correos${DEMO_MSG}`);
    if (!isEmailConfigured()) return fail("El correo no está configurado: no se envió nada.");
    const admin = adminClient();
    if (!admin) return fail("Falta la llave de servicio de Supabase: no se envió nada.");
    try {
      const r = await sendCampaignBatch(admin);
      await audit(sb, v, "campaign.send", CAMPAIGN, { ...r });
      revalidatePath("/admin/embudo/campana-50");
      return ok(`Tanda enviada: ${r.emailed} correos${r.failed ? `, ${r.failed} con error` : ""}. Quedan ${r.left}. Quedó en auditoría.`);
    } catch {
      return fail("No pudimos leer la audiencia (¿falta la migración 0078?). No se envió nada.");
    }
  });
}
