import { describe, expect, it } from "vitest";
import { levelOf, streakOf } from "./gamify";

describe("gamificación", () => {
  it("niveles", () => {
    expect(levelOf(0).n).toBe("Banana verde");
    expect(levelOf(850)).toMatchObject({ n: "Banana madura", toNext: 750 });
    expect(levelOf(99999).progress).toBe(1);
  });
  it("racha no se rompe si hoy aún no entrenas", () => {
    const s = new Set(["2026-10-19", "2026-10-20"]);
    expect(streakOf(s, "2026-10-21")).toEqual({ days: 2, todayDone: false });
    s.add("2026-10-21");
    expect(streakOf(s, "2026-10-21")).toEqual({ days: 3, todayDone: true });
    expect(streakOf(new Set(["2026-10-18"]), "2026-10-21").days).toBe(0);
  });
});
