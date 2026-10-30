import { describe, expect, it } from "vitest";
import { ALERT_KINDS, alertText, channelsFor, DEFAULT_PREFS, firstName, money, normalizePrefs, paymentKey, summarize, summaryText, type AdminEvent } from "./admin-avisos";

const ev = (over: Partial<AdminEvent>): AdminEvent => ({ id: 1, event_key: "k", kind: "registro", user_id: "u1", amount_minor: null, currency: null, data: {}, created_at: "2026-10-28T20:00:00Z", ...over });
const maria = { firstName: "María", country: "CR" };

describe("textos de los avisos", () => {
  it("registro: nombre de pila y país, y abre la cuenta", () => {
    const t = alertText(ev({ kind: "registro" }), maria);
    expect(t.title).toBe("Nuevo usuario");
    expect(t.body).toBe("María, Costa Rica");
    expect(t.url).toBe("/admin/usuarios/u1");
  });
  it("pago: monto, plan, país y procesador", () => {
    const t = alertText(ev({ kind: "pago", amount_minor: 1499, currency: "USD", data: { plan: "completo", billing: "mes", provider: "tilopay" } }), { firstName: "Juan", country: "CO" });
    expect(t.title).toBe("Pago recibido: $14.99");
    expect(t.body).toBe("Entreno + Nutrición mensual, Juan, Colombia, Tilopay");
  });
  it("temporada: nombre del deporte", () => {
    const t = alertText(ev({ kind: "temporada", amount_minor: 1499, currency: "USD", data: { slug: "temporada-running-1", provider: "onvo" } }), maria);
    expect(t.title).toBe("Temporada comprada: $14.99");
    expect(t.body).toContain("Temporada Running");
  });
  it("cobro rechazado: dice si se reintenta", () => {
    const t = alertText(ev({ kind: "cobro_fallido", amount_minor: 499, currency: "USD", data: { plan: "entreno", billing: "mes", final: false, origen: "prueba" } }), maria);
    expect(t.title).toBe("Cobro rechazado: $4.99");
    expect(t.body).toContain("se reintenta");
  });
  it("condominio: sin persona, abre la lista de condominios", () => {
    const t = alertText(ev({ kind: "condominio", user_id: null, data: { org: "Las Palmas", units: "120", location: "Escazú" } }), null);
    expect(t.body).toBe("Las Palmas, 120 unidades, Escazú");
    expect(t.url).toBe("/admin/condominios");
  });
  it("sin datos de la persona no muestra vacíos ni undefined", () => {
    for (const k of ALERT_KINDS) {
      const t = alertText(ev({ kind: k, user_id: null }), null);
      expect(`${t.title} ${t.body}`).not.toMatch(/undefined|null|NaN|, ,/);
      expect(t.title.length).toBeGreaterThan(3);
    }
  });
  it("nunca lleva el correo ni datos de tarjeta", () => {
    const t = alertText(ev({ kind: "tarjeta", amount_minor: 499, currency: "USD", data: { plan: "entreno", billing: "mes", email: "x@y.com", last4: "4242" } }), maria);
    expect(JSON.stringify(t)).not.toMatch(/@|4242/);
  });
});

describe("canales", () => {
  it("por defecto: push y campanita al instante, correo solo en el resumen", () => {
    expect(channelsFor("pago", DEFAULT_PREFS)).toEqual({ push: true, inApp: true, email: false });
  });
  it("un tipo apagado no sale por ningún canal", () => {
    const p = normalizePrefs({ ...DEFAULT_PREFS, email: true, email_mode: "instante", kinds: ["pago"] });
    expect(channelsFor("registro", p)).toEqual({ push: false, inApp: false, email: false });
    expect(channelsFor("pago", p)).toEqual({ push: true, inApp: true, email: true });
  });
  it("la prueba sale siempre por los canales encendidos", () => {
    expect(channelsFor("prueba", normalizePrefs({ kinds: [] })).push).toBe(true);
  });
  it("los avisos de sistema salen siempre, y por correo aunque el modo sea resumen", () => {
    const p = normalizePrefs({ ...DEFAULT_PREFS, email: true, email_mode: "resumen", kinds: [] });
    expect(channelsFor("sistema", p)).toEqual({ push: true, inApp: true, email: true });
    expect(channelsFor("sistema", normalizePrefs({ ...DEFAULT_PREFS, push: false, kinds: [] })).push).toBe(false);
  });
  it("sistema: cron fallido y errores sobre el umbral, sin datos de personas y con enlace a Salud", () => {
    const cron = alertText(ev({ kind: "sistema", user_id: null, data: { motivo: "cron", cron: "cobros", errores: 3 } }), null);
    expect(cron).toEqual({ title: "Falló el cron de cobros", body: "3 errores, revisa Salud y Sentry", url: "/admin/salud" });
    const cut = alertText(ev({ kind: "sistema", user_id: null, data: { motivo: "cron", cron: "avisos", excepcion: true } }), null);
    expect(cut.title).toBe("Falló el cron de avisos al dueño");
    expect(cut.body).toBe("se cortó con un error, revisa Salud y Sentry");
    const err = alertText(ev({ kind: "sistema", user_id: null, data: { motivo: "errores", total: 1200, umbral: 50 } }), null);
    expect(err).toEqual({ title: "Errores en la app: 1,200 en 24 h", body: "el aviso sale desde 50, revisa Salud y Sentry", url: "/admin/salud" });
  });
  it("ignora tipos desconocidos guardados en la base", () => {
    expect(normalizePrefs({ kinds: ["pago", "hackeo" as never] }).kinds).toEqual(["pago"]);
  });
});

describe("resumen del día", () => {
  it("suma solo ingresos en USD y cuenta cada tipo", () => {
    const s = summarize([
      { kind: "registro", amount_minor: null, currency: null },
      { kind: "registro", amount_minor: null, currency: null },
      { kind: "pago", amount_minor: 499, currency: "USD" },
      { kind: "temporada", amount_minor: 1499, currency: "USD" },
      { kind: "pago", amount_minor: 5000, currency: "CRC" },
      { kind: "cobro_fallido", amount_minor: 499, currency: "USD" },
      { kind: "tarjeta", amount_minor: 499, currency: "USD" },
    ], 1);
    expect(s).toEqual({ registros: 2, primerosEntrenos: 1, pagos: 3, ingresoMinor: 1998, tarjetas: 1, rechazos: 1, cancelaciones: 0 });
    const t = summaryText(s);
    expect(t.title).toBe("Tu día en Banana Burn: $19.98");
    expect(t.body).toBe("2 usuarios nuevos, 1 primer entreno, 3 pagos, 1 tarjeta guardada, 1 cobro rechazado");
  });
  it("día vacío", () => {
    expect(summaryText(summarize([], 0)).title).toBe("Tu día en Banana Burn: $0");
  });
});

describe("utilidades", () => {
  it("monto", () => {
    expect(money(1499, "usd")).toBe("$14.99");
    expect(money(2000, "USD")).toBe("$20");
    expect(money(null, "USD")).toBeNull();
  });
  it("nombre de pila", () => {
    expect(firstName("  María José Rojas ")).toBe("María");
    expect(firstName("")).toBeNull();
  });
  it("la clave de un pago es estable (el mismo cobro no avisa dos veces)", () => {
    expect(paymentKey("onvo", "pi_123")).toBe(paymentKey("onvo", "pi_123"));
    expect(paymentKey("onvo", "x".repeat(400)).length).toBeLessThanOrEqual(160);
  });
});
