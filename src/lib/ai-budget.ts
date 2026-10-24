// Tope diario GLOBAL de llamadas a la IA (Anthropic), además del cupo por persona (0032). SOLO SERVIDOR.
// La cuenta vive en Postgres (0040: ai_usage_daily, ai_budget_take, ai_budget_add) y vale para todas las instancias.
// Si un error en la app o un ataque dispara las preguntas, el gasto se corta en estos números (configurables en Vercel):
//   COACH_DAILY_MAX            preguntas del chat por día para todos (por defecto 5000)
//   COACH_DAILY_TOKENS         tokens del chat por día (entrada + salida + caché; por defecto 30 millones; 0 = sin tope)
//   COACH_FEEDBACK_DAILY_MAX   feedback post-entreno con IA por día (por defecto 3000; al llegar, el feedback sale por reglas)
// El día es el de Costa Rica (igual que el cupo por persona).
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import { memoryRateLimit } from "@/lib/security";
import { logError } from "@/lib/log";

export type AiKind = "chat" | "feedback";
export type AiUsage = { in: number; out: number; cacheRead: number; cacheWrite: number };
type Env = Record<string, string | undefined>;
type RpcClient = Pick<SupabaseClient, "rpc">;

const MISSING = new Set(["PGRST202", "42883"]);

const int = (raw: string | undefined, fallback: number, max: number) => {
  const n = Number(String(raw ?? "").replace(/[_\s.,]/g, ""));
  return raw != null && raw.trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), max) : fallback;
};

/** Topes del día según el entorno. Valores raros caen al valor por defecto (nunca a "sin tope"). */
export function aiLimits(env: Env = process.env) {
  return {
    chat: { requests: int(env.COACH_DAILY_MAX, 5000, 1_000_000), tokens: int(env.COACH_DAILY_TOKENS, 30_000_000, 10_000_000_000) },
    feedback: { requests: int(env.COACH_FEEDBACK_DAILY_MAX, 3000, 1_000_000), tokens: 0 },
  } satisfies Record<AiKind, { requests: number; tokens: number }>;
}

/** Mensaje cuando se llegó al tope global del chat (no es culpa de la persona: no gasta su cupo). */
export const AI_BUSY_MSG = "El coach tiene mucha demanda hoy y llegó a su límite diario. Vuelve mañana y seguimos.";

/**
 * Reserva una llamada del día. true = puede llamar a la IA. Si la base no responde, deja pasar con un tope por
 * instancia (mismo número) para no apagar el coach por un fallo de la base, y lo registra.
 */
export async function takeAiBudget(kind: AiKind, opts: { db?: RpcClient | null; env?: Env } = {}): Promise<boolean> {
  const lim = aiLimits(opts.env)[kind];
  if (lim.requests === 0) return false;
  const db = opts.db === undefined ? adminClient() : opts.db;
  const fallback = () => memoryRateLimit(`ai-budget:${kind}`, lim.requests, 24 * 3600_000);
  if (!db) return fallback();
  try {
    const { data, error } = await db.rpc("ai_budget_take", { p_kind: kind, p_max_requests: lim.requests, p_max_tokens: lim.tokens });
    if (error) {
      if (!MISSING.has(error.code ?? "")) logError("coach", "ai_budget_failed", { code: error.code ?? null, kind });
      return fallback();
    }
    // Una línea cada 10 minutos por instancia (alerta para el monitoreo, sin llenar los registros).
    if (data === false && memoryRateLimit(`ai-budget-log:${kind}`, 1, 600_000)) logError("coach", "ai_budget_reached", { kind, max: lim.requests });
    return data !== false;
  } catch {
    return fallback();
  }
}

/** Suma los tokens de una respuesta; `refund` devuelve la llamada reservada (la IA no respondió). Nunca lanza. */
export async function addAiUsage(kind: AiKind, usage: Partial<AiUsage>, opts: { refund?: boolean; db?: RpcClient | null } = {}): Promise<void> {
  const db = opts.db === undefined ? adminClient() : opts.db;
  if (!db) return;
  const n = (x: number | undefined) => (Number.isFinite(x) && (x as number) > 0 ? Math.floor(x as number) : 0);
  try {
    const { error } = await db.rpc("ai_budget_add", { p_kind: kind, p_requests: opts.refund ? -1 : 0, p_in: n(usage.in), p_out: n(usage.out), p_cache_read: n(usage.cacheRead), p_cache_write: n(usage.cacheWrite) });
    if (error && !MISSING.has(error.code ?? "")) logError("coach", "ai_usage_failed", { code: error.code ?? null, kind });
  } catch {
    /* solo contabilidad: nunca rompe la respuesta */
  }
}
