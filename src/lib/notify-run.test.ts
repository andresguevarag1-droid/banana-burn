import { describe, expect, it, vi } from "vitest";
import { allPages } from "./notify-run";
import { forEachLimit } from "./concurrency";

describe("allPages", () => {
  it("lee todas las páginas cuando hay más de 1000 filas", async () => {
    const rows = Array.from({ length: 2345 }, (_, i) => i);
    const page = vi.fn(async (a: number, b: number) => ({ data: rows.slice(a, b + 1), error: null }));
    const r = await allPages(page);
    expect(r.data).toHaveLength(2345);
    expect(page).toHaveBeenCalledTimes(3);
  });
  it("devuelve el error para que el lote se salte", async () => {
    const r = await allPages(async () => ({ data: null, error: { code: "57014" } }));
    expect(r.error?.code).toBe("57014");
  });
  it("una página vacía termina", async () => {
    const page = vi.fn(async () => ({ data: [], error: null }));
    expect((await allPages(page)).data).toEqual([]);
    expect(page).toHaveBeenCalledTimes(1);
  });
});

describe("forEachLimit (personas en paralelo en el cron)", () => {
  it("procesa todo sin pasar del límite a la vez", async () => {
    let live = 0, peak = 0;
    const seen: number[] = [];
    await forEachLimit(Array.from({ length: 30 }, (_, i) => i), 8, async (i) => {
      live++; peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, 2));
      seen.push(i); live--;
    });
    expect(seen.sort((a, b) => a - b)).toEqual(Array.from({ length: 30 }, (_, i) => i));
    expect(peak).toBe(8);
  });
  it("lista vacía o límite raro no se cuelga", async () => {
    await expect(forEachLimit([], 8, async () => {})).resolves.toBeUndefined();
    const fn = vi.fn(async () => {});
    await forEachLimit([1, 2], 0, fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
