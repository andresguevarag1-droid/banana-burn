import { describe, expect, it } from "vitest";
import { trialCardNotice } from "./trial-card-notice";
import { DAY_MS, scheduleFor } from "./trial";
import { demoCardState } from "./trial-demo";
const start = new Date("2026-11-02T18:30:00Z");
const schedule = scheduleFor("prueba", start, undefined, 7, start.toISOString());
const ent = { access: "trial" as const, trial: { endsAt: schedule.chargeAt, daysLeft: 3 }, card: null, charge: null, cardStep: "trial" as const };
const at = (days: number) => new Date(+start + days * DAY_MS);
describe("aviso opcional de tarjeta", () => {
  it.each([4, 5, 6])("día transcurrido %s: fecha y monto coinciden con cobro", (elapsed) => {
    expect(trialCardNotice(ent, at(elapsed))).toEqual({ day: elapsed + 1, chargeAt: "2026-11-09T18:30:00.000Z", entreno: 4.99, completo: 7.49 });
  });
  it.each([0, 3.999999, 7, 8])("no aparece fuera de días 5 a 7 (%s)", elapsed => {
    expect(trialCardNotice(ent, at(elapsed))).toBeNull();
  });
  it("se oculta con tarjeta guardada, beta, cobro, cortesía o fecha inválida", () => {
    expect(trialCardNotice({ ...ent, card: { active: true, brand: "visa", last4: "4242", expMonth: 12, expYear: 2029 } }, at(5))).toBeNull();
    expect(trialCardNotice({ ...ent, trial: { ...ent.trial, beta: true } }, at(5))).toBeNull();
    expect(trialCardNotice({ ...ent, charge: demoCardState("prueba").charge }, at(5))).toBeNull();
    expect(trialCardNotice({ ...ent, access: "comp" }, at(5))).toBeNull();
    expect(trialCardNotice({ ...ent, trial: { endsAt: "invalid", daysLeft: 1 } }, at(5))).toBeNull();
  });
  it.each([5, 6, 7])("demo reproduce día %s", day => {
    const demo = demoCardState(`dia${day}`, start);
    expect(trialCardNotice({ ...demo, access: "trial" }, start)?.day).toBe(day);
  });
});
