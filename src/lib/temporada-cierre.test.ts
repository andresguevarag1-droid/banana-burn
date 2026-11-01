// Reglas del cierre de la Temporada 1 (docs/emails/temporada-1-cierre.md): fechas de Costa Rica y a quién le toca.
import { describe, expect, it } from "vitest";
import { SEASON_CLOSE_DAY, T1_SLUGS, seasonCloseStep, seasonCloseStepAt } from "./temporada-cierre";
import { SEASONS_T1 } from "./seasons";

const ok = { marketing: true, access: true, staff: false, enrolled: false };

describe("fechas del cierre de la Temporada 1", () => {
  it("16 y 21 de noviembre de 2026, días de Costa Rica (UTC-6), dentro de la inscripción", () => {
    expect(SEASON_CLOSE_DAY).toEqual({ temporada1_cierre_16: "2026-11-16", temporada1_cierre_21: "2026-11-21" });
    for (const s of SEASONS_T1) expect(s.enrollUntil).toBe("2026-11-22");
    expect(seasonCloseStepAt(new Date("2026-11-16T06:00:00Z"))).toBe("temporada1_cierre_16"); // 00:00 en Costa Rica
    expect(seasonCloseStepAt(new Date("2026-11-17T05:59:00Z"))).toBe("temporada1_cierre_16"); // 23:59 en Costa Rica
    expect(seasonCloseStepAt(new Date("2026-11-16T05:59:00Z"))).toBeNull(); // todavía 15
    expect(seasonCloseStepAt(new Date("2026-11-17T06:00:00Z"))).toBeNull();
    expect(seasonCloseStepAt(new Date("2026-11-21T13:00:00Z"))).toBe("temporada1_cierre_21");
  });

  it("sin envíos atrasados: ni el 22 ni después, ni otros días", () => {
    for (const iso of ["2026-11-15T13:00:00Z", "2026-11-18T13:00:00Z", "2026-11-22T13:00:00Z", "2026-11-23T13:00:00Z", "2027-11-16T13:00:00Z"]) {
      expect(seasonCloseStepAt(new Date(iso)), iso).toBeNull();
    }
  });

  it("cuenta como inscrito cualquiera de las tres Temporada 1", () => {
    expect(T1_SLUGS).toEqual(["temporada-running-1", "temporada-raquetas-1", "temporada-cross-1"]);
  });
});

describe("a quién le toca", () => {
  const now = new Date("2026-11-16T13:00:00Z");
  it("con permiso de novedades, acceso por plan o prueba y sin inscripción", () => {
    expect(seasonCloseStep({ now, ...ok })).toBe("temporada1_cierre_16");
  });
  it("nunca sin permiso de novedades, sin acceso, al staff ni a quien ya se inscribió", () => {
    expect(seasonCloseStep({ now, ...ok, marketing: false })).toBeNull();
    expect(seasonCloseStep({ now, ...ok, access: false })).toBeNull();
    expect(seasonCloseStep({ now, ...ok, staff: true })).toBeNull();
    expect(seasonCloseStep({ now, ...ok, enrolled: true })).toBeNull();
  });
});
