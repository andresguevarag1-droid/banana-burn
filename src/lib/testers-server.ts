// Testers de la beta en el servidor: estado propio (RLS), avisos por correo, push y campanita, y datos del panel.
// La campanita del momento de asignar la deja la base (admin_set_tester, 0029). Aquí van el correo y el push de esa
// asignación, el aviso de 3 días antes del final y el agradecimiento al terminar: una sola vez por etapa, porque cada
// etapa se reclama con un UPDATE condicional (notified_at, soon_notified_at, ended_notified_at) antes de enviar.
import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { notifyInApp, sendTesterEmail, sendTesterEndedEmail } from "@/lib/email";
import { sendPush, type PushSub } from "@/lib/push";
import { errInfo } from "@/lib/security/log";
import { demoTesterRows, testerDaysLeft, testerNoticeDue, testerState, type TesterGrantRow, type TesterNotice, type TesterState } from "@/lib/testers";

export const TESTER_COLS = "id,starts_at,expires_at,revoked_at,end_kind,renewal,seen_at,notified_at,soon_notified_at,ended_notified_at,created_at";

const NONE: TesterState = testerState([]);

/** Una sola lectura por request (layout, Hoy y perfil piden lo mismo). */
const rowsFor = cache(async (userId: string): Promise<TesterGrantRow[]> => {
  const sb = await createClient();
  const { data, error } = await sb.from("tester_grants").select(TESTER_COLS).eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  return error ? [] : ((data ?? []) as TesterGrantRow[]);
});

/** Asignaciones propias (RLS). Sin 0029 aplicada: lista vacía. */
export async function getMyTesterRows(v: Viewer): Promise<TesterGrantRow[]> {
  return v.demo ? [] : rowsFor(v.id);
}

/**
 * Estado de tester de quien mira. En demo, el de ejemplo que pida `demoKind` (?tester=demo, activo, pronto o fin).
 * `pending`: hay una etapa sin avisar por correo o push (la app la manda después de responder; el cron es el respaldo).
 */
export async function getMyTester(v: Viewer, demoKind?: string | null): Promise<TesterState & { pending: boolean }> {
  if (v.demo) return { ...testerState(demoTesterRows(demoKind)), pending: false };
  const rows = await getMyTesterRows(v).catch(() => []);
  if (!rows.length) return { ...NONE, pending: false };
  const now = new Date();
  const state = testerState(rows, now);
  const liveIds = rows.filter((r) => !r.revoked_at && Date.parse(r.expires_at) > now.getTime()).map((r) => r.id);
  const pending = rows.some((r) => testerNoticeDue(r, now, liveIds.some((id) => id !== r.id)) !== null);
  return { ...state, pending };
}

/** ¿Estas personas son testers hoy? (insignia de la comunidad; la RPC solo responde por perfiles visibles). */
export async function testersAmong(sb: SupabaseClient, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { data, error } = await sb.rpc("community_testers", { p_ids: ids.slice(0, 200) });
  if (error) return new Set();
  return new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id));
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long", timeZone: "America/Costa_Rica" });

const COPY: Record<TesterNotice, (r: TesterGrantRow) => { title: string; body: string; url: string }> = {
  asignado: (r) => ({ title: r.renewal ? "Renovamos tu mes de tester" : "Eres tester de Banana Burn", body: `Entreno + Nutrición gratis hasta el ${fmt(r.expires_at)}. Gracias por probar la beta.`, url: "/app" }),
  pronto: (r) => {
    const n = testerDaysLeft(r.expires_at);
    return { title: n <= 1 ? "Hoy es tu último día de tester" : `Te quedan ${n} días de tester`, body: `Tu mes gratis termina el ${fmt(r.expires_at)}. Si algo te faltó contarnos, toca Reportar algo en Hoy.`, url: "/app" };
  },
  terminado: () => ({ title: "Gracias por probar Banana Burn", body: "Terminó tu mes de tester. Tus datos siguen guardados; elige un plan para seguir registrando.", url: "/app/suscripcion" }),
};
const CLAIM_COL: Record<TesterNotice, "notified_at" | "soon_notified_at" | "ended_notified_at"> = { asignado: "notified_at", pronto: "soon_notified_at", terminado: "ended_notified_at" };

async function pushTo(admin: SupabaseClient, userId: string, payload: { title: string; body: string; url: string; tag: string }): Promise<number> {
  const { data: prefs } = await admin.from("notification_prefs").select("push_reminders").eq("user_id", userId).maybeSingle();
  if (prefs?.push_reminders === false) return 0;
  const { data: subs } = await admin.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", userId);
  return subs?.length ? sendPush(admin, subs as PushSub[], payload) : 0;
}

export type TesterDelivery = { claimed: number; email: number; push: number; inApp: number };

