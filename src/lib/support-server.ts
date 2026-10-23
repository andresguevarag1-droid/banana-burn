// Soporte en el servidor: casos propios (RLS), cola del equipo, avisos por correo y push, y datos de ejemplo del demo.
// La campanita la deja la base al registrar cada evento (_support_event, 0034). Aquí van el correo y el push, una sola
// vez por evento (support_events.notified_at se reclama de forma atómica antes de enviar), y el aviso al equipo.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { sendFeedbackToTeam, sendSupportEmail } from "@/lib/email";
import type { SupportMailKind } from "@/lib/email/templates";
import { sendPush, type PushSub } from "@/lib/push";
import { errInfo } from "@/lib/security/log";
import { CATEGORY_LABEL, OPEN_STATUSES, SUPPORT_STATUSES, slaLate, ticketNumber, type SupportCategory, type SupportStatus } from "@/lib/support";

export type TicketRow = {
  id: number; user_id: string; category: string; title: string; body: string; status: SupportStatus; priority: string; assigned_to: string | null;
  from_tester: boolean; context: Record<string, string>; attachment_path: string | null; first_response_at: string | null; resolved_at: string | null;
  closed_at: string | null; reopened_count: number; last_user_at: string; last_staff_at: string | null; created_at: string; updated_at: string;
};
export type MessageRow = { id: number; ticket_id: number; author: string | null; author_kind: "usuario" | "equipo"; internal: boolean; body: string; created_at: string; author_name?: string };
export type EventRow = { id: number; ticket_id: number; kind: string; status: string | null; by_user: boolean; created_at: string };

const T_COLS = "id,user_id,category,title,body,status,priority,assigned_to,from_tester,context,attachment_path,first_response_at,resolved_at,closed_at,reopened_count,last_user_at,last_staff_at,created_at,updated_at";
const M_COLS = "id,ticket_id,author,author_kind,internal,body,created_at";
const E_COLS = "id,ticket_id,kind,status,by_user,created_at";

