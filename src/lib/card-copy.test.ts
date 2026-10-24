import { describe, expect, it } from "vitest";
import { offer } from "./offer";
import { trialNudge } from "./copy";
import { cardInputErrors, formatCardNumber, formatExp, luhnOk, onvoCardBody, onvoCardError, parseExp } from "./card-input";
import { checkPaymentMethod, firstChargeFailed, listOf, matchesAttempt } from "./onvo";
import { pagoFallido, pruebaIniciada, recordatorioCobro, cobroCancelado } from "./email/templates";
import { demoCardState } from "./trial-demo";

const BEFORE = new Date("2026-10-23T12:00:00Z");
const AFTER = new Date("2026-11-01T06:00:00Z");
const RULES = /[\u{1F300}-\u{1FAFF}☀-➿]|—|\bIA\b|·/u;

describe("textos de la oferta según la fecha", () => {
  it("antes del 1 de noviembre: la copia de la beta, sin hablar de tarjeta", () => {
    const o = offer(BEFORE);
    expect(o.card).toBe(false);
    expect(o.note).toBe("7 días gratis con todo incluido.");
    expect(o.signupChecks).toEqual(["7 días gratis", "Todo incluido"]);
    expect(JSON.stringify(o)).not.toMatch(/sin tarjeta/i);
  });
  it("0043, desde el 1 de noviembre: 7 días sin tarjeta y la oferta opcional del 50 % del primer mes", () => {
    const o = offer(AFTER);
    expect(o.card).toBe(true);
    expect(o.note).toBe("7 días gratis con todo incluido, sin tarjeta.");
    expect(o.signupChecks).toEqual(["7 días gratis", "Sin tarjeta"]);
    const all = JSON.stringify({ ...o, from: o.from("$9.99"), pricingIntro: o.pricingIntro(50), faqTrial: o.faqTrial("Entreno + Nutrición") });
    expect(all).toMatch(/50 %/);
    expect(all).not.toMatch(/se pide tarjeta|guardas tu tarjeta, hoy no te cobramos y el día 7/i);
    expect(o.faqCancel).toMatch(/8 días hábiles/);
  });
  it("sin emojis, rayas largas, cadenas con punto medio ni 'IA' en ninguno de los dos", () => {
    for (const d of [BEFORE, AFTER]) {
      const o = offer(d);
      expect(JSON.stringify({ ...o, from: o.from("$5.00"), pricingIntro: o.pricingIntro(50), faqTrial: o.faqTrial("Completo") })).not.toMatch(RULES);
    }
  });
});

describe("aviso de la prueba con tarjeta", () => {
  it("dice cuánto y cuándo, y que se cancela sin costo", () => {
    expect(trialNudge(7, 7, { amount: 14.99, canceled: false })).toMatchObject({ day: 1, body: "Tienes todo incluido. Hoy no te cobramos. El día 7 se cobra tu plan, salvo que canceles antes." });
    expect(trialNudge(2, 7, { amount: 14.99, canceled: false })).toMatchObject({ day: 6, tone: "warn", title: "En 2 días se cobra tu plan de $14.99", body: "Puedes cancelar sin costo hasta el día 7." });
    expect(trialNudge(1, 7, { amount: 9.99, canceled: false }).title).toBe("Hoy es tu día 7: se cobra tu plan de $9.99");
    expect(trialNudge(3, 7, { amount: 9.99, canceled: true }).body).toMatch(/no se te cobrará/);
  });
  it("sin cobro (beta) ya no promete 'no pediremos tarjeta'", () => {
    expect(trialNudge(7).body).not.toMatch(/tarjeta/);
  });
});

describe("formulario de tarjeta (navegador)", () => {
  const ok = { holder: "Ana López", number: "4242 4242 4242 4242", exp: "12/29", cvv: "123" };
  it("Luhn, formato y vencimiento", () => {
    expect(luhnOk("4242424242424242")).toBe(true);
    expect(luhnOk("4242424242424241")).toBe(false);
    expect(formatCardNumber("4242424242424242")).toBe("4242 4242 4242 4242");
    expect(formatExp("1229")).toBe("12/29");
    expect(parseExp("12/29", BEFORE)).toEqual({ month: 12, year: 2029 });
    expect(parseExp("09/26", BEFORE)).toBeNull();
    expect(parseExp("13/29", BEFORE)).toBeNull();
    expect(cardInputErrors(ok, BEFORE)).toEqual({});
    expect(Object.keys(cardInputErrors({ holder: "", number: "1", exp: "x", cvv: "1" }, BEFORE)).sort()).toEqual(["cvv", "exp", "holder", "number"]);
  });
  it("arma el cuerpo de ONVO solo con lo que pide la documentación", () => {
    expect(onvoCardBody(ok, "cus_1", BEFORE)).toEqual({ type: "card", customerId: "cus_1", card: { holderName: "Ana López", number: "4242424242424242", expMonth: 12, expYear: 2029, cvv: "123" } });
  });
  it("mensajes de error sin interpretar códigos del banco", () => {
    expect(onvoCardError({ code: "cards.invalid_card_info" })).toMatch(/Revisa los datos/);
    expect(onvoCardError({ details: { card: { reason: "issuer_declined", declineCode: "51" } } })).toMatch(/banco rechazó/);
    expect(onvoCardError(null)).toMatch(/No pudimos guardar/);
  });
});

