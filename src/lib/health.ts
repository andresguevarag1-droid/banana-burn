// Estado de las integraciones para /api/salud. Solo booleanos: nunca valores de llaves ni datos de usuarios.

export type Integrations = {
  supabase: boolean; serviceRole: boolean; anthropic: boolean; onvo: boolean; onvoOneTime: boolean;
  resend: boolean; vapid: boolean; cron: boolean; emailUnsub: boolean;
};

type Env = Record<string, string | undefined>;
const has = (env: Env, ...keys: string[]) => keys.every((k) => Boolean(env[k]?.trim()));

export function integrationsFrom(env: Env, onvo: { full: boolean; oneTime: boolean }): Integrations {
  return {
    supabase: has(env, "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRole: has(env, "SUPABASE_SERVICE_ROLE_KEY"),
    anthropic: has(env, "ANTHROPIC_API_KEY"),
    onvo: onvo.full,
    onvoOneTime: onvo.oneTime,
    resend: has(env, "RESEND_API_KEY"),
    vapid: Boolean((env.VAPID_PUBLIC_KEY || env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)?.trim() && env.VAPID_PRIVATE_KEY?.trim()),
    cron: has(env, "CRON_SECRET"),
    emailUnsub: has(env, "EMAIL_UNSUB_SECRET"),
  };
}

/** Lo que falta para producción, en palabras simples (para el panel o un monitor). */
export function missingFor(i: Integrations): string[] {
  const out: string[] = [];
  if (!i.supabase) out.push("Supabase (sin llaves la app corre en demo o no deja entrar)");
  if (!i.serviceRole) out.push("SUPABASE_SERVICE_ROLE_KEY (retos automáticos, XP de comidas, cron)");
  if (!i.anthropic) out.push("ANTHROPIC_API_KEY (Coach Banana)");
  if (!i.onvo) out.push("ONVO (cobro de planes)");
  if (!i.resend) out.push("RESEND_API_KEY (correos)");
  if (!i.vapid) out.push("VAPID (avisos push)");
  if (!i.cron) out.push("CRON_SECRET (recordatorios diarios)");
  return out;
}
