import { describe, expect, it } from "vitest";
import { CHALLENGES, CHALLENGE_BY_ID, challengeState } from "./challenges";

describe("retos", () => {
  it("flexiones van de 10 a 100", () => {
    const c = CHALLENGE_BY_ID["flexiones-30"];
    expect(c.task(1)).toMatch(/^10 /); expect(c.task(30)).toMatch(/^100 /);
  });
  it("estado: día, completados y fallados", () => {
    const s = challengeState(CHALLENGES[0], "2026-10-01", ["2026-10-01", "2026-10-02", "2026-10-04"], "2026-10-05");
    expect(s).toMatchObject({ day: 5, completed: 3, missed: 1, todayDone: false, finished: false });
    expect(s.cells).toHaveLength(30);
  });
  it("ids únicos", () => expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length));
});
