// Qué puede usar cada usuario. Úsalo SOLO en código de servidor.
// Política (decidida por el dueño):
//   - Hasta BETA_ENDS_AT (1 nov 2026, beta): todo gratis para todos, sin tarjeta.
//   - Desde BETA_ENDS_AT: prueba gratis de TRIAL_DAYS días con TODO incluido, SOLO para cuentas nuevas y con la tarjeta
//     guardada en ONVO; el día 7 se cobra el plan elegido (trial.ts, trial-billing.ts, 0026). Las cuentas de la beta no
//     tienen días extra: muro hasta que guardan tarjeta y pagan.
//   - Después: plan "entreno" = entreno, coach, comunidad, retos y progreso; plan "completo" = todo (incluye nutrición y Banana Shield).
//   - Cortesías vigentes (source 'cortesia') y staff = completo.
//   - Regalos de meses (source 'regalo' o 'referido', 0025): respetan su plan y se apilan (empiezan al terminar lo que ya había).
//   - Sin plan y sin prueba vigente: la app muestra el muro de planes (no se borra nada).
// La base de datos repite la regla de acceso en public.has_app_access() (0013/0021) para el coach y la comunidad,
// y la de nutrición en public.has_nutrition_access() (0022) para comidas, Mis comidas y Mis recetas.
import "server-only";
import { logError } from "@/lib/log";
import { cache } from "react";
import { createClient, STAFF, type Role, type Viewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { BETA_ENDS_AT, type Billing, type PlanId } from "@/lib/plans";
import { profilePlanFor } from "@/lib/onvo";
import { APP_LOCKED_MSG, NUTRITION_LOCKED_MSG, type Need } from "@/lib/plan-access";
import { bestLiveComp, compChainEnd, compPlan } from "@/lib/gifts";
import { cardStepFor, chargeView, signedUpInBeta, trialLive, type CardRow, type CardStep, type ChargeView, type TrialChargeRow } from "@/lib/trial";

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
  /** Fin del acceso continuo por cortesías y regalos (incluye regalos apilados que siguen). ISO. */
  compEndsAt?: string;
  /** ¿El plan viene de una suscripción de ONVO (vs. cortesía, staff o asignado a mano)? */
  fromSubscription: boolean;
  /** Primer cobro con la tarjeta guardada (prueba de 7 días, fin de la beta o inmediato). */
  charge?: ChargeView | null;
  /** Tarjeta guardada (solo marca, últimos 4 y vencimiento). */
  card?: { brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null; active: boolean } | null;
  /** Qué ofrece la pantalla para agregar tarjeta (trial.ts). */
  cardStep?: CardStep;
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

/** `source`: 'cortesia' (panel, vale como completo), 'regalo' o 'referido' (respetan su plan). Sin 0025 no viene: cortesía. */
export type CompRow = { plan: string; previous_plan: string | null; starts_at: string; expires_at: string; revoked_at: string | null; created_at: string; source?: string | null };

const DEMO_ENT: Entitlements = { plan: "completo", access: "demo", app: true, nutrition: true, locked: false, trial: null, status: "demo", fromSubscription: false, charge: null, card: null, cardStep: "none" };
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
  /** Primer cobro programado (public.trial_charges, 0026). */
  trialCharge?: TrialChargeRow | null;
  /** Tarjeta guardada (public.payment_methods, 0026). */
  card?: CardRow | null;
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

  // 2) Cortesía o regalo vigente: la cortesía vale como completo (política del dueño); un regalo, según su plan.
  const comp = bestLiveComp(comps.filter((c) => compLive(c, now)), now);
  const giftPlan: PlanId | "free" = comp ? compPlan(comp) : "free";

  // 3) Staff: completo.
  const staffPlan: PlanId | "free" = STAFF.includes(i.role as Role) ? "completo" : "free";

  // 4) Plan asignado a mano (sin suscripciones). Si hubo cortesías ya vencidas, el perfil puede tener el plan
  //    de la cortesía sin restaurar (cron atrasado): entonces vale el plan previo a la última cortesía.
  let manualPlan: PlanId | "free" = "free";
  if (!i.subs.length && !comp) {
    const lastComp = [...comps].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    manualPlan = profilePlan(lastComp ? lastComp.previous_plan : i.profilePlan);
  }

  const candidates: [PlanId | "free", AccessSource][] = [[subPlan, "subscription"], [giftPlan, "comp"], [staffPlan, "staff"], [manualPlan, "manual"]];
  const [plan, source] = candidates.reduce((best, c) => (rank(c[0]) > rank(best[0]) ? c : best), ["free", "none"] as [PlanId | "free", AccessSource]);

  const betaEndsAt = i.betaEndsAt ?? BETA_ENDS_AT;
  const betaEnd = Date.parse(betaEndsAt);
  const tc = i.trialCharge ?? null;
  // Durante la beta nadie se bloquea. Después, la prueba de 7 días es la de la tarjeta guardada (cuentas nuevas).
  const beta = Number.isFinite(betaEnd) && betaEnd > now.getTime();
  const cardTrial = !beta && trialLive(tc, i.card, i.createdAt, now, betaEndsAt);
  const trialEnd = beta ? new Date(betaEnd) : cardTrial ? new Date(tc!.trial_ends_at) : null;
  const live = !!trialEnd && trialEnd.getTime() > now.getTime();
  // Para el muro: cuándo terminó el acceso gratis (la prueba con tarjeta, o la beta para las cuentas de la beta).
  const endedAt = trialEnd ?? (tc?.kind === "prueba" ? new Date(tc.trial_ends_at) : signedUpInBeta(i.createdAt, betaEndsAt) && Number.isFinite(betaEnd) ? new Date(betaEnd) : null);
  const charge = chargeView(tc, now);
  const card = i.card ? { brand: i.card.brand, last4: i.card.last4, expMonth: i.card.exp_month, expYear: i.card.exp_year, active: i.card.status === "active" } : null;
  const cardStep = cardStepFor({ paidAccess: plan !== "free", createdAt: i.createdAt, row: tc, now, betaEndsAt });
  const base = { status, billing, renewsAt, endsAt, compEndsAt: comp ? compChainEnd(comps, now) : undefined, trialEndsAt: endedAt?.toISOString(), fromSubscription: source === "subscription", charge, card, cardStep };

  if (plan !== "free") return { ...base, plan, access: source, app: true, nutrition: plan === "completo", locked: false, trial: null };
  if (live) {
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

const COMP_COLS = "plan,previous_plan,starts_at,expires_at,revoked_at,created_at";
const CHARGE_READ = "id,user_id,idem_key,kind,plan,billing,amount_minor,trial_started_at,trial_ends_at,charge_at,next_attempt_at,status,attempts,last_attempt_at,provider_subscription_id,last_error,reminder_sent_at,failure_notified_attempt,canceled_at,created_at,updated_at";

/** Cobro programado y tarjeta (RLS: solo lo propio; de la tarjeta solo marca, últimos 4 y vencimiento). Sin 0026: nada. */
async function loadCardTrial(sb: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<{ trialCharge: TrialChargeRow | null; card: CardRow | null }> {
  const [t, c] = await Promise.all([
    sb.from("trial_charges").select(CHARGE_READ).eq("user_id", userId).maybeSingle(),
    sb.from("payment_methods").select("brand,last4,exp_month,exp_year,status").eq("user_id", userId).maybeSingle(),
  ]);
  return { trialCharge: t.error ? null : ((t.data as TrialChargeRow | null) ?? null), card: c.error ? null : ((c.data as CardRow | null) ?? null) };
}

/** Cortesías y regalos del usuario (RLS: solo los propios). Sin 0025 (no existe `source`) lee las columnas de antes. */
async function loadComps(sb: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<CompRow[]> {
  const q = (cols: string) => sb.from("comp_grants").select(cols).eq("user_id", userId).order("created_at", { ascending: false }).limit(30);
  const first = await q(`${COMP_COLS},source`);
  if (!first.error) return (first.data as unknown as CompRow[] | null) ?? [];
  const legacy = await q(COMP_COLS);
  return (legacy.data as unknown as CompRow[] | null) ?? [];
}

/** Una sola lectura por request (layout + página piden lo mismo). */
const load = cache(async (userId: string, role: string, viewerPlan: string): Promise<Entitlements> => {
  const sb = await createClient();
  const [rows, prof, comps, ct] = await Promise.all([
    getSubscriptions(userId),
    sb.from("profiles").select("created_at").eq("id", userId).maybeSingle(),
    loadComps(sb, userId),
    loadCardTrial(sb, userId),
  ]);
  const ent = entitlementsFrom({ profilePlan: viewerPlan, role, createdAt: (prof.data?.created_at as string | undefined) ?? null, subs: rows, comps, ...ct });
  // Suscripción vencida y el perfil aún dice plan pagado: lo bajamos a `free` (nunca sube: eso solo lo hace el webhook).
  if (ent.access !== "comp" && ent.access !== "staff" && rows.length && pickCurrent(rows) && profilePlanFor(pickCurrent(rows)!) === "free" && (viewerPlan === "entreno" || viewerPlan === "completo")) {
    const admin = adminClient();
    if (admin) {
      await admin.from("profiles").update({ plan: "free" }).eq("id", userId).then(({ error }) => {
        if (error) logError("pagos", "downgrade_failed", { code: error.code });
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

/**
 * Candado de servidor para acciones: null si puede, o el mensaje para la persona.
 * `nutrition` = `ent.nutrition`; `app` = `ent.app`. En demo siempre puede (DEMO_ENT).
 */
export async function accessError(v: Viewer, need: Need): Promise<string | null> {
  const ent = await getEntitlements(v);
  if (need === "nutrition") return ent.nutrition ? null : ent.app ? NUTRITION_LOCKED_MSG : APP_LOCKED_MSG;
  return ent.app ? null : APP_LOCKED_MSG;
}
