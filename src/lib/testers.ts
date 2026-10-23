// Testers de la beta: un mes de cortesía para quien ayuda a probar la app. Reglas puras, sin acceso a datos.
// La base de datos es la fuente de verdad (0029_testers.sql): public.tester_grants guarda cada asignación y el acceso
// sale de comp_grants (source 'tester', plan completo), así que _has_app_access y entitlements.ts ya lo cuentan.
//   - "Tester" no es un rol de staff: no da permisos del panel ni cambia profiles.role.
//   - Dura TESTER_DAYS días desde que se asigna. Asignar de nuevo renueva desde ahora (nunca recorta).
//   - Faltando TESTER_SOON_DAYS días, un aviso amable; al terminar, un agradecimiento y la persona vuelve a las reglas
//     normales (planes y prueba con tarjeta). Todo se calcula con la fecha: no depende de ningún proceso nocturno.

export const TESTER_DAYS = 30;
export const TESTER_SOON_DAYS = 3;
/** Días después del final en que Hoy sigue mostrando el agradecimiento. */
export const TESTER_THANKS_DAYS = 7;
/** El agradecimiento por correo y push solo sale si el mes terminó hace menos de esto (nada de avisos viejos). */
export const TESTER_ENDED_NOTICE_DAYS = 14;

const DAY = 864e5;

export type TesterGrantRow = {
  id: number; starts_at: string; expires_at: string; revoked_at: string | null;
  end_kind?: string | null; renewal?: boolean | null; seen_at?: string | null; notified_at?: string | null;
  soon_notified_at?: string | null; ended_notified_at?: string | null; created_at?: string | null;
};

export type TesterPhase = "activo" | "pronto" | "terminado" | "ninguno";

export type TesterState = {
  phase: TesterPhase;
  /** Fin del mes vigente (o del último, si ya terminó). ISO. */
  until: string | null;
  /** Inicio de la asignación vigente. ISO. */
  startsAt: string | null;
  /** Días que quedan (0 si ya no es tester). El último día cuenta como 1. */
  daysLeft: number;
  /** Fracción del mes ya usada (0 a 1), para la barra. */
  used: number;
  /** ¿Alguna vez fue tester? (medalla "Tester beta"). */
  ever: boolean;
  /** La asignación vigente es una renovación. */
  renewal: boolean;
  /** Asignación vigente que la persona aún no vio (ventana de bienvenida). */
  unseenId: number | null;
};

const live = (r: TesterGrantRow, t: number) => !r.revoked_at && Date.parse(r.starts_at) <= t && Date.parse(r.expires_at) > t;

/** Días que quedan hasta `until` (redondeo hacia arriba; 0 si ya pasó). */
export function testerDaysLeft(until: string | null | undefined, now = new Date()): number {
  if (!until) return 0;
  const ms = Date.parse(until) - now.getTime();
  return ms > 0 ? Math.ceil(ms / DAY) : 0;
}

/** Estado de tester de una persona a partir de sus asignaciones (las propias, por RLS). */
export function testerState(rows: TesterGrantRow[], now = new Date()): TesterState {
  const t = now.getTime();
  const ever = rows.length > 0;
  const cur = rows.filter((r) => live(r, t)).sort((a, b) => b.expires_at.localeCompare(a.expires_at))[0];
  if (cur) {
    const daysLeft = testerDaysLeft(cur.expires_at, now);
    const s = Date.parse(cur.starts_at), e = Date.parse(cur.expires_at);
    const used = Math.max(0, Math.min(1, (t - s) / Math.max(1, e - s)));
    return { phase: daysLeft <= TESTER_SOON_DAYS ? "pronto" : "activo", until: cur.expires_at, startsAt: cur.starts_at, daysLeft, used, ever, renewal: !!cur.renewal, unseenId: cur.seen_at ? null : cur.id };
  }
  // Terminó solo (no lo quitó un admin ni lo reemplazó una renovación): agradecimiento por unos días.
  const ended = rows.filter((r) => !r.revoked_at && Date.parse(r.expires_at) <= t).sort((a, b) => b.expires_at.localeCompare(a.expires_at))[0];
  if (ended && t - Date.parse(ended.expires_at) < TESTER_THANKS_DAYS * DAY)
    return { phase: "terminado", until: ended.expires_at, startsAt: ended.starts_at, daysLeft: 0, used: 1, ever, renewal: false, unseenId: null };
  return { phase: "ninguno", until: null, startsAt: null, daysLeft: 0, used: 0, ever, renewal: false, unseenId: null };
}

