// Reglas de los correos después del primer pago (primer-pago.ts): a quién le toca cada pieza y cuándo.
import { describe, expect, it } from "vitest";
import { firstPaidSubscription, firstPaymentAt, firstPaymentDay, firstPaymentStep, type FirstPaymentSub } from "./primer-pago";

const PAID = "2026-11-10T15:00:00.000Z";
const at = (iso: string, hours: number) => new Date(Date.parse(iso) + hours * 3600_000);
const sub = (over: Partial<FirstPaymentSub> = {}): FirstPaymentSub => ({
  status: "active", plan: "entreno", billing: "mes", cancel_at_period_end: false,
  current_period_start: PAID, current_period_end: "2026-12-10T15:00:00.000Z", created_at: "2026-11-10T14:58:00.000Z", ...over,
});
const step = (subs: FirstPaymentSub[], now: Date, emailReminders = true) => firstPaymentStep({ subs, now, emailReminders });

describe("ventanas del día 1 y del día 21", () => {
  it("día 1 entre las 24 y las 48 horas del pago; día 21 entre los 21 y los 22 días completos", () => {
    expect(step([sub()], at(PAID, 23.9))).toBeNull();
    expect(step([sub()], at(PAID, 24))).toBe("primer_pago_d1");
    expect(step([sub()], at(PAID, 47.9))).toBe("primer_pago_d1");
    expect(step([sub()], at(PAID, 48))).toBeNull();
    expect(step([sub()], at(PAID, 21 * 24 - 0.1))).toBeNull();
    expect(step([sub()], at(PAID, 21 * 24))).toBe("primer_pago_d21");
    expect(step([sub()], at(PAID, 22 * 24))).toBeNull();
  });

  it("vale para los dos planes mensuales y da el día de la plantilla", () => {
    expect(step([sub({ plan: "completo" })], at(PAID, 30))).toBe("primer_pago_d1");
    expect(firstPaymentDay("primer_pago_d1")).toBe(1);
    expect(firstPaymentDay("primer_pago_d21")).toBe(21);
  });
});

describe("a quién no le llega", () => {
  it("baja de recordatorios", () => {
    expect(step([sub()], at(PAID, 30), false)).toBeNull();
  });

  it("sin pago confirmado: sin suscripción (cortesía, regalo, condominio, beta) o con la suscripción en 'incomplete'", () => {
    expect(step([], at(PAID, 30))).toBeNull();
    expect(step([sub({ status: "incomplete", current_period_start: null, current_period_end: null })], at(PAID, 30))).toBeNull();
  });

  it("plan anual, o un plan desconocido", () => {
    expect(step([sub({ billing: "anual", current_period_end: "2027-11-10T15:00:00.000Z" })], at(PAID, 30))).toBeNull();
    expect(step([sub({ plan: null })], at(PAID, 30))).toBeNull();
  });

  it("renovación: el periodo ya no es el primero de la fila, así que el mes 2 no repite las piezas", () => {
    const renewed = sub({ created_at: "2026-10-10T14:58:00.000Z", current_period_start: PAID });
    expect(firstPaymentAt([renewed])).toBeNull();
    expect(step([renewed], at(PAID, 30))).toBeNull();
    expect(step([renewed], at(PAID, 21 * 24 + 1))).toBeNull();
  });

  it("ya había pagado antes: una suscripción vieja (cancelada) es el primer pago, no la nueva", () => {
    const old = sub({ status: "canceled", created_at: "2026-06-01T10:00:00.000Z", current_period_start: "2026-06-01T10:00:00.000Z", current_period_end: "2026-07-01T10:00:00.000Z" });
    expect(firstPaidSubscription([sub(), old])).toBe(old);
    expect(step([sub(), old], at(PAID, 30))).toBeNull();
  });

  it("canceló, quedó en past_due, venció o pasó a anual: se revalida antes de cada envío", () => {
    expect(step([sub({ cancel_at_period_end: true })], at(PAID, 21 * 24 + 1))).toBeNull();
    expect(step([sub({ status: "past_due" })], at(PAID, 30))).toBeNull();
    expect(step([sub({ status: "canceled" })], at(PAID, 30))).toBeNull();
    expect(step([sub({ current_period_end: "2026-11-11T00:00:00.000Z" })], at(PAID, 30))).toBeNull();
    const annual = sub({ billing: "anual", created_at: "2026-11-20T10:00:00.000Z", current_period_start: "2026-11-20T10:00:00.000Z", current_period_end: "2027-11-20T10:00:00.000Z" });
    expect(step([sub({ status: "canceled" }), annual], at(PAID, 21 * 24 + 1))).toBeNull();
  });
});

describe("cambios que no cortan la secuencia", () => {
  it("el primer mes con 50 % de ONVO es su propia fila: cuenta como primer pago", () => {
    expect(step([sub({ plan: "completo" })], at(PAID, 21 * 24 + 2))).toBe("primer_pago_d21");
  });

  it("subió de Entreno a Entreno + Nutrición en el mes: el ancla sigue siendo el primer pago", () => {
    const first = sub({ status: "canceled" });
    const upgrade = sub({ plan: "completo", created_at: "2026-11-15T10:00:00.000Z", current_period_start: "2026-11-15T10:00:00.000Z", current_period_end: "2026-12-15T10:00:00.000Z" });
    expect(step([first, upgrade], at(PAID, 21 * 24 + 2))).toBe("primer_pago_d21");
  });
});
