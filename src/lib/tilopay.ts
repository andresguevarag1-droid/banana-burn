// Cliente REST mínimo de Tilopay. SOLO SERVIDOR: usa TILOPAY_API_USER, TILOPAY_API_PASSWORD y TILOPAY_KEY.
import "server-only";
// Nunca importes este archivo desde un componente "use client".
//
// Referencias (documentación pública de Tilopay, oct 2026; host único app.tilopay.com, modo prueba/producción se
// cambia en el portal):
//   Token          POST /api/v1/login                     { apiuser, password } → { access_token, expires_in (s) }
//   Guardar tarjeta POST /api/v1/processTokenize          { redirect, key, email, language, firstName, lastName, token_version:"v2" } → { type:"100", url }
//   Cobrar guardada POST /api/v1/processRecurrentPayment  { key, amount, currency, orderNumber, capture:"1", email, card } → { response:"1", description, auth, … }
//   Página de pago  POST /api/v1/processPayment           { redirect, key, amount, currency, orderNumber, capture, subscription, platform, billTo*, … } → { type:"100", url }
//                   Vuelve con ?code=1&description&auth&order&tpt&crd&OrderHash&returnData
//   Consultar       POST /api/v1/consult                  (forma NO documentada públicamente: se lee a la defensiva)
//   Quitar tarjeta  "remove-card" (ruta NO publicada: TILOPAY_REMOVE_CARD_PATH; si falla, se marca local)
// Los webhooks de Tilopay no vienen firmados (el algoritmo de orderHash no es público): NUNCA damos acceso por webhook.
// Solo el resultado servidor a servidor (respuesta del cobro o consulta) cuenta.
import { createHmac, timingSafeEqual } from "node:crypto";
import { resilientFetch, type FetchLike } from "./resilient-fetch";
import type { Billing, PlanId } from "./plans";

if (typeof window !== "undefined") {
  throw new Error("src/lib/tilopay.ts es solo para el servidor");
}

export const TILOPAY_API = "https://app.tilopay.com";
const DEFAULT_REMOVE_CARD_PATH = "/api/v1/removeCard";

// ───────────────────────── Configuración ─────────────────────────

/** ¿Tilopay está listo y encendido? Sin las cuatro variables, la app sigue toda con ONVO como hoy. */
export function isTilopayConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.TILOPAY_API_USER?.trim() && env.TILOPAY_API_PASSWORD?.trim() && env.TILOPAY_KEY?.trim() && env.TILOPAY_ENABLED?.trim() === "1");
}

export class TilopayError extends Error {
  constructor(message: string, public status: number, public body?: unknown) {
    super(message);
    this.name = "TilopayError";
  }
}

// ───────────────────────── REST ─────────────────────────

// Tiempo límite en todo; cobros y tokenización nunca se reintentan solos (son POST).
let fetcher: FetchLike = resilientFetch({ readTimeoutMs: 10_000, writeTimeoutMs: 20_000, retries: 0 });
/** Solo pruebas: cambia el fetch y limpia el token en memoria. */
export function __setTilopayFetch(f: FetchLike | null) {
  fetcher = f ?? resilientFetch({ readTimeoutMs: 10_000, writeTimeoutMs: 20_000, retries: 0 });
  cached = null;
}

let cached: { token: string; until: number } | null = null;
let inflight: Promise<string> | null = null;

