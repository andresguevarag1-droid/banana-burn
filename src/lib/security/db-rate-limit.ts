// Límite de frecuencia compartido entre instancias (Postgres, 0023_seguridad_2.sql). SOLO SERVIDOR con service_role.
// El límite en memoria (memoryRateLimit) es por instancia de Vercel: con varias instancias no frena a un bot.
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Parte de una clave que no debe quedar legible en la base (correo, IP): hash corto. */
export const keyPart = (s: string) => createHash("sha256").update(s).digest("base64url").slice(0, 22);

type RpcClient = Pick<SupabaseClient, "rpc">;

/** Errores de "la función no existe" (0023 sin aplicar): no apagamos el registro ni los pagos por eso. */
const MISSING = new Set(["PGRST202", "42883"]);

/**
 * Cuenta un intento. true = puede seguir; false = superó `max` en la ventana.
 * Sin cliente o si la base falla, deja pasar (queda el límite en memoria) y lo registra sin datos personales.
 */
export async function dbRateLimit(db: RpcClient | null, key: string, windowSec: number, max: number): Promise<boolean> {
  if (!db) return true;
  try {
    const { data, error } = await db.rpc("rate_hit", { p_key: key.slice(0, 200), p_window_seconds: windowSec, p_max: max });
    if (error) {
      if (!MISSING.has(error.code ?? "")) console.warn(JSON.stringify({ scope: "rate-limit", msg: "rate_hit falló", code: error.code ?? null }));
      return true;
    }
    return data !== false;
  } catch {
    return true;
  }
}

/** Varios límites a la vez (p. ej. por IP y por correo): se cuentan todos y basta que uno se pase para frenar. */
export async function dbRateLimitAll(db: RpcClient | null, rules: { key: string; windowSec: number; max: number }[]): Promise<boolean> {
  const res = await Promise.all(rules.map((r) => dbRateLimit(db, r.key, r.windowSec, r.max)));
  return res.every(Boolean);
}
