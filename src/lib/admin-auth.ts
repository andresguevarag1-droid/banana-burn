// Guardas de acceso del panel (solo servidor). Toda página y acción del admin pasa por aquí.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getViewer, type Role, type Viewer } from "@/lib/supabase/server";
import { can, canSee, isStaff, STAFF_ROLES, type Capability, type Section } from "@/lib/admin-perms";

export const DEMO_ROLE_COOKIE = "bb_admin_demo_role";

/** Viewer del panel. En modo demo permite simular otro rol de staff (cookie) para revisar la matriz de permisos. */
export async function getAdminViewer(): Promise<Viewer | null> {
  const v = await getViewer();
  if (!v) return null;
  if (v.demo) {
    const r = (await cookies()).get(DEMO_ROLE_COOKIE)?.value as Role | undefined;
    if (r && STAFF_ROLES.includes(r)) return { ...v, role: r };
  }
  return v;
}

/** Para layouts/páginas: exige sesión de staff y acceso a la sección; si no, redirige. */
export async function requireSection(section: Section): Promise<Viewer> {
  const v = await getAdminViewer();
  if (!v) redirect("/entrar?next=/admin");
  if (!isStaff(v.role)) redirect("/app");
  if (!canSee(v.role, section)) redirect(`/admin?sin_acceso=${section}`);
  return v;
}

/** Para server actions: nunca redirige; devuelve el viewer o un error legible. */
export async function authorize(cap: Capability): Promise<{ ok: true; v: Viewer } | { ok: false; error: string }> {
  const v = await getAdminViewer();
  if (!v) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };
  if (!can(v.role, cap)) return { ok: false, error: "Tu rol no tiene permiso para esta acción." };
  return { ok: true, v };
}
