// Formato del panel en español de Costa Rica. Fuente única para páginas, acciones y exportaciones.
import { usd } from "./plans";

const TZ = "America/Costa_Rica";

/** Marcador de celda vacía (sin raya larga). */
export const EMPTY = "-";

const toDate = (s: string) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00-06:00` : s);

/** "21 oct 2026" */
export const fmtDate = (s?: string | null) =>
  s ? toDate(s).toLocaleDateString("es-419", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }) : EMPTY;

/** "21 oct" (para ejes y series cortas). */
export const fmtDay = (s?: string | null) => (s ? toDate(s).toLocaleDateString("es-419", { day: "numeric", month: "short", timeZone: TZ }) : EMPTY);

/** "21 oct 2026, 08:12 a. m." */
export const fmtDateTime = (s?: string | null) =>
  s ? toDate(s).toLocaleString("es-419", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ }) : EMPTY;

const NUM = new Intl.NumberFormat("es-419", { maximumFractionDigits: 1 });
/** Número con separadores de es-CR ("1 324", "33,3"). */
export const fmtNum = (n: number) => NUM.format(n);
/** Porcentaje ya calculado (0 a 100): "33,3 %". */
export const fmtPct = (n: number) => `${NUM.format(n)} %`;

/** Montos en USD con el mismo formato que el resto de la app (usd() de plans.ts). */
export const money = (n: number) => usd(Math.round(n * 100) / 100);

// ─────────── Auditoría: etiquetas para personas ───────────

/** Nombre humano de cada acción auditada. */
export const ACTION_LABEL: Record<string, string> = {
  "user.role_change": "Cambio de rol",
  "user.comp_grant": "Cortesía otorgada",
  "user.comp_revoke": "Cortesía revocada",
  "user.comp_expire": "Cortesía vencida",
  "user.gift": "Meses regalados",
  "user.tester_grant": "Tester de la beta asignado",
  "user.tester_revoke": "Tester de la beta quitado",
  "feedback.status": "Reporte de la app actualizado",
  "support.reply": "Soporte: respuesta a la persona",
  "support.note": "Soporte: nota interna",
  "support.update": "Soporte: estado, prioridad o asignación",
  "support.file_view": "Soporte: captura vista",
  "referral.reward_revoke": "Recompensa de referidos revocada",
  "referral.approve": "Referido aprobado",
  "referral.reject": "Referido descartado",
  "user.onboarding_reset": "Bienvenida reiniciada",
  "user.suspend": "Usuario suspendido",
  "user.unsuspend": "Usuario reactivado",
  "user.delete": "Cuenta borrada",
  "user.delete_failed": "Borrado de cuenta fallido",
  "food.create": "Alimento creado",
  "food.update": "Alimento editado",
  "food.delete": "Alimento eliminado",
  "food.seed": "Base de alimentos cargada",
  "exercise.update": "Ejercicio editado",
  "exercise.reset": "Ejercicio restaurado",
  "challenge.create": "Reto creado",
  "challenge.update": "Reto editado",
  "challenge.delete": "Reto eliminado",
  "challenge.status": "Estado de reto cambiado",
  "challenge.duplicate": "Reto duplicado",
  "challenge.reorder": "Orden de retos cambiado",
  "challenge.grant": "Reto regalado (cortesía)",
  "announcement.create": "Anuncio creado",
  "announcement.update": "Anuncio editado",
  "announcement.delete": "Anuncio eliminado",
  "report.hide": "Contenido ocultado",
  "report.resolve": "Reporte resuelto",
  "report.dismiss": "Reporte descartado",
  "report.reopen": "Reporte reabierto",
  "identity.view": "Fotos de identidad abiertas",
  "identity.approve": "Identidad aprobada",
  "identity.reject": "Identidad rechazada",
  "identity.withdraw": "Verificación retirada por la persona",
  "user.profile_update": "Nombre o país editado",
  "user.email_change": "Correo cambiado",
  "user.email_change_requested": "Cambio de correo enviado a confirmar",
  "user.access_email": "Correo de acceso enviado",
  "user.sign_out_all": "Sesiones cerradas",
  "user.block": "Cuenta bloqueada",
  "user.unblock": "Cuenta desbloqueada",
  "user.auth_ban": "Inicio de sesión bloqueado",
  "user.auth_unban": "Inicio de sesión desbloqueado",
  "user.ban_failed": "Bloqueo del inicio de sesión fallido",
  "user.renewal_cancel": "Renovación cancelada",
  "user.charge_cancel": "Cobro programado cancelado",
  "challenge.revoke": "Acceso a reto o temporada quitado",
  "challenge.reset": "Progreso de reto reiniciado",
  "season.intake_reset": "Cuestionario de temporada reiniciado",
  "badge.set": "Insignia cambiada a mano",
  "xp.adjust": "XP ajustado",
};
const GROUP_LABEL: Record<string, string> = { referral: "Referidos", user: "Usuarios", food: "Alimentos", exercise: "Ejercicios", challenge: "Retos", announcement: "Anuncios", report: "Moderación", identity: "Verificación", season: "Temporadas", badge: "Insignias", xp: "XP" };
export const actionLabel = (a: string) => ACTION_LABEL[a] ?? a.replace(/[._]/g, " ");
export const actionGroupLabel = (prefix: string) => GROUP_LABEL[prefix] ?? prefix;

/** Claves del detalle (meta) en español. */
const META_LABEL: Record<string, string> = {
  from: "De", to: "A", de: "De", a: "A", reason: "Motivo", motivo: "Motivo", plan: "Plan", previous_plan: "Plan anterior", restored_plan: "Plan restaurado",
  expires_at: "Vence", vence: "Vence", grant: "Cortesía", title: "Título", titulo: "Título", slug: "Identificador", active: "Activo", days: "Días",
  audience: "Audiencia", name: "Nombre", nombre: "Nombre", enabled: "Habilitado", habilitado: "Habilitado", verified: "Verificado", verificado: "Verificado",
  months: "Meses", starts_at: "Empieza", message: "Con mensaje", reward: "Recompensa", group: "Grupo", referral: "Referido", flag: "Señal",
  target_type: "Tipo", tipo: "Tipo", target_id: "Contenido", id: "Contenido", note: "Nota", count: "Cantidad", role: "Rol", step: "Paso", cues: "Claves", doc_type: "Documento", country: "País", status: "Estado",
  before: "Antes", after: "Después", full_name: "Nombre", email: "Correo", pending_email: "Correo por confirmar", delta: "XP", xp: "XP", badge: "Insignia",
  override: "A mano", challenge: "Reto", season: "Temporada", source: "Origen", mode: "Modo", kind: "Tipo", sessions: "Sesiones", sessions_closed: "Sesiones cerradas",
  blocked: "Bloqueada", blocked_at: "Bloqueada desde", renews: "Se renueva", access_until: "Acceso hasta", charge: "Cobro", access: "Acceso", sent: "Correo enviado",
};
const VALUE_LABEL: Record<string, string> = {
  free: "Usuario", pro: "Usuario con plan", coach: "Coach", support: "Soporte", admin: "Admin", superadmin: "Superadmin",
  entreno: "Entreno", completo: "Entreno + Nutrición", post: "Publicación", comment: "Comentario", user: "Perfil",
  todos: "Todos", pago: "Planes de pago", staff: "Solo staff", subscriptions: "Cancelar cobros", photos: "Borrar fotos", auth: "Borrar cuenta",
};
const ISO_TS = /^\d{4}-\d{2}-\d{2}(T[\d:.]+([+-]\d{2}:?\d{2}|Z)?)?$/;

/** Valor del detalle legible: Sí/No, fechas, roles y planes con nombre. */
export function metaValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return EMPTY;
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "number") return fmtNum(v);
  if (typeof v === "string") return VALUE_LABEL[v] ?? (ISO_TS.test(v) ? fmtDate(v) : v);
  if (Array.isArray(v)) return v.map(metaValue).join(", ");
  // Antes y después (0056): "Nombre Ana, País CR".
  if (typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${metaKey(k)} ${metaValue(x)}`).join(", ") || EMPTY;
  return JSON.stringify(v);
}
export const metaKey = (k: string) => META_LABEL[k] ?? k.replace(/_/g, " ");
