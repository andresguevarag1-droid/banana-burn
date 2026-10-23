// Regalos de meses en el servidor: lectura propia (RLS), entrega por correo y push, y datos de ejemplo del demo.
// El aviso de la campanita lo deja la base al crear el regalo (_gift_grant, 0025); aquí van correo y push, una sola vez
// por regalo (comp_grants.notified_at se reclama de forma atómica antes de enviar).
import "server-only";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { planLabel, toGiftView, type GiftView } from "@/lib/gifts";
import { sendGiftEmail } from "@/lib/email";
import { sendPush, type PushSub } from "@/lib/push";
import { errInfo } from "@/lib/security/log";

const COLS = "id,source,plan,months,message,starts_at,expires_at,revoked_at,seen_at,notified_at";
const GIFT_SOURCES = ["regalo", "referido"];

type Row = { id: number; source: string; plan: string; months: number | null; message: string | null; starts_at: string; expires_at: string; revoked_at: string | null; seen_at: string | null; notified_at: string | null };

const DAY = 864e5;
/** Historial de ejemplo del demo: claramente de muestra (la página lo rotula como demo). */
export function demoGifts(now = new Date()): GiftView[] {
  const t = now.getTime();
  const iso = (d: number) => new Date(t + d * DAY).toISOString();
  return [
    toGiftView({ id: 2, source: "referido", plan: "completo", months: 1, message: "Tres personas que invitaste ya entrenan con Banana Burn.", starts_at: iso(40), expires_at: iso(70), revoked_at: null }, now),
    toGiftView({ id: 1, source: "regalo", plan: "completo", months: 3, message: "Gracias por ser de las primeras personas en entrenar con nosotros.", starts_at: iso(-50), expires_at: iso(40), revoked_at: null }, now),
  ];
}

/** Regalos recibidos (lo propio, por RLS). Sin 0025 aplicada devuelve una lista vacía. */
export async function getMyGifts(v: Viewer): Promise<GiftView[]> {
  if (v.demo) return demoGifts();
  const sb = await createClient();
  const { data, error } = await sb.from("comp_grants").select(COLS).eq("user_id", v.id).in("source", GIFT_SOURCES).order("created_at", { ascending: false }).limit(50);
  if (error) return [];
  return ((data ?? []) as Row[]).map((r) => toGiftView(r));
}

/** Regalos que la persona aún no vio (ventana de celebración). `undelivered`: alguno sin correo ni push todavía. */
export async function getUnseenGifts(v: Viewer): Promise<{ gifts: GiftView[]; undelivered: boolean }> {
  if (v.demo) return { gifts: [], undelivered: false };
  const sb = await createClient();
  const { data, error } = await sb.from("comp_grants").select(COLS).eq("user_id", v.id).in("source", GIFT_SOURCES).is("seen_at", null).is("revoked_at", null)
    .order("created_at", { ascending: true }).limit(5);
  if (error || !data?.length) return { gifts: [], undelivered: false };
  const rows = data as Row[];
  return { gifts: rows.map((r) => toGiftView(r)), undelivered: rows.some((r) => !r.notified_at) };
}

/**
 * Manda correo (si hay Resend) y push (si la persona lo activó) de los regalos pendientes. Idempotente: cada regalo se
 * reclama con `notified_at` antes de enviar, así dos procesos a la vez no lo mandan dos veces. Nunca lanza.
 */
export async function deliverPendingGifts(opts: { userId?: string; limit?: number } = {}): Promise<{ claimed: number; email: number; push: number }> {
  const out = { claimed: 0, email: 0, push: 0 };
  const admin = adminClient();
  if (!admin) return out;
  try {
    let q = admin.from("comp_grants").select("id,user_id,source,plan,months,message,starts_at,expires_at")
      .is("notified_at", null).is("revoked_at", null).in("source", GIFT_SOURCES).order("created_at", { ascending: true }).limit(Math.min(opts.limit ?? 50, 200));
    if (opts.userId) q = q.eq("user_id", opts.userId);
    const { data, error } = await q;
    if (error) return out;
    for (const g of (data ?? []) as (Omit<Row, "revoked_at" | "seen_at" | "notified_at"> & { user_id: string })[]) {
      const { data: claimed } = await admin.from("comp_grants").update({ notified_at: new Date().toISOString() }).eq("id", g.id).is("notified_at", null).select("id");
      if (!claimed?.length) continue;
      out.claimed++;
      const view = toGiftView({ ...g, revoked_at: null });
      const startsNow = Date.parse(g.starts_at) <= Date.now() + 60_000;
      const mail = await sendGiftEmail({ userId: g.user_id, grantId: g.id, months: view.months, plan: planLabel(g.plan), source: view.source, startsAt: g.starts_at, expiresAt: g.expires_at, message: g.message, startsNow }).catch(() => null);
      if (mail?.ok) out.email++;
      const { data: prefs } = await admin.from("notification_prefs").select("push_reminders").eq("user_id", g.user_id).maybeSingle();
      if (prefs?.push_reminders === false) continue;
      const { data: subs } = await admin.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", g.user_id);
      if (subs?.length) out.push += await sendPush(admin, subs as PushSub[], { title: view.title, body: startsNow ? "Ya está activo en tu cuenta." : "Se suma al final de tu acceso actual.", url: "/app/suscripcion", tag: `regalo-${g.id}` });
    }
  } catch (e) {
    console.error("[regalos] entrega", errInfo(e));
  }
  if (out.claimed) console.info(JSON.stringify({ scope: "regalos", msg: "entregados", ...out }));
  return out;
}
