// Borrado de cuentas (derecho de supresión). Una sola secuencia para el usuario (/api/cuenta/borrar) y el panel.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cancelSubscription, detachPaymentMethod, OnvoError } from "@/lib/onvo";
import { removeCardToken } from "@/lib/tilopay";

const BUCKET = "progreso";
const ID_BUCKET = "identidad";

export type DeleteResult = { ok: true } | { ok: false; status: number; error: string; step: "subscriptions" | "photos" | "auth" };

/**
 * Orden (si un paso falla, no se sigue):
 *  1. Cancela en ONVO las suscripciones de ONVO que aún cobran (si falla, NO borramos: la persona seguiría pagando sin
 *     cuenta). Las de Tilopay las cobra nuestro motor desde la base: caen en cascada y no se cobra más (cancelStepFor).
 *  2. Borra todas sus fotos de Storage (carpeta `${uid}/` en 'progreso' y en 'identidad'): Storage no se borra en cascada.
 *  3. Quita datos personales de lo que no cae en cascada (scrub_deleted_user: cuerpo de webhooks, extractos de reportes).
 *  4. Borra el usuario en Auth; las tablas públicas caen en cascada (payment_events conserva el registro contable con user_id nulo).
 * `admin` debe ser el cliente con service_role.
 */
/**
 * Qué hacer con cada suscripción viva al borrar la cuenta. Pura (admin-account.test.ts).
 * - ONVO: cancelarla en ONVO (si no, ONVO seguiría cobrando).
 * - Tilopay: nada afuera; los cobros los hace nuestro motor (cron/cobros) desde estas filas, que caen en cascada.
 * - "onvo-pi:…": el 50 % del primer mes fue un pago único (PaymentIntent), no una suscripción de ONVO.
 * - Otros proveedores (tiendas de apps): no se cancelan desde aquí; Apple solo deja cancelar desde Ajustes.
 */
export function cancelStepFor(s: { provider?: string | null; provider_subscription_id?: string | null }): "onvo" | "skip" {
  const id = s.provider_subscription_id ?? "";
  if (!id || id.startsWith("onvo-pi:")) return "skip";
  return (s.provider ?? "onvo") === "onvo" ? "onvo" : "skip";
}

export async function deleteAccountData(admin: SupabaseClient, userId: string, scope = "cuenta"): Promise<DeleteResult> {
  // 1) Suscripciones que todavía pueden cobrar.
  const { data: subs } = await admin.from("subscriptions").select("id,provider,provider_subscription_id,status").eq("user_id", userId).in("status", ["active", "trialing", "past_due", "incomplete"]);
  for (const s of subs ?? []) {
    if (cancelStepFor(s) !== "onvo") continue;
    try {
      await cancelSubscription(s.provider_subscription_id as string);
    } catch (e) {
      if (!(e instanceof OnvoError && e.status === 404)) {
        console.error(JSON.stringify({ scope, msg: "no se pudo cancelar en ONVO antes de borrar", userId, status: e instanceof OnvoError ? e.status : null }));
        return { ok: false, status: 502, step: "subscriptions", error: "No pudimos cancelar la suscripción con el procesador de pagos. Intenta de nuevo o escríbenos a hola@bananaburn.app." };
      }
    }
  }

  // 1b) Tarjeta guardada (0026): el cobro programado cae en cascada con la cuenta (no se cobra nada); la tarjeta se
  //     desconecta en su procesador (ONVO o Tilopay). Si no responde, se sigue: sin cuenta ni cobro programado nadie la
  //     vuelve a usar.
  const { data: card } = await admin.from("payment_methods").select("provider,provider_payment_method_id,status").eq("user_id", userId).maybeSingle();
  if (card?.status === "active" && card.provider_payment_method_id) {
    const pm = card.provider_payment_method_id as string;
    if (card.provider === "tilopay") {
      const email = (await admin.auth.admin.getUserById(userId).catch(() => null))?.data?.user?.email ?? "";
      const removed = email ? await removeCardToken(pm, email) : false;
      if (!removed) console.error(JSON.stringify({ scope, msg: "no se pudo quitar la tarjeta en Tilopay antes de borrar", userId }));
    } else {
      await detachPaymentMethod(pm).catch(() => console.error(JSON.stringify({ scope, msg: "no se pudo desconectar la tarjeta en ONVO antes de borrar", userId })));
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

  // 2b) Fotos de verificación de identidad (bucket privado 'identidad', 0030). Documentos de identidad: no se sigue sin borrarlas.
  try {
    for (let guard = 0; guard < 5; guard++) {
      const { data: files, error } = await admin.storage.from(ID_BUCKET).list(userId, { limit: 100 });
      if (error) { if (/not found/i.test(error.message ?? "")) break; throw error; }
      if (!files?.length) break;
      const { error: rmErr } = await admin.storage.from(ID_BUCKET).remove(files.map((f) => `${userId}/${f.name}`));
      if (rmErr) throw rmErr;
      if (files.length < 100) break;
    }
  } catch {
    console.error(JSON.stringify({ scope, msg: "no se pudieron borrar las fotos de identidad", userId }));
    return { ok: false, status: 500, step: "photos", error: "No pudimos borrar las fotos de tu verificación. Intenta de nuevo o escríbenos a hola@bananaburn.app." };
  }

  // 2c) Capturas de soporte (bucket privado 'soporte', 0034). Los casos se borran en cascada; las capturas, aquí.
  //     Si falla no se detiene el borrado: quedan en una carpeta sin dueño que nadie puede leer (solo service_role).
  try {
    for (let guard = 0; guard < 5; guard++) {
      const { data: files, error } = await admin.storage.from("soporte").list(userId, { limit: 100 });
      if (error || !files?.length) break;
      const { error: rmErr } = await admin.storage.from("soporte").remove(files.map((f) => `${userId}/${f.name}`));
      if (rmErr || files.length < 100) break;
    }
  } catch {
    console.error(JSON.stringify({ scope, msg: "no se pudieron borrar las capturas de soporte", userId }));
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
