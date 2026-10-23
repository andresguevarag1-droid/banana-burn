// Soporte: "Reportar un problema", casos y estados. Reglas puras, sin acceso a datos.
// La base de datos es la fuente de verdad (0034_soporte.sql): support_create_ticket, support_reply, support_user_action
// y las funciones admin_support_*. Esto es el espejo para pantallas, demo y pruebas.

export const SUPPORT_CATEGORIES = [
  ["app", "Error en la app"], ["pagos", "Pagos y cobros"], ["entreno", "Entrenamiento"], ["nutricion", "Nutrición"],
  ["comunidad", "Comunidad"], ["cuenta", "Cuenta"], ["otro", "Otro"],
] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number][0];
export const CATEGORY_LABEL = Object.fromEntries(SUPPORT_CATEGORIES) as Record<SupportCategory, string>;

export const SUPPORT_STATUSES = ["recibido", "en_proceso", "necesita_info", "resuelto", "cerrado"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];
export const STATUS_LABEL: Record<SupportStatus, string> = {
  recibido: "Recibido", en_proceso: "En proceso", necesita_info: "Necesitamos más información", resuelto: "Resuelto", cerrado: "Cerrado",
};
export const OPEN_STATUSES: SupportStatus[] = ["recibido", "en_proceso", "necesita_info"];

export const PRIORITIES = ["baja", "normal", "alta", "urgente"] as const;
export type SupportPriority = (typeof PRIORITIES)[number];
export const PRIORITY_LABEL: Record<SupportPriority, string> = { baja: "Baja", normal: "Normal", alta: "Alta", urgente: "Urgente" };

/** Límites (los mismos CHECK de 0034). */
export const TITLE_MIN = 4, TITLE_MAX = 120, BODY_MIN = 10, BODY_MAX = 4000, MESSAGE_MAX = 4000;
/** Captura: mismo tope y tipos que el bucket 'soporte'. */
export const SHOT_MAX_BYTES = 5 * 1024 * 1024;
export const SHOT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** Días para reabrir un caso resuelto o cerrado. */
export const REOPEN_DAYS = 7;
export const MAX_REOPENS = 3;
/** Horas sin primera respuesta del equipo para marcar el caso como atrasado. */
export const SLA_HOURS = 24;

const H = 3600e3;
const DAY = 24 * H;

export const ticketNumber = (id: number | string) => `BB-${String(id).padStart(5, "0")}`;
export const isOpen = (s: string) => (OPEN_STATUSES as string[]).includes(s);

/** Transiciones del equipo (espejo de public._support_staff_can). */
const STAFF_MOVES: Record<SupportStatus, SupportStatus[]> = {
  recibido: ["en_proceso", "necesita_info", "resuelto", "cerrado"],
  en_proceso: ["necesita_info", "resuelto", "cerrado"],
  necesita_info: ["en_proceso", "resuelto", "cerrado"],
  resuelto: ["en_proceso", "cerrado"],
  cerrado: ["en_proceso"],
};
export function staffCanMove(from: string, to: string): boolean {
  return from !== to && (STAFF_MOVES[from as SupportStatus] ?? []).includes(to as SupportStatus);
}
export const staffMoves = (from: string): SupportStatus[] => STAFF_MOVES[from as SupportStatus] ?? [];

export type TicketCore = { status: string; resolved_at?: string | null; closed_at?: string | null; reopened_count?: number | null };

/** Lo que puede hacer la persona con su caso (espejo de support_reply y support_user_action). */
export function userCan(t: TicketCore, now = new Date()) {
  const open = isOpen(t.status);
  const since = Math.max(t.resolved_at ? Date.parse(t.resolved_at) : 0, t.closed_at ? Date.parse(t.closed_at) : 0);
  const reopen = (t.status === "resuelto" || t.status === "cerrado") && since > 0 && now.getTime() - since <= REOPEN_DAYS * DAY && (t.reopened_count ?? 0) < MAX_REOPENS;
  return { reply: open, confirm: t.status !== "cerrado", reopen };
}

/** Después de que la persona responde: si le pedimos información, vuelve a "en proceso". */
export const statusAfterUserReply = (s: SupportStatus): SupportStatus => (s === "necesita_info" ? "en_proceso" : s);
/** Después de una respuesta pública del equipo sin cambio de estado explícito. */
export const statusAfterStaffReply = (s: SupportStatus, to?: SupportStatus | null): SupportStatus => to ?? (s === "recibido" ? "en_proceso" : s);

