import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EX, FIRST_MAX_MIN, forEquipment, isTrainingDay, planDay, scheduleFor, type Equipment } from "@/lib/engine";
import { firstSessionPlan, nextSessionPlan } from "@/lib/athlete";
import { FUNNEL_EVENTS, cleanEvent } from "@/app/api/track/event";
import { Readiness } from "@/components/readiness";

// Mismo recorte del dashboard que usan Hoy y /app/entreno.
const dash = (equipment: Equipment, sex: "m" | "f", dow = 1, days = 6, week = 0) => {
  const engineSched = scheduleFor(days);
  const opts = { equipment, level: "principiante" as const, minutes: undefined, sex };
  return { program: null, plan: planDay(dow, week, engineSched, opts), engineSched, today: { dow } as never, week, opts };
};

const CASES: { equipment: Equipment; sex: "m" | "f"; who: string }[] = (["gym", "casa", "ninguno"] as const).flatMap((equipment) => [
  { equipment, sex: "m" as const, who: "hombre (Coach Banana)" },
  { equipment, sex: "f" as const, who: "mujer (Coach Platanita)" },
]);

describe("primer entreno corto", () => {
  for (const { equipment, sex, who } of CASES) {
    it(`${equipment}, ${who}: el primero dura 10 a 15 min con 3 o 4 ejercicios de su equipo; el segundo es el normal`, () => {
      const d = dash(equipment, sex);
      const first = firstSessionPlan(d, 0)!;
      expect(first.mins).toBeGreaterThanOrEqual(10);
      expect(first.mins).toBeLessThanOrEqual(FIRST_MAX_MIN);
      expect(first.exercises.length).toBeGreaterThanOrEqual(3);
      expect(first.exercises.length).toBeLessThanOrEqual(4);
      expect(first.cardio).toBeUndefined();
      // Del equipo de la persona: ninguno pide algo que no tenga (el motor no lo cambiaría por otro).
      for (const e of first.exercises) expect(forEquipment(e.id, equipment)).toBe(e.id);
      if (equipment === "ninguno") for (const e of first.exercises) expect(EX[e.id].inc).toBe(0);
      // Se guarda con la plantilla del día: la rutina sigue igual después.
      expect(first.tpl).toBe(d.plan.tpl);
      expect(isTrainingDay(first)).toBe(true);

      // Segundo entreno (ya hay uno guardado): vuelve el plan normal, más largo.
      expect(firstSessionPlan(d, 1)).toBeNull();
      expect(d.plan.mins!).toBeGreaterThan(FIRST_MAX_MIN);
    });
  }

  it("en un día de descanso adelanta la próxima sesión, también corta", () => {
    const d = dash("gym", "f", 0, 3);
    expect(isTrainingDay(d.plan)).toBe(false);
    const first = firstSessionPlan(d, 0)!;
    expect(first.tpl).toBe(nextSessionPlan(d)!.tpl);
    expect(first.mins).toBeLessThanOrEqual(FIRST_MAX_MIN);
  });

  it("con un programa activo manda el programa", () => {
    expect(firstSessionPlan({ ...dash("casa", "f"), program: {} as never }, 0)).toBeNull();
  });

  it.each([3, 4, 5, 6])("con %i días semanales conserva la rutina al regresar sin entrenar", (days) => {
    for (const { equipment, sex } of CASES) {
      const initial = firstSessionPlan(dash(equipment, sex, 1, days), 0)!;
      for (const week of [0, 1, 4]) {
        for (const dow of [0, 1, 2, 3, 4, 5, 6]) {
          const returning = dash(equipment, sex, dow, days, week);
          expect(firstSessionPlan(returning, 0)).toEqual(initial);
          expect(firstSessionPlan(returning, 1)).toBeNull();
        }
      }
    }
  });

  it("el botón de Hoy muestra la duración corta del primer entreno", () => {
    const first = firstSessionPlan(dash("ninguno", "m"), 0)!;
    const html = renderToStaticMarkup(<Readiness first initial={0} dateKey="2026-10-30" demo mins={first.mins!} />);
    expect(html).toContain(`Empezar mi primer entreno (${first.mins} min)`);
    expect((html.match(/<a /g) ?? []).length).toBe(1);
    expect(html).not.toContain("¿Cómo te sientes hoy?");
  });

  it("Hoy y Entreno deciden la primera vez en el servidor con los entrenos guardados", () => {
    const hoy = readFileSync("src/app/(app)/app/page.tsx", "utf8");
    expect(hoy).toMatch(/isFirstDay\(\{[^}]*workouts: learnState\.workouts/);
    expect(readFileSync("src/lib/hoy-first.ts", "utf8")).toMatch(/workouts === 0/);
    expect(hoy).toMatch(/firstSessionPlan\(d, 0\)/);
    const entreno = readFileSync("src/app/(app)/app/entreno/page.tsx", "utf8");
    expect(entreno).toMatch(/hasSavedWorkout\(v\)/);
    expect(entreno).toMatch(/firstSessionPlan\(d, saved \? 1 : 0\)/);
  });

  it.each([0, 1, 2, 3])("la energía %i no desvía ni acorta el primer entreno", (initial) => {
    for (const demo of [true, false]) {
      const html = renderToStaticMarkup(<Readiness first initial={initial} dateKey="2026-11-01" demo={demo} mins={13} suggestSoft />);
      expect(html).toContain(`href="/app/entreno${demo ? "?primera=1" : ""}"`);
      expect(html).toContain("Empezar mi primer entreno (13 min)");
      expect(html).not.toContain("modo=suave");
      expect(html).not.toContain("<button");
    }
  });
});

describe("embudo del entreno (0061) en el primer entreno", () => {
  // El issue los llama workout_open, set1_start y workout_done; en 0061 son workout_open, workout_first_set y workout_saved.
  const EVENTS = ["workout_open", "brief_start", "workout_first_set", "workout_saved"] as const;
  it.each([true, false])("los eventos conservan first_session=%s y la plantilla", (firstSession) => {
    const tpl = firstSessionPlan(dash("gym", "m"), 0)!.tpl!;
    for (const name of EVENTS) {
      expect(FUNNEL_EVENTS).toContain(name);
      expect(cleanEvent({ name, props: { template: tpl, done: 0, total: 6, first_session: firstSession } })).toEqual({ name, props: { template: tpl, done: 0, total: 6, first_session: firstSession } });
    }
  });
  it.each([true, false])("acepta onboarding_done con goal y trial=%s como origen de las 24 horas", (trial) => {
    expect(FUNNEL_EVENTS).toContain("onboarding_done");
    expect(cleanEvent({ name: "onboarding_done", props: { goal: "recomp", trial } })).toEqual({
      name: "onboarding_done",
      props: { goal: "recomp", trial },
    });
  });
  it("el reproductor los sigue enviando", () => {
    const player = readFileSync("src/app/(app)/app/entreno/player.tsx", "utf8");
    for (const name of EVENTS) expect(player).toContain(`track("${name}"`);
  });
});
