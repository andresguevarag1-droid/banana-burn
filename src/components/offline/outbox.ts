"use client";
// Envío de entrenos con bandeja de salida: se escriben en el teléfono antes de mandarlos y se reintentan al volver la señal.
// Un candado en memoria evita que el reproductor y la sincronización global manden el mismo entreno a la vez.
import { saveWorkout, type SaveResult } from "@/app/(app)/app/entreno/actions";
import type { Finished } from "@/app/(app)/app/entreno/validate";
import { dropOutbox, failOutbox, outboxId, putOutbox, readOutbox, type KV, type Outbox } from "@/lib/offline-queue";

export type PendingWorkout = Outbox<Finished>;
export const OUTBOX_EVENT = "bb:outbox";
export type OutboxEvent = { id: string; result: SaveResult | null; pending: number };

const kv: KV = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
};
const inFlight = new Map<string, Promise<SaveResult | null>>();

export const pendingWorkouts = () => readOutbox<Finished>(kv);

function emit(detail: OutboxEvent) {
  try { window.dispatchEvent(new CustomEvent<OutboxEvent>(OUTBOX_EVENT, { detail })); } catch { /* */ }
}

/** Escribe el entreno en la bandeja (antes de enviarlo). `sessionKey` es la sesión del reproductor a borrar al guardarse. */
export function queueWorkout(payload: Finished, sessionKey: string): PendingWorkout {
  const item = { id: outboxId(payload), key: sessionKey, payload, at: Date.now() };
  putOutbox(kv, item);
  return { ...item, tries: 0 };
}

/**
 * Envía un entreno de la bandeja. Devuelve la respuesta del servidor, o null si no hubo red (queda pendiente).
 * Si ya se está enviando, espera ese mismo envío en vez de mandar otro.
 */
export function sendQueued(item: PendingWorkout): Promise<SaveResult | null> {
  const running = inFlight.get(item.id);
  if (running) return running;
  const p = (async () => {
    let res: SaveResult;
    try { res = await saveWorkout(item.payload); }
    catch { emit({ id: item.id, result: null, pending: pendingWorkouts().length }); return null; } // sin red o servidor caído
    if (res.ok) {
      dropOutbox(kv, item.id);
      try { localStorage.removeItem(item.key); } catch { /* */ }
    } else failOutbox(kv, item.id);
    emit({ id: item.id, result: res, pending: pendingWorkouts().length });
    return res;
  })().finally(() => inFlight.delete(item.id));
  inFlight.set(item.id, p);
  return p;
}

/** Envía todo lo pendiente, en orden. Se detiene en la primera falla de red. Devuelve cuántos se guardaron. */
export async function flushWorkouts(): Promise<number> {
  let saved = 0;
  for (const it of pendingWorkouts()) {
    const r = await sendQueued(it);
    if (r === null) break;
    if (r.ok) saved++;
  }
  return saved;
}
