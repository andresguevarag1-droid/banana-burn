import "server-only";
// Datos del panel de referidores (/admin/referidores). Solo superadmin (la página lo exige antes de llamar). Lee con
// service_role porque necesita correos de Auth y conteos de suscripciones de las cuentas referidas.
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import { DEFAULT_SETTINGS, balances, maskMethod, tierFor, type AffSettings } from "@/lib/affiliates";
import { activeCount, getAffSettings } from "@/lib/affiliates-server";

export type AdminAffiliate = {
  userId: string; name: string; email: string; code: string; active: boolean; createdAt: string; revokedAt: string | null;
  active_count: number; level: number; rate: number; signups: number; clicks: number; pending: number; available: number; paid: number; perk: boolean; method: string | null;
};
export type AdminPayout = { id: number; affiliateId: string; name: string; period: string; amount: number; status: string; method: Record<string, string | null>; reference: string | null; paidAt: string | null; createdAt: string };
export type AdminInvite = { id: number; email: string; code: string | null; expiresAt: string; usedAt: string | null; canceledAt: string | null; createdAt: string };
export type AdminAffiliatesData = { demo: boolean; unavailable?: boolean; settings: AffSettings; affiliates: AdminAffiliate[]; payouts: AdminPayout[]; invites: AdminInvite[] };

async function emailsFor(db: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(ids.slice(0, 200).map(async (id) => {
    const { data } = await db.auth.admin.getUserById(id);
    if (data.user?.email) out.set(id, data.user.email);
  }));
  return out;
}

export function demoAdminAffiliates(): AdminAffiliatesData {
  const d = (n: number) => new Date(Date.now() - n * 864e5).toISOString();
  const mk = (i: number, name: string, code: string, act: number, pending: number, available: number, paid: number): AdminAffiliate => {
    const t = tierFor(act);
    return { userId: `00000000-0000-4000-8000-0000000000a${i}`, name, email: `${code}@ejemplo.com`, code, active: true, createdAt: d(40 - i * 5), revokedAt: null, active_count: act, level: t.level, rate: t.rate, signups: act + 6, clicks: act * 9 + 20, pending, available, paid, perk: act >= 31, method: i % 2 ? "SINPE Móvil ****4821" : "IBAN CR05 **** 2210" };
  };
  return {
    demo: true, settings: DEFAULT_SETTINGS,
    affiliates: [mk(1, "Carla Mora", "carla-fit", 34, 4120, 9860, 15200), mk(2, "Diego Solano", "diego-run", 14, 1210, 2390, 3100), mk(3, "Paula Rojas", "paula-pilates", 6, 380, 0, 0)],
    payouts: [{ id: 1, affiliateId: "00000000-0000-4000-8000-0000000000a1", name: "Carla Mora", period: "2026-11", amount: 9860, status: "pendiente", method: { kind: "sinpe", sinpe_phone: "88884821", holder_name: "Carla Mora Jiménez", iban: null, id_number: "1-1234-0567" }, reference: null, paidAt: null, createdAt: d(1) }],
    invites: [{ id: 1, email: "nueva.referidora@ejemplo.com", code: null, expiresAt: d(-10), usedAt: null, canceledAt: null, createdAt: d(4) }],
  };
}

