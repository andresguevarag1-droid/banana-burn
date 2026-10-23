import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/env";
import { resilientFetch } from "@/lib/resilient-fetch";

// Tiempo límite en cada llamada (y un reintento en lecturas): una base lenta no deja colgado el cron ni un webhook.
const dbFetch = resilientFetch({ readTimeoutMs: 8_000, writeTimeoutMs: 12_000 });

/** Cliente con service_role: SOLO en el servidor, para operaciones de cuenta (borrado) y webhooks. */
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: dbFetch } });
}
