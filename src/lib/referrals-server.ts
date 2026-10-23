// Referidos en el servidor: atribución al crear la cuenta (service_role), página "Invita y gana" y señales anti abuso.
// Señales: nunca se guarda el correo ni la IP de nadie. Se guarda un HMAC (con un secreto del servidor) del correo
// normalizado y del prefijo de red (/24 en IPv4, /48 en IPv6), igual que las claves de rate_limits (0023) pero con llave:
// sin el secreto no se pueden revertir probando direcciones. Pon REFERRAL_SECRET una vez y no lo cambies.
import "server-only";
import { createHmac } from "node:crypto";
import { cookies, headers } from "next/headers";
import { adminClient } from "@/lib/supabase/admin";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/env";
import { REF_COOKIE, ipPrefix, normEmail, normalizeCode, referralLink, type MyReferral, type MyReward } from "@/lib/referrals";

function secret() {
  return process.env.REFERRAL_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

/** HMAC corto (32 caracteres base64url) de una señal. null sin secreto o sin valor. */
export function signalHash(kind: "mail" | "ip", value: string | null | undefined, key = secret()): string | null {
  if (!key || !value) return null;
  return createHmac("sha256", key).update(`${kind}:${value}`).digest("base64url").slice(0, 32);
}
export const emailSignal = (email: string | null | undefined, key?: string) => (email && email.includes("@") ? signalHash("mail", normEmail(email), key) : null);
export const ipSignal = (ip: string | null | undefined, key?: string) => signalHash("ip", ipPrefix(ip), key);

async function requestIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
}

/**
 * Atribuye una cuenta recién creada a quien la invitó, con la cookie del enlace /r/<código>. Solo en el servidor y con
 * service_role; la base valida una sola vez por cuenta y por correo, nunca a sí misma y solo en las primeras 72 horas.
 * Llamar justo después de crear la cuenta (registro o enlace de confirmación). Nunca lanza ni bloquea el registro.
 */
export async function attributeReferral(userId: string, email: string | null | undefined): Promise<string | null> {
  try {
    const store = await cookies();
    const code = normalizeCode(store.get(REF_COOKIE)?.value);
    if (!code) return null;
    const admin = adminClient();
    if (!admin) return null;
    const { data, error } = await admin.rpc("referral_attribute", { p_referred: userId, p_code: code, p_email_hash: emailSignal(email), p_ip_hash: ipSignal(await requestIp()) });
    if (error) {
      console.warn(JSON.stringify({ scope: "referidos", msg: "atribución falló", code: error.code ?? null }));
      return null;
    }
    try { store.delete(REF_COOKIE); } catch { /* componente de servidor: la cookie vence sola */ }
    console.info(JSON.stringify({ scope: "referidos", msg: "atribución", result: String(data) }));
    return String(data);
  } catch {
    return null;
  }
}

export type ReferralPageData = { demo: boolean; code: string | null; link: string | null; referrals: MyReferral[]; rewards: MyReward[]; unavailable?: boolean };

const DAY = 864e5;
/** Ejemplo del demo: datos inventados y rotulados como demo en la página. */
export function demoReferralPage(now = Date.now()): ReferralPageData {
  const iso = (d: number) => new Date(now - d * DAY).toISOString();
  const code = "demo2345";
  return {
    demo: true, code, link: referralLink(SITE_URL, code),
    referrals: [
      { initial: "M", status: "calificado", created_at: iso(30), qualified_at: iso(28), annual: true, group_no: 1, expired: false },
      { initial: "J", status: "calificado", created_at: iso(26), qualified_at: iso(25), annual: false, group_no: 1, expired: false },
      { initial: "C", status: "calificado", created_at: iso(20), qualified_at: iso(18), annual: false, group_no: 1, expired: false },
      { initial: "L", status: "calificado", created_at: iso(9), qualified_at: iso(8), annual: false, group_no: null, expired: false },
      { initial: "S", status: "calificado", created_at: iso(5), qualified_at: iso(4), annual: false, group_no: null, expired: false },
      { initial: "D", status: "registrado", created_at: iso(1), qualified_at: null, annual: false, group_no: null, expired: false },
    ],
    rewards: [{ id: 1, group_no: 1, months: 3, plan: "completo", created_at: iso(18), upgraded_at: null, revoked_at: null }],
  };
}

/** Datos de "Invita y gana" de la persona (RLS y funciones propias). Guarda su prefijo de red para detectar auto referidos. */
export async function getReferralPage(v: Viewer): Promise<ReferralPageData> {
  if (v.demo) return demoReferralPage();
  const sb = await createClient();
  const [code, list, rewards] = await Promise.all([
    sb.rpc("my_referral_code"),
    sb.rpc("my_referrals"),
    sb.from("referral_rewards").select("id,group_no,months,plan,created_at,upgraded_at,revoked_at").eq("referrer", v.id).order("group_no", { ascending: true }).limit(100),
  ]);
  if (code.error || !code.data) return { demo: false, code: null, link: null, referrals: [], rewards: [], unavailable: true };
  const admin = adminClient();
  const ip = ipSignal(await requestIp());
  if (admin && ip) await admin.rpc("referral_touch", { p_user: v.id, p_ip_hash: ip }).then(() => {}, () => {});
  return {
    demo: false, code: String(code.data), link: referralLink(SITE_URL, String(code.data)),
    referrals: (list.data as MyReferral[] | null) ?? [], rewards: (rewards.data as MyReward[] | null) ?? [],
  };
}
