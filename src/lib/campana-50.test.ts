// #332: campaña "primer mes al 50 %" a cuentas anteriores: segmentos, exclusiones, oferta en el cobro e idempotencia del envío.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { campaignSegment, offerActive, offerExpiry, type CampaignInput } from "./campana-50";
import { promoFor } from "./trial";

const base: CampaignInput = { createdAt: "2026-11-10T12:00:00.000Z", staff: false, tester: false, comp: false, paid: false, chargeInFlight: false, emailReminders: true, alreadySent: false, workouts: 0 };

describe("segmentos", () => {
  it("entrenaron / sin entreno", () => {
    expect(campaignSegment({ ...base, workouts: 2 })).toBe("entrenaron");
    expect(campaignSegment(base)).toBe("sin_entreno");
  });
  it("solo cuentas creadas antes de la tarjeta obligatoria", () => {
    expect(campaignSegment({ ...base, createdAt: "2026-11-23T06:00:00.000Z" })).toBeNull();
    expect(campaignSegment({ ...base, createdAt: null })).toBeNull();
  });
  it.each(["staff", "tester", "comp", "paid", "chargeInFlight", "alreadySent"] as const)("fuera: %s", (k) => {
    expect(campaignSegment({ ...base, [k]: true })).toBeNull();
  });
  it("fuera: se dio de baja de los correos", () => {
    expect(campaignSegment({ ...base, emailReminders: false })).toBeNull();
  });
});

describe("oferta en el cobro", () => {
  it("vale OFFER_DAYS desde el envío", () => {
    const sent = new Date("2026-11-24T12:00:00.000Z");
    const row = { expires_at: offerExpiry(sent) };
    expect(offerActive(row, new Date("2026-12-07T12:00:00.000Z"))).toBe(true);
    expect(offerActive(row, new Date("2026-12-08T12:00:01.000Z"))).toBe(false);
    expect(offerActive(null)).toBe(false);
  });
  it("promoFor: con la oferta, el cobro inmediato va al 50 %; nunca si ya pagó", () => {
    expect(promoFor("inmediato", false)).toBeNull();
    expect(promoFor("inmediato", false, true)).not.toBeNull();
    expect(promoFor("inmediato", true, true)).toBeNull();
  });
});

// ── Envío por tandas con una base en memoria ──
type Row = Record<string, unknown>;
let tables: Record<string, Row[]> = {};
const sent: { to: string; key?: string; subject: string }[] = [];
function query(name: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let range: [number, number] | null = null;
  let upsert: { row: Row; on: string; ignore: boolean } | null = null;
  const q = {
    select: () => q, order: () => q, limit: () => q,
    in: (c: string, v: unknown[]) => { filters.push((r) => v.includes(r[c])); return q; },
    eq: (c: string, v: unknown) => { filters.push((r) => r[c] === v); return q; },
    lt: (c: string, v: string) => { filters.push((r) => String(r[c]) < v); return q; },
    not: (c: string) => { filters.push((r) => r[c] != null); return q; },
    range: (a: number, b: number) => { range = [a, b]; return q; },
    upsert: (row: Row, o: { onConflict: string; ignoreDuplicates?: boolean }) => { upsert = { row, on: o.onConflict, ignore: Boolean(o.ignoreDuplicates) }; return q; },
    maybeSingle: () => q,
    then: (ok: (v: { data: unknown; error: null }) => unknown) => {
      const rows = (tables[name] ??= []);
      if (upsert) {
        const { row, on, ignore } = upsert;
        const keys = on.split(",");
        const i = rows.findIndex((r) => keys.every((k) => r[k] === row[k]));
        if (i >= 0) { if (ignore) return Promise.resolve(ok({ data: [], error: null })); rows[i] = row; } else rows.push(row);
        return Promise.resolve(ok({ data: [{ id: rows.length }], error: null }));
      }
      const out = rows.filter((r) => filters.every((f) => f(r)));
      return Promise.resolve(ok({ data: range ? out.slice(range[0], range[1] + 1) : out, error: null }));
    },
  };
  return q;
}
const db = { from: query, auth: { admin: { getUserById: async (id: string) => ({ data: { user: { email: `${id}@correo.com` } } }) } } };

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ STAFF: ["coach", "support", "admin", "superadmin"] }));
vi.mock("@/lib/email/send", () => ({
  unsubscribeUrl: () => "https://bananaburn.app/baja",
  sendEmail: async (to: string, msg: { subject: string }, o: { idempotencyKey?: string }) => { sent.push({ to, subject: msg.subject, key: o.idempotencyKey }); return { ok: true }; },
}));

