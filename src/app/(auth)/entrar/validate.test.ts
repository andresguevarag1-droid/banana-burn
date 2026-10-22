import { describe, expect, it } from "vitest";
import { normEmail, signupError } from "./validate";

describe("signupError", () => {
  it("acepta correo y contraseña válidos", () => expect(signupError(" Ana@Gmail.com ", "banana123")).toBeNull());
  it("rechaza correos mal escritos", () => {
    expect(signupError("ana@gmail", "banana123")).toMatch(/correo/);
    expect(signupError("", "banana123")).toMatch(/correo/);
    expect(signupError(42, "banana123")).toMatch(/correo/);
  });
  it("exige de 8 a 72 caracteres", () => {
    expect(signupError("a@b.co", "corta1")).toMatch(/8/);
    expect(signupError("a@b.co", "solamenteletras")).toBeNull();
    expect(signupError("a@b.co", "a1".repeat(40))).toMatch(/72/);
  });
  it("normaliza el correo", () => expect(normEmail("  X@Y.COM ")).toBe("x@y.com"));
});
