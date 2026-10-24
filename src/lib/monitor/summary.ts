// Cálculos puros sobre filas de errores (panel /admin/salud y aviso del cron). Sin dependencias.

export type ErrorRow = { source: string; kind: string; route: string; message: string; hits: number; last_at: string; release?: string | null };

/** Totales por ruta, de mayor a menor. */
export function byRoute(rows: Pick<ErrorRow, "route" | "hits">[]): { route: string; hits: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.route, (m.get(r.route) ?? 0) + Number(r.hits || 0));
  return [...m.entries()].map(([route, hits]) => ({ route, hits })).sort((a, b) => b.hits - a.hits || a.route.localeCompare(b.route));
}

/** Total y reparto por fuente (navegador, pantalla de error, servidor). */
export function totals(rows: Pick<ErrorRow, "source" | "hits">[]) {
  const out = { total: 0, client: 0, boundary: 0, server: 0 };
  for (const r of rows) {
    const n = Number(r.hits || 0);
    out.total += n;
    if (r.source === "client" || r.source === "boundary" || r.source === "server") out[r.source] += n;
  }
  return out;
}

/** Estado de una tarea programada: "ok", "falló" o "atrasada" (sin correr en más de `maxAgeH` horas). */
export function beatState(b: { ok: boolean; last_at: string } | null | undefined, now = Date.now(), maxAgeH = 26): "ok" | "fallo" | "atrasada" | "nunca" {
  if (!b) return "nunca";
  if (now - new Date(b.last_at).getTime() > maxAgeH * 3600_000) return "atrasada";
  return b.ok ? "ok" : "fallo";
}
