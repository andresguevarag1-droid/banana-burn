// Bandeja de salida de entrenos sin señal. Lógica pura (sin navegador) para poder probarla.
// Cada entreno terminado se escribe aquí ANTES de enviarlo: si se cae la señal o se cierra la app, no se pierde.

export type Outbox<P> = { id: string; key: string; payload: P; at: number; tries: number };
export type KV = { get(k: string): string | null; set(k: string, v: string): void };

export const OUTBOX_KEY = "bb.outbox.workouts.v1";
/** Tope de entrenos guardados sin señal (los más viejos salen primero). */
export const OUTBOX_MAX = 20;
/** Respuestas de error del servidor (no de red) antes de dejar de insistir con un entreno. */
export const OUTBOX_MAX_TRIES = 6;

/** Un entreno se reconoce por plantilla + hora de inicio (lo mismo que usa el servidor para el doble envío). */
export const outboxId = (p: { template: string; startedAt: string }) => `${p.template}|${p.startedAt}`;

export function readOutbox<P>(kv: KV): Outbox<P>[] {
  try {
    const raw = JSON.parse(kv.get(OUTBOX_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x) => x && typeof x.id === "string" && typeof x.key === "string" && x.payload && typeof x.at === "number") : [];
  } catch { return []; }
}

function write<P>(kv: KV, list: Outbox<P>[]) {
  try { kv.set(OUTBOX_KEY, JSON.stringify(list.slice(-OUTBOX_MAX))); } catch { /* almacenamiento lleno o bloqueado */ }
}

/** Agrega o reemplaza (mismo id) un entreno pendiente. */
export function putOutbox<P>(kv: KV, item: Omit<Outbox<P>, "tries"> & { tries?: number }): Outbox<P>[] {
  const list = readOutbox<P>(kv).filter((x) => x.id !== item.id);
  list.push({ ...item, tries: item.tries ?? 0 });
  write(kv, list);
  return list;
}

export function dropOutbox<P>(kv: KV, id: string): Outbox<P>[] {
  const list = readOutbox<P>(kv).filter((x) => x.id !== id);
  write(kv, list);
  return list;
}

/** El servidor respondió con error: cuenta un intento; al llegar al tope deja de insistir. Devuelve si sigue pendiente. */
export function failOutbox<P>(kv: KV, id: string): boolean {
  const list = readOutbox<P>(kv);
  const it = list.find((x) => x.id === id);
  if (!it) return false;
  it.tries += 1;
  const keep = it.tries < OUTBOX_MAX_TRIES;
  write(kv, keep ? list : list.filter((x) => x.id !== id));
  return keep;
}
