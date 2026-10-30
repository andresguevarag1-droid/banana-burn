import "server-only";
// Llave única de cobro (0062): (usuario, periodo, procesador). El cron la reserva justo antes de llamar a ONVO o Tilopay;
// el índice único parcial de la base deja una sola reservada, así que un mismo cobro nunca se manda dos veces, aunque haya
// dos procesos, dos filas de la misma persona o un error en el reclamo de la fila. Se libera SOLO cuando se sabe que no se
// cobró (rechazo, intento devuelto): así el reintento del mismo periodo puede reservarla de nuevo.
// Si la base no responde o falta la tabla, no se cobra (falla cerrado): es mejor aplazar un cobro que hacerlo dos veces.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PayProvider } from "@/lib/pay-provider";
import { recordServerError } from "@/lib/monitor/server";

/** Periodo del primer cobro de la prueba o de la beta: uno por cuenta (trial_charges es una fila por persona). */
export const FIRST_CHARGE_PERIOD = "primer_cobro";
/** Periodo de una renovación o del paso a la suscripción normal: el inicio del periodo que se cobra, en ISO UTC. */
export const periodOf = (iso: string) => new Date(iso).toISOString();

export type ChargeOrigin = "primer_cobro" | "primer_mes_normal" | "cambio_tarjeta" | "renovacion";
export type ChargeKey = { userId: string; periodo: string; procesador: PayProvider };

const alert = (msg: string, meta?: Record<string, unknown>) => console.error(JSON.stringify({ scope: "llave-cobro", msg: `ALERTA ${msg}`, ...meta }));

/**
 * Reserva la llave antes de llamar al procesador. "reservada": se puede cobrar. "ocupada": ya hay un cobro de este periodo
 * con este procesador (cobrado o por confirmar): no se cobra. "error": la base no respondió: tampoco se cobra.
 */
export async function reserveChargeKey(db: SupabaseClient, k: ChargeKey & { origen: ChargeOrigin; referencia: string }): Promise<"reservada" | "ocupada" | "error"> {
  const { error } = await db.from("charge_keys").insert({ user_id: k.userId, periodo: k.periodo, procesador: k.procesador, origen: k.origen, referencia: k.referencia.slice(0, 120), estado: "reservado" });
  if (!error) return "reservada";
  if (error.code === "23505") {
    alert("cobro bloqueado: la llave de este periodo ya está reservada", { userId: k.userId, periodo: k.periodo, procesador: k.procesador, origen: k.origen });
    recordServerError("pagos/llave-ocupada", "charge_key_taken");
    return "ocupada";
  }
  alert("no se pudo reservar la llave de cobro: no se cobra", { userId: k.userId, periodo: k.periodo, procesador: k.procesador, code: error.code ?? null });
  recordServerError("pagos/llave-error", "charge_key_error");
  return "error";
}

/** Libera la llave: se sabe que NO se cobró (rechazo o intento devuelto). Nunca lanza; sin llave reservada no hace nada. */
export async function releaseChargeKey(db: SupabaseClient, k: ChargeKey, motivo: string): Promise<void> {
  const { error } = await db.from("charge_keys").update({ estado: "liberado", released_at: new Date().toISOString(), motivo: motivo.slice(0, 120) })
    .eq("user_id", k.userId).eq("periodo", k.periodo).eq("procesador", k.procesador).eq("estado", "reservado");
  if (error) alert("no se pudo liberar la llave de cobro: el reintento quedará bloqueado hasta revisarla", { userId: k.userId, periodo: k.periodo, procesador: k.procesador });
}

/** Solo lectura (simulacro): ¿la llave está reservada? null si no se pudo leer (p. ej. falta 0062). */
export async function chargeKeyHeld(db: SupabaseClient, k: ChargeKey): Promise<boolean | null> {
  const { data, error } = await db.from("charge_keys").select("id").eq("user_id", k.userId).eq("periodo", k.periodo).eq("procesador", k.procesador).eq("estado", "reservado").limit(1);
  if (error) return null;
  return (data?.length ?? 0) > 0;
}
