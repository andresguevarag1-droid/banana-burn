import { describe, expect, it } from "vitest";
import {
  DAY_MS, MAX_ATTEMPTS, TRIAL_CARD_LINE, afterDecline, amountMinorFor, attemptKeyFor, bannerFor, canCancel, canChangePlan, cardRequired,
  cardStepFor, chargeView, idemKeyFor, isDue, kindFor, onCardSaved, reminderDue, reminderLine, scheduleFor, signedUpInBeta, trialLive,
  type TrialChargeRow,
} from "./trial";
import { PLANS } from "./plans";

const BETA = "2026-11-01T06:00:00.000Z";
const at = (s: string) => new Date(s);
const plus = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);
const START = at("2026-11-10T15:00:00.000Z");

function row(over: Partial<TrialChargeRow> = {}): TrialChargeRow {
  const s = scheduleFor("prueba", START, BETA);
  return {
    id: 1, user_id: "u1", idem_key: idemKeyFor("u1"), kind: "prueba", plan: "completo", billing: "mes", amount_minor: 1499,
    trial_started_at: s.trialStartedAt, trial_ends_at: s.trialEndsAt, charge_at: s.chargeAt, next_attempt_at: s.chargeAt, status: "scheduled",
    attempts: 0, last_attempt_at: null, provider_subscription_id: null, last_error: null, reminder_sent_at: null, failure_notified_attempt: null,
    canceled_at: null, created_at: s.trialStartedAt, updated_at: s.trialStartedAt, ...over,
  };
}

describe("antes y después del 1 de noviembre", () => {
  it("la tarjeta solo se pide desde el fin de la beta", () => {
    expect(cardRequired(at("2026-11-01T05:59:59Z"), BETA)).toBe(false);
    expect(cardRequired(at("2026-11-01T06:00:00Z"), BETA)).toBe(true);
  });
  it("tipo de primer cobro según cuándo se creó la cuenta y cuándo guarda la tarjeta", () => {
    expect(kindFor({ createdAt: "2026-10-20T00:00:00Z", now: at("2026-10-25T00:00:00Z"), betaEndsAt: BETA })).toBe("beta");
    expect(kindFor({ createdAt: "2026-10-20T00:00:00Z", now: at("2026-11-03T00:00:00Z"), betaEndsAt: BETA })).toBe("inmediato");
    expect(kindFor({ createdAt: "2026-11-02T00:00:00Z", now: at("2026-11-03T00:00:00Z"), betaEndsAt: BETA })).toBe("prueba");
    expect(signedUpInBeta(null, BETA)).toBe(true);
  });
  it("cuenta de la beta: sin días extra, se cobra al terminar la beta (o ya, si guarda la tarjeta después)", () => {
    const b = scheduleFor("beta", at("2026-10-25T00:00:00Z"), BETA);
    expect(b.chargeAt).toBe(BETA);
    expect(b.trialEndsAt).toBe(BETA);
    const i = scheduleFor("inmediato", at("2026-11-03T00:00:00Z"), BETA);
    expect(i.chargeAt).toBe("2026-11-03T00:00:00.000Z");
  });
});

