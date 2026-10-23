import { describe, expect, it, vi } from "vitest";
import { allPages } from "./notify-run";

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
