import { describe, expect, it } from "vitest";
import { clean, cleanUrl } from "./env";

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
});
