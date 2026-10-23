import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
import { sumXp } from "./xp-total";

/** Base falsa de xp_events con el tope de 1000 filas por respuesta de Supabase. */
function fakeDb(n: number, xpEach = 10) {
  const rows = Array.from({ length: n }, (_, i) => ({ id: i + 1, xp: xpEach }));
  let calls = 0;
  const from = () => {
    let after = 0, lim = 1000;
    const q = {
      select: () => q, eq: () => q, order: () => q,
      gt: (_: string, v: number) => { after = v; return q; },
      limit: (l: number) => { lim = Math.min(l, 1000); calls++; return Promise.resolve({ data: rows.filter((r) => r.id > after).slice(0, lim), error: null }); },
    };
    return q;
  };
  return { db: { from } as never, calls: () => calls };
}

describe("sumXp", () => {
  it("suma más de 1000 eventos sin cortarse", async () => {
    const f = fakeDb(2500);
    expect(await sumXp(f.db, "u")).toBe(25000);
    expect(f.calls()).toBe(3);
  });
  it("un usuario nuevo da 0 con una sola consulta", async () => {
    const f = fakeDb(0);
    expect(await sumXp(f.db, "u")).toBe(0);
    expect(f.calls()).toBe(1);
  });
  it("si la base falla, avisa en vez de mostrar un XP menor", async () => {
    const db = { from: () => { const q = { select: () => q, eq: () => q, gt: () => q, order: () => q, limit: () => Promise.resolve({ data: null, error: { code: "57014" } }) }; return q; } } as never;
    await expect(sumXp(db, "u")).rejects.toThrow();
  });
});
