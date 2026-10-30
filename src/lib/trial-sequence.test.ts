import { describe, expect, it } from "vitest";
import { chargeReminderToday, trialSequenceStep, trialStepAt, type TrialSequenceInput } from "./trial-sequence";

const H = 3600_000;
const SIGNUP = "2026-11-02T12:00:00.000Z"; // después del lanzamiento (BETA_ENDS_AT, 1 nov)
const at = (hours: number) => new Date(Date.parse(SIGNUP) + hours * H);
const chargeAt = new Date(Date.parse(SIGNUP) + 7 * 24 * H).toISOString();

const base = (over: Partial<TrialSequenceInput> = {}): TrialSequenceInput => ({
  createdAt: SIGNUP, now: at(25), emailReminders: true, profilePlan: "free", staff: false, paid: false, comp: false, tester: false, charge: null, ...over,
});

describe("ventanas de la secuencia (24, 72 y 120 horas desde el registro)", () => {
  it("día 2, 4 y 6 en su ventana de 24 horas", () => {
    expect(trialStepAt(SIGNUP, at(24))).toBe("prueba_d2");
    expect(trialStepAt(SIGNUP, at(47.9))).toBe("prueba_d2");
    expect(trialStepAt(SIGNUP, at(72))).toBe("prueba_d4");
    expect(trialStepAt(SIGNUP, at(120))).toBe("prueba_d6");
    expect(trialStepAt(SIGNUP, at(143.9))).toBe("prueba_d6");
  });
  it("fuera de las ventanas no hay pieza (ni se recuperan atrasadas)", () => {
    for (const h of [0, 23.9, 48, 60, 96, 144, 168, 24 * 30]) expect(trialStepAt(SIGNUP, at(h)), `${h} h`).toBeNull();
  });
  it("las cuentas de la beta no reciben la secuencia", () => {
    const beta = "2026-10-28T12:00:00.000Z";
    for (const days of [1, 3, 5]) expect(trialStepAt(beta, new Date(Date.parse(beta) + days * 24 * H + H))).toBeNull();
  });
  it("sin fecha de registro, nada", () => {
    expect(trialStepAt(null, at(25))).toBeNull();
    expect(trialStepAt("no-es-fecha", at(25))).toBeNull();
  });
});

describe("a quién le llega", () => {
  it("prueba normal sin plan pago, con recordatorios activos", () => {
    expect(trialSequenceStep(base())).toBe("prueba_d2");
    expect(trialSequenceStep(base({ now: at(73) }))).toBe("prueba_d4");
    expect(trialSequenceStep(base({ now: at(121) }))).toBe("prueba_d6");
  });
  it("con tarjeta guardada y cobro programado, los días 2 y 4", () => {
    const charge = { status: "scheduled" as const, kind: "prueba" as const, charge_at: chargeAt, reminder_sent_at: null };
    expect(trialSequenceStep(base({ charge }))).toBe("prueba_d2");
    expect(trialSequenceStep(base({ charge, now: at(73) }))).toBe("prueba_d4");
  });
});

describe("a quién no le llega", () => {
  it("se dio de baja de los recordatorios", () => {
    expect(trialSequenceStep(base({ emailReminders: false }))).toBeNull();
  });
  it("ya pagó un plan, tiene plan asignado o es staff", () => {
    expect(trialSequenceStep(base({ paid: true }))).toBeNull();
    for (const plan of ["entreno", "completo", "pro"]) expect(trialSequenceStep(base({ profilePlan: plan }))).toBeNull();
    expect(trialSequenceStep(base({ staff: true }))).toBeNull();
  });
  it("cortesía, regalo, mes gratis de condominio o tester", () => {
    expect(trialSequenceStep(base({ comp: true }))).toBeNull();
    expect(trialSequenceStep(base({ tester: true }))).toBeNull();
  });
  it("canceló el cobro programado, o el cobro ya se hizo o está en curso", () => {
    for (const status of ["canceled", "succeeded", "charging", "pending", "failed", "retry_scheduled", "superseded"] as const) {
      expect(trialSequenceStep(base({ charge: { status, kind: "prueba", charge_at: chargeAt, reminder_sent_at: null } })), status).toBeNull();
    }
  });
  it("el día del aviso del cobro va solo recordatorioCobro (día 6 con cobro programado)", () => {
    const charge = { status: "scheduled" as const, kind: "prueba" as const, charge_at: chargeAt, reminder_sent_at: null };
    expect(chargeReminderToday(charge, at(121))).toBe(true);
    expect(trialSequenceStep(base({ charge, now: at(121) }))).toBeNull();
  });
  it("si el aviso del cobro ya salió hoy, tampoco va la pieza", () => {
    const charge = { status: "scheduled" as const, kind: "prueba" as const, charge_at: new Date(at(200).getTime()).toISOString(), reminder_sent_at: at(70).toISOString() };
    expect(chargeReminderToday(charge, at(73))).toBe(true);
    expect(trialSequenceStep(base({ charge, now: at(73) }))).toBeNull();
    expect(chargeReminderToday(charge, at(97))).toBe(false);
  });
});
