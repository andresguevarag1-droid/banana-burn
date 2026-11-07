// Primer contacto (#283): de qué anuncio llega cada visita. La primera página con utm_* o fbclid deja una cookie de 30 días
// que no se pisa (ref-capture.tsx) y al crear la cuenta el servidor la guarda en signup_attribution (0069).
// Reglas puras. Solo parámetros de la URL, el path y la fecha: nada de IP ni user agent.

export const FIRST_TOUCH_COOKIE = "bb_ft";
export const FIRST_TOUCH_DAYS = 30;
export const FIRST_TOUCH_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"] as const;
export type FirstTouchKey = (typeof FIRST_TOUCH_KEYS)[number];
export type FirstTouch = Partial<Record<FirstTouchKey, string>> & { landing: string | null; first_seen_at: string };

/** Tope de cada valor. */
export const MAX_LEN = 200;
/** Tope de la cookie ya codificada (los navegadores aceptan 4,096 bytes con el nombre y los atributos). */
const MAX_COOKIE = 3800;

/** Texto acotado o null: lo que no es texto, vacío o con caracteres de control se descarta. */
export function cleanValue(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  // eslint-disable-next-line no-control-regex
  if (!s || /[\u0000-\u001f\u007f]/.test(s)) return null;
  return s.slice(0, MAX_LEN);
}

const cleanLanding = (v: unknown) => {
  const s = cleanValue(v);
  return s && s.startsWith("/") && !s.startsWith("//") ? s : null;
};

const cleanDate = (v: unknown, now: number) => {
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  // Vencida (más de FIRST_TOUCH_DAYS) o en el futuro: no sirve.
  return Number.isFinite(t) && t <= now + 60_000 && t > now - FIRST_TOUCH_DAYS * 86400_000 ? new Date(t).toISOString() : null;
};

/** Primer contacto de una URL, o null si no trae ningún utm_* ni fbclid. */
export function firstTouchFrom(url: URL, now = new Date()): FirstTouch | null {
  const out: FirstTouch = { landing: cleanLanding(url.pathname), first_seen_at: now.toISOString() };
  let any = false;
  for (const k of FIRST_TOUCH_KEYS) {
    const v = cleanValue(url.searchParams.get(k));
    if (v) { out[k] = v; any = true; }
  }
  return any ? out : null;
}

/** Valida lo que viene de la cookie (la escribe el navegador: puede venir cualquier cosa). null si no sirve. */
export function cleanFirstTouch(raw: unknown, now = new Date()): FirstTouch | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const first = cleanDate(r.first_seen_at, now.getTime());
  if (!first) return null;
  const out: FirstTouch = { landing: cleanLanding(r.landing), first_seen_at: first };
  let any = false;
  for (const k of FIRST_TOUCH_KEYS) {
    const v = cleanValue(r[k]);
    if (v) { out[k] = v; any = true; }
  }
  return any ? out : null;
}

/** Valor de la cookie. null si no cabe (se prefiere no guardar a guardar a medias). */
export function encodeFirstTouch(t: FirstTouch): string | null {
  const v = encodeURIComponent(JSON.stringify(t));
  return v.length <= MAX_COOKIE ? v : null;
}

export function decodeFirstTouch(v: string | null | undefined, now = new Date()): FirstTouch | null {
  if (!v) return null;
  try { return cleanFirstTouch(JSON.parse(decodeURIComponent(v)), now); } catch { return null; }
}

/** Valor de una cookie dentro de document.cookie. */
export function readCookie(all: string, name: string): string | null {
  for (const part of all.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

/**
 * Cookie a escribir para esta visita, o null si no toca: ya hay un primer contacto válido (no se pisa) o la URL no trae
 * utm_* ni fbclid. Dura FIRST_TOUCH_DAYS y es SameSite=Lax.
 */
export function firstTouchCookie(url: URL, cookies: string, now = new Date(), secure = url.protocol === "https:"): string | null {
  if (decodeFirstTouch(readCookie(cookies, FIRST_TOUCH_COOKIE), now)) return null;
  const t = firstTouchFrom(url, now);
  const v = t && encodeFirstTouch(t);
  if (!v) return null;
  return `${FIRST_TOUCH_COOKIE}=${v}; Path=/; Max-Age=${FIRST_TOUCH_DAYS * 86400}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** Argumentos de signup_attribution_save (0069). */
export function attributionArgs(userId: string, t: FirstTouch) {
  return {
    p_user: userId, p_source: t.utm_source ?? null, p_medium: t.utm_medium ?? null, p_campaign: t.utm_campaign ?? null,
    p_content: t.utm_content ?? null, p_term: t.utm_term ?? null, p_fbclid: t.fbclid ?? null, p_landing: t.landing, p_first_seen: t.first_seen_at,
  };
}
