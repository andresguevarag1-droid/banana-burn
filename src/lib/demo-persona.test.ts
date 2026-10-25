import { describe, expect, it } from "vitest";
import { parseDemoState } from "./demo-persona";
import { girlDemoDone, girlDemoState } from "./programs-server";
import { PROGRAM_SEED_BY_SLUG } from "./program-seed";
import { addDays, daysToWeekEnd, programDayOf, resolveProgram, weekDaysLabel } from "./programs";
import { commonTempo, rxBadge, sessionLine } from "./voice";

const get = (o: Record<string, string>) => (k: string) => o[k];

describe("demo de chica (solo modo demo)", () => {
  it("sin cookies es el demo de siempre: Andrés con el programa insignia", () => {
    expect(parseDemoState(get({}))).toEqual({ program: "si", day: 12, status: "activo", girl: false, season: null });
  });
  it("un programa de chicas trae a Sofía; ?persona= lo fuerza", () => {
    expect(parseDemoState(get({ bb_demo_programa: "pilates-casa-30", bb_demo_dia: "29" }))).toMatchObject({ program: "pilates-casa-30", day: 29, girl: true });
    expect(parseDemoState(get({ bb_demo_programa: "banana-girl" }))).toMatchObject({ day: 9, girl: true });
    expect(parseDemoState(get({ bb_demo_programa: "no", bb_demo_persona: "chica" }))).toMatchObject({ program: "no", girl: true });
    expect(parseDemoState(get({ bb_demo_programa: "pilates-casa-30", bb_demo_persona: "chico" })).girl).toBe(false);
  });
  it("valores raros se ignoran", () => {
    expect(parseDemoState(get({ bb_demo_programa: "otro", bb_demo_dia: "0", bb_demo_estado: "x" }))).toEqual({ program: "si", day: 12, status: "activo", girl: false, season: null });
    expect(parseDemoState(get({ bb_demo_dia: "61" })).day).toBe(12);
  });
  const p = PROGRAM_SEED_BY_SLUG["pilates-casa-30"];
  const def = { meta: p.meta, sessions: p.sessions };
  const today = "2026-11-12";
  const at = (day: number, status: "activo" | "pausado" | "completado" = "activo") => {
    const st = girlDemoState({ program: "pilates-casa-30", day, status, girl: true, season: null }, today);
    return { st, run: resolveProgram(def, st, girlDemoDone(st, today), today) };
  };
  it("día N del demo: va al día, sin sesiones perdidas", () => {
    for (const d of [1, 2, 8, 12, 14, 22, 28]) {
      const { run } = at(d);
      expect(run.effectiveDay + 1).toBe(d);
      expect(run.sessionsMissed, `día ${d}`).toBe(0);
    }
    expect(at(1).run.sessionsDone).toBe(0);
  });
  it("día 29 toca la prueba final; día 30 ya hizo todo y puede cerrar; día 31 terminó", () => {
    expect(at(29).run.today).toBe("entreno");
    expect(at(29).run.next?.session.title).toMatch(/Prueba final/);
    const d30 = at(30).run;
    expect(d30.sessionsDone).toBe(d30.sessionsTotal);
    expect(d30.canFinish).toBe(true);
    expect(d30.today).toBe("semana-completa");
    expect(at(31).run.today).toBe("terminado");
  });
  it("en pausa el día se congela", () => {
    const { st, run } = at(10, "pausado");
    expect(st.pausedOn).toBe(addDays(today, -3));
    expect(run.today).toBe("pausado");
    expect(run.effectiveDay + 1).toBe(10);
  });
});

describe("etiquetas de un programa en días", () => {
  const m = PROGRAM_SEED_BY_SLUG["pilates-casa-30"].meta;
  it("días de cada semana", () => {
    expect(weekDaysLabel(m, 1)).toBe("días 1 a 7");
    expect(weekDaysLabel(m, 2)).toBe("días 8 a 14");
    expect(weekDaysLabel(m, 5)).toBe("días 29 y 30");
    expect(weekDaysLabel({ ...m, days: 29 }, 5)).toBe("día 29");
  });
  it("cada sesión se nombra con el día del programa en que toca", () => {
    const def = { meta: m, sessions: PROGRAM_SEED_BY_SLUG["pilates-casa-30"].sessions };
    expect([1, 2, 3, 4, 5].map((d) => programDayOf(def, 1, d))).toEqual([1, 2, 3, 5, 6]);
    expect(programDayOf(def, 2, 4)).toBe(12);
    expect(programDayOf(def, 5, 1)).toBe(29);
  });
  it("días que faltan para el hito de fin de semana", () => {
    expect(daysToWeekEnd(m, 2, 11)).toBe(2); // día 12: faltan 13 y 14
    expect(daysToWeekEnd(m, 5, 28)).toBe(1); // día 29: mañana es el 30
    expect(daysToWeekEnd(m, 5, 29)).toBe(0);
    expect(daysToWeekEnd(m, 5, 40)).toBe(0);
  });
  it("tempo de la sesión: el del programa (2-1-2 en pilates), no el 3-1-1 del método", () => {
    expect(commonTempo([{ tempo: "2-1-2" }, { tempo: "2-1-2" }, {}, { tempo: "3-1-3" }])).toBe("2-1-2");
    expect(commonTempo([{ tempo: "2-1-2" }, {}, {}, {}])).toBeNull();
    expect(sessionLine("intermedio", { exercises: 5, mins: 16, tempo: "2-1-2" })).toBe("5 ejercicios en unos 16 min, tempo 2-1-2");
    expect(sessionLine("intermedio", { exercises: 5, mins: 16, tempo: null })).toBe("5 ejercicios en unos 16 min");
    expect(sessionLine("intermedio", { exercises: 5, mins: 40 })).toContain("tempo 3-1-1");
  });
  it("un ejercicio por tiempo progresa en segundos, no en repeticiones", () => {
    expect(rxBadge("intermedio", "reps", "s")).toBe("+ segundos");
    expect(rxBadge("intermedio", "reps")).toBe("+1 rep");
    expect(rxBadge("intermedio", "cal", "s")).toBe("Calibración");
  });
});
