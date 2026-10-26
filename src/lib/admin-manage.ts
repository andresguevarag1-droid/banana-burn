// Reglas puras del panel del superadmin para administrar cuentas (0056). Las repite la base en las RPC de 0056: el
// servidor valida aquí para dar un mensaje claro y la base vuelve a validar. Probado en admin-manage.test.ts.

export const NAME_MIN = 2;
export const NAME_MAX = 60;
export const XP_ADJUST_MAX = 20_000;
/** "Sin vencimiento" en el panel: 10 años, el tope de admin_grant_comp_long. */
export const COMP_FOREVER_DAYS = 3650;
export const COMP_MAX_DAYS = 3660;
const DAY = 864e5;

export type Check = { ok: true } | { ok: false; error: string };
const no = (error: string): Check => ({ ok: false, error });
const yes: Check = { ok: true };

const EMAIL = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[a-z]{2,}$/i;

/** Nombre visible: 2 a 60 caracteres, sin etiquetas. Devuelve el nombre limpio o un error. */
export function cleanName(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (value.length < NAME_MIN || value.length > NAME_MAX) return { ok: false, error: `El nombre va de ${NAME_MIN} a ${NAME_MAX} caracteres.` };
  if (/[<>]/.test(value)) return { ok: false, error: "El nombre tiene caracteres no permitidos." };
  return { ok: true, value };
}

/** Correo nuevo: válido, en minúsculas y distinto del actual. */
export function cleanEmail(raw: string, current: string | null): { ok: true; value: string } | { ok: false; error: string } {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!EMAIL.test(value) || value.length > 254) return { ok: false, error: "Ese correo no parece válido." };
  if (current && value === current.trim().toLowerCase()) return { ok: false, error: "Ese ya es el correo de la cuenta." };
  return { ok: true, value };
}

/** País: código ISO de 2 letras (CR, GT, CO...) o vacío para no cambiarlo. */
export function cleanCountry(raw: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const value = String(raw ?? "").trim().toUpperCase();
  if (!value) return { ok: true, value: null };
  return /^[A-Z]{2}$/.test(value) ? { ok: true, value } : { ok: false, error: "El país va como código de 2 letras (CR, GT, CO)." };
}

/** Acciones que el superadmin no se hace a sí mismo (bloquearse, cerrar sus sesiones, cambiarse el correo desde aquí). */
export type SelfAction = "block" | "signout" | "email" | "delete";
export function notSelf(actorId: string, targetId: string, what: SelfAction): Check {
  if (actorId !== targetId) return yes;
  return no({
    block: "No puedes bloquear tu propia cuenta.",
    signout: "Para cerrar tus sesiones usa Salir en tu perfil.",
    email: "Cambia tu propio correo desde tu perfil.",
    delete: "No puedes borrar tu propia cuenta desde el panel.",
  }[what]);
}

/** Ajuste de XP: entero distinto de 0, entre -20.000 y 20.000, y el total no queda bajo 0. */
export function checkXpDelta(delta: number, total: number): Check {
  if (!Number.isInteger(delta) || delta === 0) return no("Escribe un número entero distinto de 0.");
  if (Math.abs(delta) > XP_ADJUST_MAX) return no(`El ajuste va de -${XP_ADJUST_MAX.toLocaleString("es-419")} a ${XP_ADJUST_MAX.toLocaleString("es-419")} XP.`);
  if (total + delta < 0) return no(`El XP no puede quedar bajo 0 (tiene ${total.toLocaleString("es-419")}).`);
  return yes;
}

/** Duración de una cortesía: días rápidos, una fecha o "sin vencimiento" (10 años). Devuelve la fecha ISO de vencimiento. */
export type CompChoice = { kind: "dias"; days: number } | { kind: "fecha"; date: string } | { kind: "siempre" };
export function compExpiry(c: CompChoice, now = Date.now()): { ok: true; iso: string } | { ok: false; error: string } {
  let t: number;
  if (c.kind === "siempre") t = now + COMP_FOREVER_DAYS * DAY;
  else if (c.kind === "dias") {
    if (!Number.isInteger(c.days) || c.days < 1 || c.days > 366) return { ok: false, error: "Los días van de 1 a 366." };
    t = now + c.days * DAY;
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date)) return { ok: false, error: "Elige una fecha." };
    // Fin del día elegido, hora de Costa Rica (UTC-6).
    t = Date.parse(`${c.date}T23:59:59-06:00`);
    if (!Number.isFinite(t) || t <= now) return { ok: false, error: "El vencimiento debe ser una fecha futura." };
  }
  if (t > now + COMP_MAX_DAYS * DAY) return { ok: false, error: "Una cortesía puede durar máximo 10 años." };
  return { ok: true, iso: new Date(t).toISOString() };
}

/** Insignias que se cambian a mano (igual que _badge_manageable). Nivel y verificado salen del XP y de la identidad. */
export const MANUAL_BADGES: { id: string; label: string }[] = [
  { id: "racha7", label: "Racha de 7 días" },
  { id: "racha30", label: "Racha de 30 días" },
  { id: "coleccion", label: "Colección (3 Premium)" },
  { id: "tester", label: "Tester de la beta" },
  { id: "pr", label: "Récord personal" },
  { id: "w10", label: "10 entrenos" },
  { id: "w50", label: "50 entrenos" },
];
const SLUG = /^[a-z0-9-]{1,60}$/;
export function isManualBadge(id: string): boolean {
  if (MANUAL_BADGES.some((b) => b.id === id)) return true;
  const m = /^(prog|reto):(.+)$/.exec(id);
  return !!m && SLUG.test(m[2]);
}
export const badgeId = (kind: "programa" | "reto", slug: string) => `${kind === "programa" ? "prog" : "reto"}:${slug}`;

/** Nombre legible de una insignia para el panel. */
export function badgeLabel(id: string, label?: string | null, titles: Record<string, string> = {}): string {
  const fixed = MANUAL_BADGES.find((b) => b.id === id)?.label;
  if (fixed) return fixed;
  if (id === "nivel") return "Nivel";
  if (id === "verificado") return "Identidad verificada";
  const m = /^(prog|reto):(.+)$/.exec(id);
  if (m) return `${m[1] === "prog" ? "Certificado" : "Medalla"}: ${titles[m[2]] ?? label ?? m[2]}`;
  return label || id;
}

/** De dónde viene el acceso a un reto, programa o temporada. */
export const ACCESS_SOURCE_LABEL: Record<string, string> = { compra: "Compra", cortesia: "Cortesía", anual: "Incluida en el plan anual" };

/** Estados extra de la lista de usuarios (0056) además de los de siempre. */
export const EXTRA_USER_STATUS = [["prueba", "En prueba"], ["pagando", "Pagando"], ["beta", "Cuenta de la beta"], ["vencido", "Sin acceso"], ["bloqueado", "Bloqueados"]] as const;

/** Cómo se cambia el correo. */
export type EmailMode = "ahora" | "confirmar";
