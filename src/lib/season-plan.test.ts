import { describe, expect, it } from "vitest";
import { SEASON_SEED_BY_SLUG } from "./season-content";
import { DEFAULT_INTAKE, adaptExercises, personalPhases, personalSeason, personalWeeks, swapsFor } from "./season-plan";
import { SEASON_BY_SLUG, type SeasonIntake } from "./seasons";
import { calendarSlot, resolveProgram, type ProgramDef } from "./programs";
import { knownExercise } from "./programs-server";

const seed = (slug: string): ProgramDef => { const p = SEASON_SEED_BY_SLUG[slug]; return { slug, title: p.title, meta: p.meta, sessions: p.sessions }; };
const run = SEASON_BY_SLUG["temporada-running-1"];
const runner = (o: Partial<SeasonIntake> = {}): SeasonIntake => ({
  ...DEFAULT_INTAKE, trainDays: [0, 1, 2, 3, 4], sessions: 3, minutes: 45, goal: "marca",
  running: { runDays: [1, 3, 5], longRunDay: 5, kmWeek: 30, paceDist: null, paceTime: null, target: "21k", surface: ["calle"], watch: "no" }, ...o,
});

describe("temporada a la medida", () => {
  it("solo las sesiones elegidas, en orden de día y con sus días de la semana", () => {
    const p = personalSeason(seed(run.slug), run, runner());
    expect(personalWeeks(p)).toBe(true);
    expect(p.def.slots).toEqual([...p.def.slots!].sort((a, b) => a - b));
    expect(p.def.slots).toHaveLength(3);
    for (const ph of p.def.meta.phases.map((_, k) => k + 1)) expect(p.def.sessions.filter((s) => s.phase === ph).map((s) => s.day)).toEqual([1, 2, 3]);
    // Nunca fuerza ni potencia el viernes (víspera de la larga del sábado) ni el sábado.
    p.plan.slots.filter((s) => s.kind === "fuerza" || s.kind === "potencia").forEach((s) => expect([4, 5]).not.toContain(s.dow));
  });
  it("el calendario del programa pone cada sesión en su día de la semana", () => {
    const p = personalSeason(seed(run.slug), run, runner());
    const st = { status: "activo" as const, startedOn: run.startsOn, pausedOn: null, pausedDays: 0 };
    const days = [0, 1, 2, 3, 4, 5, 6].filter((k) => calendarSlot(p.def, st, run.startsOn, `2026-11-${String(9 + k).padStart(2, "0")}`));
    expect(days).toEqual(p.def.slots);
    const r = resolveProgram(p.def, st, [], "2026-11-09");
    expect(r.required).toBe(3);
  });
  it("respeta los minutos: 30 min = 4 ejercicios", () => {
    const p = personalSeason(seed(run.slug), run, runner({ minutes: 30 }));
    for (const s of p.def.sessions) expect(s.exercises.length).toBeLessThanOrEqual(4);
  });
  it("con molestia de rodilla no hay saltos ni zancadas", () => {
    const p = personalSeason(seed(run.slug), run, runner({ injuries: ["rodilla"] }));
    const ids = p.def.sessions.flatMap((s) => s.exercises.map((e) => e.id));
    for (const bad of ["jumpsquat", "ds:3361", "bulgarian", "ds:0431"]) expect(ids).not.toContain(bad);
    for (const id of ids) expect(knownExercise(id), id).toBe(true);
  });
  it("raquetas: las molestias típicas también cambian ejercicios", () => {
    const sw = swapsFor("raquetas", { ...DEFAULT_INTAKE, raquetas: { which: "padel", playDays: [2], competitiveDays: [], hand: "derecha", category: "", matchMin: 90, pains: ["codo"] } });
    expect(sw["ds:0994"]).toBeNull();
  });
  it("cross: lo que no quiere hacer no aparece", () => {
    const cross = SEASON_BY_SLUG["temporada-cross-1"];
    const p = personalSeason(seed(cross.slug), cross, { ...DEFAULT_INTAKE, sessions: 4, trainDays: [0, 1, 2, 3, 4, 5, 6], cross: { boxDays: [], oly: "nada", gymnastics: "nada", benchWod: null, squat1rm: null, avoid: ["olimpicos", "colgarse"] } });
    const ids = p.def.sessions.flatMap((s) => s.exercises.map((e) => e.id));
    for (const bad of ["ds:0535", "pullup", "ds:0970", "kneeraise"]) expect(ids).not.toContain(bad);
  });
  it("adaptar no repite ejercicios", () => {
    const out = adaptExercises([{ id: "jumpsquat", sets: 3, lo: 5, hi: 6, rest: 90 }, { id: "glutebridge", sets: 3, lo: 10, hi: 12, rest: 60 }], { jumpsquat: "glutebridge" }, 6);
    expect(out.map((e) => e.id)).toEqual(["glutebridge"]);
  });
  it("evento dentro de la temporada: descarga en su semana, sin perder las 8 semanas", () => {
    const p = personalSeason(seed(run.slug), run, runner({ eventDate: "2026-12-27", eventType: "21K" }));
    expect(p.taper).toEqual([4, 7]);
    expect(personalWeeks(p)).toBe(true);
    const w7 = personalPhases(seed(run.slug).meta.phases, [4, 7]).phases;
    expect(w7.map((x) => `${x.name}:${x.weeks}:${!!x.deload}`)).toEqual(["Base:3:false", "Descarga:1:true", "Potencia:2:false", "Afinar para tu evento:1:true", "Afinar y prueba:1:true"]);
  });
});
