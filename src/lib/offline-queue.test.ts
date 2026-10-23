import { describe, expect, it } from "vitest";
import { OUTBOX_MAX, OUTBOX_MAX_TRIES, dropOutbox, failOutbox, outboxId, putOutbox, readOutbox, type KV } from "./offline-queue";

const mem = (): KV & { data: Map<string, string> } => { const data = new Map<string, string>(); return { data, get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v) }; };
const item = (n: number) => ({ id: outboxId({ template: "pushA", startedAt: `2026-10-22T12:00:0${n}.000Z` }), key: `bb.session.v2.2026-10-22.pushA`, payload: { n }, at: n });

describe("bandeja de entrenos sin señal", () => {
  it("guarda, reemplaza por id y borra", () => {
    const kv = mem();
    putOutbox(kv, item(1));
    putOutbox(kv, { ...item(1), payload: { n: 9 } });
    expect(readOutbox(kv)).toHaveLength(1);
    expect(readOutbox<{ n: number }>(kv)[0].payload.n).toBe(9);
    dropOutbox(kv, item(1).id);
    expect(readOutbox(kv)).toHaveLength(0);
  });
  it("tolera datos corruptos", () => {
    const kv = mem();
    kv.set("bb.outbox.workouts.v1", "{no es json");
    expect(readOutbox(kv)).toEqual([]);
    kv.set("bb.outbox.workouts.v1", JSON.stringify([{ id: 1 }, null, item(2)]));
    expect(readOutbox(kv)).toHaveLength(1);
  });
  it("deja de insistir tras varios rechazos del servidor", () => {
    const kv = mem();
    putOutbox(kv, item(1));
    for (let i = 1; i < OUTBOX_MAX_TRIES; i++) expect(failOutbox(kv, item(1).id)).toBe(true);
    expect(failOutbox(kv, item(1).id)).toBe(false);
    expect(readOutbox(kv)).toHaveLength(0);
  });
  it("tiene tope y conserva los más nuevos", () => {
    const kv = mem();
    for (let i = 0; i < OUTBOX_MAX + 5; i++) putOutbox(kv, { ...item(i), id: `x${i}` });
    const list = readOutbox(kv);
    expect(list).toHaveLength(OUTBOX_MAX);
    expect(list.at(-1)!.id).toBe(`x${OUTBOX_MAX + 4}`);
  });
  it("si el almacenamiento falla, no rompe", () => {
    const kv: KV = { get: () => { throw new Error("bloqueado"); }, set: () => { throw new Error("lleno"); } };
    expect(readOutbox(kv)).toEqual([]);
    expect(() => putOutbox(kv, item(1))).not.toThrow();
  });
});
