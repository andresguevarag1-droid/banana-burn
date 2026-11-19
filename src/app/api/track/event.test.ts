import { describe, expect, it } from "vitest";
import { cleanEvent } from "./event";

describe("cleanEvent", () => {
  it("acepta eventos conocidos y props simples", () => {
    expect(cleanEvent({ name: "cta_click", props: { cta: "hero", path: "/", n: 2, ok: true } })).toEqual({ name: "cta_click", props: { cta: "hero", path: "/", n: 2, ok: true } });
  });
  it("descarta nombres desconocidos y basura", () => {
    expect(cleanEvent({ name: "hack" })).toBeNull();
    expect(cleanEvent(null)).toBeNull();
    expect(cleanEvent("cta_click")).toBeNull();
  });
  it("quita objetos anidados, claves raras y recorta textos", () => {
    const e = cleanEvent({ name: "page_view", props: { path: "x".repeat(500), nested: { a: 1 }, "Bad-Key": "y", nan: Number.NaN } });
    expect(e?.props).toEqual({ path: "x".repeat(120) });
  });
  it("descarta textos con datos personales (correo, teléfono, cédula)", () => {
    const e = cleanEvent({ name: "cta_click", props: { cta: "hero", email: "ana@correo.com", tel: "+506 8888-1234", ced: "1-2345-6789", n: 3 } });
    expect(e?.props).toEqual({ cta: "hero", n: 3 });
  });
});

describe("email_click (#320)", () => {
  it("solo el kind de un correo de regreso, sin nada más", () => {
    expect(cleanEvent({ name: "email_click", props: { kind: "regreso_r1", email: "ana@correo.com", path: "/app/entreno" } })).toEqual({ name: "email_click", props: { kind: "regreso_r1", path: "/app/entreno" } });
    expect(cleanEvent({ name: "email_click", props: { kind: "otro" } })).toBeNull();
    expect(cleanEvent({ name: "email_click" })).toBeNull();
  });
});
