// fetch con tiempo límite y un reintento SOLO para lecturas (GET/HEAD), que son idempotentes.
// Las escrituras nunca se reintentan aquí: un POST que llegó pero cuya respuesta se perdió no debe duplicarse.

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ResilientOpts = {
  /** Tiempo límite por intento para lecturas (ms). */
  readTimeoutMs?: number;
  /** Tiempo límite para escrituras (ms). */
  writeTimeoutMs?: number;
  /** Reintentos extra para lecturas ante red caída, tiempo agotado o 502/503/504. */
  retries?: number;
  /** Espera base entre intentos (ms). */
  backoffMs?: number;
  base?: FetchLike;
};

const RETRY_STATUS = new Set([502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

export const isIdempotent = (method: string) => method === "GET" || method === "HEAD";

/** Une la señal del llamador (si hay) con el tiempo límite. */
function withTimeout(signal: AbortSignal | null | undefined, ms: number): AbortSignal {
  const t = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, t]) : t;
}

export function resilientFetch(opts: ResilientOpts = {}): FetchLike {
  const { readTimeoutMs = 6_000, writeTimeoutMs = 10_000, retries = 1, backoffMs = 250 } = opts;
  return async (input, init) => {
    const base = opts.base ?? fetch;
    const method = methodOf(input, init);
    const read = isIdempotent(method);
    const attempts = read ? 1 + Math.max(0, retries) : 1;
    for (let i = 0; ; i++) {
      const last = i >= attempts - 1;
      try {
        const res = await base(input, { ...init, signal: withTimeout(init?.signal, read ? readTimeoutMs : writeTimeoutMs) });
        if (!last && RETRY_STATUS.has(res.status)) { await sleep(backoffMs * (i + 1)); continue; }
        return res;
      } catch (e) {
        // Si quien llama canceló a propósito, no insistimos.
        if (last || init?.signal?.aborted) throw e;
        await sleep(backoffMs * (i + 1));
      }
    }
  };
}
