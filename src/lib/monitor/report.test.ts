import { describe, expect, it } from "vitest";
import { browserFamily, cleanReport, cleanRoute, fingerprint, isNoise, scrubMessage } from "./report";

describe("scrubMessage (sin datos personales)", () => {
  it("quita correos, ids, números largos, tokens y query strings", () => {
    const m = scrubMessage("Falló para ana.perez@correo.com id 3f2b1c4d-1111-4222-8333-444455556666 tel 8888-1234 token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc url https://x.supabase.co/rest/v1/profiles?id=eq.123&email=a@b.co");
    expect(m).not.toMatch(/ana|perez|3f2b1c4d|8888|1234|eyJ|email=|id=eq/);
    expect(m).toContain("[correo]");
    expect(m).toContain("[id]");
    expect(m).toContain("[n]");
    expect(m).toContain("x.supabase.co/rest/v1/profiles");
  });
  it("deja mensajes técnicos útiles", () => {
    expect(scrubMessage("Cannot read properties of undefined (reading 'sets')")).toBe("Cannot read properties of undefined (reading 'sets')");
    expect(scrubMessage("Loading chunk 4512 failed.")).toBe("Loading chunk [n] failed.");
  });
  it("tarjetas y cédulas", () => {
    expect(scrubMessage("tarjeta 4242 4242 4242 4242 cedula 1-1234-0567")).not.toMatch(/\d{3,}/);
  });
  it("acota el largo y quita saltos de línea", () => {
    expect(scrubMessage("a\n\tb".repeat(500)).length).toBeLessThanOrEqual(300);
    expect(scrubMessage("a\n\nb")).toBe("a b");
    expect(scrubMessage(42)).toBe("");
  });
});

describe("cleanRoute", () => {
  it("sin dominio, query ni ids", () => {
    expect(cleanRoute("https://www.bananaburn.app/app/retos/abdomen-21?ref=x#y")).toBe("/app/retos/:id");
    expect(cleanRoute("/admin/usuarios/3f2b1c4d-1111-4222-8333-444455556666")).toBe("/admin/usuarios/:id");
    expect(cleanRoute("/app/hoy")).toBe("/app/hoy");
  });
  it("códigos y nombres de usuario en la URL siempre se quitan", () => {
    expect(cleanRoute("/r/ANA2026")).toBe("/r/:codigo");
    expect(cleanRoute("/r/anita")).toBe("/r/:codigo");
    expect(cleanRoute("/app/comunidad/u/ana_perez")).toBe("/app/comunidad/u/:usuario");
  });
  it("valores raros", () => {
    expect(cleanRoute(undefined)).toBe("/");
    expect(cleanRoute("/a/%E0%A4%A")).toBe("/a/:id");
    expect(cleanRoute("/" + "x/".repeat(50)).split("/").length).toBeLessThanOrEqual(9);
  });
});

describe("cleanReport (endpoint público)", () => {
  it("acepta un reporte del navegador y lo limpia", () => {
    const r = cleanReport({ source: "boundary", kind: "TypeError", message: "x de ana@a.co", route: "/app/retos/abdomen-21", digest: "123abc", release: "a1b2c3d", extra: "ignorado" }, "Mozilla/5.0 Chrome/120 Safari/537");
    expect(r).toEqual({ source: "boundary", kind: "TypeError", message: "x de [correo]", route: "/app/retos/:id", digest: "123abc", release: "a1b2c3d", browser: "chrome" });
  });
  it("rechaza lo inválido", () => {
    expect(cleanReport(null)).toBeNull();
    expect(cleanReport([])).toBeNull();
    expect(cleanReport({ source: "server", message: "x" })).toBeNull();
    expect(cleanReport({ source: "client", message: "" })).toBeNull();
  });
  it("campos mal formados quedan en valores seguros", () => {
    const r = cleanReport({ source: "client", kind: "<script>", message: "m", digest: "../../etc", release: "x".repeat(99) });
    expect(r).toMatchObject({ kind: "Error", digest: null, release: null, route: "/" });
  });
});

describe("ruido, huella y navegador", () => {
  it("descarta ruido de extensiones y del navegador", () => {
    expect(isNoise("ResizeObserver loop completed with undelivered notifications.")).toBe(true);
    expect(isNoise("Script error.")).toBe(true);
    expect(isNoise("x", "AbortError")).toBe(true);
    expect(isNoise("Cannot read properties of null")).toBe(false);
    // Inyectado por otras apps y navegadores (no es nuestro código).
    expect(isNoise("undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')")).toBe(true);
    expect(isNoise("undefined is not an object (evaluating 'window.__firefox__.reader')")).toBe(true);
    expect(isNoise("Error invoking postMessage: Java object is gone")).toBe(true);
  });
  it("misma huella para el mismo error", () => {
    const a = { source: "client" as const, kind: "TypeError", route: "/app", message: "m" };
    expect(fingerprint(a)).toBe(fingerprint({ ...a }));
    expect(fingerprint(a)).not.toBe(fingerprint({ ...a, route: "/app/hoy" }));
  });
  it("familia del navegador sin versión", () => {
    expect(browserFamily("Mozilla/5.0 (iPhone) AppleWebKit Version/17 Mobile Safari/604.1")).toBe("safari");
    expect(browserFamily("Mozilla/5.0 Chrome/120 Edg/120")).toBe("edge");
    expect(browserFamily("Mozilla/5.0 SamsungBrowser/23 Chrome/115")).toBe("samsung");
    expect(browserFamily(null)).toBeNull();
  });
});
