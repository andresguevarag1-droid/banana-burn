import { describe, expect, it } from "vitest";
import { deepLinkPath, linkAction, needsFullLoad } from "./links";

const ORIGIN = "https://www.bananaburn.app";

describe("linkAction", () => {
  it("nuestro dominio se queda en la app (con y sin www, rutas relativas)", () => {
    expect(linkAction("/app/entreno", ORIGIN)).toBe("app");
    expect(linkAction("https://www.bananaburn.app/precios", ORIGIN)).toBe("app");
    expect(linkAction("https://bananaburn.app/app", ORIGIN)).toBe("app");
  });
  it("un preview de Vercel cuenta como propio cuando la app lo carga", () => {
    expect(linkAction("https://banana-burn-git-x.vercel.app/app", "https://banana-burn-git-x.vercel.app")).toBe("app");
  });
  it("otras páginas se abren en el navegador dentro de la app", () => {
    expect(linkAction("https://www.openstreetmap.org/copyright", ORIGIN)).toBe("browser");
    expect(linkAction("http://example.com", ORIGIN)).toBe("browser");
    expect(linkAction("https://bananaburn.app.evil.com/", ORIGIN)).toBe("browser");
  });
  it("WhatsApp, correo, teléfono y tiendas los abre el sistema", () => {
    expect(linkAction("https://wa.me/50688888888?text=hola", ORIGIN)).toBe("system");
    expect(linkAction("mailto:hola@bananaburn.app", ORIGIN)).toBe("system");
    expect(linkAction("tel:+50688888888", ORIGIN)).toBe("system");
    expect(linkAction("https://apps.apple.com/app/id1", ORIGIN)).toBe("system");
  });
  it("lo raro se ignora", () => {
    expect(linkAction("javascript:alert(1)", ORIGIN)).toBe("ignore");
    expect(linkAction("data:text/html,hola", ORIGIN)).toBe("ignore");
    expect(linkAction("http://[mal", ORIGIN)).toBe("ignore");
  });
});

describe("deepLinkPath", () => {
  it("devuelve la ruta interna con query y hash", () => {
    expect(deepLinkPath("https://www.bananaburn.app/app/entreno?dia=2#x", ORIGIN)).toBe("/app/entreno?dia=2#x");
    expect(deepLinkPath("https://bananaburn.app/auth/callback?token_hash=abc&type=recovery", ORIGIN)).toBe("/auth/callback?token_hash=abc&type=recovery");
  });
  it("rechaza otros dominios, http y esquemas propios", () => {
    expect(deepLinkPath("https://evil.com/app", ORIGIN)).toBeNull();
    expect(deepLinkPath("http://www.bananaburn.app/app", ORIGIN)).toBeNull();
    expect(deepLinkPath("app.bananaburn://app", ORIGIN)).toBeNull();
  });
});

describe("needsFullLoad", () => {
  it("auth y api se cargan completas", () => {
    expect(needsFullLoad("/auth/callback?code=1")).toBe(true);
    expect(needsFullLoad("/api/version")).toBe(true);
    expect(needsFullLoad("/app/authority")).toBe(false);
    expect(needsFullLoad("/app")).toBe(false);
  });
});
