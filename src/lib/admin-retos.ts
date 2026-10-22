// Lecturas del panel para la tienda de retos. Staff con content.challenges; ventas solo con challenges.sales.
import "server-only";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { can } from "@/lib/admin-perms";
import { fromCatalogRow, parsePlan, SEED_CHALLENGES, type CatalogRow, type Challenge, type ChallengeStatus, type DayTask } from "@/lib/challenges";

export const ADMIN_COLS = "id,slug,title,description,days,rules,status,price_usd,onvo_price_id,difficulty,minutes,cover,icon,verify,grace,xp,steps_goal,badge,reward_title,start_mode,start_date,featured,coming_soon,safety_note,sort,updated_at";

export type AdminChallenge = Challenge & { uuid: string; onvoPriceId: string | null; updatedAt: string | null };
export type ChallengeStats = { active: number; joined: number; completed: number; purchases: number | null; revenueMinor: number | null; comps: number | null };
export type Buyer = { userId: string; name: string; source: "compra" | "cortesia"; at: string; amountMinor: number | null; reason: string | null };

type AdminRow = CatalogRow & { id: string; onvo_price_id: string | null; updated_at: string | null };

const toAdmin = (r: AdminRow, plan?: DayTask[] | null): AdminChallenge | null => {
  const c = fromCatalogRow(r, plan);
  return c ? { ...c, uuid: r.id, onvoPriceId: r.onvo_price_id, updatedAt: r.updated_at } : null;
};
/** En demo, el catálogo sembrado (id = slug). Sin estadísticas: no se inventan ventas ni personas. */
const demoAdmin = (): AdminChallenge[] => SEED_CHALLENGES.map((c) => ({ ...c, uuid: c.id, onvoPriceId: null, updatedAt: null }));

export async function listAdminChallenges(v: Viewer, status?: ChallengeStatus | null): Promise<{ rows: { c: AdminChallenge; stats: ChallengeStats | null }[]; needsMigration: boolean }> {
  if (v.demo) return { rows: demoAdmin().filter((c) => !status || c.status === status).map((c) => ({ c, stats: null })), needsMigration: false };
  const sb = await createClient();
  let q = sb.from("challenges_catalog").select(ADMIN_COLS).order("sort").order("created_at");
  if (status) q = q.eq("status", status);
  const [{ data, error }, st] = await Promise.all([q, sb.rpc("admin_challenge_stats")]);
  if (error) return { rows: [], needsMigration: true };
  const stats = new Map<string, ChallengeStats>();
  for (const s of (st.data ?? []) as { slug: string; active: number; joined: number; completed: number; purchases: number | null; revenue_minor: number | null; comps: number | null }[]) {
    stats.set(s.slug, { active: Number(s.active), joined: Number(s.joined), completed: Number(s.completed), purchases: s.purchases === null ? null : Number(s.purchases), revenueMinor: s.revenue_minor === null ? null : Number(s.revenue_minor), comps: s.comps === null ? null : Number(s.comps) });
  }
  const rows = ((data ?? []) as AdminRow[]).map((r) => toAdmin(r)).filter((c): c is AdminChallenge => !!c).map((c) => ({ c, stats: stats.get(c.id) ?? null }));
  return { rows, needsMigration: false };
}

export async function getAdminChallenge(v: Viewer, id: string): Promise<{ c: AdminChallenge; plan: DayTask[]; stats: ChallengeStats | null; buyers: Buyer[] | null } | null> {
  if (v.demo) {
    const c = demoAdmin().find((x) => x.uuid === id);
    return c ? { c, plan: c.plan ?? [], stats: null, buyers: can(v.role, "challenges.sales") ? [] : null } : null;
  }
  const sb = await createClient();
  const { data: row } = await sb.from("challenges_catalog").select(ADMIN_COLS).eq("id", id).maybeSingle();
  if (!row) return null;
  const slug = (row as AdminRow).slug;
  const [{ data: p }, { list }] = await Promise.all([
    sb.from("challenge_plans").select("days").eq("slug", slug).maybeSingle(),
    listAdminChallenges(v).then((r) => ({ list: r.rows })),
  ]);
  const plan = parsePlan(p?.days, (row as AdminRow).days);
  const c = toAdmin(row as AdminRow, plan)!;
  let buyers: Buyer[] | null = null;
  if (can(v.role, "challenges.sales")) {
    const [{ data: ents }, { data: pur }] = await Promise.all([
      sb.from("challenge_entitlements").select("user_id,source,created_at,reason,purchase_id").eq("challenge_slug", slug).order("created_at", { ascending: false }).limit(200),
      sb.from("challenge_purchases").select("id,amount_minor").eq("challenge_slug", slug).eq("status", "pagado").limit(500),
    ]);
    const amount = new Map(((pur ?? []) as { id: number; amount_minor: number }[]).map((x) => [x.id, x.amount_minor]));
    const ids = [...new Set(((ents ?? []) as { user_id: string }[]).map((e) => e.user_id))];
    const { data: profs } = ids.length ? await sb.from("profiles").select("id,full_name").in("id", ids) : { data: [] };
    const name = new Map(((profs ?? []) as { id: string; full_name: string | null }[]).map((x) => [x.id, x.full_name ?? ""]));
    buyers = ((ents ?? []) as { user_id: string; source: "compra" | "cortesia"; created_at: string; reason: string | null; purchase_id: number | null }[]).map((e) => ({
      userId: e.user_id, name: name.get(e.user_id) || "Sin nombre", source: e.source, at: e.created_at, amountMinor: e.purchase_id ? amount.get(e.purchase_id) ?? null : null, reason: e.reason,
    }));
  }
  return { c, plan, stats: list.find((r) => r.c.id === slug)?.stats ?? null, buyers };
}