// ───────────── Demo: una historia coherente (rotulada como demo en cada pantalla) ─────────────
const HOUR = 3600e3;
type DemoCase = { t: TicketRow; m: MessageRow[]; e: EventRow[]; name: string; email: string };
function demoCases(viewerId: string, now = Date.now()): DemoCase[] {
  const at = (h: number) => new Date(now - h * HOUR).toISOString();
  const base = (o: Partial<TicketRow> & Pick<TicketRow, "id" | "category" | "title" | "body" | "status">, h: number, user = viewerId): TicketRow => ({
    user_id: user, priority: "normal", assigned_to: null, from_tester: false, context: { page: "/app", version: "demo", device: "iPhone, Safari", plan: "completo" }, attachment_path: null,
    first_response_at: null, resolved_at: null, closed_at: null, reopened_count: 0, last_user_at: at(h), last_staff_at: null, created_at: at(h), updated_at: at(h), ...o,
  });
  const msg = (id: number, ticket: number, kind: "usuario" | "equipo", body: string, h: number, internal = false, author_name?: string): MessageRow => ({ id, ticket_id: ticket, author: null, author_kind: kind, internal, body, created_at: at(h), author_name });
  const ev = (id: number, ticket: number, kind: string, status: string | null, h: number, by_user = false): EventRow => ({ id, ticket_id: ticket, kind, status, by_user, created_at: at(h) });
  return [
    { name: "Andrés", email: "demo@bananaburn.app",
      t: base({ id: 101, category: "app", title: "No se guarda mi peso", body: "Cuando toco Guardar en Hoy se queda cargando y al volver a entrar el peso no aparece. Me pasa desde ayer en la mañana.", status: "en_proceso", priority: "alta", from_tester: true, attachment_path: "demo/captura.png", first_response_at: at(20), last_staff_at: at(3), last_user_at: at(2) }, 26),
      m: [msg(1, 101, "equipo", "Gracias por avisarnos. ¿Te pasa con coma decimal (70,5) o también con números enteros?", 20, false, "Ana Lucía"),
        msg(2, 101, "equipo", "Reproducido en iOS 17 con coma decimal. Revisar el parseo en weigh-in.", 19, true, "Ana Lucía"),
        msg(3, 101, "usuario", "Solo con coma. Con 70 sí se guarda.", 2),
        msg(4, 101, "equipo", "Perfecto, ya encontramos el problema y lo estamos corrigiendo. Te avisamos apenas esté listo.", 1, false, "Ana Lucía")],
      e: [ev(1, 101, "creado", "recibido", 26), ev(2, 101, "estado", "en_proceso", 20), ev(3, 101, "respuesta", null, 1)] },
    { name: "Andrés", email: "demo@bananaburn.app",
      t: base({ id: 102, category: "pagos", title: "Me llegó el recibo dos veces", body: "Recibí dos correos de recibo del mismo pago de este mes. ¿Me cobraron doble?", status: "resuelto", first_response_at: at(70), resolved_at: at(60), last_staff_at: at(60) }, 72),
      m: [msg(5, 102, "equipo", "Revisamos tu cuenta: hay un solo cobro. El correo salió dos veces por un reintento de nuestro lado y ya lo corregimos.", 60, false, "Mónica")],
      e: [ev(4, 102, "creado", "recibido", 72), ev(5, 102, "estado", "en_proceso", 70), ev(6, 102, "estado", "resuelto", 60)] },
    { name: "Andrés", email: "demo@bananaburn.app",
      t: base({ id: 103, category: "entreno", title: "El video de peso muerto no carga", body: "En el detalle del ejercicio peso muerto rumano la animación se queda en blanco.", status: "necesita_info", first_response_at: at(5), last_staff_at: at(5) }, 30),
      m: [msg(6, 103, "equipo", "¿Nos dices si estabas con datos móviles o wifi? Y si puedes, una captura de la pantalla.", 5, false, "Jonathan")],
      e: [ev(7, 103, "creado", "recibido", 30), ev(8, 103, "estado", "necesita_info", 5)] },
    { name: "Valeria Jiménez", email: "valeria.jimenez64@gmail.com", t: base({ id: 104, category: "pagos", title: "No puedo cambiar mi tarjeta", body: "Al guardar la tarjeta nueva dice que no se pudo usar. Es una Visa débito del BCR.", status: "recibido", priority: "urgente" }, 30, "00000000-0000-4000-8000-000000000019"), m: [], e: [ev(9, 104, "creado", "recibido", 30)] },
    { name: "Jorge Segura", email: "jorge.segura12@ice.co.cr", t: base({ id: 105, category: "comunidad", title: "Un comentario ofensivo en mi publicación", body: "Alguien me dejó un comentario muy grosero en mi entreno de ayer. Ya lo reporté pero sigue ahí.", status: "recibido", from_tester: true }, 5, "00000000-0000-4000-8000-000000000027"), m: [], e: [ev(10, 105, "creado", "recibido", 5)] },
    { name: "María José Brenes", email: "maria.jose.brenes@yahoo.com", t: base({ id: 106, category: "nutricion", title: "Las calorías del gallo pinto no cuadran", body: "Registré una taza de gallo pinto y me salen 520 kcal. Me parece muy alto.", status: "en_proceso", first_response_at: at(40), last_staff_at: at(40), assigned_to: "demo" }, 50, "00000000-0000-4000-8000-000000000009"), m: [msg(7, 106, "equipo", "Lo estamos revisando con la nutricionista. Gracias por el detalle.", 40, false, "Andrés")], e: [ev(11, 106, "creado", "recibido", 50), ev(12, 106, "estado", "en_proceso", 40)] },
    { name: "Fabián Zúñiga", email: "fabian.zuniga85@outlook.com", t: base({ id: 107, category: "cuenta", title: "Quiero cambiar mi correo", body: "Me cambié de trabajo y quiero usar mi correo personal para entrar.", status: "cerrado", first_response_at: at(100), resolved_at: at(95), closed_at: at(90) }, 110, "00000000-0000-4000-8000-000000000036"), m: [msg(8, 107, "equipo", "Ya puedes cambiarlo en Perfil, Cuenta. Te llega un enlace al correo nuevo.", 95, false, "Mónica")], e: [ev(13, 107, "creado", "recibido", 110), ev(14, 107, "estado", "resuelto", 95), ev(15, 107, "estado", "cerrado", 90, true)] },
  ];
}

