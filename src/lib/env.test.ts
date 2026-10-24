import { describe, expect, it } from "vitest";
import { CANONICAL_ORIGIN, clean, cleanUrl, siteUrlFrom } from "./env";

describe("variables de entorno tolerantes", () => {
  it("agrega https y quita la barra final", () => {
    expect(cleanUrl("bananaburn.app")).toBe("https://bananaburn.app");
    expect(cleanUrl(" https://bananaburn.app/ ")).toBe("https://bananaburn.app");
    expect(cleanUrl('"https://banana-burn.vercel.app"')).toBe("https://banana-burn.vercel.app");
    expect(cleanUrl("http://localhost:3000/")).toBe("http://localhost:3000");
  });
  it("un valor inválido cae al respaldo sin lanzar error", () => {
    expect(cleanUrl("https://", "x")).toBe("x");
    expect(cleanUrl("", "y")).toBe("y");
    expect(cleanUrl(undefined)).toBe("");
  });
  it("limpia comillas y espacios", () => {
    expect(clean("  'abc'  ")).toBe("abc");
  });
  it("URL pública: canónica con www y respaldo seguro", () => {
    expect(siteUrlFrom({ NEXT_PUBLIC_SITE_URL: "https://www.bananaburn.app" })).toBe("https://www.bananaburn.app");
    expect(siteUrlFrom({ NEXT_PUBLIC_SITE_URL: "bananaburn.app" })).toBe(CANONICAL_ORIGIN);
    expect(siteUrlFrom({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "bananaburn.app" })).toBe(CANONICAL_ORIGIN);
    expect(siteUrlFrom({ VERCEL_ENV: "preview" })).toBe(CANONICAL_ORIGIN);
    expect(siteUrlFrom({ NEXT_PUBLIC_SITE_URL: "http://localhost:3805" })).toBe("http://localhost:3805");
    expect(siteUrlFrom({})).toBe("http://localhost:3000");
  });
});
