import { describe, expect, it } from "vitest";
import { handoffPath, looksLikeHandoff, withoutHandoff } from "./handoff";

describe("pase de navegador", () => {
  it("lleva la misma ruta de la app con el pase", () => {
    expect(handoffPath("/app/entreno?modo=suave", "a.b")).toBe("/app/entreno?modo=suave&entrar=a.b");
    expect(handoffPath("/app", "a.b")).toBe("/app?entrar=a.b");
  });
  it("nunca fuera de la app y reemplaza un pase anterior", () => {
    expect(handoffPath("https://otro.com/app", "a.b")).toBe("/app?entrar=a.b");
    expect(handoffPath("//otro.com/app", "a.b")).toBe("/app?entrar=a.b");
    expect(handoffPath("/admin", "a.b")).toBe("/app?entrar=a.b");
    expect(handoffPath("/appx", "a.b")).toBe("/app?entrar=a.b");
    expect(handoffPath(null, "a.b")).toBe("/app?entrar=a.b");
    expect(handoffPath("/app?entrar=viejo.x&x=1", "a.b")).toBe("/app?x=1&entrar=a.b");
  });
  it("reconoce la forma del pase y lo quita de la dirección", () => {
    expect(looksLikeHandoff("eyJ1Ijo.abc-_")).toBe(true);
    expect(looksLikeHandoff("<script>")).toBe(false);
    expect(looksLikeHandoff(null)).toBe(false);
    expect(withoutHandoff("/app/entreno", "?entrar=a.b&modo=suave")).toBe("/app/entreno?modo=suave");
    expect(withoutHandoff("/app", "?entrar=a.b")).toBe("/app");
  });
});