describe("qué día se cobra", () => {
  it("la prueba dura 7 días exactos desde que se guarda la tarjeta y el cobro es al terminar (día 7)", () => {
    const s = scheduleFor("prueba", START, BETA);
    expect(Date.parse(s.trialEndsAt) - START.getTime()).toBe(7 * DAY_MS);
    expect(s.chargeAt).toBe(s.trialEndsAt);
  });
  it("no se cobra antes de tiempo, sí al llegar el momento", () => {
    const r = row();
    expect(isDue(r, plus(START, 6))).toBe(false);
    expect(isDue(r, new Date(Date.parse(r.charge_at) - 1000))).toBe(false);
    expect(isDue(r, at(r.charge_at))).toBe(true);
    expect(isDue(r, plus(START, 7.5))).toBe(true);
  });
  it("solo los programados o con reintento se cobran", () => {
    for (const status of ["charging", "pending", "unknown", "failed", "succeeded", "canceled", "superseded"] as const) expect(isDue(row({ status }), plus(START, 8))).toBe(false);
    expect(isDue(row({ status: "retry_scheduled", next_attempt_at: plus(START, 8).toISOString() }), plus(START, 8))).toBe(true);
  });
  it("aviso 2 días antes (día 5), una sola vez", () => {
    const r = row();
    expect(reminderDue(r, plus(START, 4.9))).toBe(false);
    expect(reminderDue(r, plus(START, 5))).toBe(true);
    expect(reminderDue(r, plus(START, 6.9))).toBe(true);
    expect(reminderDue(r, plus(START, 7))).toBe(false);
    expect(reminderDue({ ...r, reminder_sent_at: plus(START, 5).toISOString() }, plus(START, 5.5))).toBe(false);
    expect(reminderDue({ ...r, status: "canceled" }, plus(START, 5.5))).toBe(false);
    expect(reminderDue({ ...r, kind: "inmediato" }, plus(START, 5.5))).toBe(false);
  });
  it("textos exactos", () => {
    expect(TRIAL_CARD_LINE).toBe("7 días gratis. Hoy no te cobramos. El día 7 se cobra tu plan, salvo que canceles antes.");
    expect(reminderLine(14.99)).toBe("En 2 días se cobra tu plan de $14.99. Puedes cancelar sin costo hasta el día 7.");
    expect(reminderLine(9.99, "beta", "1 de noviembre")).toBe("En 2 días se cobra tu plan de $9.99, el 1 de noviembre. Puedes cancelar sin costo antes de esa fecha.");
  });
});

describe("rechazo y reintento", () => {
  it("el rechazo del día 7 se reintenta una vez al día siguiente (día 8)", () => {
    const now = plus(START, 7);
    expect(afterDecline({ attempts: 1 }, now)).toEqual({ status: "retry_scheduled", nextAttemptAt: plus(now, 1).toISOString() });
  });
  it("si el reintento también falla, no hay más intentos automáticos", () => {
    expect(afterDecline({ attempts: 2 }, plus(START, 8))).toEqual({ status: "failed", nextAttemptAt: null });
  });
  it("una tarjeta nueva después de un rechazo cobra en ese momento", () => {
    expect(onCardSaved(row({ status: "retry_scheduled", attempts: 1 }), { createdAt: START.toISOString(), now: plus(START, 7.2) })).toEqual({ do: "charge_now" });
    expect(onCardSaved(row({ status: "failed", attempts: 2 }), { createdAt: START.toISOString(), now: plus(START, 9) })).toEqual({ do: "charge_now" });
    expect(onCardSaved(row({ status: "failed", attempts: MAX_ATTEMPTS }), { createdAt: START.toISOString(), now: plus(START, 9) })).toEqual({ do: "card_only" });
  });
});

describe("máquina de estados al guardar la tarjeta", () => {
  const ctx = { createdAt: START.toISOString(), now: plus(START, 2), betaEndsAt: BETA };
  it("sin fila: se crea con el tipo que corresponde", () => {
    expect(onCardSaved(null, ctx)).toEqual({ do: "create", kind: "prueba" });
    expect(onCardSaved(null, { ...ctx, createdAt: "2026-10-01T00:00:00Z" })).toEqual({ do: "create", kind: "inmediato" });
  });
  it("programado: solo cambia la tarjeta", () => expect(onCardSaved(row(), ctx)).toEqual({ do: "keep" }));
  it("cancelado antes del fin: se reanuda; después del fin: se cobra", () => {
    expect(onCardSaved(row({ status: "canceled" }), ctx)).toEqual({ do: "resume" });
    expect(onCardSaved(row({ status: "canceled" }), { ...ctx, now: plus(START, 10) })).toEqual({ do: "charge_now" });
  });
  it("cobro en curso: espera (nunca dos cobros a la vez)", () => {
    for (const status of ["charging", "pending", "unknown"] as const) expect(onCardSaved(row({ status }), ctx)).toEqual({ do: "busy" });
  });
  it("ya cobrado o reemplazado: solo guarda la tarjeta", () => {
    expect(onCardSaved(row({ status: "succeeded" }), ctx)).toEqual({ do: "card_only" });
    expect(onCardSaved(row({ status: "superseded" }), ctx)).toEqual({ do: "card_only" });
  });
});

