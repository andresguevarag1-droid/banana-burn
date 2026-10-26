// Revisión de variables NEXT_PUBLIC_* (las copia Next al JavaScript del navegador). La corre next.config.ts al compilar:
// si una llave secreta quedó en una variable pública, el build falla antes de publicarla. Sin dependencias.

/** Variables que jamás deben ir al navegador. */
const SERVER_SECRETS = [
  "SUPABASE_SERVICE_ROLE_KEY", "ONVO_SECRET_KEY", "ONVO_WEBHOOK_SECRET", "ANTHROPIC_API_KEY", "RESEND_API_KEY",
  "CRON_SECRET", "EMAIL_UNSUB_SECRET", "VAPID_PRIVATE_KEY", "META_CAPI_TOKEN", "FCM_SERVICE_ACCOUNT_JSON", "APNS_PRIVATE_KEY",
];

/** Rol de un JWT de Supabase (llaves "anon" y "service_role" de formato antiguo). */
function jwtRole(token: string): string | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const json = JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as { role?: unknown };
    return typeof json.role === "string" ? json.role : null;
  } catch {
    return null;
  }
}

/** Lista de problemas (vacía si todo está bien). Nunca incluye el valor de ninguna variable. */
export function publicEnvProblems(env: Record<string, string | undefined>): string[] {
  const out: string[] = [];
  const pub = Object.entries(env).filter(([k, v]) => k.startsWith("NEXT_PUBLIC_") && typeof v === "string" && v.trim());
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (anon && (anon.startsWith("sb_secret_") || jwtRole(anon) === "service_role"))
    out.push("NEXT_PUBLIC_SUPABASE_ANON_KEY tiene la llave service_role (secreta). Usa la llave anon o publishable.");
  const onvo = env.NEXT_PUBLIC_ONVO_PUBLISHABLE_KEY?.trim();
  if (onvo && /secret/i.test(onvo)) out.push("NEXT_PUBLIC_ONVO_PUBLISHABLE_KEY tiene una llave secreta de ONVO. Usa la llave publicable.");
  for (const [k] of pub) if (/SECRET|PRIVATE|SERVICE_ROLE/.test(k)) out.push(`${k}: una variable con ese nombre no debe ser NEXT_PUBLIC_.`);
  const secrets = SERVER_SECRETS.map((k) => env[k]?.trim()).filter((v): v is string => !!v && v.length >= 8);
  for (const [k, v] of pub) if (secrets.includes(v!.trim())) out.push(`${k} tiene el mismo valor que una llave secreta del servidor.`);
  return [...new Set(out)];
}