// ───────────── La persona ─────────────

/** Casos propios (RLS). Sin 0034: `unavailable`. */
export async function getMyTickets(v: Viewer): Promise<{ tickets: TicketRow[]; unavailable?: boolean }> {
  if (v.demo) return { tickets: demoCases(v.id).filter((c) => c.t.user_id === v.id).map((c) => c.t) };
  const sb = await createClient();
  const { data, error } = await sb.from("support_tickets").select(T_COLS).eq("user_id", v.id).order("updated_at", { ascending: false }).limit(50);
  if (error) return { tickets: [], unavailable: true };
  return { tickets: (data ?? []) as TicketRow[] };
}

/** Un caso propio con su conversación pública y su línea de tiempo (las notas internas nunca llegan: RLS). */
export async function getMyTicket(v: Viewer, id: number): Promise<{ t: TicketRow; messages: MessageRow[]; events: EventRow[] } | null> {
  if (v.demo) {
    const c = demoCases(v.id).find((x) => x.t.id === id && x.t.user_id === v.id);
    return c ? { t: c.t, messages: c.m.filter((m) => !m.internal), events: c.e } : null;
  }
  const sb = await createClient();
  const { data: t } = await sb.from("support_tickets").select(T_COLS).eq("id", id).eq("user_id", v.id).maybeSingle();
  if (!t) return null;
  const [m, e] = await Promise.all([
    sb.from("support_messages").select(M_COLS).eq("ticket_id", id).eq("internal", false).order("created_at").limit(200),
    sb.from("support_events").select(E_COLS).eq("ticket_id", id).order("created_at").limit(100),
  ]);
  return { t: t as TicketRow, messages: (m.data ?? []) as MessageRow[], events: (e.data ?? []) as EventRow[] };
}

// ───────────── El equipo ─────────────

export type QueueFilters = { status?: string; category?: string; priority?: string; tester?: string; assigned?: string };
export type QueueRow = TicketRow & { name: string; late: boolean; assignee_name?: string };

const ASSIGNED_ME = (v: Viewer) => (v.demo ? "demo" : v.id);

/** Cola de soporte: más antiguos primero, con conteos por estado. Sin 0034: `unavailable`. */
export async function getSupportQueue(v: Viewer, f: QueueFilters): Promise<{ rows: QueueRow[]; counts: Record<SupportStatus, number>; late: number; unavailable?: boolean }> {
  const counts = Object.fromEntries(SUPPORT_STATUSES.map((s) => [s, 0])) as Record<SupportStatus, number>;
  const now = new Date();
  let all: (TicketRow & { name: string; assignee_name?: string })[];
  if (v.demo) {
    all = demoCases("demo").map((c) => ({ ...c.t, name: c.name, assignee_name: c.t.assigned_to ? "Andrés Guevara" : undefined }));
  } else {
    const sb = await createClient();
    const { data, error } = await sb.from("support_tickets").select(T_COLS).order("created_at", { ascending: true }).limit(1000);
    if (error) return { rows: [], counts, late: 0, unavailable: true };
    const rows = (data ?? []) as TicketRow[];
    const names = await nameMap(sb, [...rows.map((r) => r.user_id), ...rows.map((r) => r.assigned_to).filter((x): x is string => !!x)]);
    all = rows.map((r) => ({ ...r, name: names.get(r.user_id) ?? "Sin nombre", assignee_name: r.assigned_to ? names.get(r.assigned_to) : undefined }));
  }
  for (const r of all) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const st = f.status || "abiertos";
  const rows = all
    .filter((r) => (st === "todos" ? true : st === "abiertos" ? (OPEN_STATUSES as string[]).includes(r.status) : r.status === st))
    .filter((r) => !f.category || r.category === f.category)
    .filter((r) => !f.priority || r.priority === f.priority)
    .filter((r) => !f.tester || (f.tester === "si" ? r.from_tester : !r.from_tester))
    .filter((r) => !f.assigned || (f.assigned === "mio" ? r.assigned_to === ASSIGNED_ME(v) : f.assigned === "nadie" ? !r.assigned_to : true))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((r) => ({ ...r, late: slaLate(r, now) }));
  return { rows, counts, late: all.filter((r) => slaLate(r, now)).length };
}

