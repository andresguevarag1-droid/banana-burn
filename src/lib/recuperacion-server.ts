// Aviso de recuperación dentro de la app (recuperacion.ts): ¿se le muestra a quien mira? Se revalida en cada carga, así que
// desaparece solo al pagar, al recibir una cortesía o al guardar una tarjeta. Lecturas con la sesión propia (RLS).
import "server-only";
import { createClient, STAFF, type Viewer } from "@/lib/supabase/server";
import type { Entitlements } from "@/lib/entitlements";
import { getMyTesterRows } from "@/lib/testers-server";
import { recoveryEligible } from "@/lib/recuperacion";

export async function getRecoveryNotice(v: Viewer, ent: Entitlements): Promise<boolean> {
  // Solo con el muro de planes y sin cobro: lo demás ya tiene acceso o su propio aviso de cobro.
  if (v.demo || !ent.locked || ent.charge || STAFF.includes(v.role)) return false;
  try {
    const sb = await createClient();
    const [prof, subs, comps, charges, testers] = await Promise.all([
      sb.from("profiles").select("created_at").eq("id", v.id).maybeSingle(),
      sb.from("subscriptions").select("status").eq("user_id", v.id).limit(20),
      sb.from("comp_grants").select("revoked_at").eq("user_id", v.id).limit(30),
      sb.from("trial_charges").select("id").eq("user_id", v.id).limit(1),
      getMyTesterRows(v),
    ]);
    if (prof.error || subs.error || comps.error || charges.error) return false;
    return recoveryEligible({
      createdAt: (prof.data?.created_at as string | undefined) ?? null, profilePlan: v.plan, staff: false,
      paid: (subs.data ?? []).some((r) => r.status !== "incomplete"),
      comp: (comps.data ?? []).some((r) => !r.revoked_at),
      tester: testers.some((r) => !r.revoked_at),
      hasCharge: (charges.data ?? []).length > 0,
    });
  } catch {
    return false;
  }
}
