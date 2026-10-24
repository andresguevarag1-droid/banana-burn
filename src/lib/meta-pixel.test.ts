import { describe, expect, it } from "vitest";
import { pixelIdFrom, toMetaEvent, priceOf } from "./meta-pixel";

describe("pixelIdFrom", () => {
  it("usa el píxel de Banana Burn por defecto, acepta otro ID y se apaga con off", () => {
    expect(pixelIdFrom({})).toBe("1544502257509303");
    expect(pixelIdFrom({ NEXT_PUBLIC_META_PIXEL_ID: " 1234567890123 " })).toBe("1234567890123");
    expect(pixelIdFrom({ NEXT_PUBLIC_META_PIXEL_ID: "basura" })).toBe("1544502257509303");
    expect(pixelIdFrom({ NEXT_PUBLIC_META_PIXEL_ID: "off" })).toBe("");
  });
});

describe("toMetaEvent", () => {
  it("mapea el embudo a eventos estándar de Meta", () => {
    expect(toMetaEvent("onboarding_done", { trial: true })?.name).toBe("CompleteRegistration");
    expect(toMetaEvent("card_saved")?.name).toBe("AddPaymentInfo");
    expect(toMetaEvent("plan_wall_view")?.name).toBe("ViewContent");
    expect(toMetaEvent("checkout_view", { plan: "completo", billing: "anual" })).toEqual({ name: "InitiateCheckout", params: { value: 89.99, currency: "USD", content_name: "completo" } });
  });
  it("la compra lleva valor y moneda, por id o por nombre del plan", () => {
    expect(toMetaEvent("purchase_success", { plan: "Entreno", billing: "mes" })?.params).toMatchObject({ value: 9.99, currency: "USD" });
    expect(toMetaEvent("purchase_success", { plan: "Entreno + Nutrición" })?.params).toMatchObject({ value: 14.99 });
    expect(priceOf("entreno", "anual")).toBe(59.99);
  });
  it("solo los botones de registro cuentan como Lead; page_view y Entrar no se envían", () => {
    expect(toMetaEvent("cta_click", { cta: "hero" })?.name).toBe("Lead");
    expect(toMetaEvent("cta_click", { cta: "nav" })?.name).toBe("Lead");
    expect(toMetaEvent("cta_click", { cta: "nav-entrar" })).toBeNull();
    expect(toMetaEvent("cta_click", { cta: "exito-entreno" })).toBeNull();
    expect(toMetaEvent("page_view")).toBeNull();
  });
});

describe("Lead", () => {
  it("cuenta el envío del registro y los botones de la landing de GLP-1", () => {
    expect(toMetaEvent("cta_click", { cta: "registro-google" })?.name).toBe("Lead");
    expect(toMetaEvent("cta_click", { cta: "glp1-hero" })?.name).toBe("Lead");
    expect(toMetaEvent("cta_click", { cta: "entrar-password" })).toBeNull();
    expect(toMetaEvent("cta_click", { cta: "hero-tour" })).toBeNull();
  });
});
