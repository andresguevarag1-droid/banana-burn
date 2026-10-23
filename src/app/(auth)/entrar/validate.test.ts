import { describe, expect, it } from "vitest";
import { loginOutcome, normEmail, signupError } from "./validate";

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

describe("loginOutcome (confirmar solo con la contraseña correcta)", () => {
  it("sin error entra", () => expect(loginOutcome(null)).toBe("ok"));
  it("correo sin confirmar (por código o por mensaje)", () => {
    expect(loginOutcome({ code: "email_not_confirmed", message: "Email not confirmed" })).toBe("unconfirmed");
    expect(loginOutcome({ message: "Email not confirmed" })).toBe("unconfirmed");
  });
  it("contraseña equivocada u otro error: no se confirma nada", () => {
    expect(loginOutcome({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe("bad");
    expect(loginOutcome({ message: "Request rate limit reached" })).toBe("bad");
  });
});
