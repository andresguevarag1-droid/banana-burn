// Reglas del correo de checkout abandonado (#237) y su plantilla: cuándo sale, a quién no, una vez cada 7 días y el destino.
import { describe, expect, it } from "vitest";
import { abandonedCheckoutDue, cardOnFile, lastCheckout, paidSince, type AbandonedInput } from "./checkout-abandonado";
import * as T from "./email/templates";

const AT = "2026-11-03T15:00:00.000Z"; // 09:00 en Costa Rica
const now = (min: number) => new Date(Date.parse(AT) + min * 60_000);
const base = (over: Partial<AbandonedInput> = {}): AbandonedInput => ({
  now: now(61), checkouts: [{ received_at: AT, payload: { plan: "completo", billing: "mes" } }], subs: [], chargeStatuses: [], cards: 0,
  emailReminders: true, timezone: "America/Costa_Rica", quietStart: "22:00", quietEnd: "07:00", sentDays: [], ...over,
});

describe("abandonedCheckoutDue", () => {
  it("sale 1 hora después del checkout con el mismo plan y periodo, y no antes ni después de 24 h", () => {
    expect(abandonedCheckoutDue(base({ now: now(59) }))).toBeNull();
    expect(abandonedCheckoutDue(base())).toEqual({ plan: "completo", billing: "mes" });
    expect(abandonedCheckoutDue(base({ now: now(24 * 60) }))).toBeNull();
  });

  it("usa el último checkout: si abrió otro hace menos de 1 hora, espera", () => {
    const checkouts = [{ received_at: AT, payload: { plan: "completo", billing: "mes" } }, { received_at: now(40).toISOString(), payload: { plan: "entreno", billing: "anual" } }];
    expect(abandonedCheckoutDue(base({ checkouts }))).toBeNull();
    expect(abandonedCheckoutDue(base({ checkouts, now: now(101) }))).toEqual({ plan: "entreno", billing: "anual" });
    expect(lastCheckout([])).toBeNull();
  });

  it("no sale si pagó, si tiene tarjeta guardada o un cobro de la prueba abierto", () => {
    expect(abandonedCheckoutDue(base({ subs: [{ status: "active", current_period_start: now(5).toISOString() }] }))).toBeNull();
    // Pagó y canceló después del checkout: igual pagó.
    expect(abandonedCheckoutDue(base({ subs: [{ status: "canceled", current_period_start: now(5).toISOString() }] }))).toBeNull();
    expect(abandonedCheckoutDue(base({ chargeStatuses: ["succeeded"] }))).toBeNull();
    expect(abandonedCheckoutDue(base({ chargeStatuses: ["scheduled"] }))).toBeNull();
    expect(abandonedCheckoutDue(base({ cards: 1 }))).toBeNull();
    // La suscripción pendiente del propio checkout ('incomplete', sin periodo) no es un pago; un cobro cancelado tampoco.
    expect(abandonedCheckoutDue(base({ subs: [{ status: "incomplete", current_period_start: null }], chargeStatuses: ["canceled"] }))).not.toBeNull();
    // Un plan pagado que terminó antes del checkout no cuenta como pago de este.
    expect(paidSince([{ status: "canceled", current_period_start: "2026-09-01T00:00:00.000Z" }], [], AT)).toBe(false);
    expect(cardOnFile(0, ["superseded", "canceled"])).toBe(false);
  });

  it("respeta email_reminders y las horas de silencio", () => {
    expect(abandonedCheckoutDue(base({ emailReminders: false }))).toBeNull();
    expect(abandonedCheckoutDue(base({ quietStart: "09:00", quietEnd: "12:00" }))).toBeNull();
  });

  it("una vez cada 7 días", () => {
    expect(abandonedCheckoutDue(base({ sentDays: ["2026-10-28"] }))).toBeNull(); // hace 6 días
    expect(abandonedCheckoutDue(base({ sentDays: ["2026-10-27"] }))).not.toBeNull(); // hace 7 días
  });

  it("ignora un checkout con un plan o periodo que no existe", () => {
    expect(abandonedCheckoutDue(base({ checkouts: [{ received_at: AT, payload: { plan: "oro", billing: "mes" } }] }))).toBeNull();
    expect(abandonedCheckoutDue(base({ checkouts: [{ received_at: AT, payload: null }] }))).toBeNull();
  });
});

describe("plantilla checkoutAbandonado", () => {
  const nb = (s: string) => s.replace(/\u00a0/g, " ");

  it("asunto, plan, precio con IVA, cancela cuando quieras y el botón al mismo plan y periodo", () => {
    const m = T.checkoutAbandonado({ plan: "entreno", billing: "anual", promo: true, unsubscribe: "https://bananaburn.app/baja" });
    expect(m.subject).toBe("Tu plan quedó a medio camino");
    expect(m.text).toContain("Elegiste Entreno, anual.");
    expect(m.text).toMatch(/Cuesta \$\d+\.\d{2} al año, con IVA incluido\./);
    expect(m.text).toContain("Cancela cuando quieras desde Mi plan.");
    expect(m.text).toMatch(/Terminar mi pago: https?:\/\/\S+\/app\/suscripcion\?plan=entreno&pago=anual\n/);
    expect(m.html).toContain("/app/suscripcion?plan=entreno&amp;pago=anual\"");
    expect(m.html).toContain("Terminar mi pago");
    // El 50 % es solo del mensual.
    expect(nb(m.text)).not.toContain("50 %");
  });

  it("en el mensual recuerda el 50 % solo si tiene derecho", () => {
    const con = T.checkoutAbandonado({ plan: "completo", billing: "mes", promo: true, unsubscribe: "u" });
    expect(con.text).toMatch(/Cuesta \$\d+\.\d{2} al mes, con IVA incluido\./);
    expect(nb(con.text)).toContain("tu primer mes cuesta 50 % menos: $7.49");
    const sin = T.checkoutAbandonado({ plan: "completo", billing: "mes", promo: false, unsubscribe: "u" });
    expect(nb(sin.text)).not.toContain("50 %");
  });
});