/** ¿Lleva más de SLA_HOURS sin primera respuesta (y sigue abierto)? */
export function slaLate(t: { status: string; created_at: string; first_response_at?: string | null }, now = new Date()): boolean {
  return isOpen(t.status) && !t.first_response_at && now.getTime() - Date.parse(t.created_at) > SLA_HOURS * H;
}
/** "3 h", "2 d": cuánto lleva esperando. */
export function waitLabel(fromIso: string, now = new Date()): string {
  const h = Math.max(0, (now.getTime() - Date.parse(fromIso)) / H);
  if (h < 1) return "menos de 1 h";
  if (h < 48) return `${Math.floor(h)} h`;
  return `${Math.floor(h / 24)} d`;
}

/** Pasos de la línea de tiempo que ve la persona. "Necesitamos más información" aparece mientras esté pendiente. */
export type TimelineStep = { key: "recibido" | "en_proceso" | "necesita_info" | "resuelto"; label: string; state: "hecho" | "actual" | "pendiente"; at?: string };
export function timeline(t: { status: string; created_at: string }, events: { kind: string; status: string | null; created_at: string }[]): TimelineStep[] {
  const last = (st: string) => [...events].reverse().find((e) => (e.kind === "estado" || e.kind === "creado") && e.status === st)?.created_at;
  const order: TimelineStep["key"][] = ["recibido", "en_proceso", ...(t.status === "necesita_info" ? ["necesita_info" as const] : []), "resuelto"];
  const cur: TimelineStep["key"] = t.status === "cerrado" ? "resuelto" : (t.status as TimelineStep["key"]);
  const ci = order.indexOf(cur);
  return order.map((k, i) => ({
    key: k, label: k === "resuelto" && t.status === "cerrado" ? "Cerrado" : STATUS_LABEL[k],
    state: i < ci || (i === ci && (t.status === "resuelto" || t.status === "cerrado")) ? "hecho" : i === ci ? "actual" : "pendiente",
    at: k === "recibido" ? t.created_at : last(k === "resuelto" && t.status === "cerrado" ? "cerrado" : k),
  }));
}

// ───────────── Formulario ─────────────

export type TicketInput = { category: string; title: string; body: string };
/** Valida antes de enviar (la base repite las reglas). Devuelve el mensaje de error o null. */
export function ticketError(i: TicketInput): string | null {
  if (!SUPPORT_CATEGORIES.some(([k]) => k === i.category)) return "Elige una categoría.";
  const t = i.title.trim().length, b = i.body.trim().length;
  if (t < TITLE_MIN) return "Escribe un título corto, por ejemplo: No guarda mi peso.";
  if (t > TITLE_MAX) return `El título puede tener hasta ${TITLE_MAX} caracteres.`;
  if (b < BODY_MIN) return "Cuéntanos un poco más: qué hiciste y qué pasó.";
  if (b > BODY_MAX) return `La descripción puede tener hasta ${BODY_MAX.toLocaleString("es-CO")} caracteres.`;
  return null;
}

/** Captura válida: tipo y tamaño. Devuelve el mensaje de error o null. */
export function shotError(f: { type: string; size: number } | null | undefined): string | null {
  if (!f) return null;
  if (!(SHOT_TYPES as readonly string[]).includes(f.type)) return "La captura debe ser JPG, PNG o WebP.";
  if (f.size > SHOT_MAX_BYTES) return "La captura pesa más de 5 MB. Recórtala o envía otra.";
  return null;
}

/** Nombre del archivo de la captura dentro de la carpeta propia (sin datos de la persona). */
export function shotName(type: string, rand: string): string {
  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  return `captura-${rand.replace(/[^a-z0-9]/gi, "").slice(0, 16) || "x"}.${ext}`;
}

/**
 * Dispositivo y navegador en palabras ("iPhone, Safari"). Nada de versión exacta ni del user agent completo:
 * alcanza para reproducir el problema sin servir de huella del dispositivo.
 */
export function deviceLabel(ua: string | null | undefined): string {
  const s = ua ?? "";
  const os = /iPhone/.test(s) ? "iPhone" : /iPad/.test(s) ? "iPad" : /Android/.test(s) ? "Android" : /Mac OS X|Macintosh/.test(s) ? "Mac" : /Windows/.test(s) ? "Windows" : /Linux/.test(s) ? "Linux" : "Otro";
  const br = /Edg\//.test(s) ? "Edge" : /SamsungBrowser/.test(s) ? "Samsung Internet" : /CriOS|Chrome\//.test(s) ? "Chrome" : /FxiOS|Firefox\//.test(s) ? "Firefox" : /Safari\//.test(s) ? "Safari" : "otro navegador";
  return `${os}, ${br}`;
}
