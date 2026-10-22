import { describe, expect, it } from "vitest";
import { CHALLENGES, CHALLENGE_BY_ID, challengeState, fromCatalogRow, mergeCatalog } from "./challenges";
import { metAuto } from "./challenges-server";

const days = (start: string, idx: number[]) => idx.map((i) => { const d = new Date(start + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); });

describe("retos", () => {
  it("flexiones van de 10 a 100", () => {
    const c = CHALLENGE_BY_ID["flexiones-30"];
    expect(c.task(1)).toMatch(/^10 /); expect(c.task(30)).toMatch(/^100 /);
  });
  it("estado: día, completados y fallados", () => {
    const s = challengeState(CHALLENGES[0], "2026-10-01", ["2026-10-01", "2026-10-02", "2026-10-04"], "2026-10-05");
    expect(s).toMatchObject({ day: 5, completed: 3, missed: 1, todayDone: false, finished: false, outcome: "activo", graceLeft: 2 });
    expect(s.cells).toHaveLength(30);
  });
  it("ids únicos", () => expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length));
});

describe("retos: fallar y vencer", () => {
  const c = { days: 10, grace: 2 };
  it("falla al pasar los comodines antes del final", () => {
    expect(challengeState(c, "2026-10-01", days("2026-10-01", [0, 1, 2]), "2026-10-06").outcome).toBe("activo"); // 2 fallados = comodines
    expect(challengeState(c, "2026-10-01", days("2026-10-01", [0, 1]), "2026-10-06").outcome).toBe("fallido"); // 3 fallados
  });
  it("vence al terminar el plazo sin la meta", () => {
    expect(challengeState({ days: 10, grace: 0 }, "2026-10-01", days("2026-10-01", [0, 1, 2]), "2026-10-15").outcome).toBe("vencido");
  });
  it("se completa con días - comodines y sin días pendientes", () => {
    const done8 = days("2026-10-01", [0, 1, 2, 3, 4, 5, 6, 7]);
    expect(challengeState(c, "2026-10-01", done8, "2026-10-10").outcome).toBe("activo"); // hoy (día 10) aún pendiente
    expect(challengeState(c, "2026-10-01", done8, "2026-10-11").outcome).toBe("completado");
    expect(challengeState(c, "2026-10-01", days("2026-10-01", [0, 1, 2, 3, 4, 5, 6, 7, 9]), "2026-10-10").outcome).toBe("completado");
  });
  it("todos los días cumplidos = completado aunque no tenga comodines", () => {
    expect(challengeState({ days: 3 }, "2026-10-01", days("2026-10-01", [0, 1, 2]), "2026-10-03").outcome).toBe("completado");
  });
  it("el cupo de activos se libera: un reto viejo nunca queda activo para siempre", () => {
    expect(challengeState(CHALLENGE_BY_ID["banana-30"], "2026-01-01", [], "2026-10-22").outcome).toBe("vencido");
  });
});

describe("retos del panel (challenges_catalog)", () => {
  it("interpreta reglas conocidas y limita XP y comodines", () => {
    const c = fromCatalogRow({ slug: "pasos-14", title: "14 días de pasos", description: "x", days: 14, rules: { verify: "steps", pasosMin: 8000, comodines: 99, xp: 9999 } })!;
    expect(c).toMatchObject({ id: "pasos-14", verify: "steps", stepsGoal: 8000, grace: 13, xp: 400, source: "admin" });
    expect(c.task(1)).toMatch(/8.000|8,000/);
  });
  it("verificación desconocida = manual; tarea propia", () => {
    const c = fromCatalogRow({ slug: "lectura", title: "Leer 10 páginas", description: null, days: 21, rules: { verify: "magia", tarea: "Lee 10 páginas" } })!;
    expect(c.verify).toBe("manual");
    expect(c.task(3)).toBe("Lee 10 páginas");
    expect(c.grace).toBe(2);
  });
  it("filas inválidas se ignoran", () => {
    expect(fromCatalogRow({ slug: "NO VALIDO", title: "x", description: null, days: 10, rules: {} })).toBeNull();
  });
  it("el panel agrega retos y reemplaza al base con el mismo identificador", () => {
    const m = mergeCatalog([{ slug: "agua-21", title: "Agua editada", description: "y", days: 14, rules: { verify: "water" } }, { slug: "nuevo-7", title: "Nuevo reto", description: null, days: 7, rules: {} }]);
    expect(m.find((c) => c.id === "agua-21")?.title).toBe("Agua editada");
    expect(m.find((c) => c.id === "nuevo-7")).toBeTruthy();
    expect(m.length).toBe(CHALLENGES.length + 1);
  });
  it("pasos usa la meta del reto", () => {
    const c = fromCatalogRow({ slug: "pasos-5k", title: "5 mil pasos", description: null, days: 7, rules: { verify: "steps", pasosMin: 5000 } })!;
    expect(metAuto(c, { workout: false, steps: 5200, water: 0, protein: 0, proteinGoal: 0 })).toBe(true);
    expect(metAuto(CHALLENGE_BY_ID["pasos-30"], { workout: false, steps: 5200, water: 0, protein: 0, proteinGoal: 0 })).toBe(false);
  });
});
