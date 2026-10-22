// Validación manual de formularios del panel (sin zod). Cada helper devuelve el valor limpio o lanza ValidationError.
export class ValidationError extends Error {}

type Src = FormData | Record<string, unknown>;
const raw = (src: Src, key: string): unknown => (src instanceof FormData ? src.get(key) : src[key]);

export function text(src: Src, key: string, opts: { label?: string; max?: number; min?: number; required?: boolean } = {}): string {
  const label = opts.label ?? key;
  const v = raw(src, key);
  const s = typeof v === "string" ? v.trim() : "";
  if (!s && opts.required) throw new ValidationError(`${label} es obligatorio.`);
  if (opts.min && s && s.length < opts.min) throw new ValidationError(`${label} debe tener al menos ${opts.min} caracteres.`);
  if (opts.max && s.length > opts.max) throw new ValidationError(`${label} admite máximo ${opts.max} caracteres.`);
  return s;
}

export function int(src: Src, key: string, opts: { label?: string; min?: number; max?: number; required?: boolean } = {}): number | null {
  const label = opts.label ?? key;
  const v = raw(src, key);
  const s = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
  if (!s) { if (opts.required) throw new ValidationError(`${label} es obligatorio.`); return null; }
  if (!/^-?\d+$/.test(s)) throw new ValidationError(`${label} debe ser un número entero.`);
  const n = Number(s);
  if (opts.min !== undefined && n < opts.min) throw new ValidationError(`${label} debe ser ≥ ${opts.min}.`);
  if (opts.max !== undefined && n > opts.max) throw new ValidationError(`${label} debe ser ≤ ${opts.max}.`);
  return n;
}

export function num(src: Src, key: string, opts: { label?: string; min?: number; max?: number; required?: boolean } = {}): number | null {
  const label = opts.label ?? key;
  const v = raw(src, key);
  const s = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim().replace(",", ".") : "";
  if (!s) { if (opts.required) throw new ValidationError(`${label} es obligatorio.`); return null; }
  const n = Number(s);
  if (!Number.isFinite(n)) throw new ValidationError(`${label} debe ser un número.`);
  if (opts.min !== undefined && n < opts.min) throw new ValidationError(`${label} debe ser ≥ ${opts.min}.`);
  if (opts.max !== undefined && n > opts.max) throw new ValidationError(`${label} debe ser ≤ ${opts.max}.`);
  return n;
}

export function bool(src: Src, key: string): boolean {
  const v = raw(src, key);
  return v === true || v === "on" || v === "true" || v === "1";
}

export function oneOf<T extends string>(src: Src, key: string, allowed: readonly T[], opts: { label?: string; fallback?: T } = {}): T {
  const v = raw(src, key);
  if (typeof v === "string" && (allowed as readonly string[]).includes(v)) return v as T;
  if (opts.fallback !== undefined) return opts.fallback;
  throw new ValidationError(`${opts.label ?? key} no es válido.`);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Fecha YYYY-MM-DD o datetime-local (YYYY-MM-DDTHH:mm). Devuelve ISO string o null. */
export function date(src: Src, key: string, opts: { label?: string; required?: boolean } = {}): string | null {
  const label = opts.label ?? key;
  const s = text(src, key);
  if (!s) { if (opts.required) throw new ValidationError(`${label} es obligatoria.`); return null; }
  const t = ISO_DATE.test(s) ? Date.parse(s + "T23:59:59-06:00") : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? Date.parse(s + ":00-06:00") : NaN;
  if (!Number.isFinite(t)) throw new ValidationError(`${label} no es una fecha válida.`);
  return new Date(t).toISOString();
}

export function json(src: Src, key: string, opts: { label?: string; max?: number } = {}): Record<string, unknown> {
  const label = opts.label ?? key;
  const s = text(src, key, { label, max: opts.max ?? 5000 });
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error();
    return v as Record<string, unknown>;
  } catch {
    throw new ValidationError(`${label} debe ser un objeto JSON válido, p. ej. {"minSesiones": 3}.`);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function id(src: Src, key: string, opts: { uuid?: boolean; label?: string } = {}): string {
  const s = text(src, key, { required: true, max: 64, label: opts.label ?? "Identificador" });
  if (opts.uuid ? !UUID.test(s) : !/^[\w-]+$/.test(s)) throw new ValidationError(`${opts.label ?? "Identificador"} no es válido.`);
  return s;
}
export const isUuid = (s: string) => UUID.test(s);

/** Líneas no vacías de un textarea (p. ej. claves técnicas). */
export function lines(src: Src, key: string, opts: { max?: number; maxLen?: number } = {}): string[] {
  return text(src, key, { max: 4000 }).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, opts.max ?? 12).map((l) => l.slice(0, opts.maxLen ?? 200));
}

export const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