describe("cancelar antes del día 7", () => {
  it("se puede cancelar mientras está programado o después de un rechazo, no con el cobro en curso", () => {
    expect(canCancel(row())).toBe(true);
    expect(canCancel(row({ status: "retry_scheduled" }))).toBe(true);
    expect(canCancel(row({ status: "failed" }))).toBe(true);
    expect(canCancel(row({ status: "charging" }))).toBe(false);
    expect(canCancel(row({ status: "succeeded" }))).toBe(false);
    expect(canCancel(null)).toBe(false);
  });
  it("cancelado antes del día 7: sigue con acceso hasta el final de la prueba, nunca después", () => {
    const card = { status: "disconnected" as const };
    expect(trialLive(row({ status: "canceled" }), card, START.toISOString(), plus(START, 6.9), BETA)).toBe(true);
    expect(trialLive(row({ status: "canceled" }), card, START.toISOString(), plus(START, 7), BETA)).toBe(false);
    expect(isDue(row({ status: "canceled", next_attempt_at: null }), plus(START, 7))).toBe(false);
  });
  it("cambiar el plan: solo programado y antes del cobro", () => {
    expect(canChangePlan(row(), plus(START, 3))).toBe(true);
    expect(canChangePlan(row(), plus(START, 7))).toBe(false);
    expect(canChangePlan(row({ status: "canceled" }), plus(START, 3))).toBe(false);
  });
});

describe("prueba vigente (misma regla que _trial_live en 0026)", () => {
  const card = { status: "active" as const };
  it("cuenta nueva con tarjeta y cobro programado", () => expect(trialLive(row(), card, START.toISOString(), plus(START, 1), BETA)).toBe(true));
  it("sin tarjeta no hay prueba", () => expect(trialLive(row(), null, START.toISOString(), plus(START, 1), BETA)).toBe(false));
  it("una cuenta de la beta no recibe prueba aunque tenga fila", () => expect(trialLive(row(), card, "2026-10-15T00:00:00Z", plus(START, 1), BETA)).toBe(false));
  it("rechazado o con reintento: muro", () => {
    expect(trialLive(row({ status: "failed" }), card, START.toISOString(), plus(START, 1), BETA)).toBe(false);
    expect(trialLive(row({ status: "retry_scheduled" }), card, START.toISOString(), plus(START, 1), BETA)).toBe(false);
  });
  it("solo la fila de tipo prueba", () => expect(trialLive(row({ kind: "beta" }), card, START.toISOString(), plus(START, 1), BETA)).toBe(false));
});

describe("qué pide la pantalla de la tarjeta", () => {
  const base = { paidAccess: false, betaEndsAt: BETA };
  it("con plan pagado no pide nada", () => expect(cardStepFor({ ...base, paidAccess: true, createdAt: "2026-10-01T00:00:00Z", row: null, now: at("2026-10-20T00:00:00Z") })).toBe("none"));
  it("beta: cuenta sin tarjeta, aviso para agregarla", () => expect(cardStepFor({ ...base, createdAt: "2026-10-01T00:00:00Z", row: null, now: at("2026-10-20T00:00:00Z") })).toBe("beta"));
  it("después de la beta: cuenta nueva empieza su prueba; cuenta de la beta paga", () => {
    expect(cardStepFor({ ...base, createdAt: "2026-11-05T00:00:00Z", row: null, now: at("2026-11-05T01:00:00Z") })).toBe("trial");
    expect(cardStepFor({ ...base, createdAt: "2026-10-01T00:00:00Z", row: null, now: at("2026-11-05T01:00:00Z") })).toBe("pay");
  });
  it("rechazado: cambiar tarjeta; cancelado y ya terminó: pagar; programado: nada", () => {
    expect(cardStepFor({ ...base, createdAt: START.toISOString(), row: row({ status: "retry_scheduled" }), now: plus(START, 7.1) })).toBe("pay");
    expect(cardStepFor({ ...base, createdAt: START.toISOString(), row: row({ status: "canceled" }), now: plus(START, 8) })).toBe("pay");
    expect(cardStepFor({ ...base, createdAt: START.toISOString(), row: row({ status: "canceled" }), now: plus(START, 3) })).toBe("none");
    expect(cardStepFor({ ...base, createdAt: START.toISOString(), row: row(), now: plus(START, 3) })).toBe("none");
  });
});