export type TicketAdmin = { t: TicketRow; messages: MessageRow[]; events: EventRow[]; user: { name: string; email: string | null }; staff: { id: string; name: string }[] };

/** Un caso completo para el equipo: conversación con notas internas, eventos, persona y equipo para asignar. */
export async function getSupportTicketAdmin(v: Viewer, id: number): Promise<TicketAdmin | null> {
  if (v.demo) {
    const c = demoCases("demo").find((x) => x.t.id === id);
    return c ? { t: c.t, messages: c.m, events: c.e, user: { name: c.name, email: c.email }, staff: [{ id: "demo", name: "Andrés Guevara" }, { id: "s2", name: "Mónica Salas" }, { id: "s3", name: "Ana Lucía Pérez" }] } : null;
  }
  const sb = await createClient();
  const { data: t } = await sb.from("support_tickets").select(T_COLS).eq("id", id).maybeSingle();
  if (!t) return null;
  const [m, e, staffQ, acc] = await Promise.all([
    sb.from("support_messages").select(M_COLS).eq("ticket_id", id).order("created_at").limit(300),
    sb.from("support_events").select(E_COLS).eq("ticket_id", id).order("created_at").limit(200),
    sb.from("profiles").select("id,full_name").in("role", ["support", "admin", "superadmin"]).limit(50),
    sb.rpc("admin_user_account", { p_target: (t as TicketRow).user_id }),
  ]);
  const messages = (m.data ?? []) as MessageRow[];
  const names = await nameMap(sb, [(t as TicketRow).user_id, ...messages.map((x) => x.author).filter((x): x is string => !!x)]);
  const email = ((acc.data as { email: string }[] | null)?.[0]?.email) ?? null;
  return {
    t: t as TicketRow, events: (e.data ?? []) as EventRow[],
    messages: messages.map((x) => ({ ...x, author_name: x.author ? names.get(x.author) : undefined })),
    user: { name: names.get((t as TicketRow).user_id) ?? "Sin nombre", email },
    staff: ((staffQ.data ?? []) as { id: string; full_name: string | null }[]).map((s) => ({ id: s.id, name: s.full_name || "Sin nombre" })),
  };
}

/** Casos abiertos (insignia del menú y tarjeta del resumen). */
export async function openSupportCount(v: Viewer): Promise<{ open: number; late: number }> {
  if (v.demo) { const now = new Date(); const c = demoCases("demo").map((x) => x.t).filter((t) => (OPEN_STATUSES as string[]).includes(t.status)); return { open: c.length, late: c.filter((t) => slaLate(t, now)).length }; }
  const sb = await createClient();
  const { data, error } = await sb.from("support_tickets").select("status,created_at,first_response_at").in("status", OPEN_STATUSES).limit(1000);
  if (error) return { open: 0, late: 0 };
  const rows = (data ?? []) as Pick<TicketRow, "status" | "created_at" | "first_response_at">[];
  const now = new Date();
  return { open: rows.length, late: rows.filter((t) => slaLate(t, now)).length };
}

async function nameMap(sb: Awaited<ReturnType<typeof createClient>>, ids: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids)].slice(0, 300);
  if (!uniq.length) return new Map();
  const { data } = await sb.from("profiles").select("id,full_name").in("id", uniq);
  return new Map(((data ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name || "Sin nombre"]));
}

// ───────────── Avisos (correo y push) ─────────────

const MAIL_KIND = (e: { kind: string; status: string | null }): SupportMailKind | null =>
  e.kind === "creado" ? "recibido" : e.kind === "respuesta" ? "respuesta" : e.kind === "estado" && e.status && e.status !== "recibido" ? (e.status as SupportMailKind) : null;

