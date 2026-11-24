import "server-only";
// #332: lectura de la audiencia y envío por tandas de la campaña "primer mes al 50 %" (reglas en campana-50.ts).
// Solo la llama el staff desde /admin/campana-50 al tocar "Enviar": nunca un cron. Cada cuenta se reclama en
// notification_log (kind campana_50_actuales, ONCE_DAY) antes de enviar, así que tocar dos veces no repite correos.
import type { SupabaseClient } from "@supabase/supabase-js";
import { STAFF } from "@/lib/supabase/server";
import { sendEmail, unsubscribeUrl } from "@/lib/email/send";
import { withLoginLinks } from "@/lib/email/login-link";
import { campana50 } from "@/lib/email/templates";
import { allPages, languagesOf } from "@/lib/notify-run";
import { ONCE_DAY } from "@/lib/notify";
import { trialProgress, type TrialProgress } from "@/lib/recuperacion";
import { CARD_REQUIRED_FROM } from "@/lib/card-required";
import { logError } from "@/lib/log";
import { BATCH_SIZE, CAMPAIGN, CHARGE_IN_FLIGHT, OFFER_DAYS, campaignSegment, offerExpiry, type CampaignSegment } from "@/lib/campana-50";

export type CampaignTarget = { id: string; segment: CampaignSegment };
export type CampaignAudience = { targets: CampaignTarget[]; counts: Record<CampaignSegment, number>; sent: number };

const ids = (rows: unknown, ok: (r: Record<string, unknown>) => boolean = () => true) =>
  new Set(((rows as Record<string, unknown>[] | null) ?? []).filter(ok).map((r) => r.user_id as string));

/** Cuentas que reciben la campaña hoy, por segmento. Si alguna lectura falla, lanza: sin esos datos podría llegarle a quien ya pagó. */
export async function loadAudience(admin: SupabaseClient): Promise<CampaignAudience> {
  const prof = await allPages((a, b) => admin.from("profiles").select("id,created_at,role,plan").lt("created_at", CARD_REQUIRED_FROM).order("id").range(a, b));
  if (prof.error) throw new Error(`profiles:${prof.error.code}`);
  const profiles = prof.data as { id: string; created_at: string; role: string | null; plan: string | null }[];
  const all = profiles.map((p) => p.id);
  if (!all.length) return { targets: [], counts: { entrenaron: 0, sin_entreno: 0 }, sent: 0 };
  const q = (t: string, cols: string) => allPages((a, b) => admin.from(t).select(cols).in("user_id", all).order("user_id").range(a, b));
  const [prefs, subs, comps, testers, charges, logs, wks] = await Promise.all([
    q("notification_prefs", "user_id,email_reminders"),
    q("subscriptions", "user_id,status"),
    q("comp_grants", "user_id,revoked_at,expires_at"),
    q("tester_grants", "user_id,revoked_at"),
    q("trial_charges", "user_id,status"),
    allPages((a, b) => admin.from("notification_log").select("user_id").eq("kind", CAMPAIGN).in("user_id", all).order("user_id").range(a, b)),
    allPages((a, b) => admin.from("workouts").select("user_id").not("finished_at", "is", null).in("user_id", all).order("user_id").range(a, b)),
  ]);
  const failed = [prefs, subs, comps, testers, charges, logs, wks].find((r) => r.error);
  if (failed) throw new Error(`audience:${failed.error?.code}`);
  const now = Date.now();
  const off = ids(prefs.data, (r) => r.email_reminders === false);
  const paid = ids(subs.data, (r) => r.status !== "incomplete");
  const comp = ids(comps.data, (r) => !r.revoked_at && Date.parse(r.expires_at as string) > now);
  const tester = ids(testers.data, (r) => !r.revoked_at);
  const inFlight = ids(charges.data, (r) => (CHARGE_IN_FLIGHT as readonly unknown[]).includes(r.status));
  const sentTo = ids(logs.data);
  const workouts = new Map<string, number>();
  for (const w of (wks.data as { user_id: string }[])) workouts.set(w.user_id, (workouts.get(w.user_id) ?? 0) + 1);
  const targets: CampaignTarget[] = [];
  for (const p of profiles) {
    const segment = campaignSegment({
      createdAt: p.created_at, staff: STAFF.includes(p.role as (typeof STAFF)[number]), tester: tester.has(p.id), comp: comp.has(p.id),
      paid: paid.has(p.id) || p.plan === "entreno" || p.plan === "completo" || p.plan === "pro", chargeInFlight: inFlight.has(p.id), emailReminders: !off.has(p.id), alreadySent: sentTo.has(p.id), workouts: workouts.get(p.id) ?? 0,
    });
    if (segment) targets.push({ id: p.id, segment });
  }
  const counts = { entrenaron: targets.filter((t) => t.segment === "entrenaron").length, sin_entreno: targets.filter((t) => t.segment === "sin_entreno").length };
  return { targets, counts, sent: sentTo.size };
}