/** Token de API en memoria (24 h según Tilopay); se renueva 10 minutos antes de vencer. */
export async function apiToken(now = Date.now()): Promise<string> {
  if (cached && cached.until > now) return cached.token;
  if (inflight) return inflight;
  inflight = (async () => {
    const apiuser = process.env.TILOPAY_API_USER?.trim();
    const password = process.env.TILOPAY_API_PASSWORD?.trim();
    if (!apiuser || !password) throw new TilopayError("Tilopay no está configurado", 503);
    const res = await fetcher(`${TILOPAY_API}/api/v1/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ apiuser, password }),
    });
    const j = (await res.json().catch(() => null)) as { access_token?: unknown; expires_in?: unknown } | null;
    if (!res.ok || !j || typeof j.access_token !== "string" || !j.access_token) throw new TilopayError(`Tilopay login ${res.status}`, res.status === 200 ? 502 : res.status);
    const secs = typeof j.expires_in === "number" && j.expires_in > 0 ? j.expires_in : Number(j.expires_in) > 0 ? Number(j.expires_in) : 3600;
    cached = { token: j.access_token, until: now + Math.max(60, secs - 600) * 1000 };
    return j.access_token;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

async function tilopay<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const token = await apiToken();
  const send = (t: string) => fetcher(`${TILOPAY_API}${path}`, {
    method: "POST",
    headers: { Authorization: `bearer ${t}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  let res = await send(token);
  if (res.status === 401) {
    // Token vencido antes de tiempo: uno nuevo y una sola vez más (el 401 no llegó a procesar nada).
    cached = null;
    res = await send(await apiToken());
  }
  const j = (await res.json().catch(() => null)) as T | null;
  if (!res.ok) {
    const msg = j && typeof j === "object" && "message" in j ? String((j as { message: unknown }).message).slice(0, 200) : `HTTP ${res.status}`;
    throw new TilopayError(`Tilopay ${path}: ${msg}`, res.status, j);
  }
  if (!j || typeof j !== "object") throw new TilopayError(`Tilopay ${path}: respuesta vacía`, 502);
  return j;
}

const key = () => {
  const k = process.env.TILOPAY_KEY?.trim();
  if (!k) throw new TilopayError("TILOPAY_KEY no está configurada", 503);
  return k;
};

/** Monto como texto con 2 decimales ("9.99"), desde centavos. */
export const amountText = (minor: number) => (Math.round(minor) / 100).toFixed(2);

/** Nombre y apellido para los formularios de Tilopay (piden los dos). */
export function splitName(full: string | null | undefined): { firstName: string; lastName: string } {
  const parts = (full ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const firstName = (parts[0] ?? "Cliente").slice(0, 40);
  const lastName = (parts.slice(1).join(" ") || "Banana Burn").slice(0, 60);
  return { firstName, lastName };
}

// ───────────────────────── Guardar tarjeta ─────────────────────────

export async function createTokenizeUrl(i: { redirect: string; email: string; name: string }): Promise<string> {
  const { firstName, lastName } = splitName(i.name);
  const r = await tilopay<{ type?: unknown; url?: unknown }>("/api/v1/processTokenize", {
    redirect: i.redirect, key: key(), email: i.email, language: "es", firstName, lastName, token_version: "v2",
  });
  if (typeof r.url !== "string" || !/^https:\/\//.test(r.url)) throw new TilopayError("Tilopay no devolvió el formulario de tarjeta", 502, r);
  return r.url;
}

// ───────────────────────── Página de pago (compra directa) ─────────────────────────

export async function createPaymentUrl(i: { redirect: string; email: string; name: string; amountMinor: number; orderNumber: string; country: string | null; returnData: string }): Promise<string> {
  const { firstName, lastName } = splitName(i.name);
  const country = i.country && /^[A-Z]{2}$/.test(i.country) ? i.country : "CR";
  const r = await tilopay<{ type?: unknown; url?: unknown }>("/api/v1/processPayment", {
    redirect: i.redirect, key: key(), amount: amountText(i.amountMinor), currency: "USD", orderNumber: i.orderNumber,
    capture: "1", subscription: "1", platform: "bananaburn", token_version: "v2", hashVersion: "V2", returnData: i.returnData,
    // Tilopay pide los datos de facturación; no pedimos dirección: van datos mínimos y el país.
    billToFirstName: firstName, billToLastName: lastName, billToAddress: "N/A", billToAddress2: "N/A", billToCity: "N/A",
    billToState: "N/A", billToZipPostCode: "00000", billToCountry: country, billToTelephone: "00000000", billToEmail: i.email,
  });
  if (typeof r.url !== "string" || !/^https:\/\//.test(r.url)) throw new TilopayError("Tilopay no devolvió la página de pago", 502, r);
  return r.url;
}

// ───────────────────────── Cobrar con la tarjeta guardada ─────────────────────────

export type ChargeOutcome =
  | { state: "approved"; auth: string | null; transactionId: string | null; description: string | null }
  | { state: "declined"; description: string }
  | { state: "unknown"; error: string };

/** Lee la respuesta de processRecurrentPayment. Pura. "1" = aprobado; cualquier otro código explícito = rechazado. */
export function readCharge(j: unknown): ChargeOutcome {
  if (!j || typeof j !== "object") return { state: "unknown", error: "respuesta vacía" };
  const o = j as Record<string, unknown>;
  const code = o.response ?? o.code;
  const description = typeof o.description === "string" ? o.description.slice(0, 200) : null;
  if (code === "1" || code === 1) {
    const s = (x: unknown) => (typeof x === "string" || typeof x === "number" ? String(x).slice(0, 100) : null);
    return { state: "approved", auth: s(o.auth), transactionId: s(o.tilopayTransaction ?? o.tpt ?? o.order_id), description };
  }
  if (code !== undefined && code !== null && code !== "") return { state: "declined", description: description ?? `código ${String(code).slice(0, 20)}` };
  return { state: "unknown", error: "respuesta sin código" };
}

/**
 * Cobra con la tarjeta guardada (servidor a servidor, sin formulario). `orderNumber` es determinista por intento: si la
 * respuesta se pierde, la consulta por ese número dice si se cobró. Tiempo agotado, red o 5xx = "unknown" (no se reintenta).
 */
export async function chargeSavedCard(i: { token: string; email: string; amountMinor: number; orderNumber: string }): Promise<ChargeOutcome> {
  try {
    const j = await tilopay<unknown>("/api/v1/processRecurrentPayment", {
      key: key(), amount: amountText(i.amountMinor), currency: "USD", orderNumber: i.orderNumber, capture: "1", email: i.email, card: i.token,
    });
    return readCharge(j);
  } catch (e) {
    if (e instanceof TilopayError) {
      // 4xx con cuerpo = Tilopay lo procesó y lo rechazó (datos o banco). 401/403 = llave mal configurada (no es rechazo).
      if (e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 403 && e.status !== 408 && e.status !== 429) {
        const r = readCharge(e.body);
        return r.state === "approved" ? { state: "unknown", error: "aprobado con error HTTP" } : { state: "declined", description: e.message.slice(0, 200) };
      }
      return { state: "unknown", error: `Tilopay ${e.status}` };
    }
    return { state: "unknown", error: e instanceof Error ? e.name : "red" };
  }
}

// ───────────────────────── Consultar ─────────────────────────

export type ConsultResult = { state: "approved"; amountMinor: number | null; currency: string | null; token: string | null } | { state: "declined" } | { state: "unknown" };

/**
 * Lee la consulta de una orden. La forma de /api/v1/consult no es pública: se aceptan varias formas razonables y todo lo
 * que no se reconoce queda "unknown" (nunca se toma como aprobado ni como rechazado).
 */
export function readConsult(j: unknown, orderNumber: string): ConsultResult {
  if (!j || typeof j !== "object") return { state: "unknown" };
  const o = j as Record<string, unknown>;
  const list = Array.isArray(o.response) ? o.response : Array.isArray(o.data) ? o.data : Array.isArray(o.transactions) ? o.transactions : [o.response && typeof o.response === "object" ? o.response : o];
  const tx = (list as unknown[]).find((t) => t && typeof t === "object" && [(t as Record<string, unknown>).orderNumber, (t as Record<string, unknown>).order, (t as Record<string, unknown>).order_number].some((x) => String(x ?? "") === orderNumber)) as Record<string, unknown> | undefined;
  if (!tx) return { state: "unknown" };
  const code = String(tx.code ?? tx.response ?? tx.status ?? tx.estado ?? "").toLowerCase();
  const amt = Number(tx.amount ?? tx.monto);
  const cur = typeof tx.currency === "string" ? tx.currency.toUpperCase() : typeof tx.moneda === "string" ? tx.moneda.toUpperCase() : null;
  const token = [tx.crd, tx.card, tx.token, tx.cardToken].find((x) => typeof x === "string" && TOKEN_RE.test(x)) as string | undefined;
  if (["1", "approved", "aprobada", "aprobado", "success", "captured"].includes(code)) return { state: "approved", amountMinor: Number.isFinite(amt) && amt > 0 ? Math.round(amt * 100) : null, currency: cur, token: token ?? null };
  if (["0", "2", "declined", "rechazada", "rechazado", "denied", "failed", "error"].includes(code)) return { state: "declined" };
  return { state: "unknown" };
}

export async function consultOrder(orderNumber: string): Promise<ConsultResult> {
  try {
    const j = await tilopay<unknown>("/api/v1/consult", { key: key(), orderNumber });
    return readConsult(j, orderNumber);
  } catch {
    return { state: "unknown" };
  }
}

// ───────────────────────── Quitar tarjeta ─────────────────────────

/** Quita la tarjeta en Tilopay. La ruta no es pública (TILOPAY_REMOVE_CARD_PATH). true si Tilopay respondió bien. */
export async function removeCardToken(token: string, email: string): Promise<boolean> {
  const path = process.env.TILOPAY_REMOVE_CARD_PATH?.trim() || DEFAULT_REMOVE_CARD_PATH;
  if (!/^\/api\/[A-Za-z0-9/_-]{1,80}$/.test(path)) return false;
  try {
    await tilopay<unknown>(path, { key: key(), card: token, email });
    return true;
  } catch {
    return false;
  }
}

// ───────────────────────── Vuelta del navegador ─────────────────────────

export const TOKEN_RE = /^[A-Za-z0-9+/=._:-]{8,400}$/;

/**
 * Lee los parámetros con que Tilopay devuelve a la persona. Los de processTokenize no están documentados: la tarjeta
 * puede venir como crd, token, card o cardToken; marca y últimos 4 si vienen. Pura.
 */
export function readReturn(q: URLSearchParams): { code: string | null; order: string | null; token: string | null; brand: string | null; last4: string | null; description: string | null; returnData: string | null } {
  const pick = (...names: string[]) => {
    for (const n of names) {
      const v = q.get(n);
      if (v && v.trim()) return v.trim();
    }
    return null;
  };
  const token = pick("crd", "token", "card", "cardToken", "card_token", "tlpy_token");
  const brandRaw = pick("brand", "cardBrand", "card_brand", "type", "cardType")?.toLowerCase().replace(/[^a-z_]/g, "").slice(0, 20) ?? null;
  const digits = pick("last4", "lastDigits", "last_digits", "cardLast4", "last4Digits")?.replace(/\D/g, "") ?? null;
  const masked = pick("cardNumber", "card_number", "maskedCard", "masked")?.replace(/\D/g, "") ?? null;
  const last4 = digits && digits.length >= 4 ? digits.slice(-4) : masked && masked.length >= 4 ? masked.slice(-4) : null;
  const known = new Set(["visa", "mastercard", "amex", "american_express", "discover", "diners", "jcb"]);
  return {
    code: pick("code"),
    order: pick("order", "orderNumber"),
    token: token && TOKEN_RE.test(token) ? token : null,
    brand: brandRaw && known.has(brandRaw) ? (brandRaw === "american_express" ? "amex" : brandRaw) : null,
    last4,
    description: pick("description")?.slice(0, 200) ?? null,
    returnData: pick("returnData"),
  };
}

// ───────────────────────── Estado firmado de la vuelta ─────────────────────────

export type ReturnPurpose = "tarjeta" | "pago";
export type ReturnState = { u: string; p: ReturnPurpose; plan: PlanId; billing: Billing; n: string; t: number; o?: string };

/** Vigencia del estado: 2 horas para llenar la tarjeta en Tilopay y volver. */
export const STATE_MAX_AGE_MS = 2 * 3600_000;

function stateSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const s = env.TILOPAY_STATE_SECRET?.trim() || env.TILOPAY_API_PASSWORD?.trim();
  return s ? `bb-tilopay-vuelta:${s}` : null;
}

export function signState(s: Omit<ReturnState, "t">, now = Date.now(), env: NodeJS.ProcessEnv = process.env): string {
  const secret = stateSecret(env);
  if (!secret) throw new TilopayError("Tilopay no está configurado", 503);
  const payload = Buffer.from(JSON.stringify({ ...s, t: Math.floor(now / 1000) })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

export function verifyState(token: string | null | undefined, now = Date.now(), env: NodeJS.ProcessEnv = process.env): ReturnState | null {
  const secret = stateSecret(env);
  if (!secret || !token || token.length > 600) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const want = createHmac("sha256", secret).update(payload).digest();
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as ReturnState;
    if (typeof s.u !== "string" || (s.p !== "tarjeta" && s.p !== "pago") || typeof s.t !== "number") return null;
    if (s.plan !== "entreno" && s.plan !== "completo") return null;
    if (s.billing !== "mes" && s.billing !== "anual") return null;
    if (now - s.t * 1000 > STATE_MAX_AGE_MS || s.t * 1000 - now > 60_000) return null;
    return s;
  } catch {
    return null;
  }
}

// ───────────────────────── Números de orden ─────────────────────────
// Deterministas por intento (cobro seguro ante reintentos), solo letras, números y guiones, menos de 50 caracteres.

const compact = (uuid: string) => uuid.replace(/[^0-9a-f]/gi, "").slice(0, 32);
/** Cobro de la prueba: "trial:<uuid>" + intento. */
export const trialOrderNumber = (idemKey: string, attempt: number) => `bbt-${compact(idemKey.replace(/^trial:/, ""))}-${attempt}`;
/** Renovación: suscripción + fin del periodo que se cobra + intento. */
export const renewalOrderNumber = (subRowId: number, periodEnd: string, attempt: number) => `bbr-${subRowId}-${periodEnd.slice(0, 10).replace(/-/g, "")}-${attempt}`;
/** Compra directa en la página de pago. */
export const checkoutOrderNumber = (nonce: string) => `bbc-${nonce.replace(/[^0-9a-z]/gi, "").slice(0, 24)}`;
/** ID propio de una suscripción cobrada con Tilopay (Tilopay no tiene suscripción: la llevamos nosotros). */
export const tilopaySubId = (order: string) => `tlp:${order}`;
/** Cliente estable por persona (Tilopay no tiene clientes). */
export const tilopayCustomerId = (userId: string) => `tlp:${userId}`;
