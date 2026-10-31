import { describe, expect, it } from "vitest";
import { annualDismissed, annualDismissKey } from "./annual-upsell";

describe("silencio del aviso anual", () => {
  it("respeta los 30 días completos y vuelve al terminar", () => {
    const now = Date.parse("2026-12-01T12:00:00Z");
    const until = now + 30 * 864e5;
    expect(annualDismissed(String(until), until - 1)).toBe(true);
    expect(annualDismissed(String(until), until)).toBe(false);
    expect(annualDismissed(null, now)).toBe(false);
    expect(annualDismissed("invalid", now)).toBe(false);
  });
  it("separa las preferencias de cuentas en el mismo navegador", () => {
    expect(annualDismissKey("a")).not.toBe(annualDismissKey("b"));
  });
});
