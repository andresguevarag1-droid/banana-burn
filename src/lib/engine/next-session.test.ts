import { describe, expect, it } from "vitest";
import { nextTrainingDow, scheduleFor } from "@/lib/engine";
import { nextSessionPlan } from "@/lib/athlete";
import { shortSteps } from "@/lib/guide";

describe("próxima sesión para adelantar en un día de descanso", () => {
  it("3 días (lun, mié, vie): el domingo adelanta el lunes y el martes el miércoles", () => {
    const s = scheduleFor(3);
    expect(nextTrainingDow(s, 0)).toBe(1);
    expect(nextTrainingDow(s, 2)).toBe(3);
    expect(nextTrainingDow(s, 6)).toBe(1);
  });
  it("sin días de entreno devuelve null", () => {
    expect(nextTrainingDow({ 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null }, 3)).toBeNull();
  });
  it("el plan adelantado trae ejercicios; del sábado al lunes rota a la semana siguiente", () => {
    const engineSched = scheduleFor(3);
    const opts = { equipment: "gym" as const, level: "intermedio" as const, sex: "m" as const };
    const sat = nextSessionPlan({ engineSched, today: { dow: 6 } as never, week: 2, opts })!;
    expect(sat.dow).toBe(1);
    expect(sat.exercises.length).toBeGreaterThan(0);
    const tue = nextSessionPlan({ engineSched, today: { dow: 2 } as never, week: 2, opts })!;
    expect(tue.dow).toBe(3);
  });
});

describe("guía corta", () => {
  it("termina llevando al primer entreno", () => {
    const steps = shortSteps({ name: "Ana" } as never, { lastFree: "", firstPaid: "", day: () => "" } as never);
    const last = steps.at(-1)!;
    expect(last.id).toBe("final");
    expect(last.cta?.href).toBe("/app/entreno");
  });
});