async function progressOf(admin: SupabaseClient, userId: string): Promise<TrialProgress | null> {
  const [wk, sets] = await Promise.all([
    admin.from("workouts").select("id,template,finished_at").eq("user_id", userId).limit(1000),
    admin.from("workout_sets").select("workout_id,kg,reps,done").eq("user_id", userId).limit(10000),
  ]);
  if (wk.error || sets.error) return null;
  return trialProgress(wk.data ?? [], sets.data ?? []);
}

export type BatchResult = { claimed: number; emailed: number; failed: number; left: number };

/**
 * Envía la siguiente tanda (BATCH_SIZE). Por cuenta: reclama en notification_log, deja la oferta en promo_offers (antes del
 * correo: si el correo llega, el 50 % ya vale) y envía con llave de idempotencia. Entre correos, una pausa (Resend: 2 por s).
 */
export async function sendCampaignBatch(admin: SupabaseClient, now = new Date(), opts: { pauseMs?: number; limit?: number } = {}): Promise<BatchResult> {
  const { targets } = await loadAudience(admin);
  const batch = targets.slice(0, opts.limit ?? BATCH_SIZE);
  const langs = await languagesOf(admin, batch.map((t) => t.id));
  const out: BatchResult = { claimed: 0, emailed: 0, failed: 0, left: targets.length - batch.length };
  for (const [i, t] of batch.entries()) {
    try {
      const { data: claimed, error } = await admin.from("notification_log")
        .upsert({ user_id: t.id, kind: CAMPAIGN, local_day: ONCE_DAY, channels: ["email"], pushes: 0 }, { onConflict: "user_id,kind,local_day", ignoreDuplicates: true })
        .select("id");
      if (error) { out.failed++; continue; }
      if (!claimed?.length) continue;
      out.claimed++;
      const offer = await admin.from("promo_offers").upsert({ user_id: t.id, campaign: CAMPAIGN, segment: t.segment, sent_at: now.toISOString(), expires_at: offerExpiry(now) }, { onConflict: "user_id" });
      if (offer.error) { out.failed++; logError("admin:campana50", "offer_failed", { code: offer.error.code }); continue; }
      const { data } = await admin.auth.admin.getUserById(t.id);
      const to = data.user?.email;
      if (!to) continue;
      const lang = langs.get(t.id);
      const unsubscribe = unsubscribeUrl(t.id, "recordatorios");
      const progress = t.segment === "entrenaron" ? await progressOf(admin, t.id) : null;
      const mail = campana50({ segment: t.segment, progress, unsubscribe, offerDays: OFFER_DAYS, locale: lang?.locale, units: lang?.units ?? undefined });
      const r = await sendEmail(to, withLoginLinks(mail, t.id), { idempotencyKey: `${CAMPAIGN}/${t.id}`, unsubscribe, tags: { kind: CAMPAIGN } });
      if (r.ok) out.emailed++; else out.failed++;
    } catch (e) {
      out.failed++;
      logError("admin:campana50", "user_failed", { kind: e instanceof Error ? e.name : "unknown" });
    }
    if (i < batch.length - 1 && (opts.pauseMs ?? 600) > 0) await new Promise((r) => setTimeout(r, opts.pauseMs ?? 600));
  }
  return out;
}
