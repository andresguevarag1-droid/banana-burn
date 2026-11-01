import { expect, it, vi } from "vitest";
import { fakeDb } from "./fake-db";
import type { SubscriptionRow } from "./entitlements";
import { expectedAmountMinor } from "./onvo";
import { activateVerified } from "./billing";

vi.mock("@/lib/trial-billing", () => ({ trialOnActivated: vi.fn(async () => {}) }));
vi.mock("@/lib/email", () => ({ sendPaymentReceipt: vi.fn(async () => {}), sendPaymentFailed: vi.fn(), sendSubscriptionCanceled: vi.fn() }));
vi.mock("@/lib/affiliates-server", () => ({ affiliateOnPaid: vi.fn(async () => {}) }));
vi.mock("@/lib/admin-avisos-server", () => ({ enqueueAdminEvent: vi.fn(async () => {}), kickAdminDispatch: vi.fn(async () => {}) }));

it.each(["onvo", "tilopay"] as const)("%s: verified monthly and annual payments notify referrals once per payment", async provider => {
  for (const billing of ["mes", "anual"] as const) {
    const row: SubscriptionRow = { id: 1, user_id: "qa-friend", provider, provider_customer_id: null, provider_subscription_id: "qa-sub", status: "incomplete", price_id: null, plan: "entreno", billing, cancel_at_period_end: false, canceled_at: null, current_period_start: null, current_period_end: null, created_at: "2026-11-01T00:00:00Z" };
    const f = fakeDb({ subscriptions: [row], profiles: [{ id: row.user_id, plan: "free" }], card_fingerprints: [{ user_id: row.user_id, paid: false }] }, { payment_events: ["event_key"] });
    const args = { provider, reference: "verified-payment", periodStart: "2026-11-01T00:00:00Z", periodEnd: "2027-11-01T00:00:00Z", amountMinor: expectedAmountMinor("entreno", billing), currency: "USD" };
    expect((await activateVerified(f.db, row, { ...args, amountMinor: 0 })).ok).toBe(false);
    expect(f.rpcCalls.filter(c => c.fn === "referral_paid")).toHaveLength(0);
    // A different reference models the processor confirming a valid payment after a rejected amount.
    const valid = { ...args, reference: "valid-payment" };
    expect((await activateVerified(f.db, row, valid)).ok).toBe(true);
    expect(f.tables.card_fingerprints[0].paid).toBe(true);
    expect(f.rpcCalls.filter(c => c.fn === "referral_paid")).toEqual([{ fn: "referral_paid", args: { p_user: row.user_id, p_annual: billing === "anual" } }]);
    await activateVerified(f.db, row, valid);
    expect(f.rpcCalls.filter(c => c.fn === "referral_paid")).toHaveLength(1);
  }
});
