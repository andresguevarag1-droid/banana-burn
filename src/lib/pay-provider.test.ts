import { describe, expect, it } from "vitest";
import { normCountry, providerFor } from "./pay-provider";

describe("procesador según el país", () => {
  it("sin Tilopay encendido, siempre ONVO (como hoy)", () => {
    expect(providerFor({ country: "CO", tilopayReady: false })).toBe("onvo");
    expect(providerFor({ country: "GT", override: "tilopay", tilopayReady: false })).toBe("onvo");
  });
  it("Costa Rica va con ONVO; Colombia y Guatemala con Tilopay", () => {
    expect(providerFor({ country: "CR", tilopayReady: true })).toBe("onvo");
    expect(providerFor({ country: "co", tilopayReady: true })).toBe("tilopay");
    expect(providerFor({ country: "GT", tilopayReady: true })).toBe("tilopay");
  });
  it("sin país por IP usa el de la bienvenida; sin ninguno, ONVO", () => {
    expect(providerFor({ country: null, profileCountry: "CO", tilopayReady: true })).toBe("tilopay");
    expect(providerFor({ country: "XX", profileCountry: "CR", tilopayReady: true })).toBe("onvo");
    expect(providerFor({ country: undefined, profileCountry: null, tilopayReady: true })).toBe("onvo");
  });
  it("la elección de la persona manda, y lo que no es un procesador se ignora", () => {
    expect(providerFor({ country: "CR", override: "tilopay", tilopayReady: true })).toBe("tilopay");
    expect(providerFor({ country: "CO", override: "onvo", tilopayReady: true })).toBe("onvo");
    expect(providerFor({ country: "CO", override: "stripe", tilopayReady: true })).toBe("tilopay");
  });
  it("staff en Costa Rica puede forzar Tilopay para probarlo", () => {
    expect(providerFor({ country: "CR", profileCountry: "CR", override: "tilopay", tilopayReady: true })).toBe("tilopay");
  });
  it("normaliza el país", () => {
    expect(normCountry(" cr ")).toBe("CR");
    expect(normCountry("T1")).toBeNull();
    expect(normCountry("COL")).toBeNull();
    expect(normCountry(5)).toBeNull();
  });
});
