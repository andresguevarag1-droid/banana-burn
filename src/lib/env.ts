/** Valor de una variable sin espacios ni comillas pegadas por error al copiarla en Vercel. */
export const clean = (v: string | undefined) => (v ?? "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();
/**
 * URL pública lista para usar: agrega https:// si falta y quita la barra final. Un valor inválido no rompe el build
 * (antes "bananaburn.app" sin https hacía fallar el deploy con "Invalid URL"): cae al respaldo.
 */
export function cleanUrl(v: string | undefined, fallback = ""): string {
  const raw = clean(v);
  if (!raw) return fallback;
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withProto);
    return `${u.origin}${u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "")}`;
  } catch {
    return fallback;
  }
}
export const SUPABASE_URL = (() => { const u = cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL); try { return u ? new URL(u).origin : ""; } catch { return ""; } })();
export const SUPABASE_ANON_KEY = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
/** Sin llaves de Supabase la app corre en modo demo (datos de ejemplo, sin login). */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
/** URL pública: variable explícita, o el dominio de producción que Vercel expone, o local. */
export const SITE_URL = cleanUrl(process.env.NEXT_PUBLIC_SITE_URL) || cleanUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) || "http://localhost:3000";

/**
 * ¿Se permite el modo demo? Solo si Supabase NO está configurado y no estamos en el deploy de producción
 * de Vercel (salvo que se pida explícitamente con BB_ALLOW_DEMO=1). Si a producción le faltan las llaves,
 * la app falla cerrada (nadie entra) en vez de abrir un "superadmin" de demo.
 */
export const isDemoMode =
  !isSupabaseConfigured && (process.env.VERCEL_ENV !== "production" || process.env.BB_ALLOW_DEMO === "1");
