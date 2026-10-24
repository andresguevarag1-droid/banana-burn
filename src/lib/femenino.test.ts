import { describe, expect, it } from "vitest";
import { planDay } from "./engine";
import { DEFAULT_WEEK } from "./engine/data";
import { TPL } from "./engine/data";
import { levelOf, levelAt, nextUnlock } from "./gamify";
import { workoutName } from "./progress";

describe("nombres para ella", () => {
  const dowOf = (tpl: string) => Number(Object.entries(DEFAULT_WEEK).find(([, t]) => t === tpl)![0]);
  it("las rutinas con nombre masculino tienen versión para ella; el id no cambia", () => {
    const d = dowOf("pullB");
    expect(planDay(d, 0, DEFAULT_WEEK, { sex: "f" }).name).toBe("Glúteos y espalda esculpida");
    expect(planDay(d, 0, DEFAULT_WEEK, { sex: "m" }).name).toBe("Espalda de gorila y glúteos");
    expect(planDay(d, 0, DEFAULT_WEEK, { sex: "f" }).tpl).toBe("pullB");
    for (const t of Object.values(TPL)) expect(/gorila|macho/i.test(t.nf ?? t.n), t.n).toBe(false);
  });
  it("niveles: mismos XP y número, nombre para ella", () => {
    expect(levelOf(1700, "f").n).toBe("Banana dorada");
    expect(levelOf(1700, "m").n).toBe("Plátano macho");
    expect(levelOf(1700, "f").next?.n).toBe("Mona fuerte");
    expect(levelAt(7, "f").n).toBe("Reina de la selva");
    expect(levelAt(8, "f").n).toBe("King Kong");
    expect(nextUnlock(2000, "f")?.name).toBe("Mona fuerte");
  });
  it("historial: el nombre guardado se muestra para ella", () => {
    expect(workoutName("pullA", "f")).toBe("Espalda firme y brazos tonificados");
    expect(workoutName("pullA")).toBe("Espalda ancha y bíceps fuertes");
  });
});
