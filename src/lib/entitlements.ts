// Qué puede usar cada usuario según su suscripción. Úsalo SOLO en código de servidor.
import "server-only";
import { createClient, type Viewer } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { hasNutrition, type Billing, type PlanId } from "@/lib/plans";
import { profilePlanFor } from "@/lib/onvo";

export type SubStatus = "demo" | "none" | "incomplete" | "active" | "trialing" | "past_due" | "canceling" | "canceled" | "expired";

export type Entitlements = {
  /** Plan efectivo hoy. `free` = sin suscripción de pago (beta). */
  plan: PlanId | "free";
  /** ¿Puede usar nutrición? Respeta la regla de beta de plans.ts (`hasNutrition`). */
  nutrition: boolean;
  status: SubStatus;
  billing?: Billing;
  /** Próximo cobro (si renueva). ISO. */
  renewsAt?: string;
  /** Fin del acceso (si se canceló o falló el pago). ISO. */
  endsAt?: string;
  trialEndsAt?: string;
  /** ¿El plan viene de una suscripción de ONVO (vs. asignado a mano por un admin)? */
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

const DEMO_ENT: Entitlements = { plan: "completo", nutrition: true, status: "demo", fromSubscription: false };

/** Plan del perfil → plan de producto (`pro` histórico = completo). */
function profilePlan(p: string): PlanId | "free" {
  if (p === "entreno" || p === "completo") return p;
  if (p === "pro") return "completo";
  return "free";
}

/** Suscripción más relevante del usuario: la vigente si existe; si no, la más reciente con pago. */
export function pickCurrent(rows: SubscriptionRow[], now = new Date()): SubscriptionRow | null {
  const paidish = rows.filter((r) => r.status !== "incomplete");
  const live = paidish.filter((r) => profilePlanFor(r, now) !== "free");
  const byEnd = (a: SubscriptionRow, b: SubscriptionRow) => (b.current_period_end ?? "").localeCompare(a.current_period_end ?? "");
  return live.sort(byEnd)[0] ?? paidish.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

export function entitlementsFrom(viewerPlan: string, rows: SubscriptionRow[], now = new Date()): Entitlements {
  const cur = pickCurrent(rows, now);
  if (!cur) {
    // Sin suscripciones: respetamos el plan asignado a mano (cuentas cortesía, staff).
    const plan = profilePlan(viewerPlan);
    return { plan, nutrition: hasNutrition(plan), status: plan === "free" ? "none" : "active", fromSubscription: false };
  }
  const plan = profilePlanFor(cur, now);
  const billing = cur.billing ?? undefined;
  const end = cur.current_period_end ?? undefined;
  let status: SubStatus;
  if (plan === "free") status = cur.status === "canceled" ? "canceled" : "expired";
  else if (cur.status === "canceled" || cur.cancel_at_period_end) status = "canceling";
  else status = (cur.status as SubStatus) ?? "active";
  return {
    plan,
    nutrition: hasNutrition(plan),
    status,
    billing,
    renewsAt: status === "active" || status === "trialing" ? end : undefined,
    endsAt: status === "canceling" || status === "past_due" || status === "canceled" || status === "expired" ? end : undefined,
    trialEndsAt: status === "trialing" ? end : undefined,
    fromSubscription: true,
  };
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

/**
 * Derechos del usuario. En modo demo: acceso completo.
 * Si una suscripción venció y el perfil aún dice plan pagado, lo baja a `free` (nunca sube: eso solo lo hace el webhook).
 */
export async function getEntitlements(viewer: Viewer): Promise<Entitlements> {
  if (viewer.demo) return DEMO_ENT;
  const rows = await getSubscriptions(viewer.id);
  const ent = entitlementsFrom(viewer.plan, rows);
  if (ent.fromSubscription && ent.plan === "free" && (viewer.plan === "entreno" || viewer.plan === "completo")) {
    const admin = adminClient();
    if (admin) {
      await admin.from("profiles").update({ plan: "free" }).eq("id", viewer.id).then(({ error }) => {
        if (error) console.error("[pagos] no se pudo bajar el plan vencido", viewer.id, error.message);
        else console.info("[pagos] plan vencido → free", viewer.id);
      });
    }
  }
  return ent;
}
