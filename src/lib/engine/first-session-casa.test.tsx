import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EX, FIRST_HOME_MIN, FIRST_MAX_MIN, homeFirstAt, offersHomeFirst, planDay, scheduleFor, type Equipment } from "@/lib/engine";
import { firstSessionPlan } from "@/lib/athlete";
import { cleanEvent } from "@/app/api/track/event";
import { Readiness } from "@/components/readiness";

// Mismo recorte del dashboard que usan Hoy y /app/entreno.
const dash = (equipment: Equipment, dow = 1, days = 6) => {
  const engineSched = scheduleFor(days);
  const opts = { equipment, level: "principiante" as const, minutes: undefined, sex: "m" as const };
  return { program: null, plan: planDay(dow, 0, engineSched, opts), engineSched, today: { dow } as never, week: 0, opts };
};

describe("primer entreno en casa con gym en el perfil (#194)", () => {
  it.each(["gym", "mixto"] as const)("%s: la variante en casa usa los ejercicios sin equipo y dura 12 min", (equipment) => {
    expect(offersHomeFirst(equipment)).toBe(true);
    const d = dash(equipment);
    const gym = firstSessionPlan(d, 0)!;
    const home = firstSessionPlan(d, 0, true)!;
    // Los mismos ejercicios del primer entreno sin equipo (FIRST_EX.ninguno), con descanso corto para caber en 12 min.
    expect(home.exercises.map((e) => e.id)).toEqual(firstSessionPlan(dash("ninguno"), 0)!.exercises.map((e) => e.id));
    expect(home.exercises.map((e) => e.id).slice(0, 3)).toEqual(["bwsquat", "pushup", "glutebridge"]);
    for (const e of home.exercises) expect(EX[e.id].inc).toBe(0);
    // El botón de Hoy promete "(12 min, sin equipo)" y muestra home.mins.
    expect(home.mins).toBe(FIRST_HOME_MIN);
    expect(FIRST_HOME_MIN).toBe(12);
    expect(gym.mins).toBeLessThanOrEqual(FIRST_MAX_MIN);
    // Se guarda con la misma plantilla que el primer entreno de gym: cuenta como el primero y la rutina no cambia.
    expect(home.tpl).toBe(gym.tpl);
    expect(gym.exercises.map((e) => e.id).slice(0, 3)).toEqual(["goblet", "incline", "lat"]);
    // Desde el segundo entreno, la rutina normal del gym (también si llega con ?casa=1).
    expect(firstSessionPlan(d, 1, true)).toBeNull();
    expect(d.plan.exercises.some((e) => EX[e.id].inc > 0)).toBe(true);
  });

  it.each(["casa", "ninguno"] as const)("%s: no hay variante (ya entrena con lo que tiene)", (equipment) => {
    expect(offersHomeFirst(equipment)).toBe(false);
    const d = dash(equipment);
    expect(firstSessionPlan(d, 0, true)).toEqual(firstSessionPlan(d, 0));
  });

  it("con un programa activo manda el programa", () => {
    expect(firstSessionPlan({ ...dash("gym"), program: {} as never }, 0, true)).toBeNull();
  });

  it.each([
    [18, true], [21.5, true], [23.99, true], [0, true], [4.99, true],
    [5, false], [9, false], [12, false], [17.99, false],
  ])("registro a las %s: en casa primero = %s", (hour, first) => {
    expect(homeFirstAt(hour)).toBe(first);
  });
  it("sin hora de registro, el gym primero", () => {
    expect(homeFirstAt(null)).toBe(false);
    expect(homeFirstAt(undefined)).toBe(false);
  });

  const order = (html: string) => [html.indexOf("Empieza tu primer entreno"), html.indexOf("¿No estás en el gym?")];

  it.each([true, false])("el botón en casa abre ?casa=1 y su orden sigue la hora (de noche = %s)", (night) => {
    for (const demo of [true, false]) {
      const html = renderToStaticMarkup(<Readiness first initial={0} dateKey="2026-11-02" demo={demo} mins={14} home={{ mins: 12, first: night }} />);
      expect((html.match(/<a /g) ?? []).length).toBe(2);
      expect(html).toContain("¿No estás en el gym? Hazlo en casa ahora (12 min, sin equipo)");
      expect(html).toContain(`href="/app/entreno?casa=1${demo ? "&amp;primera=1" : ""}"`);
      expect(html).toContain(`href="/app/entreno${demo ? "?primera=1" : ""}"`);
      const [gym, casa] = order(html);
      expect(night ? casa < gym : gym < casa).toBe(true);
      // El primero es el botón principal.
      expect(html.indexOf("btn-primary")).toBeLessThan(Math.min(gym, casa));
    }
  });

  it("sin la opción en casa, un solo botón como antes", () => {
    const html = renderToStaticMarkup(<Readiness first initial={0} dateKey="2026-11-02" demo={false} mins={14} />);
    expect((html.match(/<a /g) ?? []).length).toBe(1);
    expect(html).not.toContain("casa=1");
  });

  it("workout_open y workout_saved llevan variant casa-primero", () => {
    expect(cleanEvent({ name: "workout_open", props: { first_session: true, template: "pushA", variant: "casa-primero" } })?.props.variant).toBe("casa-primero");
    const player = readFileSync("src/app/(app)/app/entreno/player.tsx", "utf8");
    expect(player).toMatch(/track\("workout_open", \{[^}]*\.\.\.\(variant \? \{ variant \} : \{\}\)/);
    expect(player).toMatch(/track\("workout_saved", \{[^}]*\.\.\.\(variant \? \{ variant \} : \{\}\)/);
    const entreno = readFileSync("src/app/(app)/app/entreno/page.tsx", "utf8");
    expect(entreno).toContain('variant={homeFirst ? "casa-primero" : undefined}');
    // El perfil no cambia: el equipo de la variante solo vive en esta página.
    expect(entreno).not.toMatch(/update\(\{[^}]*equipment/);
  });
});
