// Matriz de permisos del panel de staff. Fuente única para UI (qué se muestra) y servidor (qué se permite).
// La base de datos repite estas reglas con RLS y funciones SECURITY DEFINER (0005_admin.sql): nunca confiamos en el cliente.
import type { Role } from "@/lib/supabase/server";

export const ROLES: Role[] = ["free", "pro", "coach", "support", "admin", "superadmin"];
export const STAFF_ROLES: Role[] = ["coach", "support", "admin", "superadmin"];
export const PRIVILEGED: Role[] = ["admin", "superadmin"];

export const ROLE_LABEL: Record<Role, string> = {
  free: "Usuario", pro: "Usuario con plan", coach: "Coach", support: "Soporte", admin: "Admin", superadmin: "Superadmin",
};

export type Capability =
  | "users.view"          // lista y ficha de cuenta (nombre, correo, rol, plan, alta)
  | "users.health"        // tendencia de peso, meta, tipo de objetivo
  | "users.activity"      // entrenos, última actividad detallada
  | "users.billing"       // suscripciones y cortesías del usuario
  | "users.role"          // cambiar rol (con reglas extra, ver checkRoleChange)
  | "users.comp"          // regalar plan de cortesía con vencimiento
  | "users.gift"          // regalar meses (se apilan, con aviso, correo y push). Solo admin: es una decisión de ingresos
  | "users.tester"        // hacer tester de la beta por 1 mes (o quitarlo). No es un rol de staff: no da permisos del panel
  | "feedback.manage"     // marcar como visto o resuelto lo que reportan desde la app
  | "referrals.view"      // referidos de un usuario, recompensas y conteos
  | "referrals.manage"    // revocar recompensas por fraude y revisar referidos "en revisión"
  | "users.onboarding"    // reiniciar la bienvenida
  | "users.suspend"       // pausar a un usuario en la comunidad (no puede publicar ni comentar)
  | "users.delete"        // borrar una cuenta (misma secuencia que el borrado por el usuario)
  | "users.verify"        // revisar verificaciones de identidad (fotos con enlaces de 60 s, auditadas) y aprobar o rechazar
  | "metrics.revenue"     // MRR, conversión y churn en el resumen
  | "payments.view"
  | "content.exercises"
  | "content.challenges"   // crear, editar, ocultar, ordenar y publicar retos de la tienda
  | "challenges.sales"     // compras e ingresos por reto, lista de compradores
  | "challenges.grant"     // regalar un reto de pago (cortesía, auditada)
  | "content.foods"
  | "content.announcements"
  | "community.moderate"
  | "audit.view";

const ALL_STAFF = STAFF_ROLES;
const COACH_ADMIN: Role[] = ["coach", "admin", "superadmin"];
const SUPPORT_ADMIN: Role[] = ["support", "admin", "superadmin"];

export const MATRIX: Record<Capability, Role[]> = {
  "users.view": ALL_STAFF,
  "users.health": COACH_ADMIN,
  "users.activity": COACH_ADMIN,
  "users.billing": SUPPORT_ADMIN,
  "users.role": PRIVILEGED,
  "users.comp": SUPPORT_ADMIN,
  "users.gift": PRIVILEGED,
  "users.tester": PRIVILEGED,
  "feedback.manage": SUPPORT_ADMIN,
  "referrals.view": SUPPORT_ADMIN,
  "referrals.manage": PRIVILEGED,
  "users.onboarding": SUPPORT_ADMIN,
  "users.suspend": SUPPORT_ADMIN,
  "users.delete": PRIVILEGED,
  "users.verify": SUPPORT_ADMIN, // igual que public.is_billing_staff() en admin_identity_* (0030)
  "metrics.revenue": PRIVILEGED,
  "payments.view": SUPPORT_ADMIN,
  "content.exercises": COACH_ADMIN,
  "content.challenges": COACH_ADMIN,
  "challenges.sales": SUPPORT_ADMIN,
  "challenges.grant": SUPPORT_ADMIN,
  "content.foods": COACH_ADMIN,
  "content.announcements": PRIVILEGED,
  "community.moderate": ALL_STAFF,
  "audit.view": PRIVILEGED,
};

export function can(role: Role | null | undefined, cap: Capability): boolean {
  return !!role && MATRIX[cap].includes(role);
}

export type Section = "resumen" | "usuarios" | "pagos" | "contenido" | "retos" | "comunidad" | "verificaciones" | "auditoria";

/** Una sección es visible si el rol tiene al menos una de sus capacidades. */
export const SECTION_CAPS: Record<Section, Capability[]> = {
  resumen: ["users.view"],
  usuarios: ["users.view"],
  pagos: ["payments.view"],
  contenido: ["content.exercises", "content.foods", "content.announcements"],
  retos: ["content.challenges"],
  comunidad: ["community.moderate"],
  verificaciones: ["users.verify"],
  auditoria: ["audit.view"],
};

export function canSee(role: Role | null | undefined, section: Section): boolean {
  return SECTION_CAPS[section].some((c) => can(role, c));
}

export const isStaff = (role: Role | null | undefined) => !!role && STAFF_ROLES.includes(role);

/** Roles que el actor puede asignar. Solo superadmin otorga admin/superadmin. */
export function assignableRoles(actor: Role): Role[] {
  if (actor === "superadmin") return ROLES;
  if (actor === "admin") return ["free", "pro", "coach", "support"];
  return [];
}

export type RoleChange = { actorId: string; actorRole: Role; targetId: string; targetRole: Role; newRole: Role };

/** Reglas de cambio de rol (espejo de public.admin_set_role). */
export function checkRoleChange(c: RoleChange): { ok: true } | { ok: false; error: string } {
  if (!ROLES.includes(c.newRole)) return { ok: false, error: "Rol inválido." };
  if (!can(c.actorRole, "users.role")) return { ok: false, error: "Tu rol no puede cambiar roles." };
  if (c.actorId === c.targetId) return { ok: false, error: "No puedes cambiar tu propio rol." };
  if (c.newRole === c.targetRole) return { ok: false, error: "El usuario ya tiene ese rol." };
  if (c.actorRole !== "superadmin" && (PRIVILEGED.includes(c.newRole) || PRIVILEGED.includes(c.targetRole)))
    return { ok: false, error: "Solo un superadmin puede otorgar o quitar roles admin/superadmin." };
  if (!assignableRoles(c.actorRole).includes(c.newRole)) return { ok: false, error: "No puedes asignar ese rol." };
  return { ok: true };
}
