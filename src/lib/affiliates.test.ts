import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => null }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, delete: () => {} }) }));
const mail = vi.hoisted(() => ({ notifyInApp: vi.fn(async () => true), sendAffiliateEmail: vi.fn(async () => null), sendTeamAffiliatePayouts: vi.fn(async () => null) }));
vi.mock("@/lib/email", () => mail);
const billing = vi.hoisted(() => ({ cancelAtPeriodEnd: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/billing", () => billing);

import type { SupabaseClient } from "@supabase/supabase-js";
import { fakeDb } from "@/lib/fake-db";
import {
  affCookieValue, availableAt, balances, commissionLine, DEFAULT_SETTINGS, endOfMonthCR, netBase, normalizeAffCode,
  parseAffCookie, payoutDue, perkTarget, tierFor,
} from "@/lib/affiliates";
import { affiliateOnPaid, reverseCommission, runPayouts, syncPerk } from "@/lib/affiliates-server";

const AFF = "00000000-0000-4000-8000-0000000000a1";
const REF = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const NOW = new Date("2026-11-10T18:00:00Z");
const future = new Date(NOW.getTime() + 20 * 864e5).toISOString();

/** Referidor con `n` referidos pagando (plan entreno activo) y `extra` solo registrados. */
function world(n: number, extra = 0) {
  const refs = Array.from({ length: n + extra }, (_, i) => ({ user_id: REF(i + 1), affiliate_id: AFF }));
  const subs = Array.from({ length: n }, (_, i) => ({ id: i + 1, user_id: REF(i + 1), plan: "entreno", status: "active", current_period_end: future, cancel_at_period_end: false, created_at: NOW.toISOString() }));
  return fakeDb(
    { affiliates: [{ user_id: AFF, code: "carla", active: true, perk_since: null, perk_notice_at: null }], affiliate_referrals: refs, subscriptions: subs, affiliate_commissions: [], comp_grants: [], card_fingerprints: [], trial_charges: [], affiliate_payouts: [], affiliate_payout_methods: [] },
    { affiliate_commissions: ["payment_ref"] },
  ).db;
}
async function all(db: SupabaseClient, t: string) { const { data } = await db.from(t).select("*"); return (data as Record<string, unknown>[]) ?? []; }

beforeEach(() => { vi.clearAllMocks(); });

describe("niveles", () => {
  it.each([[0, 0], [1, 10], [10, 10], [11, 20], [20, 20], [21, 30], [30, 30], [31, 40], [80, 40]])("%i pagando → %i %%", (n, rate) => {
    expect(tierFor(n).rate).toBe(rate);
  });
  it("dice cuántos faltan para el siguiente", () => {
    expect(tierFor(14)).toMatchObject({ level: 2, toNext: 7, next: { min: 21, rate: 30 } });
    expect(tierFor(31)).toMatchObject({ level: 4, next: null, toNext: 0 });
  });
});

describe("base neta (ajustes confirmados: ONVO 3.9 % + $0.35, Tilopay 4.25 % + $0.35, IVA 13 % incluido)", () => {
  it("ejemplo del dueño: Entreno mensual $9.99 con ONVO", () => {
    // 9.99 / 1.13 = 8.84; ONVO = 9.99 × 0.039 + 0.35 = 0.74; base = 8.84 − 0.74 = 8.10
    expect(netBase(999, "onvo")).toEqual({ tax: 115, fee: 74, net: 810 });
    const at = (n: number) => commissionLine({ grossMinor: 999, provider: "onvo", activeCount: n }).commission;
    expect([at(5), at(15), at(25), at(35)]).toEqual([81, 162, 243, 324]); // $0.81, $1.62, $2.43, $3.24
  });
  it("Tilopay", () => {
    // 9.99 × 0.0425 = 0.42 + 0.35 = 0.77; base = 8.84 − 0.77 = 8.07
    expect(netBase(999, "tilopay")).toEqual({ tax: 115, fee: 77, net: 807 });
  });
  it("nunca negativa ni redondea hacia arriba", () => {
    expect(netBase(30, "onvo").net).toBe(0);
    expect(commissionLine({ grossMinor: 1001, provider: "onvo", activeCount: 1 }).commission).toBe(Math.floor(netBase(1001, "onvo").net / 10));
  });
});

describe("cookie del enlace", () => {
  it("el último clic gana y vence a los 60 días", () => {
    const t = NOW.getTime();
    const first = affCookieValue("ana", t - 5 * 864e5);
    const last = affCookieValue("beto", t - 864e5);
    expect(parseAffCookie(last, t)?.code).toBe("beto");
    expect(parseAffCookie(first, t)?.code).toBe("ana");
    expect(parseAffCookie(affCookieValue("ana", t - 61 * 864e5), t)).toBeNull();
    expect(parseAffCookie("ANA!.123", t)).toBeNull();
    expect(normalizeAffCode(" Carla-Fit ")).toBe("carla-fit");
  });
});

describe("espera y pago mínimo", () => {
  it("pasa a disponible después de 30 días", () => {
    const paid = new Date("2026-11-01T00:00:00Z");
    const at = availableAt(paid, 30);
    expect(at.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    const l = [{ status: "pending", commission_minor: 500, available_at: at.toISOString() }];
    expect(balances(l, at.getTime() - 1)).toEqual({ pending: 500, available: 0, paid: 0 });
    expect(balances(l, at.getTime())).toEqual({ pending: 0, available: 500, paid: 0 });
  });
  it("mínimo de $20 y método de pago", () => {
    expect(payoutDue(1999, 2000, true)).toBe(false);
    expect(payoutDue(2000, 2000, true)).toBe(true);
    expect(payoutDue(5000, 2000, false)).toBe(false);
  });
});

describe("comisiones con la base", () => {
  it("una por pago (idempotente) con el % del nivel actual", async () => {
    const db = world(12);
    const p = { userId: REF(1), provider: "onvo" as const, reference: "pay_1", amountMinor: 999, currency: "USD", plan: "entreno" as const, billing: "mensual" as never };
    expect(await affiliateOnPaid(db, p, NOW)).toBe("creada");
    expect(await affiliateOnPaid(db, p, NOW)).toBe("duplicada");
    const lines = await all(db, "affiliate_commissions");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ payment_ref: "onvo:pay_1", rate_pct: 20, net_minor: 810, commission_minor: 162, status: "pending", active_count: 12 });
  });
  it("sin comisión si paga con la misma tarjeta del referidor", async () => {
    const db = world(3);
    await db.from("card_fingerprints").insert([{ user_id: AFF, fingerprint: "fp1" }, { user_id: REF(1), fingerprint: "fp1" }]);
    expect(await affiliateOnPaid(db, { userId: REF(1), provider: "tilopay", reference: "t1", amountMinor: 999, currency: "USD", plan: "entreno", billing: "mensual" as never }, NOW)).toBe("misma_tarjeta");
  });
  it("sin comisión si el referidor fue revocado", async () => {
    const db = world(3);
    await db.from("affiliates").update({ active: false }).eq("user_id", AFF);
    expect(await affiliateOnPaid(db, { userId: REF(1), provider: "onvo", reference: "x", amountMinor: 999, currency: "USD", plan: "entreno", billing: "mensual" as never }, NOW)).toBe("inactivo");
  });
  it("reembolso: revierte; si ya se pagó, ajuste negativo (una sola vez)", async () => {
    const db = world(2);
    await affiliateOnPaid(db, { userId: REF(1), provider: "onvo", reference: "r1", amountMinor: 999, currency: "USD", plan: "entreno", billing: "mensual" as never }, NOW);
    const [l] = await all(db, "affiliate_commissions");
    expect(await reverseCommission(db, l.id as number, "reembolso", null, NOW)).toBe("revertida");
    expect(await reverseCommission(db, l.id as number, "reembolso", null, NOW)).toBe("ya");
    await affiliateOnPaid(db, { userId: REF(2), provider: "onvo", reference: "r2", amountMinor: 999, currency: "USD", plan: "entreno", billing: "mensual" as never }, NOW);
    const l2 = (await all(db, "affiliate_commissions")).find((x) => x.payment_ref === "onvo:r2")!;
    await db.from("affiliate_commissions").update({ status: "paid" }).eq("id", l2.id);
    expect(await reverseCommission(db, l2.id as number, "contracargo", null, NOW)).toBe("ajuste");
    expect(await reverseCommission(db, l2.id as number, "contracargo", null, NOW)).toBe("ya");
    const adj = (await all(db, "affiliate_commissions")).filter((x) => x.kind === "ajuste");
    expect(adj).toHaveLength(1);
    expect(adj[0].commission_minor).toBe(-(l2.commission_minor as number));
  });
  it("pagos del mes: solo con método y desde $20", async () => {
    const db = world(31);
    await db.from("affiliate_commissions").insert([
      { affiliate_id: AFF, payment_ref: "a", kind: "pago", commission_minor: 1500, status: "pending", available_at: new Date(NOW.getTime() - 864e5).toISOString(), payout_id: null },
      { affiliate_id: AFF, payment_ref: "b", kind: "pago", commission_minor: 400, status: "available", available_at: NOW.toISOString(), payout_id: null },
    ]);
    expect(await runPayouts(db, "owner", NOW)).toMatchObject({ created: 0, skippedNoMethod: 1 });
    await db.from("affiliate_payout_methods").insert({ user_id: AFF, kind: "sinpe", sinpe_phone: "88884821", holder_name: "Carla" });
    expect(await runPayouts(db, "owner", NOW)).toMatchObject({ created: 0, skippedLow: 1 });
    await db.from("affiliate_commissions").insert({ affiliate_id: AFF, payment_ref: "c", kind: "pago", commission_minor: 300, status: "available", available_at: NOW.toISOString(), payout_id: null });
    expect(await runPayouts(db, "owner", NOW)).toMatchObject({ created: 1, total: 2200 });
    expect(mail.sendTeamAffiliatePayouts).toHaveBeenCalledOnce();
  });
});

describe("acceso gratis del nivel máximo", () => {
  it("con 31 pagando: da la cortesía hasta fin de mes y deja de cobrarle", async () => {
    const db = world(31);
    await db.from("subscriptions").insert({ id: 99, user_id: AFF, plan: "completo", status: "active", current_period_end: future, cancel_at_period_end: false });
    expect(await syncPerk(db, { user_id: AFF, perk_since: null, perk_notice_at: null }, DEFAULT_SETTINGS, NOW)).toBe("on");
    const g = await all(db, "comp_grants");
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ source: "afiliado", expires_at: endOfMonthCR(NOW).toISOString() });
    expect(billing.cancelAtPeriodEnd).toHaveBeenCalledOnce();
    expect(mail.sendAffiliateEmail).toHaveBeenCalledWith(expect.objectContaining({ kind: "nivel_maximo" }));
  });
  it("en la última semana del mes se extiende al mes siguiente", () => {
    expect(perkTarget(new Date("2026-11-26T18:00:00Z")).toISOString()).toBe(endOfMonthCR(new Date("2026-11-26T18:00:00Z"), 1).toISOString());
    expect(perkTarget(NOW).toISOString()).toBe(endOfMonthCR(NOW).toISOString());
  });
  it("al bajar de 31: avisa 7 días antes y la cortesía vence a fin de mes", async () => {
    const db = world(30);
    const end = endOfMonthCR(NOW).toISOString();
    await db.from("comp_grants").insert({ id: 5, user_id: AFF, plan: "completo", source: "afiliado", starts_at: NOW.toISOString(), expires_at: end, revoked_at: null });
    const a = { user_id: AFF, perk_since: "2026-10-01T00:00:00Z", perk_notice_at: null };
    expect(await syncPerk(db, a, DEFAULT_SETTINGS, NOW)).toBe("none"); // faltan más de 7 días
    const late = new Date(Date.parse(end) - 5 * 864e5);
    expect(await syncPerk(db, a, DEFAULT_SETTINGS, late)).toBe("notice");
    expect((await all(db, "comp_grants"))[0].expires_at).toBe(end); // no se extiende
    const after = new Date(Date.parse(end) + 3600_000);
    expect(await syncPerk(db, { ...a, perk_notice_at: late.toISOString() }, DEFAULT_SETTINGS, after)).toBe("off");
  });
});

