// Qué puede usar cada usuario. Úsalo SOLO en código de servidor.
// Política (decidida por el dueño):
//   - Prueba gratis de TRIAL_DAYS días con TODO incluido, sin tarjeta, desde profiles.created_at.
//   - Después: plan "entreno" = entreno, coach, comunidad, retos y progreso; plan "completo" = todo (incluye nutrición y Banana Shield).
//   - Cortesías vigentes y staff = completo.
//   - Sin plan y sin prueba vigente: la app muestra el muro de planes (no se borra nada).
// La base de datos repite la regla de acceso en public.has_app_access() (0013) para el coach y la comunidad.
import "server-only";
import { cache } from "react";
import { createClient, STAFF, type Role, type Viewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { BETA_ENDS_AT, TRIAL_DAYS, type Billing, type PlanId } from "@/lib/plans";
import { profilePlanFor } from "@/lib/onvo";

export type SubStatus = "demo" | "none" | "incomplete" | "active" | "trialing" | "past_due" | "canceling" | "canceled" | "expired";

/** De dónde sale el acceso de hoy. */
export type AccessSource = "demo" | "subscription" | "comp" | "staff" | "manual" | "trial" | "none";

export type Entitlements = {
  /** Plan efectivo hoy (suscripción, cortesía, staff o asignado a mano). `free` = sin plan (en prueba o bloqueado). */
  plan: PlanId | "free";
  /** Origen del acceso. */
  access: AccessSource;
  /** Entreno, coach, comunidad, retos y progreso. */
  app: boolean;
  /** Nutrición y Banana Shield (GLP-1). */
  nutrition: boolean;
  /** Sin plan ni prueba vigente: la app muestra el muro de planes. */
  locked: boolean;
  /** Prueba gratis vigente. `beta`: el acceso viene del período de prueba del servicio (todos gratis hasta BETA_ENDS_AT). */
  trial: { endsAt: string; daysLeft: number; beta?: boolean } | null;
  /** Fin de la prueba gratis (vigente o pasada). */
  trialEndsAt?: string;
  /** Estado de la suscripción de pago (o `none` si nunca pagó). */
  status: SubStatus;
  billing?: Billing;
  /** Próximo cobro (si renueva). ISO. */
  renewsAt?: string;
  /** Fin del acceso pagado (si se canceló o falló el pago). ISO. */
  endsAt?: string;
  /** Vencimiento de la cortesía vigente. ISO. */
  compEndsAt?: string;
  /** ¿El plan viene de una suscripción de ONVO (vs. cortesía, staff o asignado a mano)? */
  fromSubscription: boolean;
};

export type SubscriptionRow = {
  id: number;
  user_id: string;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  status: string;
  price_id: string | null;
  plan: PlanId | null;
  billing: Billing | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
};

export type CompRow = { plan: string; previous_plan: string | null; starts_at: string; expires_at: string; revoked_at: string | null; created_at: string };

const DEMO_ENT: Entitlements = { plan: "completo", access: "demo", app: true, nutrition: true, locked: false, trial: null, status: "demo", fromSubscription: false };
const DAY = 864e5;

/** Plan del perfil → plan de producto (`pro` histórico = completo). */
function profilePlan(p: string | null | undefined): PlanId | "free" {
  if (p === "entreno" || p === "completo") return p;
  if (p === "pro") return "completo";
  return "free";
}
const rank = (p: PlanId | "free") => (p === "completo" ? 2 : p === "entreno" ? 1 : 0);

/** Suscripción más relevante del usuario: la vigente si existe; si no, la más reciente con pago. */
export function pickCurrent(rows: SubscriptionRow[], now = new Date()): SubscriptionRow | null {
  const paidish = rows.filter((r) => r.status !== "incomplete");
  const live = paidish.filter((r) => profilePlanFor(r, now) !== "free");
  const byEnd = (a: SubscriptionRow, b: SubscriptionRow) => (b.current_period_end ?? "").localeCompare(a.current_period_end ?? "");
  return live.sort(byEnd)[0] ?? paidish.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

const compLive = (c: CompRow, now: Date) => !c.revoked_at && Date.parse(c.starts_at) <= now.getTime() && Date.parse(c.expires_at) > now.getTime();

export type AccessInput = {
  /** profiles.plan (lo sincronizan el webhook y las cortesías). */
  profilePlan: string | null | undefined;
  role: Role | string | null | undefined;
  /** profiles.created_at: inicio de la prueba gratis. */
  createdAt: string | null | undefined;
  subs: SubscriptionRow[];
  comps?: CompRow[];
  now?: Date;
  /** Fin del período de prueba del servicio (por defecto BETA_ENDS_AT). */
  betaEndsAt?: string;
};

/** Regla de acceso, pura y testeada. */
export function entitlementsFrom(i: AccessInput): Entitlements {
  const now = i.now ?? new Date();
  const comps = i.comps ?? [];

  // 1) Suscripción de pago.
  const cur = pickCurrent(i.subs, now);
  let subPlan: PlanId | "free" = "free";
  let status: SubStatus = "none";
  let billing: Billing | undefined, renewsAt: string | undefined, endsAt: string | undefined;
  if (cur) {
    subPlan = profilePlanFor(cur, now);
    billing = cur.billing ?? undefined;
    const end = cur.current_period_end ?? undefined;
    if (subPlan === "free") status = cur.status === "canceled" ? "canceled" : "expired";
    else if (cur.status === "canceled" || cur.cancel_at_period_end) status = "canceling";
    else status = (["active", "trialing", "past_due"].includes(cur.status) ? cur.status : "active") as SubStatus;
    renewsAt = status === "active" || status === "trialing" ? end : undefined;
    endsAt = status === "canceling" || status === "past_due" || status === "canceled" || status === "expired" ? end : undefined;
  }

  // 2) Cortesía vigente: completo (política del dueño).
  const comp = comps.filter((c) => compLive(c, now)).sort((a, b) => b.expires_at.localeCompare(a.expires_at))[0];
  const compPlan: PlanId | "free" = comp ? "completo" : "free";

  // 3) Staff: completo.
  const staffPlan: PlanId | "free" = STAFF.includes(i.role as Role) ? "completo" : "free";

  // 4) Plan asignado a mano (sin suscripciones). Si hubo cortesías ya vencidas, el perfil puede tener el plan
  //    de la cortesía sin restaurar (cron atrasado): entonces vale el plan previo a la última cortesía.
  let manualPlan: PlanId | "free" = "free";
  if (!i.subs.length && !comp) {
    const lastComp = [...comps].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    manualPlan = profilePlan(lastComp ? lastComp.previous_plan : i.profilePlan);
  }

  const candidates: [PlanId | "free", AccessSource][] = [[subPlan, "subscription"], [compPlan, "comp"], [staffPlan, "staff"], [manualPlan, "manual"]];
  const [plan, source] = candidates.reduce((best, c) => (rank(c[0]) > rank(best[0]) ? c : best), ["free", "none"] as [PlanId | "free", AccessSource]);

  const created = i.createdAt ? Date.parse(i.createdAt) : NaN;
  const ownEnd = Number.isFinite(created) ? created + TRIAL_DAYS * DAY : NaN;
  const betaEnd = Date.parse(i.betaEndsAt ?? BETA_ENDS_AT);
  // Durante la beta nadie se bloquea: la prueba dura al menos hasta que termina la beta.
  const beta = Number.isFinite(betaEnd) && betaEnd > now.getTime() && !(ownEnd > betaEnd);
  const trialEnd = beta ? new Date(betaEnd) : Number.isFinite(ownEnd) ? new Date(ownEnd) : null;
  const trialLive = !!trialEnd && trialEnd.getTime() > now.getTime();
  const base = { status, billing, renewsAt, endsAt, compEndsAt: comp?.expires_at, trialEndsAt: trialEnd?.toISOString(), fromSubscription: source === "subscription" };

  if (plan !== "free") return { ...base, plan, access: source, app: true, nutrition: plan === "completo", locked: false, trial: null };
  if (trialLive) {
    const daysLeft = Math.max(1, Math.ceil((trialEnd!.getTime() - now.getTime()) / DAY));
    return { ...base, plan: "free", access: "trial", app: true, nutrition: true, locked: false, trial: { endsAt: trialEnd!.toISOString(), daysLeft, ...(beta ? { beta: true } : {}) } };
  }
  return { ...base, plan: "free", access: "none", app: false, nutrition: false, locked: true, trial: null };
}

/** Lee las suscripciones del usuario (RLS: solo las propias). */
export async function getSubscriptions(userId: string): Promise<SubscriptionRow[]> {
  const sb = await createClient();
  const { data } = await sb
    .from("subscriptions")
    .select("id,user_id,provider_customer_id,provider_subscription_id,status,price_id,plan,billing,cancel_at_period_end,canceled_at,current_period_start,current_period_end,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data as SubscriptionRow[] | null) ?? [];
}

/** Una sola lectura por request (layout + página piden lo mismo). */
const load = cache(async (userId: string, role: string, viewerPlan: string): Promise<Entitlements> => {
  const sb = await createClient();
  const [rows, prof, comps] = await Promise.all([
    getSubscriptions(userId),
    sb.from("profiles").select("created_at").eq("id", userId).maybeSingle(),
    sb.from("comp_grants").select("plan,previous_plan,starts_at,expires_at,revoked_at,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
  ]);
  const ent = entitlementsFrom({ profilePlan: viewerPlan, role, createdAt: (prof.data?.created_at as string | undefined) ?? null, subs: rows, comps: (comps.data as CompRow[] | null) ?? [] });
  // Suscripción vencida y el perfil aún dice plan pagado: lo bajamos a `free` (nunca sube: eso solo lo hace el webhook).
  if (ent.access !== "comp" && ent.access !== "staff" && rows.length && pickCurrent(rows) && profilePlanFor(pickCurrent(rows)!) === "free" && (viewerPlan === "entreno" || viewerPlan === "completo")) {
    const admin = adminClient();
    if (admin) {
      await admin.from("profiles").update({ plan: "free" }).eq("id", userId).then(({ error }) => {
        if (error) console.error("[pagos] no se pudo bajar el plan vencido", userId, error.message);
        else console.info("[pagos] plan vencido → free", userId);
      });
    }
  }
  return ent;
});

/** Derechos del usuario. En modo demo: acceso completo. */
export async function getEntitlements(viewer: Viewer): Promise<Entitlements> {
  if (viewer.demo) return DEMO_ENT;
  return load(viewer.id, viewer.role, viewer.plan);
}
