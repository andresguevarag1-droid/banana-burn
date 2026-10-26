import { describe, expect, it } from "vitest";
import { monthChallenge, newBadges, runBadges, runXp, weekRecap } from "@/lib/run-badges";

const r = (day: string, km: number, i = 0) => ({ id: `${day}-${i}`, day, distanceM: km * 1000, movingS: km * 330, paceSKm: 330 });

describe("logros de running", () => {
  it("primeros 5 y 10 km con su fecha", () => {
    const b = runBadges([r("2026-10-01", 3), r("2026-10-05", 5.2), r("2026-10-12", 10.1)], "2026-10-25");
    const get = (id: string) => b.find((x) => x.id === id)!;
    expect(get("primera").earnedOn).toBe("2026-10-01");
    expect(get("5k").earnedOn).toBe("2026-10-05");
    expect(get("10k").earnedOn).toBe("2026-10-12");
    expect(get("21k").earnedOn).toBeNull();
    expect(get("21k").progress).toBeCloseTo(10.1 / 21.097, 2);
  });
  it("km del mes y semanas seguidas", () => {
    const runs = Array.from({ length: 10 }, (_, i) => r(`2026-10-${String(1 + i * 3).padStart(2, "0")}`, 6, i));
    const b = runBadges(runs, "2026-10-29");
    expect(b.find((x) => x.id === "mes50")!.earnedOn).toBe("2026-10-25");
    expect(b.find((x) => x.id === "diez")!.earnedOn).toBe("2026-10-28");
    expect(b.find((x) => x.id === "racha4")!.earnedOn).not.toBeNull();
    expect(b.find((x) => x.id === "mes100")!.earnedOn).toBeNull();
  });
  it("sin carreras, nada ganado y nada inventado", () => {
    for (const x of runBadges([], "2026-10-25")) { expect(x.earnedOn).toBeNull(); expect(x.progress).toBeLessThan(1); }
  });
  it("celebra lo ganado hoy", () => {
    expect(newBadges([r("2026-10-25", 5.1)], "2026-10-25").map((x) => x.id)).toEqual(["primera", "5k"]);
  });
});

describe("reto del mes", () => {
  it("la meta sube sobre el mes pasado", () => {
    expect(monthChallenge([], "2026-11-03")).toMatchObject({ title: "20 km en noviembre", goalKm: 20, km: 0, daysLeft: 27 });
    const oct = [r("2026-10-02", 20), r("2026-10-09", 22)];
    expect(monthChallenge([...oct, r("2026-11-02", 8)], "2026-11-10")).toMatchObject({ goalKm: 50, km: 8, done: false });
    expect(monthChallenge([r("2026-12-30", 25)], "2027-01-02").goalKm).toBe(30);
  });
});

describe("resumen y XP", () => {
  it("semana de Hoy", () => {
    expect(weekRecap([r("2026-10-19", 5), r("2026-10-21", 8), r("2026-10-12", 9)], "2026-10-25")).toEqual({ km: 13, runs: 2, bestPace: 330 });
  });
  it("XP por carrera con tope", () => {
    expect(runXp(5000)).toBe(60);
    expect(runXp(30000)).toBe(100);
  });
});