/** "30 días", "1 día", "Último día". */
export function daysLeftLabel(n: number): string {
  if (n <= 1) return "Último día";
  return `${n.toLocaleString("es-419")} días`;
}

export type TesterNotice = "asignado" | "pronto" | "terminado";

/**
 * Qué aviso le toca a una asignación (correo, push y campanita los manda el servidor una sola vez por etapa).
 * `otherLive`: la persona tiene otra asignación vigente (renovó): entonces no se le agradece el final de la anterior.
 */
export function testerNoticeDue(r: TesterGrantRow, now = new Date(), otherLive = false): TesterNotice | null {
  if (r.revoked_at) return null;
  const t = now.getTime(), s = Date.parse(r.starts_at), e = Date.parse(r.expires_at);
  if (e > t) {
    if (!r.notified_at) return "asignado";
    if (!r.soon_notified_at && e - t <= TESTER_SOON_DAYS * DAY && e - s > TESTER_SOON_DAYS * DAY) return "pronto";
    return null;
  }
  if (!r.ended_notified_at && !otherLive && t - e < TESTER_ENDED_NOTICE_DAYS * DAY) return "terminado";
  return null;
}

// ───────────── "Reportar algo" ─────────────

export const FEEDBACK_KINDS = [["error", "Algo falla"], ["idea", "Una idea"], ["otro", "Otra cosa"]] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number][0];
export const FEEDBACK_KIND_LABEL: Record<FeedbackKind, string> = Object.fromEntries(FEEDBACK_KINDS) as Record<FeedbackKind, string>;
export const FEEDBACK_MAX = 1000;
export const FEEDBACK_STATUS_LABEL: Record<string, string> = { nuevo: "Nuevo", visto: "Visto", resuelto: "Resuelto" };

/** Valida un reporte antes de mandarlo (la base repite las reglas). Devuelve el mensaje de error o null. */
export function feedbackError(kind: string, body: string): string | null {
  if (!FEEDBACK_KINDS.some(([k]) => k === kind)) return "Elige qué quieres contarnos.";
  const len = body.trim().length;
  if (len < 3) return "Cuéntanos un poco más.";
  if (len > FEEDBACK_MAX) return `Máximo ${FEEDBACK_MAX.toLocaleString("es-419")} caracteres.`;
  return null;
}

/** Ruta interna segura para guardar con el reporte (sin consulta ni fragmento). */
export function feedbackPage(p: string | null | undefined): string | null {
  if (!p) return null;
  const path = p.split(/[?#]/)[0];
  return /^\/[A-Za-z0-9/_-]{0,199}$/.test(path) ? path : null;
}

// ───────────── Demo ─────────────

/** Estados de ejemplo del demo (?tester=demo, ?tester=pronto, ?tester=fin). */
export function demoTesterRows(kind: string | null | undefined, now = new Date()): TesterGrantRow[] {
  const t = now.getTime();
  const iso = (d: number) => new Date(t + d * DAY).toISOString();
  if (kind === "demo") return [{ id: -1, starts_at: iso(-0.01), expires_at: iso(TESTER_DAYS - 0.01), revoked_at: null, seen_at: null }];
  if (kind === "activo") return [{ id: -1, starts_at: iso(-12), expires_at: iso(TESTER_DAYS - 12), revoked_at: null, seen_at: iso(-12) }];
  if (kind === "pronto") return [{ id: -1, starts_at: iso(-28), expires_at: iso(2), revoked_at: null, seen_at: iso(-28) }];
  if (kind === "fin") return [{ id: -1, starts_at: iso(-31), expires_at: iso(-1), revoked_at: null, seen_at: iso(-31) }];
  return [];
}
