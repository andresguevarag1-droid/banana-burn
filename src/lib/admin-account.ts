// Borrado de cuentas (derecho de supresión). Una sola secuencia para el usuario (/api/cuenta/borrar) y el panel.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cancelSubscription, OnvoError } from "@/lib/onvo";

const BUCKET = "progreso";

export type DeleteResult = { ok: true } | { ok: false; status: number; error: string; step: "subscriptions" | "photos" | "auth" };

/**
 * Orden (si un paso falla, no se sigue):
 *  1. Cancela en ONVO las suscripciones que aún cobran (si falla, NO borramos: la persona seguiría pagando sin cuenta).
 *  2. Borra todas sus fotos de Storage (carpeta `${uid}/`): Storage no se borra en cascada con auth.users.
 *  3. Quita datos personales de lo que no cae en cascada (scrub_deleted_user: cuerpo de webhooks, extractos de reportes).
 *  4. Borra el usuario en Auth; las tablas públicas caen en cascada (payment_events conserva el registro contable con user_id nulo).
 * `admin` debe ser el cliente con service_role.
 */
export async function deleteAccountData(admin: SupabaseClient, userId: string, scope = "cuenta"): Promise<DeleteResult> {
  // 1) Suscripciones que todavía pueden cobrar.
  const { data: subs } = await admin.from("subscriptions").select("id,provider_subscription_id,status").eq("user_id", userId).in("status", ["active", "trialing", "past_due", "incomplete"]);
  for (const s of subs ?? []) {
    if (!s.provider_subscription_id) continue;
    try {
      await cancelSubscription(s.provider_subscription_id as string);
    } catch (e) {
      if (!(e instanceof OnvoError && e.status === 404)) {
        console.error(JSON.stringify({ scope, msg: "no se pudo cancelar en ONVO antes de borrar", userId, status: e instanceof OnvoError ? e.status : null }));
        return { ok: false, status: 502, step: "subscriptions", error: "No pudimos cancelar la suscripción con el procesador de pagos. Intenta de nuevo o escríbenos a hola@bananaburn.app." };
      }
    }
  }

  // 2) Fotos de progreso (paginado).
  try {
    for (let guard = 0; guard < 50; guard++) {
      const { data: files, error } = await admin.storage.from(BUCKET).list(userId, { limit: 100 });
      if (error) throw error;
      if (!files?.length) break;
      const { error: rmErr } = await admin.storage.from(BUCKET).remove(files.map((f) => `${userId}/${f.name}`));
      if (rmErr) throw rmErr;
      if (files.length < 100) break;
    }
  } catch {
    console.error(JSON.stringify({ scope, msg: "no se pudieron borrar las fotos", userId }));
    return { ok: false, status: 500, step: "photos", error: "No pudimos borrar las fotos. Intenta de nuevo o escríbenos a hola@bananaburn.app." };
  }

  // 3) Lo que sobrevive a la cascada (registro contable y moderación) se queda sin datos personales (0023).
  //    Si la función aún no existe en la base, se sigue: borrar la cuenta pesa más que este paso.
  try {
    const { error: scrubErr } = await admin.rpc("scrub_deleted_user", { p_user: userId });
    if (scrubErr) console.error(JSON.stringify({ scope, msg: "scrub_deleted_user falló", userId, code: scrubErr.code ?? null }));
  } catch {
    console.error(JSON.stringify({ scope, msg: "scrub_deleted_user falló", userId }));
  }

  // 4) Cuenta y datos en cascada.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error(JSON.stringify({ scope, msg: "deleteUser falló", userId, code: error.status ?? null }));
    return { ok: false, status: 500, step: "auth", error: "No se pudo borrar la cuenta." };
  }
  return { ok: true };
}