describe("tarjeta según ONVO (servidor)", () => {
  const pm = { id: "pm_1", customerId: "cus_1", status: "active", type: "card", card: { brand: "Visa", last4: "4242", expMonth: 12, expYear: 2030 } };
  it("acepta solo tarjetas activas del cliente de la persona y guarda solo marca, últimos 4 y vencimiento", () => {
    expect(checkPaymentMethod(pm, "cus_1")).toEqual({ ok: true, card: { paymentMethodId: "pm_1", customerId: "cus_1", brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 } });
    expect(checkPaymentMethod({ ...pm, customerId: "cus_2" }, "cus_1")).toEqual({ ok: false, reason: "otro_cliente" });
    expect(checkPaymentMethod({ ...pm, status: "requires-verification" }, "cus_1")).toEqual({ ok: false, reason: "no_activa" });
    expect(checkPaymentMethod({ ...pm, type: "mobile_number" }, "cus_1")).toEqual({ ok: false, reason: "no_es_tarjeta" });
    expect(checkPaymentMethod(null, "cus_1")).toEqual({ ok: false, reason: "no_existe" });
    const odd = checkPaymentMethod({ ...pm, card: { brand: "<script>", last4: "42a2" } }, "cus_1");
    expect(odd.ok && odd.card).toMatchObject({ brand: null, last4: null });
  });
  it("lista de ONVO en cualquiera de las dos formas y reconoce el intento por metadata", () => {
    expect(listOf([{ id: "a" }, { x: 1 }])).toEqual([{ id: "a" }]);
    expect(listOf({ data: [{ id: "b" }] })).toEqual([{ id: "b" }]);
    expect(listOf("raro")).toEqual([]);
    expect(matchesAttempt({ id: "s", metadata: { trialKey: "trial:u", attempt: "2" } }, "trial:u", 2)).toBe(true);
    expect(matchesAttempt({ id: "s", metadata: { trialKey: "trial:u", attempt: "1" } }, "trial:u", 2)).toBe(false);
    expect(matchesAttempt({ id: "s" }, "trial:u", 1)).toBe(false);
    expect(firstChargeFailed({ id: "s", status: "past_due" })).toBe(true);
    expect(firstChargeFailed({ id: "s", status: "active" })).toBe(false);
  });
});

describe("correos del cobro", () => {
  const d = { name: "Ana López", plan: "Entreno + Nutrición", amount: 14.99, chargeAt: "2026-11-17T15:00:00Z", kind: "prueba" as const, card: "Visa terminada en 4242" };
  it("prueba iniciada: hoy no se cobra, cuándo y cuánto", () => {
    const e = pruebaIniciada(d);
    expect(e.text).toMatch(/Hoy no te cobramos/);
    expect(pruebaIniciada({ ...d, amount: 7.49, promo: true }).subject).toMatch(/primer mes con 50 %/);
    expect(recordatorioCobro({ ...d, amount: 7.49, promo: true }).preheader).toMatch(/primer mes con 50 % de descuento/);
    expect(e.text).toMatch(/17 de noviembre de 2026/);
    expect(e.html).toContain("/app/suscripcion");
  });
  it("día 5: el texto exacto del aviso", () => {
    expect(recordatorioCobro(d).preheader).toMatch(/^En 2 días se cobra tu plan de .*14[.,]99.*\. Puedes cancelar sin costo hasta el día 7\.$/);
  });
  it("rechazo del primer cobro: acceso en pausa y la fecha del reintento", () => {
    const e = pagoFallido({ name: "Ana", plan: "Entreno", amount: 9.99, paused: true, retryDate: "2026-11-18T15:00:00Z", updateUrl: "/app/suscripcion#tarjeta" });
    expect(e.text).toMatch(/en pausa/);
    expect(e.text).toMatch(/18 de noviembre/);
    expect(pagoFallido({ name: "Ana", plan: "Entreno", amount: 9.99 }).text).toMatch(/mantienes tu acceso/);
  });
  it("sin emojis ni 'IA'", () => {
    for (const e of [pruebaIniciada(d), recordatorioCobro(d), cobroCancelado({ name: "Ana", plan: "Entreno", accessUntil: d.chargeAt, cardKept: false }), pagoFallido({ name: "Ana", plan: "Entreno", amount: 9.99, paused: true })])
      expect(e.text + e.subject).not.toMatch(/[\u{1F300}-\u{1FAFF}]|\bIA\b|—/u);
  });
});

describe("modo demo", () => {
  it("cada estado de ejemplo existe y no inventa cobros reales", () => {
    expect(demoCardState(null, BEFORE).variant).toBe("beta");
    expect(demoCardState(null, AFTER).variant).toBe("prueba");
    expect(demoCardState("fallo", AFTER)).toMatchObject({ locked: true, cardStep: "pay" });
    expect(demoCardState("fallo", AFTER).charge?.phase).toBe("reintento");
    expect(demoCardState("nueva", AFTER)).toMatchObject({ cardStep: "trial", locked: false });
    expect(demoCardState("raro", AFTER).variant).toBe("prueba");
  });
});