/**
 * Manda lo que toque de cada asignación (correo, push y campanita). Idempotente: cada etapa se reclama con su columna
 * antes de enviar, así dos procesos a la vez no la mandan dos veces. Nunca lanza. Sin service_role: no hace nada.
 */
export async function deliverTesterNotices(opts: { userId?: string; limit?: number; now?: Date } = {}): Promise<TesterDelivery> {
  const out: TesterDelivery = { claimed: 0, email: 0, push: 0, inApp: 0 };
  const admin = adminClient();
  if (!admin) return out;
  const now = opts.now ?? new Date();
  const limit = Math.min(opts.limit ?? 100, 300);
  try {
    // Candidatas: vigentes sin aviso inicial o cerca del final, y terminadas hace poco sin agradecimiento.
    const since = new Date(now.getTime() - 15 * 864e5).toISOString();
    let q = admin.from("tester_grants").select(`user_id,${TESTER_COLS}`).is("revoked_at", null).gt("expires_at", since)
      .or("notified_at.is.null,soon_notified_at.is.null,ended_notified_at.is.null").order("expires_at", { ascending: true }).limit(limit);
    if (opts.userId) q = q.eq("user_id", opts.userId);
    const { data, error } = await q;
    if (error) return out;
    const rows = (data ?? []) as (TesterGrantRow & { user_id: string })[];
    // ¿Otra asignación vigente de la misma persona? (renovó: no se agradece el final de la anterior).
    const users = [...new Set(rows.map((r) => r.user_id))];
    const { data: liveRows } = users.length
      ? await admin.from("tester_grants").select("id,user_id").in("user_id", users).is("revoked_at", null).gt("expires_at", now.toISOString())
      : { data: [] };
    const live = (liveRows ?? []) as { id: number; user_id: string }[];
    for (const r of rows) {
      const due = testerNoticeDue(r, now, live.some((x) => x.user_id === r.user_id && x.id !== r.id));
      if (!due) {
        // Terminó con otra asignación vigente: se marca para no revisarla de nuevo.
        if (!r.ended_notified_at && Date.parse(r.expires_at) <= now.getTime()) await admin.from("tester_grants").update({ ended_notified_at: now.toISOString() }).eq("id", r.id).is("ended_notified_at", null);
        continue;
      }
      const col = CLAIM_COL[due];
      // Una etapa por vuelta: la siguiente (si toca) sale en la próxima visita o corrida del cron.
      const { data: claimed } = await admin.from("tester_grants").update({ [col]: now.toISOString() }).eq("id", r.id).is(col, null).select("id");
      if (!claimed?.length) continue;
      out.claimed++;
      const c = COPY[due](r);
      if (due !== "asignado" && (await notifyInApp(r.user_id, { kind: "tester", ...c }))) out.inApp++;
      if (due === "asignado") {
        const m = await sendTesterEmail({ userId: r.user_id, grantId: r.id, expiresAt: r.expires_at, renewal: !!r.renewal }).catch(() => null);
        if (m?.ok) out.email++;
      } else if (due === "terminado") {
        const m = await sendTesterEndedEmail({ userId: r.user_id, grantId: r.id, endedAt: r.expires_at }).catch(() => null);
        if (m?.ok) out.email++;
      }
      out.push += await pushTo(admin, r.user_id, { ...c, tag: `tester-${due}-${r.id}` }).catch(() => 0);
    }
  } catch (e) {
    console.error("[testers] avisos", errInfo(e));
  }
  if (out.claimed) console.info(JSON.stringify({ scope: "testers", msg: "avisos", ...out }));
  return out;
}

// ───────────── Panel ─────────────

export type AdminTesterGrant = TesterGrantRow & { granted_by: string | null; granted_by_name?: string; revoked_by: string | null };
export type FeedbackRow = { id: number; user_id: string; kind: string; body: string; page: string | null; from_tester: boolean; status: string; created_at: string; name?: string };

export type TesterAdmin = { grants: AdminTesterGrant[]; feedback: FeedbackRow[]; unavailable?: boolean };

const DAY = 864e5;

/** Ejemplo del demo para un usuario (ficha) a partir de demoWorld. */
function demoTesterAdmin(u: { id: string; tester?: { starts_at: string; expires_at: string } | null }): TesterAdmin {
  if (!u.tester) return { grants: [], feedback: [] };
  const g: AdminTesterGrant = { id: 1, starts_at: u.tester.starts_at, expires_at: u.tester.expires_at, revoked_at: null, end_kind: null, renewal: false, seen_at: u.tester.starts_at, notified_at: u.tester.starts_at, created_at: u.tester.starts_at, granted_by: null, granted_by_name: "Andrés Guevara", revoked_by: null };
  const at = (h: number) => new Date(Date.parse(u.tester!.starts_at) + h * 3600e3).toISOString();
  const feedback: FeedbackRow[] = Date.now() - Date.parse(u.tester.starts_at) > 2 * DAY ? [
    { id: 2, user_id: u.id, kind: "idea", body: "Estaría bueno poder repetir el entreno de la semana pasada con un toque.", page: "/app/entrenar", from_tester: true, status: "nuevo", created_at: at(50) },
    { id: 1, user_id: u.id, kind: "error", body: "Al guardar el peso con coma (70,5) se quedó cargando la primera vez.", page: "/app", from_tester: true, status: "resuelto", created_at: at(26) },
  ] : [];
  return { grants: [g], feedback };
}

