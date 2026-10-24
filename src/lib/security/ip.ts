// IP del cliente y freno de ráfagas en memoria. Sin dependencias de Node: se usa también en el middleware (Edge).

/**
 * IP del cliente. En Vercel, `x-real-ip` y el primer valor de `x-forwarded-for` los escribe la plataforma con la IP real
 * (lo que mande el navegador se reemplaza). Fuera de Vercel (local) no hay garantía: solo sirve para límites holgados.
 */
export function clientIpFrom(h: Pick<Headers, "get">): string {
  const real = (h.get("x-real-ip") ?? "").trim();
  if (real) return real.slice(0, 64);
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 64) || "local";
}

/**
 * Freno grueso por clave en memoria (por instancia): `max` en una ventana fija de `windowMs`. Para el middleware: corta
 * ráfagas obviamente abusivas sin consultar la base. Con tope de claves para no crecer sin fin.
 */
export function burstLimiter(max: number, windowMs: number, maxKeys = 20_000) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (key: string, now = Date.now()): { ok: boolean; retryAfter: number } => {
    if (hits.size > maxKeys) for (const [k, b] of hits) if (b.reset <= now) hits.delete(k);
    if (hits.size > maxKeys) hits.clear();
    const b = hits.get(key);
    if (!b || b.reset <= now) { hits.set(key, { n: 1, reset: now + windowMs }); return { ok: true, retryAfter: 0 }; }
    b.n++;
    return b.n <= max ? { ok: true, retryAfter: 0 } : { ok: false, retryAfter: Math.max(1, Math.ceil((b.reset - now) / 1000)) };
  };
}
