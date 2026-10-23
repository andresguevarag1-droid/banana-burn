// Panel: referidos y regalos de un usuario (solo servidor). Lee por funciones SECURITY DEFINER que validan el rol
// (admin_referral_overview y admin_referral_counts, 0025). Las acciones (revocar, revisar, regalar) quedan en audit_log.
import "server-only";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { can } from "@/lib/admin-perms";
import { demoWorld } from "@/lib/admin-demo";

export type AdminReferral = { id: number; user_id: string | null; name: string | null; status: string; flag: string | null; created_at: string; qualified_at: string | null; annual: boolean; group_no: number | null };
export type AdminReward = { id: number; group_no: number; months: number; plan: string; created_at: string; upgraded_at: string | null; revoked_at: string | null; revoke_reason: string | null };
export type ReferralOverview = {
  code: string | null;
  referred_by: { id: string; name: string | null; status: string; created_at: string } | null;
  referrals: AdminReferral[];
  rewards: AdminReward[];
  unavailable?: boolean;
};

const DAY = 864e5;
function demoOverview(id: string): ReferralOverview {
  const { users } = demoWorld();
  const idx = users.findIndex((u) => u.id === id);
  if (idx < 0 || idx % 2) return { code: null, referred_by: null, referrals: [], rewards: [] };
  const others = users.filter((u) => u.id !== id).slice(idx % 7, (idx % 7) + 4);
  const t = Date.now();
  const iso = (d: number) => new Date(t - d * DAY).toISOString();
  const st = ["calificado", "calificado", "calificado", "sospechoso"];
  return {
    code: "demo" + String(idx).padStart(4, "2").replace(/[01]/g, "2").slice(0, 4),
    referred_by: null,
    referrals: others.map((u, i) => ({ id: i + 1, user_id: u.id, name: u.full_name, status: st[i], flag: st[i] === "sospechoso" ? "misma_red_y_dominio" : null, created_at: iso(30 - i * 5), qualified_at: st[i] === "calificado" ? iso(28 - i * 5) : null, annual: i === 0, group_no: i < 3 ? 1 : null })),
    rewards: [{ id: 1, group_no: 1, months: 3, plan: "completo", created_at: iso(18), upgraded_at: null, revoked_at: null, revoke_reason: null }],
  };
}

export async function getReferralOverview(v: Viewer, id: string): Promise<ReferralOverview | null> {
  if (!can(v.role, "referrals.view")) return null;
  if (v.demo) return demoOverview(id);
  const { data, error } = await (await createClient()).rpc("admin_referral_overview", { p_target: id });
  if (error || !data) return { code: null, referred_by: null, referrals: [], rewards: [], unavailable: true };
  return data as ReferralOverview;
}

export type ReferralCounts = { total: number; qualified: number; rewards: number };

/** Conteos para la lista de usuarios (una consulta por página). Sin 0025 o sin permiso: mapa vacío. */
export async function getReferralCounts(v: Viewer, ids: string[]): Promise<Map<string, ReferralCounts>> {
  const out = new Map<string, ReferralCounts>();
  if (!ids.length || !can(v.role, "referrals.view")) return out;
  if (v.demo) {
    const { users } = demoWorld();
    ids.forEach((id) => { const i = users.findIndex((u) => u.id === id); if (i >= 0 && i % 2 === 0) out.set(id, { total: 4, qualified: 3, rewards: 1 }); });
    return out;
  }
  const { data, error } = await (await createClient()).rpc("admin_referral_counts", { p_ids: ids.slice(0, 100) });
  if (error) return out;
  for (const r of (data ?? []) as { user_id: string; total: number; qualified: number; rewards: number }[]) {
    if (Number(r.total) > 0) out.set(r.user_id, { total: Number(r.total), qualified: Number(r.qualified), rewards: Number(r.rewards) });
  }
  return out;
}

export const REFERRAL_STATUS_LABEL: Record<string, string> = { registrado: "Registrado", calificado: "Activo", sospechoso: "En revisión", descartado: "No cuenta" };
export const REFERRAL_FLAG_LABEL: Record<string, string> = {
  mismo_correo: "Mismo correo que quien invita",
  misma_red_y_dominio: "Misma red y mismo dominio de correo",
  varias_cuentas_misma_red: "Varias cuentas desde la misma red",
  aprobado: "Aprobado por el equipo",
  aprobado_por_pago_anual: "Aprobado: compró plan anual",
  recompensa_revocada: "Recompensa revocada",
  descartado: "Descartado por el equipo",
};
