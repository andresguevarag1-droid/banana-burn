import "server-only";
// Datos de "Mis referidos" (/app/afiliados) para el referidor. Todo con su sesión: RLS deja ver solo lo propio y los
// referidos llegan anonimizados (nombre e inicial) por my_affiliate_referrals().
import { cache } from "react";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/env";
import { installQrSvg } from "@/lib/install-qr";
import { balances, DEFAULT_SETTINGS, maskMethod, sanitizeTiers, tierFor, type AffSettings } from "@/lib/affiliates";

export type AffRefRow = { label: string; created_at: string; plan: string | null; status: "pagando" | "pago_fallido" | "cancelado" | "registrado"; earned_minor: number };
export type AffMonth = { period: string; earned: number; reversed: number; paid: number };
export type AffiliatePage = {
  demo: boolean; code: string; link: string; qr: string; active: boolean; perk: boolean;
  settings: AffSettings;
  stats: { clicks_total: number; clicks_month: number; signups_total: number; signups_month: number; active: number; canceled: number };
  tier: ReturnType<typeof tierFor>;
  bal: { pending: number; available: number; paid: number };
  nextPayout: string; months: AffMonth[]; referrals: AffRefRow[];
  payouts: { id: number; period: string; amount: number; status: string; reference: string | null; paidAt: string | null }[];
  method: { kind: "sinpe" | "iban"; masked: string; holder: string } | null;
};

/** ¿Es referidor activo? (para el menú). Una consulta pequeña con RLS; en demo, no. */
export const isAffiliate = cache(async function isAffiliate(v: Viewer): Promise<boolean> {
  if (v.demo) return false;
  try {
    const sb = await createClient();
    const { data } = await sb.from("affiliates").select("active").eq("user_id", v.id).maybeSingle();
    return Boolean((data as { active?: boolean } | null)?.active);
  } catch { return false; }
});

/** Próximo pago: los pagos se preparan a inicios de mes (hora de Costa Rica). Devuelve el día 5 del mes siguiente. */
function nextPayoutDate(now = new Date()): string {
  const l = new Date(now.getTime() - 6 * 3600_000);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth() + 1, 5, 18)).toISOString();
}

const monthOf = (iso: string) => { const l = new Date(Date.parse(iso) - 6 * 3600_000); return `${l.getUTCFullYear()}-${String(l.getUTCMonth() + 1).padStart(2, "0")}`; };

export function monthsFrom(lines: { created_at: string; status: string; commission_minor: number }[]): AffMonth[] {
  const m = new Map<string, AffMonth>();
  for (const l of lines) {
    const k = monthOf(l.created_at);
    const row = m.get(k) ?? { period: k, earned: 0, reversed: 0, paid: 0 };
    if (l.status === "reversed") row.reversed += l.commission_minor;
    else { row.earned += l.commission_minor; if (l.status === "paid") row.paid += l.commission_minor; }
    m.set(k, row);
  }
  return [...m.values()].sort((a, b) => b.period.localeCompare(a.period));
}

export async function demoAffiliatePage(): Promise<AffiliatePage> {
  const code = "carla-fit";
  const link = `${SITE_URL}/?ref=${code}`;
  const d = (n: number) => new Date(Date.now() - n * 864e5).toISOString();
  const referrals: AffRefRow[] = [
    { label: "Laura Q.", created_at: d(6), plan: "completo", status: "pagando", earned_minor: 252 },
    { label: "Diego M.", created_at: d(14), plan: "entreno", status: "pagando", earned_minor: 168 },
    { label: "Sofía R.", created_at: d(22), plan: "completo", status: "pagando", earned_minor: 504 },
    { label: "Andrés V.", created_at: d(35), plan: "entreno", status: "cancelado", earned_minor: 84 },
    { label: "María J.", created_at: d(40), plan: null, status: "registrado", earned_minor: 0 },
  ];
  const lines = [
    { created_at: d(6), status: "pending", commission_minor: 252, available_at: d(-24) },
    { created_at: d(14), status: "pending", commission_minor: 168, available_at: d(-16) },
    { created_at: d(34), status: "available", commission_minor: 504, available_at: d(4) },
    { created_at: d(40), status: "available", commission_minor: 1680, available_at: d(10) },
    { created_at: d(64), status: "paid", commission_minor: 2310, available_at: d(34) },
  ];
  return {
    demo: true, code, link, qr: await installQrSvg(link), active: true, perk: false, settings: DEFAULT_SETTINGS,
    stats: { clicks_total: 418, clicks_month: 96, signups_total: 41, signups_month: 9, active: 14, canceled: 6 },
    tier: tierFor(14), bal: balances(lines), nextPayout: nextPayoutDate(), months: monthsFrom(lines), referrals,
    payouts: [{ id: 1, period: monthOf(d(40)), amount: 2310, status: "pagado", reference: "SINPE 48213", paidAt: d(30) }],
    method: { kind: "sinpe", masked: "SINPE Móvil ****4821", holder: "Carla Fernández" },
  };
}