export async function loadAdminAffiliates(demo: boolean): Promise<AdminAffiliatesData> {
  if (demo) return demoAdminAffiliates();
  const db = adminClient();
  if (!db) return { demo: false, unavailable: true, settings: DEFAULT_SETTINGS, affiliates: [], payouts: [], invites: [] };
  const { data: affs, error } = await db.from("affiliates").select("user_id,code,active,created_at,revoked_at,perk_since").order("created_at", { ascending: false }).limit(500);
  if (error) return { demo: false, unavailable: true, settings: DEFAULT_SETTINGS, affiliates: [], payouts: [], invites: [] };
  const rows = (affs as { user_id: string; code: string; active: boolean; created_at: string; revoked_at: string | null; perk_since: string | null }[] | null) ?? [];
  const ids = rows.map((r) => r.user_id);
  const settings = await getAffSettings(db);
  const [profiles, emails, lines, refs, clicks, methods, payouts, invites] = await Promise.all([
    ids.length ? db.from("profiles").select("id,full_name").in("id", ids) : Promise.resolve({ data: [] }),
    emailsFor(db, ids),
    ids.length ? db.from("affiliate_commissions").select("affiliate_id,status,commission_minor,available_at").in("affiliate_id", ids).limit(50000) : Promise.resolve({ data: [] }),
    ids.length ? db.from("affiliate_referrals").select("affiliate_id").in("affiliate_id", ids).limit(50000) : Promise.resolve({ data: [] }),
    ids.length ? db.from("affiliate_clicks").select("affiliate_id").in("affiliate_id", ids).gte("created_at", new Date(Date.now() - 180 * 864e5).toISOString()).limit(100000) : Promise.resolve({ data: [] }),
    ids.length ? db.from("affiliate_payout_methods").select("user_id,kind,sinpe_phone,iban").in("user_id", ids) : Promise.resolve({ data: [] }),
    db.from("affiliate_payouts").select("id,affiliate_id,period,amount_minor,status,method,reference,paid_at,created_at").order("created_at", { ascending: false }).limit(200),
    db.from("affiliate_invites").select("id,email_norm,code,expires_at,used_at,canceled_at,created_at").order("created_at", { ascending: false }).limit(50),
  ]);
  const name = new Map(((profiles.data as { id: string; full_name: string | null }[] | null) ?? []).map((p) => [p.id, p.full_name ?? ""]));
  const count = (list: { affiliate_id: string }[] | null) => { const m = new Map<string, number>(); for (const r of list ?? []) m.set(r.affiliate_id, (m.get(r.affiliate_id) ?? 0) + 1); return m; };
  const signups = count(refs.data as { affiliate_id: string }[] | null);
  const clickCount = count(clicks.data as { affiliate_id: string }[] | null);
  const meth = new Map(((methods.data as { user_id: string; kind: "sinpe" | "iban"; sinpe_phone: string | null; iban: string | null }[] | null) ?? []).map((m) => [m.user_id, maskMethod(m)]));
  const ledger = (lines.data as { affiliate_id: string; status: string; commission_minor: number; available_at: string }[] | null) ?? [];
  const out: AdminAffiliate[] = [];
  for (const r of rows) {
    const act = await activeCount(db, r.user_id);
    const t = tierFor(act, settings.tiers);
    const b = balances(ledger.filter((l) => l.affiliate_id === r.user_id));
    out.push({ userId: r.user_id, name: name.get(r.user_id) || "Sin nombre", email: emails.get(r.user_id) ?? "", code: r.code, active: r.active, createdAt: r.created_at, revokedAt: r.revoked_at, active_count: act, level: t.level, rate: t.rate, signups: signups.get(r.user_id) ?? 0, clicks: clickCount.get(r.user_id) ?? 0, ...b, perk: !!r.perk_since, method: meth.get(r.user_id) ?? null });
  }
  const pay = ((payouts.data as { id: number; affiliate_id: string; period: string; amount_minor: number; status: string; method: Record<string, string | null>; reference: string | null; paid_at: string | null; created_at: string }[] | null) ?? [])
    .map((p) => ({ id: p.id, affiliateId: p.affiliate_id, name: name.get(p.affiliate_id) || "Referidor", period: p.period, amount: p.amount_minor, status: p.status, method: p.method ?? {}, reference: p.reference, paidAt: p.paid_at, createdAt: p.created_at }));
  const inv = ((invites.data as { id: number; email_norm: string; code: string | null; expires_at: string; used_at: string | null; canceled_at: string | null; created_at: string }[] | null) ?? [])
    .map((i) => ({ id: i.id, email: i.email_norm, code: i.code, expiresAt: i.expires_at, usedAt: i.used_at, canceledAt: i.canceled_at, createdAt: i.created_at }));
  return { demo: false, settings, affiliates: out, payouts: pay, invites: inv };
}

export type AdminAffiliateDetail = {
  aff: AdminAffiliate | null;
  referrals: { userId: string; name: string; email: string; createdAt: string; plan: string | null; status: string; utm: Record<string, string> }[];
  lines: { id: number; createdAt: string; kind: string; referred: string; provider: string | null; gross: number; fee: number; tax: number; net: number; rate: number; activeCount: number; commission: number; status: string; availableAt: string; note: string | null; payoutId: number | null }[];
};