async function pushTo(admin: SupabaseClient, userId: string, payload: { title: string; body: string; url: string; tag: string }): Promise<number> {
  const { data: prefs } = await admin.from("notification_prefs").select("push_reminders").eq("user_id", userId).maybeSingle();
  if (prefs?.push_reminders === false) return 0;
  const { data: subs } = await admin.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", userId);
  return subs?.length ? sendPush(admin, subs as PushSub[], payload) : 0;
}

const PUSH_TITLE: Record<SupportMailKind, string> = {
  recibido: "Recibimos tu reporte", en_proceso: "Estamos trabajando en tu reporte", respuesta: "El equipo respondió tu reporte",
  necesita_info: "Necesitamos más información", resuelto: "Resolvimos tu reporte", cerrado: "Cerramos tu reporte",
};

/**
 * Correo y push de cada evento que la persona debe saber, y el aviso al equipo de cada caso nuevo. Idempotente: cada
 * evento se reclama con notified_at antes de enviar. Nunca lanza. Sin service_role: no hace nada.
 */
export async function deliverSupportNotices(opts: { ticketId?: number; limit?: number } = {}): Promise<{ claimed: number; email: number; push: number }> {
  const out = { claimed: 0, email: 0, push: 0 };
  const admin = adminClient();
  if (!admin) return out;
  try {
    let q = admin.from("support_events").select("id,ticket_id,kind,status,message_id").is("notified_at", null).in("kind", ["creado", "estado", "respuesta"])
      .order("created_at", { ascending: true }).limit(Math.min(opts.limit ?? 50, 300));
    if (opts.ticketId) q = q.eq("ticket_id", opts.ticketId);
    const { data, error } = await q;
    if (error) return out;
    for (const e of (data ?? []) as { id: number; ticket_id: number; kind: string; status: string | null; message_id: number | null }[]) {
      const { data: claimed } = await admin.from("support_events").update({ notified_at: new Date().toISOString() }).eq("id", e.id).is("notified_at", null).select("id");
      if (!claimed?.length) continue;
      out.claimed++;
      const kind = MAIL_KIND(e);
      if (!kind) continue;
      const { data: t } = await admin.from("support_tickets").select("id,user_id,title,body,category,from_tester,context").eq("id", e.ticket_id).maybeSingle();
      if (!t) continue;
      const msg = e.message_id ? (await admin.from("support_messages").select("body,internal").eq("id", e.message_id).maybeSingle()).data : null;
      const number = ticketNumber(t.id as number);
      const url = `/app/soporte/${t.id}`;
      const mail = await sendSupportEmail({ userId: t.user_id as string, eventId: e.id, kind, number, title: String(t.title), message: msg && !msg.internal ? String(msg.body) : null, url }).catch(() => null);
      if (mail?.ok) out.email++;
      out.push += await pushTo(admin, t.user_id as string, { title: PUSH_TITLE[kind], body: `${number}: ${String(t.title).slice(0, 80)}`, url, tag: `soporte-${e.id}` }).catch(() => 0);
      if (e.kind === "creado") {
        // Aviso al equipo (FEEDBACK_EMAIL o hola@): sin datos de salud ni del dispositivo más allá del contexto permitido.
        const { data: p } = await admin.from("profiles").select("full_name").eq("id", t.user_id).maybeSingle();
        const ctx = (t.context ?? {}) as Record<string, string>;
        await sendFeedbackToTeam({ reportId: t.id as number, userId: t.user_id as string, ticket: true, number, title: String(t.title), name: (p?.full_name as string) || "Sin nombre", kind: CATEGORY_LABEL[t.category as SupportCategory] ?? String(t.category), body: String(t.body), page: ctx.page ?? null, tester: !!t.from_tester }).catch(() => null);
      }
    }
  } catch (e) {
    console.error("[soporte] avisos", errInfo(e));
  }
  if (out.claimed) console.info(JSON.stringify({ scope: "soporte", msg: "avisos", ...out }));
  return out;
}
