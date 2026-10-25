// Solicitudes de reunión de condominios (página oculta /condominios, 0052). Validación pura y probada (condominios.test.ts):
// la server action la usa antes de escribir con service_role, y los mismos topes viven en los CHECK de la tabla.

export const ROLES = [
  ["administrador", "Administración del condominio"],
  ["junta", "Junta directiva"],
  ["otro", "Otro"],
] as const;
export type LeadRole = (typeof ROLES)[number][0];

export const TIMES = [
  ["manana", "Mañana"],
  ["tarde", "Tarde"],
  ["noche", "Noche"],
] as const;
export type LeadTime = (typeof TIMES)[number][0];

export const STATUSES = [
  ["nuevo", "Nuevo"],
  ["contactado", "Contactado"],
  ["reunion", "Reunión agendada"],
  ["cerrado", "Cerrado"],
] as const;
export type LeadStatus = (typeof STATUSES)[number][0];

export type LeadInput = {
  name: string; role: LeadRole; org: string; units: string | null; location: string | null; email: string;
  phone: string | null; times: LeadTime[]; days: string | null; portfolio: string | null; comment: string | null; source: string | null;
};

/** Texto plano de una línea: sin etiquetas ni caracteres de control, espacios colapsados y recortado a `max`. */
export function clean(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Igual que clean pero conserva saltos de línea (comentarios). */
export function cleanMulti(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.replace(/<[^>]*>/g, "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
}

/** Nombre del condominio para personalizar el saludo (?c=). Solo letras, números y puntuación básica, 60 caracteres. */
export function condoName(v: unknown): string | null {
  const s = clean(Array.isArray(v) ? v[0] : v, 60).replace(/[^\p{L}\p{N} .,'&()-]/gu, "").trim();
  return s.length >= 2 ? s : null;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

/** Valida el formulario. Devuelve la solicitud limpia o el primer error para mostrar junto al botón. */
export function parseLead(f: Record<string, unknown>): { ok: true; lead: LeadInput } | { ok: false; error: string } {
  const name = clean(f.name, 80);
  const roleRaw = clean(f.role, 20);
  const org = clean(f.org, 100);
  const email = clean(f.email, 254).toLowerCase();
  const phone = clean(f.phone, 30).replace(/[^\d+()\s-]/g, "").trim();
  const timesRaw = Array.isArray(f.times) ? f.times : typeof f.times === "string" ? [f.times] : [];
  const times = [...new Set(timesRaw.filter((t): t is LeadTime => TIMES.some(([k]) => k === t)))];
  if (name.length < 2) return { ok: false, error: "Escribe tu nombre." };
  if (!ROLES.some(([k]) => k === roleRaw)) return { ok: false, error: "Elige tu cargo." };
  if (org.length < 2) return { ok: false, error: "Escribe el nombre del condominio." };
  if (!EMAIL.test(email)) return { ok: false, error: "Revisa tu correo." };
  if (phone && phone.replace(/\D/g, "").length < 8) return { ok: false, error: "Revisa tu teléfono o WhatsApp (8 dígitos o más)." };
  return {
    ok: true,
    lead: {
      name, role: roleRaw as LeadRole, org, email, phone: phone || null, times,
      units: clean(f.units, 40) || null, location: clean(f.location, 100) || null,
      days: clean(f.days, 80) || null, portfolio: clean(f.portfolio, 40) || null, comment: cleanMulti(f.comment, 1000) || null, source: clean(f.source, 60) || null,
    },
  };
}

export const roleLabel = (r: string) => ROLES.find(([k]) => k === r)?.[1] ?? r;
export const timeLabel = (t: string) => TIMES.find(([k]) => k === t)?.[1] ?? t;
export const statusLabel = (s: string) => STATUSES.find(([k]) => k === s)?.[1] ?? s;
export const isStatus = (s: unknown): s is LeadStatus => typeof s === "string" && STATUSES.some(([k]) => k === s);