export async function loadAdminAffiliate(id: string, demo: boolean): Promise<AdminAffiliateDetail> {
  if (demo) {
    const d = demoAdminAffiliates();
    const aff = d.affiliates.find((a) => a.userId === id) ?? d.affiliates[0];
    return { aff, referrals: [{ userId: "x1", name: "Laura Q.", email: "laura@ejemplo.com", createdAt: new Date(Date.now() - 20 * 864e5).toISOString(), plan: "completo", status: "pagando", utm: { utm_source: "instagram" } }], lines: [{ id: 1, createdAt: new Date(Date.now() - 12 * 864e5).toISOString(), kind: "pago", referred: "Laura Q.", provider: "onvo", gross: 1499, fee: 93, tax: 172, net: 1234, rate: 40, activeCount: 34, commission: 493, status: "pending", availableAt: new Date(Date.now() + 18 * 864e5).toISOString(), note: null, payoutId: null }] };
  }
  const db = adminClient();
  if (!db) return { aff: null, referrals: [], lines: [] };
  const all = await loadAdminAffiliates(false);
  const aff = all.affiliates.find((a) => a.userId === id) ?? null;
  if (!aff) return { aff: null, referrals: [], lines: [] };
  const [{ data: refs }, { data: lines }] = await Promise.all([
    db.from("affiliate_referrals").select("user_id,created_at,utm").eq("affiliate_id", id).order("created_at", { ascending: false }).limit(500),
    db.from("affiliate_commissions").select("*").eq("affiliate_id", id).order("created_at", { ascending: false }).limit(500),
  ]);
  const refRows = (refs as { user_id: string; created_at: string; utm: Record<string, string> }[] | null) ?? [];
  const rIds = refRows.map((r) => r.user_id);
  const [{ data: profs }, { data: subs }, emails] = await Promise.all([
    rIds.length ? db.from("profiles").select("id,full_name").in("id", rIds) : Promise.resolve({ data: [] }),
    rIds.length ? db.from("subscriptions").select("user_id,plan,status,current_period_end,created_at").in("user_id", rIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    emailsFor(db, rIds),
  ]);
  const nm = new Map(((profs as { id: string; full_name: string | null }[] | null) ?? []).map((p) => [p.id, p.full_name ?? ""]));
  const lastSub = new Map<string, { plan: string | null; status: string; current_period_end: string | null }>();
  for (const s of (subs as { user_id: string; plan: string | null; status: string; current_period_end: string | null }[] | null) ?? []) if (!lastSub.has(s.user_id)) lastSub.set(s.user_id, s);
  const status = (s?: { status: string; current_period_end: string | null }) => !s ? "registrado" : s.status === "active" && (!s.current_period_end || Date.parse(s.current_period_end) > Date.now()) ? "pagando" : s.status === "past_due" ? "pago_fallido" : s.status === "canceled" ? "cancelado" : "registrado";
  return {
    aff,
    referrals: refRows.map((r) => ({ userId: r.user_id, name: nm.get(r.user_id) || "Sin nombre", email: emails.get(r.user_id) ?? "", createdAt: r.created_at, plan: lastSub.get(r.user_id)?.plan ?? null, status: status(lastSub.get(r.user_id)), utm: r.utm ?? {} })),
    lines: ((lines as Record<string, unknown>[] | null) ?? []).map((l) => ({ id: l.id as number, createdAt: l.created_at as string, kind: l.kind as string, referred: nm.get(l.referred_user as string) || (l.kind === "ajuste" ? "Ajuste" : "Persona"), provider: (l.provider as string | null) ?? null, gross: l.gross_minor as number, fee: l.fee_minor as number, tax: l.tax_minor as number, net: l.net_minor as number, rate: Number(l.rate_pct), activeCount: l.active_count as number, commission: l.commission_minor as number, status: l.status as string, availableAt: l.available_at as string, note: (l.note as string | null) ?? null, payoutId: (l.payout_id as number | null) ?? null })),
  };
}

/** CSV de pagos (para conciliación). */
export function payoutsCsv(p: AdminPayout[]): string {
  const esc = (s: unknown) => { const v = String(s ?? ""); return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  const head = ["id", "referidor", "periodo", "monto_usd", "estado", "metodo", "sinpe", "iban", "titular", "identificacion", "referencia", "pagado_el"];
  const rows = p.map((x) => [x.id, x.name, x.period, (x.amount / 100).toFixed(2), x.status, x.method.kind ?? "", x.method.sinpe_phone ?? "", x.method.iban ?? "", x.method.holder_name ?? "", x.method.id_number ?? "", x.reference ?? "", x.paidAt ? x.paidAt.slice(0, 10) : ""]);
  return [head, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}
