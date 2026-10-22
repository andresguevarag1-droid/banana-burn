export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
/** Sin llaves de Supabase la app corre en modo demo (datos de ejemplo, sin login). */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * ¿Se permite el modo demo? Solo si Supabase NO está configurado y no estamos en el deploy de producción
 * de Vercel (salvo que se pida explícitamente con BB_ALLOW_DEMO=1). Si a producción le faltan las llaves,
 * la app falla cerrada (nadie entra) en vez de abrir un "superadmin" de demo.
 */
export const isDemoMode =
  !isSupabaseConfigured && (process.env.VERCEL_ENV !== "production" || process.env.BB_ALLOW_DEMO === "1");
