// ¿Responden Resend, ONVO y Tilopay? Para /api/salud. Solo servidor. Cada revisión es una llamada mínima, de solo
// lectura y con tiempo límite corto, que confirma que el servicio está arriba Y que nuestra llave sirve. Nunca devuelve
// valores de llaves ni respuestas del proveedor: solo el estado, el tiempo y un código corto (http_401, TimeoutError).
import "server-only";
import { errCode } from "@/lib/log";
import { ONVO_API } from "@/lib/onvo";
import { TILOPAY_API, tilopayMode } from "@/lib/tilopay";

/** up: responde y la llave sirve. down: no responde o rechaza la llave. off: no está configurado (no cuenta). */
export type DepState = "up" | "down" | "off";
export type DepCheck = { state: DepState; ms: number | null; code?: string };
export type DepName = "resend" | "onvo" | "tilopay";

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;
const TIMEOUT_MS = 3_000;

async function probe(f: Fetch, url: string, init: RequestInit, isUp: (r: Response) => Promise<boolean> | boolean): Promise<DepCheck> {
  const t0 = Date.now();
  try {
    const r = await f(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const up = await isUp(r);
    return up ? { state: "up", ms: Date.now() - t0 } : { state: "down", ms: Date.now() - t0, code: `http_${r.status}` };
  } catch (e) {
    return { state: "down", ms: null, code: errCode(e) };
  }
}

/**
 * Resend: GET /domains. Una llave "solo para enviar" (la que recomienda Resend) responde 401 restricted_api_key: la
 * llave es válida y la API responde, así que cuenta como arriba.
 */
export function checkResend(env: Env = process.env, f: Fetch = fetch): Promise<DepCheck> {
  const key = env.RESEND_API_KEY?.trim();
  if (!key) return Promise.resolve({ state: "off", ms: null });
  return probe(f, "https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` } }, async (r) => {
    if (r.ok) return true;
    if (r.status !== 401) return false;
    const j = (await r.json().catch(() => null)) as { name?: unknown } | null;
    return j?.name === "restricted_api_key";
  });
}

/**
 * ONVO: GET de un cliente que no existe. ONVO revisa la llave antes de buscar: 404 = API arriba y llave válida;
 * 401/403 = llave mala; 5xx o sin respuesta = caído. No crea ni cambia nada.
 */
export function checkOnvo(env: Env = process.env, f: Fetch = fetch): Promise<DepCheck> {
  const key = env.ONVO_SECRET_KEY?.trim();
  if (!key) return Promise.resolve({ state: "off", ms: null });
  return probe(f, `${ONVO_API}/v1/customers/bb-salud`, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" } }, (r) => r.ok || r.status === 404);
}

/** Tilopay (si está encendido): el login de la API devuelve un token. Es la única llamada sin efectos que tiene. */
export function checkTilopay(env: Env = process.env, f: Fetch = fetch): Promise<DepCheck> {
  if (tilopayMode(env as NodeJS.ProcessEnv) === "off") return Promise.resolve({ state: "off", ms: null });
  const body = JSON.stringify({ apiuser: env.TILOPAY_API_USER?.trim(), password: env.TILOPAY_API_PASSWORD?.trim() });
  return probe(f, `${TILOPAY_API}/api/v1/login`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body }, async (r) => {
    if (!r.ok) return false;
    const j = (await r.json().catch(() => null)) as { access_token?: unknown } | null;
    return typeof j?.access_token === "string" && j.access_token.length > 0;
  });
}

/** Las tres a la vez (cada una con su tiempo límite: la respuesta tarda como mucho ~3 s). */
export async function checkDeps(env: Env = process.env, f: Fetch = fetch): Promise<Record<DepName, DepCheck>> {
  const [resend, onvo, tilopay] = await Promise.all([checkResend(env, f), checkOnvo(env, f), checkTilopay(env, f)]);
  return { resend, onvo, tilopay };
}
