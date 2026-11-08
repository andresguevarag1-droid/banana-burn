import "server-only";
// Guarda el primer contacto (#283) de una cuenta recién creada en signup_attribution (0069), una sola vez. La base solo
// acepta cuentas de menos de 72 h y no pisa una fila existente. Nunca lanza ni bloquea el registro.
import { cookies } from "next/headers";
import { adminClient } from "@/lib/supabase/admin";
import { FIRST_TOUCH_COOKIE, attributionArgs, decodeFirstTouch } from "@/lib/first-touch";

const MISSING = new Set(["PGRST202", "PGRST205", "42883", "42P01"]);

export async function saveSignupAttribution(userId: string): Promise<string> {
  try {
    const t = decodeFirstTouch((await cookies()).get(FIRST_TOUCH_COOKIE)?.value);
    if (!t) return "sin_cookie";
    const db = adminClient();
    if (!db) return "sin_config";
    const { data, error } = await db.rpc("signup_attribution_save", attributionArgs(userId, t));
    if (error) {
      if (!MISSING.has(error.code ?? "")) console.warn(JSON.stringify({ scope: "atribucion", msg: "no se guardó", code: error.code ?? null }));
      return "error";
    }
    return String(data);
  } catch {
    return "error";
  }
}
