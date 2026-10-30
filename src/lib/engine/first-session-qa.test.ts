import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Cliente de Supabase falso: devuelve el conteo (o el error) de `workouts` que fije cada prueba.
const db = vi.hoisted(() => ({ result: { count: 0 as number | null, error: null as unknown }, calls: [] as string[] }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (t: string) => {
      db.calls.push(t);
      const q = { select: () => q, eq: () => q, limit: () => Promise.resolve(db.result) };
      return q;
    },
  }),
}));

import { estimateMinutes, FIRST_MAX_MIN, forEquipment, isTrainingDay, planDay, scheduleFor, type Equipment } from "@/lib/engine";
import { firstSessionPlan, nextSessionPlan } from "@/lib/athlete";
import { hasSavedWorkout } from "@/app/(app)/app/entreno/done-today";

const viewer = (demo = false) => ({ id: "u1", demo }) as never;

describe("hasSavedWorkout: la primera vez se decide con los entrenos guardados", () => {
  beforeEach(() => { db.calls.length = 0; });
  it("sin entrenos guardados: false (toca el primer entreno corto)", async () => {
    db.result = { count: 0, error: null };
    expect(await hasSavedWorkout(viewer())).toBe(false);
    expect(db.calls).toEqual(["workouts"]);
  });
  it("con uno o más entrenos guardados: true (vuelve el plan normal)", async () => {
    db.result = { count: 1, error: null };
    expect(await hasSavedWorkout(viewer())).toBe(true);
    db.result = { count: 40, error: null };
    expect(await hasSavedWorkout(viewer())).toBe(true);
  });
  it("si la lectura falla: true (nunca un entreno corto por error)", async () => {
    db.result = { count: null, error: { message: "boom" } };
    expect(await hasSavedWorkout(viewer())).toBe(true);
  });
  it("en demo no consulta la base", async () => {
    expect(await hasSavedWorkout(viewer(true))).toBe(true);
    expect(db.calls).toEqual([]);
  });
});

describe("primer entreno corto en cualquier día, horario y nivel", () => {
  const equipments: Equipment[] = ["gym", "mixto", "casa", "ninguno"];
  for (const equipment of equipments)
    for (const sex of ["m", "f"] as const)
      it(`${equipment}, ${sex}: 10 a 15 min, 3 o 4 ejercicios del equipo, y Hoy muestra lo mismo que abre Entreno`, () => {
        for (const days of [2, 3, 4, 5, 6])
          for (const level of ["principiante", "intermedio", "avanzado"] as const)
            for (const minutes of [undefined, 30, 45])
              for (let dow = 0; dow < 7; dow++) {
                const engineSched = scheduleFor(days);
                const opts = { equipment, level, minutes, sex };
                const d = { program: null, plan: planDay(dow, 2, engineSched, opts), engineSched, today: { dow } as never, week: 2, opts };
                const first = firstSessionPlan(d, 0)!;
                const at = `${days} días, ${level}, ${minutes} min, día ${dow}`;
                expect(first, at).not.toBeNull();
                expect(first.mins, at).toBeGreaterThanOrEqual(10);
                expect(first.mins, at).toBeLessThanOrEqual(FIRST_MAX_MIN);
                expect(first.mins, at).toBe(estimateMinutes(first.exercises));
                expect(first.exercises.length, at).toBeGreaterThanOrEqual(3);
                expect(first.exercises.length, at).toBeLessThanOrEqual(4);
                for (const e of first.exercises) expect(forEquipment(e.id, equipment), at).toBe(e.id);
                // Hoy usa firstSessionPlan(d, 0) y Entreno firstSessionPlan(d, saved ? 1 : 0): mismo plan, mismos minutos.
                expect(firstSessionPlan(d, 0), at).toEqual(first);
                // Se guarda con la plantilla de la sesión que tocaba: hoy, o la próxima en un día de descanso.
                expect(first.tpl, at).toBe((isTrainingDay(d.plan) ? d.plan : nextSessionPlan(d)!).tpl);
                // Segundo entreno: el plan normal.
                expect(firstSessionPlan(d, 1), at).toBeNull();
                if (isTrainingDay(d.plan)) expect(d.plan.name, at).not.toBe(first.name);
              }
      });
});