const { sendCampaignBatch, loadAudience } = await import("./campana-50-server");
const OLD = "2026-11-10T12:00:00.000Z";

beforeEach(() => {
  sent.length = 0;
  tables = {
    profiles: [
      { id: "u1", created_at: OLD, role: "free", plan: "free" },
      { id: "u2", created_at: OLD, role: "free", plan: "free" },
      { id: "u3", created_at: OLD, role: "admin", plan: "free" },
      { id: "u4", created_at: "2026-11-23T08:00:00.000Z", role: "free", plan: "free" },
      { id: "u5", created_at: OLD, role: "free", plan: "free" },
      { id: "u6", created_at: OLD, role: "free", plan: "free" },
    ],
    workouts: [{ id: "w1", user_id: "u1", template: "A", finished_at: "2026-11-11T12:00:00.000Z" }],
    workout_sets: [{ workout_id: "w1", user_id: "u1", kg: 50, reps: 10, done: true }],
    subscriptions: [{ user_id: "u5", status: "active" }],
    notification_prefs: [{ user_id: "u6", email_reminders: false }],
  };
});

describe("envío por tandas", () => {
  it("cuenta los segmentos con las exclusiones", async () => {
    const a = await loadAudience(db as never);
    expect(a.counts).toEqual({ entrenaron: 1, sin_entreno: 1 });
    expect(a.targets.map((t) => t.id).sort()).toEqual(["u1", "u2"]);
  });
  it("envía una vez por cuenta, deja la oferta y la llave de idempotencia; tocar otra vez no repite", async () => {
    const now = new Date("2026-11-24T12:00:00.000Z");
    const r = await sendCampaignBatch(db as never, now, { pauseMs: 0 });
    expect(r).toMatchObject({ claimed: 2, emailed: 2, failed: 0, left: 0 });
    expect(sent.map((s) => s.key).sort()).toEqual(["campana_50_actuales/u1", "campana_50_actuales/u2"]);
    expect(sent.find((s) => s.to.startsWith("u1"))?.subject).toBe("Tu primer mes a mitad de precio");
    expect(sent.find((s) => s.to.startsWith("u2"))?.subject).toBe("Tu primer entreno dura 12 min");
    expect(tables.promo_offers.map((o) => o.user_id).sort()).toEqual(["u1", "u2"]);
    expect(tables.promo_offers[0].expires_at).toBe(offerExpiry(now));
    const again = await sendCampaignBatch(db as never, now, { pauseMs: 0 });
    expect(again).toMatchObject({ claimed: 0, emailed: 0, left: 0 });
    expect(sent).toHaveLength(2);
  });
  it("tandas: respeta el límite y deja el resto para el siguiente toque", async () => {
    const r = await sendCampaignBatch(db as never, new Date(), { pauseMs: 0, limit: 1 });
    expect(r).toMatchObject({ emailed: 1, left: 1 });
  });
});

describe("correo en inglés", () => {
  it("sin restos en español", async () => {
    const { campana50 } = await import("./email/templates");
    for (const segment of ["entrenaron", "sin_entreno"] as const) {
      const m = campana50({ segment, progress: { workouts: 2, sets: 12, kg: 900 }, unsubscribe: "https://x", offerDays: 14, locale: "en-US" });
      expect(m.text).not.toMatch(/\b(cuesta|entreno|primer mes|Recibes)\b/);
    }
  });
});
