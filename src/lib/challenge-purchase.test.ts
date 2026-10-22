import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => { throw new Error("sin Supabase en pruebas"); } }));
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkChallengeAmount, grantChallengePurchase } from "./challenge-purchase";

/** BD falsa mínima: tablas en memoria con los métodos que usa grantChallengePurchase. */
function fakeDb(init: Record<string, Record<string, unknown>[]>) {
  const t = init;
  const q = (table: string) => {
    const filters: [string, unknown][] = [];
    let patch: Record<string, unknown> | null = null;
    const match = (r: Record<string, unknown>) => filters.every(([k, v]) => r[k] === v);
    const b = {
      select: () => b,
      eq: (k: string, v: unknown) => { filters.push([k, v]); return b; },
      maybeSingle: async () => ({ data: (t[table] ?? []).find(match) ?? null, error: null }),
      update: (p: Record<string, unknown>) => { patch = p; return b; },
      upsert: async (row: Record<string, unknown>) => {
        const list = (t[table] ??= []);
        if (!list.some((r) => r.user_id === row.user_id && r.challenge_slug === row.challenge_slug)) list.push(row);
        return { error: null };
      },
      then: (res: (x: { error: null }) => void) => { if (patch) for (const r of t[table] ?? []) if (match(r)) Object.assign(r, patch); res({ error: null }); },
    };
    return b;
  };
  return { db: { from: q } as unknown as SupabaseClient, t };
}

const purchase = (over: Record<string, unknown> = {}) => ({ id: 7, user_id: "u1", challenge_slug: "abdomen-21", status: "pendiente", amount_minor: 449, currency: "USD", provider_payment_intent_id: "pi_1", created_at: "2026-10-22T10:00:00Z", ...over });

describe("monto de la compra de un reto", () => {
  it("exige USD y al menos el monto guardado", () => {
    expect(checkChallengeAmount(499, 499, "USD")).toEqual({ ok: true });
    expect(checkChallengeAmount(499, 499, "usd").ok).toBe(true);
    expect(checkChallengeAmount(499, 450, "USD").ok).toBe(false);
    expect(checkChallengeAmount(499, 499, "CRC").ok).toBe(false);
    expect(checkChallengeAmount(499, null, "USD").ok).toBe(false);
    expect(checkChallengeAmount(499, 520, "USD")).toMatchObject({ ok: true, note: expect.stringContaining("520") });
  });
});

describe("el webhook otorga el reto comprado", () => {
  it("cobro confirmado: compra pagada y acceso otorgado (una sola vez)", async () => {
    const { db, t } = fakeDb({ challenge_purchases: [purchase()], challenge_entitlements: [] });
    const r = await grantChallengePurchase(db, "pi_1", 449, "USD");
    expect(r).toMatchObject({ status: "processed", userId: "u1" });
    expect(t.challenge_purchases[0].status).toBe("pagado");
    expect(t.challenge_entitlements).toEqual([{ user_id: "u1", challenge_slug: "abdomen-21", source: "compra", purchase_id: 7 }]);
    const again = await grantChallengePurchase(db, "pi_1", 449, "USD");
    expect(again?.note).toMatch(/ya otorgado/);
    expect(t.challenge_entitlements).toHaveLength(1);
  });
  it("monto menor o en otra moneda: no otorga y deja nota", async () => {
    const { db, t } = fakeDb({ challenge_purchases: [purchase()], challenge_entitlements: [] });
    const r = await grantChallengePurchase(db, "pi_1", 100, "USD");
    expect(r?.status).toBe("ignored");
    expect(t.challenge_purchases[0].status).toBe("pendiente");
    expect(t.challenge_entitlements).toHaveLength(0);
  });
  it("sin monto en el evento: consulta ONVO y solo otorga si el cobro está 'succeeded'", async () => {
    const { db, t } = fakeDb({ challenge_purchases: [purchase()], challenge_entitlements: [] });
    const pending = await grantChallengePurchase(db, "pi_1", null, null, async () => ({ status: "requires_payment_method", amount: 449, currency: "USD" }));
    expect(pending?.status).toBe("ignored");
    expect(t.challenge_entitlements).toHaveLength(0);
    const ok = await grantChallengePurchase(db, "pi_1", null, null, async () => ({ status: "succeeded", amount: 449, currency: "USD" }));
    expect(ok?.status).toBe("processed");
    expect(t.challenge_entitlements).toHaveLength(1);
  });
  it("un cobro que no es de un reto sigue a la lógica de suscripciones", async () => {
    const { db } = fakeDb({ challenge_purchases: [purchase()] });
    expect(await grantChallengePurchase(db, "pi_otro", 999, "USD")).toBeNull();
  });
});
