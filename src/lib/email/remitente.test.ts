// El remitente de Resend: solo el dominio verificado (bananaburn.app). Con hola@tudominio.com no salía ningún correo.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { emailFrom } = await import("./send");

describe("remitente de los correos", () => {
  it("usa EMAIL_FROM si es de bananaburn.app", () => {
    expect(emailFrom("Banana Burn <hola@bananaburn.app>")).toBe("Banana Burn <hola@bananaburn.app>");
    expect(emailFrom("coach@BananaBurn.app")).toBe("coach@BananaBurn.app");
  });
  it("ignora el valor de ejemplo u otro dominio y usa el de Banana Burn", () => {
    for (const v of ["hola@tudominio.com", "Banana <hola@tudominio.com>", "x@bananaburn.app.evil.com", "", undefined])
      expect(emailFrom(v)).toBe("Banana Burn <hola@bananaburn.app>");
  });
});
