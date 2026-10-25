import { describe, expect, it } from "vitest";
import { appThemeFor } from "./app-theme";

describe("tema de la app según el coach", () => {
  it("Platanita (programas de chicas) vuelve la app rosada", () => {
    expect(appThemeFor("platanita")).toBe("platanita");
  });
  it("las temporadas con Platanita (perfiles de mujer) también", () => {
    for (const s of ["running", "raquetas", "cross"]) expect(appThemeFor(`platanita-${s}`)).toBe("platanita");
  });
  it("Coach Banana, sus temporadas y sin programa: sin tema", () => {
    for (const c of ["banana", "banana-running", "banana-raquetas", "banana-cross", null, undefined, "", "platanitas", "otra"]) expect(appThemeFor(c as string | null | undefined)).toBeNull();
  });
});
