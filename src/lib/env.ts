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
/** Dominio canónico de producción. bananaburn.app (sin www) redirige con 308 a este. */
export const CANONICAL_ORIGIN = "https://www.bananaburn.app";

/**
 * URL pública para enlaces absolutos (canonical, sitemap, correos, push). Variable explícita (NEXT_PUBLIC_SITE_URL); si
 * apunta al dominio sin www se corrige al canónico (evita un salto de redirección en cada enlace y canonical a una
 * redirección). Sin variable, en Vercel (producción o preview) se usa el canónico: VERCEL_PROJECT_PRODUCTION_URL elige
 * el dominio más corto (bananaburn.app, que redirige) y no sirve como canonical. Local: localhost.
 */
export function siteUrlFrom(env: Record<string, string | undefined>): string {
  const explicit = cleanUrl(env.NEXT_PUBLIC_SITE_URL);
  if (explicit) return explicit === "https://bananaburn.app" || explicit === "http://bananaburn.app" ? CANONICAL_ORIGIN : explicit;
  if (env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview") return CANONICAL_ORIGIN;
  return "http://localhost:3000";
}
export const SITE_URL = siteUrlFrom(process.env);

/**
 * ¿Se permite el modo demo? Solo si Supabase NO está configurado y no estamos en el deploy de producción
 * de Vercel (salvo que se pida explícitamente con BB_ALLOW_DEMO=1). Si a producción le faltan las llaves,
 * la app falla cerrada (nadie entra) en vez de abrir un "superadmin" de demo.
 */
export const isDemoMode =
  !isSupabaseConfigured && (process.env.VERCEL_ENV !== "production" || process.env.BB_ALLOW_DEMO === "1");
