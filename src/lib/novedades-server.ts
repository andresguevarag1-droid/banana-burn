// Novedades en el servidor: qué vio cada persona (0036) y el aviso a quien no abre la app. Solo servidor.
import "server-only";
import { cache } from "react";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { notifyInApp } from "@/lib/email";
import { hasDevices, loadDevices, sendPush } from "@/lib/push";
import { DEFAULT_PREFS, inQuietHours, localClock } from "@/lib/notify";
import { errInfo } from "@/lib/security/log";
import { NUDGE_COPY, needsNudge, nudgeRelease, releaseStart } from "@/lib/novedades";

export type NewsState = {
  seenId: string | null;
  seenAt: string | null;
  createdAt: string | null;
  /** ¿Se guarda en el servidor? En demo, o sin la migración 0036, el cliente recuerda en este dispositivo. */
  persisted: boolean;
};

/** Una lectura por request (layout y /app/novedades). Sin la columna (0036 sin correr): respaldo local en el cliente. */
export const getNewsState = cache(async (v: Viewer): Promise<NewsState> => {
  if (v.demo) return { seenId: null, seenAt: null, createdAt: null, persisted: false };
  const sb = await createClient();
  const { data, error } = await sb.from("profiles").select("news_seen,news_seen_at,created_at").eq("id", v.id).maybeSingle();
  if (!error && data) return { seenId: (data.news_seen as string | null) ?? null, seenAt: (data.news_seen_at as string | null) ?? null, createdAt: (data.created_at as string | null) ?? null, persisted: true };
  // Sin 0036: al menos la fecha de la cuenta, para que una cuenta nueva no reciba como novedad lo que ya existía.
  const { data: p } = await sb.from("profiles").select("created_at").eq("id", v.id).maybeSingle();
  return { seenId: null, seenAt: null, createdAt: (p?.created_at as string | null) ?? null, persisted: false };
});

export type NewsNudge = { release: string | null; scanned: number; claimed: number; inApp: number; push: number; partial?: boolean };

const PAGE = 500;

/**
 * "Hay novedades en Banana Burn": push y campanita, una sola vez por versión, para quien no la vio entre el día 3 y el 14
 * después de publicarla (no abrió la app o no llegó a Hoy). Idempotente: cada aviso se reclama en notification_log
 * (kind 'novedades', local_day = fecha de la versión) antes de enviar. Respeta el push apagado y las horas de silencio
 * (en silencio no se reclama: sale en la próxima corrida). Nunca lanza. Sin service_role o sin 0036: no hace nada.
 */
export async function nudgeUnseenNews(opts: { now?: Date; limit?: number; deadline?: number } = {}): Promise<NewsNudge> {
  const now = opts.now ?? new Date();
  const r = nudgeRelease(now);
  const out: NewsNudge = { release: r?.id ?? null, scanned: 0, claimed: 0, inApp: 0, push: 0 };
  const admin = adminClient();
  if (!r || !admin) return out;
  const limit = Math.min(opts.limit ?? 300, 1000);
  const start = new Date(releaseStart(r.date)).toISOString();
  const copy = NUDGE_COPY(r);
  try {
    for (let from = 0; out.claimed < limit; from += PAGE) {
      if (opts.deadline && Date.now() > opts.deadline) { out.partial = true; break; }
      // Cuentas de antes de la versión que no abrieron Novedades desde entonces.
      const { data, error } = await admin.from("profiles").select("id,timezone,created_at,news_seen,news_seen_at")
        .eq("onboarded", true).lt("created_at", start).or(`news_seen_at.is.null,news_seen_at.lt.${start}`)
        .order("id").range(from, from + PAGE - 1);
      if (error || !data?.length) break;
      out.scanned += data.length;
      const due = (data as { id: string; timezone: string | null; created_at: string | null; news_seen: string | null; news_seen_at: string | null }[]).filter((p) => needsNudge(r, p));
      if (due.length) {
        const ids = due.map((p) => p.id);
        const [{ data: prefRows }, devices] = await Promise.all([
          admin.from("notification_prefs").select("user_id,push_reminders,quiet_start,quiet_end,timezone").in("user_id", ids),
          // Navegadores con Web Push y teléfonos con la app nativa (0057).
          loadDevices(admin, ids),
        ]);
        const prefs = new Map(((prefRows ?? []) as { user_id: string; push_reminders: boolean | null; quiet_start: string | null; quiet_end: string | null; timezone: string | null }[]).map((x) => [x.user_id, x]));
        for (const p of due) {
          if (out.claimed >= limit || (opts.deadline && Date.now() > opts.deadline)) { out.partial = true; break; }
          const pr = prefs.get(p.id);
          const tz = pr?.timezone || p.timezone || DEFAULT_PREFS.timezone;
          const quiet = inQuietHours(localClock(now, tz), pr ? pr.quiet_start : DEFAULT_PREFS.quiet_start, pr ? pr.quiet_end : DEFAULT_PREFS.quiet_end);
          if (quiet) continue;
          const wantsPush = pr?.push_reminders !== false && hasDevices(devices.get(p.id));
          const { data: claimed, error: claimErr } = await admin.from("notification_log")
            .upsert({ user_id: p.id, kind: "novedades", local_day: r.date, channels: wantsPush ? ["inapp", "push"] : ["inapp"], pushes: wantsPush ? 1 : 0 }, { onConflict: "user_id,kind,local_day", ignoreDuplicates: true })
            .select("id");
          if (claimErr || !claimed?.length) continue;
          out.claimed++;
          if (await notifyInApp(p.id, { kind: "novedades", ...copy })) out.inApp++;
          if (wantsPush) out.push += await sendPush(admin, devices.get(p.id)!, { ...copy, tag: `novedades-${r.id}` }).catch(() => 0);
        }
      }
      if (data.length < PAGE || out.partial) break;
    }
  } catch (e) {
    console.error("[novedades] aviso", errInfo(e));
  }
  if (out.claimed) console.info(JSON.stringify({ scope: "novedades", msg: "aviso", ...out }));
  return out;
}
