import { describe, expect, it } from "vitest";
import { analyticsUrl } from "./web-analytics";

describe("Vercel Web Analytics sin datos en la URL", () => {
  it("quita query, hash e ids de la ruta", () => {
    expect(analyticsUrl("https://www.bananaburn.app/?utm_source=ig&ref=ANA")).toBe("https://www.bananaburn.app/");
    expect(analyticsUrl("https://www.bananaburn.app/pago/exito?token=abc#x")).toBe("https://www.bananaburn.app/pago/exito");
    expect(analyticsUrl("https://www.bananaburn.app/admin/usuarios/0b3c6f0e-1d2a-4c55-9a8e-2f1b3c4d5e6f")).toBe("https://www.bananaburn.app/admin/usuarios/:id");
    expect(analyticsUrl("https://www.bananaburn.app/r/ANA")).toBe("https://www.bananaburn.app/r/:codigo");
  });
});
