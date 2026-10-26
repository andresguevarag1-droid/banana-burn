import { describe, expect, it } from "vitest";
import { hapticKind } from "./device";

describe("hapticKind (vibración de la web → golpe del sistema)", () => {
  it("toques de interfaz: selección o golpe suave", () => {
    expect(hapticKind(10)).toBe("selection");
    expect(hapticKind(15)).toBe("selection");
    expect(hapticKind(20)).toBe("light");
    expect(hapticKind(30)).toBe("light");
  });
  it("cuenta regresiva y cambio de lado: golpe medio", () => {
    expect(hapticKind(40)).toBe("medium");
    expect(hapticKind(60)).toBe("medium");
  });
  it("fin del descanso, récord y entreno terminado: confirmación", () => {
    expect(hapticKind([200, 100, 200])).toBe("success");
    expect(hapticKind([40, 60, 40, 60, 120])).toBe("success");
  });
});