/** null si no es referidor (la página redirige). */
export async function getAffiliatePage(v: Viewer): Promise<AffiliatePage | null> {
  if (v.demo) return demoAffiliatePage();
  const sb = await createClient();
  const { data: aff } = await sb.from("affiliates").select("code,active,perk_since").eq("user_id", v.id).maybeSingle();
  if (!aff) return null;
  const a = aff as { code: string; active: boolean; perk_since: string | null };
  const [st, refs, lines, pays, meth, set] = await Promise.all([
    sb.rpc("my_affiliate_stats"),
    sb.rpc("my_affiliate_referrals"),
    sb.from("affiliate_commissions").select("created_at,status,commission_minor,available_at").eq("affiliate_id", v.id).order("created_at", { ascending: false }).limit(2000),
    sb.from("affiliate_payouts").select("id,period,amount_minor,status,reference,paid_at").eq("affiliate_id", v.id).neq("status", "anulado").order("created_at", { ascending: false }).limit(36),
    sb.from("affiliate_payout_methods").select("kind,sinpe_phone,iban,holder_name").eq("user_id", v.id).maybeSingle(),
    sb.from("affiliate_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  const raw = (set.data as Partial<AffSettings> | null) ?? {};
  const settings: AffSettings = { ...DEFAULT_SETTINGS, ...Object.fromEntries(Object.entries(raw).filter(([, x]) => x !== null)), tiers: sanitizeTiers(raw.tiers) } as AffSettings;
  for (const k of ["onvo_fee_pct", "tilopay_fee_pct", "tax_pct"] as const) settings[k] = Number(settings[k]);
  const s = (st.data as Record<string, number> | null) ?? {};
  const referrals = ((refs.data as AffRefRow[] | null) ?? []).map((r) => ({ ...r, earned_minor: Number(r.earned_minor) }));
  const ln = (lines.data as { created_at: string; status: string; commission_minor: number; available_at: string }[] | null) ?? [];
  const m = meth.data as { kind: "sinpe" | "iban"; sinpe_phone: string | null; iban: string | null; holder_name: string } | null;
  const link = `${SITE_URL}/?ref=${a.code}`;
  const active = Number(s.active ?? 0);
  return {
    demo: false, code: a.code, link, qr: await installQrSvg(link), active: a.active, perk: Boolean(a.perk_since),
    settings,
    stats: { clicks_total: Number(s.clicks_total ?? 0), clicks_month: Number(s.clicks_month ?? 0), signups_total: Number(s.signups_total ?? 0), signups_month: Number(s.signups_month ?? 0), active, canceled: referrals.filter((r) => r.status === "cancelado").length },
    tier: tierFor(active, settings.tiers), bal: balances(ln), nextPayout: nextPayoutDate(), months: monthsFrom(ln), referrals,
    payouts: ((pays.data as { id: number; period: string; amount_minor: number; status: string; reference: string | null; paid_at: string | null }[] | null) ?? []).map((p) => ({ id: p.id, period: p.period, amount: p.amount_minor, status: p.status, reference: p.reference, paidAt: p.paid_at })),
    method: m ? { kind: m.kind, masked: maskMethod(m), holder: m.holder_name } : null,
  };
}