/** Panel, ficha de usuario: asignaciones de tester y reportes que mandó. Sin 0029: `unavailable`. */
export async function getTesterAdmin(v: Viewer, userId: string): Promise<TesterAdmin> {
  if (v.demo) {
    const { demoWorld } = await import("@/lib/admin-demo");
    const u = demoWorld().users.find((x) => x.id === userId);
    return u ? demoTesterAdmin(u) : { grants: [], feedback: [] };
  }
  const sb = await createClient();
  const [g, f] = await Promise.all([
    sb.from("tester_grants").select(`${TESTER_COLS},granted_by,revoked_by`).eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    sb.from("feedback_reports").select("id,user_id,kind,body,page,from_tester,status,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
  ]);
  if (g.error) return { grants: [], feedback: [], unavailable: true };
  const grants = (g.data ?? []) as AdminTesterGrant[];
  const ids = [...new Set(grants.map((x) => x.granted_by).filter(Boolean))] as string[];
  const { data: names } = ids.length ? await sb.from("profiles").select("id,full_name").in("id", ids) : { data: [] };
  const nm = new Map(((names ?? []) as { id: string; full_name: string | null }[]).map((x) => [x.id, x.full_name || "Sin nombre"]));
  return { grants: grants.map((x) => ({ ...x, granted_by_name: x.granted_by ? nm.get(x.granted_by) : undefined })), feedback: (f.data ?? []) as FeedbackRow[] };
}

export type TesterListRow = { id: string; name: string; email: string | null; starts_at: string; expires_at: string; reports: number };

/** Panel, página de testers: testers vigentes y reportes recientes de la app. */
export async function getTesterOverview(v: Viewer): Promise<{ testers: TesterListRow[]; feedback: FeedbackRow[]; unavailable?: boolean }> {
  if (v.demo) {
    const { demoWorld } = await import("@/lib/admin-demo");
    const now = Date.now();
    const users = demoWorld().users.filter((u) => u.tester && Date.parse(u.tester.expires_at) > now);
    const feedback = users.flatMap((u) => demoTesterAdmin(u).feedback.map((f) => ({ ...f, id: f.id + users.indexOf(u) * 10, name: u.full_name })));
    return {
      testers: users.map((u) => ({ id: u.id, name: u.full_name, email: u.email, starts_at: u.tester!.starts_at, expires_at: u.tester!.expires_at, reports: demoTesterAdmin(u).feedback.length }))
        .sort((a, b) => a.expires_at.localeCompare(b.expires_at)),
      feedback: feedback.sort((a, b) => b.created_at.localeCompare(a.created_at)),
    };
  }
  const sb = await createClient();
  const nowIso = new Date().toISOString();
  const [g, f] = await Promise.all([
    sb.from("tester_grants").select("user_id,starts_at,expires_at").is("revoked_at", null).lte("starts_at", nowIso).gt("expires_at", nowIso).order("expires_at").limit(300),
    sb.from("feedback_reports").select("id,user_id,kind,body,page,from_tester,status,created_at").order("created_at", { ascending: false }).limit(60),
  ]);
  if (g.error) return { testers: [], feedback: [], unavailable: true };
  const grants = (g.data ?? []) as { user_id: string; starts_at: string; expires_at: string }[];
  const fb = (f.data ?? []) as FeedbackRow[];
  const ids = [...new Set([...grants.map((x) => x.user_id), ...fb.map((x) => x.user_id)])];
  const { data: acc } = ids.length ? await sb.from("profiles").select("id,full_name").in("id", ids) : { data: [] };
  const nm = new Map(((acc ?? []) as { id: string; full_name: string | null }[]).map((x) => [x.id, x.full_name || "Sin nombre"]));
  const count = new Map<string, number>();
  for (const x of fb) count.set(x.user_id, (count.get(x.user_id) ?? 0) + 1);
  return {
    testers: grants.map((x) => ({ id: x.user_id, name: nm.get(x.user_id) ?? "Sin nombre", email: null, starts_at: x.starts_at, expires_at: x.expires_at, reports: count.get(x.user_id) ?? 0 })),
    feedback: fb.map((x) => ({ ...x, name: nm.get(x.user_id) ?? "Sin nombre" })),
  };
}
