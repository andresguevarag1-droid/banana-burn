// Datos de la ficha para el superadmin (0056). SOLO SERVIDOR. Lee con la sesión del superadmin (la RPC vuelve a
// validar el rol) y, para el estado de Auth (correo confirmado, bloqueo, último ingreso), con service_role.
import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { can } from "@/lib/admin-perms";
import { logError } from "@/lib/log";

export type ManageAccess = { slug: string; source: string; title: string | null; kind: string | null; season: boolean; created_at: string; reason: string | null };
export type ManageProgram = { slug: string; title: string | null; status: string; started_on: string; season: boolean };
export type ManageChallenge = { slug: string; title: string | null; status: string; started_on: string; checkins: number };
export type ManageBadge = { id: string; label: string | null; kind: string };
export type ManageOverride = { id: string; mode: "otorgada" | "quitada"; created_at: string };
export type ManageAuth = { email: string | null; confirmed: boolean; bannedUntil: string | null; lastSignIn: string | null; providers: string[]; pendingEmail: string | null } | null;
export type ManageCharge = { status: string; charge_at: string; plan: string; billing: string; amount_minor: number } | null;
export type CatalogItem = { slug: string; title: string; kind: string; price: number; season: boolean };

export type ManageData = {
  blockedAt: string | null; blockedReason: string | null; xp: number; xpAdjust: number;
  access: ManageAccess[]; programs: ManageProgram[]; challenges: ManageChallenge[]; intakes: string[];
  badges: ManageBadge[]; overrides: ManageOverride[];
  auth: ManageAuth; charge: ManageCharge; renewing: boolean; catalog: CatalogItem[];
};

type Raw = {
  blocked_at: string | null; blocked_reason: string | null; xp: number; xp_adjust: number;
  access: ManageAccess[]; programs: ManageProgram[]; challenges: ManageChallenge[]; intakes: string[];
  badges: ManageBadge[]; overrides: ManageOverride[];
};

/** null = el rol no es superadmin; "missing" = falta aplicar 0056. */
export async function getManageData(v: Viewer, id: string): Promise<ManageData | "missing" | null> {
  if (!can(v.role, "users.manage")) return null;
  if (v.demo) return demoManage();
  const sb = await createClient();
  const { data, error } = await sb.rpc("admin_user_manage", { p_target: id });
  if (error) {
    if (["42883", "PGRST202", "42P01", "PGRST205"].includes(error.code ?? "")) return "missing";
    logError("admin-manage", "read_failed", { code: error.code });
    return "missing";
  }
  const r = data as Raw;
  const admin = adminClient();
  const [auth, charge, renewing, catalog] = await Promise.all([
    readAuth(admin, id),
    admin ? admin.from("trial_charges").select("status,charge_at,plan,billing,amount_minor").eq("user_id", id).in("status", ["scheduled", "retry_scheduled", "failed"]).maybeSingle().then((x) => (x.data as ManageCharge) ?? null) : Promise.resolve(null),
    sb.from("subscriptions").select("id").eq("user_id", id).in("status", ["active", "trialing", "past_due"]).eq("cancel_at_period_end", false).limit(1).then((x) => !!x.data?.length),
    readCatalog(sb),
  ]);
  return {
    blockedAt: r.blocked_at, blockedReason: r.blocked_reason, xp: Number(r.xp ?? 0), xpAdjust: Number(r.xp_adjust ?? 0),
    access: r.access ?? [], programs: r.programs ?? [], challenges: r.challenges ?? [], intakes: r.intakes ?? [],
    badges: r.badges ?? [], overrides: r.overrides ?? [], auth, charge, renewing, catalog,
  };
}

async function readAuth(admin: ReturnType<typeof adminClient>, id: string): Promise<ManageAuth> {
  if (!admin) return null;
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error || !data.user) return null;
  const u = data.user as typeof data.user & { banned_until?: string | null; new_email?: string | null };
  const banned = u.banned_until && Date.parse(u.banned_until) > Date.now() ? u.banned_until : null;
  return {
    email: u.email ?? null, confirmed: !!u.email_confirmed_at, bannedUntil: banned, lastSignIn: u.last_sign_in_at ?? null,
    providers: ((u.app_metadata?.providers as string[] | undefined) ?? (u.app_metadata?.provider ? [String(u.app_metadata.provider)] : [])).slice(0, 4),
    pendingEmail: u.new_email ?? null,
  };
}

async function readCatalog(sb: Awaited<ReturnType<typeof createClient>>): Promise<CatalogItem[]> {
  const [{ data: cat }, { data: seasons }] = await Promise.all([
    sb.from("challenges_catalog").select("slug,title,kind,price_usd,status").in("status", ["publicado", "oculto"]).order("sort").limit(200),
    sb.from("seasons").select("slug"),
  ]);
  const seasonSet = new Set(((seasons ?? []) as { slug: string }[]).map((s) => s.slug));
  return ((cat ?? []) as { slug: string; title: string; kind: string; price_usd: number }[])
    .map((c) => ({ slug: c.slug, title: c.title, kind: c.kind, price: Number(c.price_usd ?? 0), season: seasonSet.has(c.slug) }));
}

/** Demo: una cuenta de ejemplo con una temporada, un reto, insignias y una insignia otorgada a mano. */
function demoManage(): ManageData {
  const now = new Date().toISOString();
  return {
    blockedAt: null, blockedReason: null, xp: 2140, xpAdjust: 0,
    access: [{ slug: "temporada-running-1", source: "cortesia", title: "Temporada Running 1", kind: "programa", season: true, created_at: now, reason: "Embajadora de la marca" }],
    programs: [{ slug: "temporada-running-1", title: "Temporada Running 1", status: "activo", started_on: now.slice(0, 10), season: true }],
    challenges: [{ slug: "agua-21", title: "21 días de agua", status: "activo", started_on: now.slice(0, 10), checkins: 6 }],
    intakes: ["temporada-running-1"],
    badges: [{ id: "nivel", label: null, kind: "nivel" }, { id: "racha7", label: null, kind: "racha" }, { id: "w10", label: null, kind: "logro" }],
    overrides: [{ id: "w10", mode: "otorgada", created_at: now }],
    auth: { email: "sofia@ejemplo.com", confirmed: true, bannedUntil: null, lastSignIn: now, providers: ["email"], pendingEmail: null },
    charge: null, renewing: false,
    catalog: [
      { slug: "temporada-running-1", title: "Temporada Running 1", kind: "programa", price: 14.99, season: true },
      { slug: "temporada-raquetas-1", title: "Temporada Raquetas 1", kind: "programa", price: 16.99, season: true },
      { slug: "abdomen-marcado", title: "Abdomen marcado", kind: "programa", price: 7.99, season: false },
      { slug: "agua-21", title: "21 días de agua", kind: "reto", price: 0, season: false },
    ],
  };
}