describe("aviso de arriba para cuentas de la beta y cobros", () => {
  const view = (over: Partial<TrialChargeRow>, now = plus(START, 3)) => chargeView(row(over), now);
  it("beta sin tarjeta: pedir la tarjeta", () => expect(bannerFor({ betaLive: true, fromSubscription: false, cardStep: "beta", charge: null, trial: true })).toBe("beta-add"));
  it("beta con tarjeta guardada: muestra el cobro programado", () => expect(bannerFor({ betaLive: true, fromSubscription: false, cardStep: "none", charge: view({ kind: "beta" }), trial: true })).toBe("beta-scheduled"));
  it("beta con plan pagado: el aviso de la beta de siempre no aplica", () => expect(bannerFor({ betaLive: true, fromSubscription: true, cardStep: "none", charge: null, trial: false })).toBe("none"));
  it("cobro rechazado o en curso: siempre primero", () => {
    expect(bannerFor({ betaLive: true, fromSubscription: false, cardStep: "pay", charge: view({ status: "retry_scheduled" }), trial: false })).toBe("failed");
    expect(bannerFor({ betaLive: false, fromSubscription: false, cardStep: "none", charge: view({ status: "pending" }), trial: false })).toBe("processing");
  });
  it("después de la beta, en la prueba: el aviso de la prueba", () => expect(bannerFor({ betaLive: false, fromSubscription: false, cardStep: "none", charge: view({}), trial: true })).toBe("trial"));
  it("después de la beta, sin prueba ni cobro: nada (el muro ya lo dice)", () => expect(bannerFor({ betaLive: false, fromSubscription: false, cardStep: "pay", charge: null, trial: false })).toBe("none"));
});

describe("vista del cobro", () => {
  it("fases, días que faltan y acciones", () => {
    expect(chargeView(row(), plus(START, 4.5))).toMatchObject({ phase: "programado", amount: 14.99, daysToCharge: 3, canCancel: true, canChangePlan: true, due: false, remind: false });
    expect(chargeView(row(), plus(START, 5.5))).toMatchObject({ daysToCharge: 2, remind: true });
    expect(chargeView(row({ status: "pending" }))!.phase).toBe("procesando");
    expect(chargeView(row({ status: "retry_scheduled", next_attempt_at: "2026-11-18T15:00:00.000Z" }))!.retryAt).toBe("2026-11-18T15:00:00.000Z");
    expect(chargeView(row({ status: "superseded" }))).toBeNull();
    expect(chargeView(null)).toBeNull();
  });
});

describe("idempotencia y precio", () => {
  it("una clave por persona y una por intento", () => {
    expect(idemKeyFor("u1")).toBe("trial:u1");
    expect(attemptKeyFor({ idem_key: "trial:u1", attempts: 1 })).not.toBe(attemptKeyFor({ idem_key: "trial:u1", attempts: 2 }));
  });
  it("el monto sale de plans.ts, sin descuentos por nivel", () => {
    for (const p of PLANS) for (const b of ["mes", "anual"] as const) expect(amountMinorFor(p.id, b)).toBe(Math.round(p.price[b] * 100));
  });
});
