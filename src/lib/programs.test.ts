import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  adaptId, addDays, calendarSlot, daysLabel, effectiveDay, parseMeta, parseProgramTemplate, parseSession, phaseAt, programErrors, programNutrition,
  programTemplate, resolveProgram, resumePausedDays, startPlan, weeksOf, withProgramProtein, type DoneSession, type ProgramMeta, type ProgramSession, type ProgramState,
} from "./programs";
import { PROGRAM_SEED, PROGRAM_SEED_BY_SLUG, programSeedSql } from "./program-seed";
import { exInfo, knownExercise } from "./programs-server";
import { SEED_CHALLENGES, fromCatalogRow, storeSection } from "./challenges";
import { targets } from "./engine";

const sql = readFileSync(new URL("../../supabase/migrations/0024_programas.sql", import.meta.url), "utf8");
const recon = PROGRAM_SEED_BY_SLUG["reconstruccion-8-semanas"];
const def = { meta: recon.meta, sessions: recon.sessions };
const START = "2026-10-05"; // lunes
const st = (o: Partial<ProgramState> = {}): ProgramState => ({ slug: recon.slug, status: "activo", startedOn: START, pausedOn: null, pausedDays: 0, completedAt: null, ...o });
const done = (list: [number, number, number][]): DoneSession[] => list.map(([week, day, off]) => ({ week, day, on: addDays(START, off) }));

describe("0024 coincide con el código", () => {
  it("la siembra de la migración es la de program-seed.ts (regenerar con scripts/gen-programas-seed.ts)", () => {
    expect(sql).toContain(programSeedSql().trim());
  });
  it("precios: se conservan los de 0018 y el insignia cuesta $9.99", () => {
    expect(Object.fromEntries(PROGRAM_SEED.map((p) => [p.slug, p.priceUsd]))).toEqual({
      "reconstruccion-8-semanas": 9.99, "gluteos-30": 6.99, "dominadas-desde-cero": 7.99, "abdomen-21": 4.99, "pierde-3kg-6-semanas": 9.99,
    });
  });
});

describe("siembra de programas", () => {
  it("todos los ejercicios (y sus alternativas de casa) existen en el motor o la biblioteca", () => {
    for (const p of PROGRAM_SEED) for (const s of p.sessions) for (const e of s.exercises) {
      expect(knownExercise(e.id), `${p.slug} ${e.id}`).toBe(true);
      if (e.home) expect(knownExercise(e.home), `${p.slug} ${e.home}`).toBe(true);
    }
  });
  it("cada programa se puede publicar (fases con sesiones completas, ejercicios clave presentes)", () => {
    for (const p of PROGRAM_SEED) expect(programErrors(p.meta, p.sessions, knownExercise), p.slug).toEqual([]);
  });
  it("la meta guardada en la base vuelve igual al leerla", () => {
    for (const p of PROGRAM_SEED) {
      expect(parseMeta(JSON.parse(JSON.stringify(p.meta)))).toEqual(p.meta);
      for (const s of p.sessions) expect(parseSession(JSON.parse(JSON.stringify(s)))).toEqual(s);
    }
  });
  it("duraciones: 8, 6, 6, 3 y 6 semanas; descarga en los de 8 semanas o más", () => {
    expect(PROGRAM_SEED.map((p) => weeksOf(p.meta))).toEqual([8, 6, 6, 3, 6]);
    for (const p of PROGRAM_SEED.filter((x) => weeksOf(x.meta) >= 8)) expect(p.meta.phases.some((f) => f.deload)).toBe(true);
  });
  it("volumen sensato: entre 10 y 20 series duras por semana en los músculos grandes del insignia (fase de construcción)", () => {
    const groups: Record<string, string[]> = {
      cuadriceps: ["squat", "goblet", "bulgarian", "ds:0739"], espalda: ["lat", "dbrow", "ds:0861", "row", "invrow"], pecho: ["bench", "incline", "pushup", "floorpress"],
      gluteo: ["ds:1409", "rdl", "bulgarian", "squat"],
    };
    const required = recon.sessions.filter((x) => x.phase === 2 && !x.optional);
    for (const [g, ids] of Object.entries(groups)) {
      const n = required.reduce((a, s) => a + s.exercises.filter((e) => ids.includes(e.id)).reduce((b, e) => b + e.sets, 0), 0);
      expect(n, g).toBeGreaterThanOrEqual(10); expect(n, g).toBeLessThanOrEqual(20);
    }
  });
  it("el insignia: 3 sesiones obligatorias y 1 opcional por semana", () => {
    expect(daysLabel(recon.meta, recon.sessions)).toBe("3 a 4 días por semana");
    expect(daysLabel(PROGRAM_SEED_BY_SLUG["dominadas-desde-cero"].meta, PROGRAM_SEED_BY_SLUG["dominadas-desde-cero"].sessions)).toBe("3 días por semana");
    expect(daysLabel(PROGRAM_SEED_BY_SLUG["gluteos-30"].meta, PROGRAM_SEED_BY_SLUG["gluteos-30"].sessions)).toBe("3 a 4 días por semana");
  });
  it("en el catálogo de respaldo los programas convertidos y el insignia son programas; los hábitos siguen siendo retos", () => {
    const by = Object.fromEntries(SEED_CHALLENGES.map((c) => [c.id, c]));
    for (const p of PROGRAM_SEED) expect(by[p.slug]?.kind, p.slug).toBe("programa");
    expect(by["banana-30"].kind).toBe("reto");
    expect(by["sprint-verano-28"].kind).toBe("reto");
    expect(storeSection(by["reconstruccion-8-semanas"], "2026-10-23")).toBe("programas");
  });
  it("una fila de la base con kind 'programa' pero sin meta válida se lee como reto", () => {
    const row = { slug: "x-prog", title: "X", description: null, days: 21, rules: null, kind: "programa", program: { phases: [] } };
    expect(fromCatalogRow(row)?.kind).toBe("reto");
    expect(fromCatalogRow({ ...row, program: recon.meta })?.kind).toBe("programa");
  });
});

describe("plantillas", () => {
  it("se guardan como p:<slug>:<semana>.<día> y se leen de vuelta", () => {
    const t = programTemplate(recon.slug, 2, 3);
    expect(t).toBe("p:reconstruccion-8-semanas:2.3");
    expect(parseProgramTemplate(t)).toEqual({ slug: recon.slug, week: 2, day: 3 });
    expect(parseProgramTemplate("pushA")).toBeNull();
    expect(t.length).toBeLessThanOrEqual(80);
  });
});

describe("qué entreno toca hoy", () => {
  it("día de inicio: semana 1, día 1, toca entreno", () => {
    const r = resolveProgram(def, st(), [], START);
    expect(r).toMatchObject({ week: 1, weeks: 8, dayInWeek: 0, today: "entreno", sessionsDone: 0, sessionsTotal: 24, sessionsMissed: 0 });
    expect(r.next?.day).toBe(1);
    expect(r.next?.session.title).toBe("Cuerpo completo A");
  });
  it("tras la sesión 1, el día siguiente toca la 2 (4 días: offsets 0, 1, 3, 4)", () => {
    const r = resolveProgram(def, st(), done([[1, 1, 0]]), addDays(START, 1));
    expect(r.today).toBe("entreno");
    expect(r.next?.day).toBe(2);
  });
  it("si ya hizo una sesión hoy, no le pide otra", () => {
    const r = resolveProgram(def, st(), done([[1, 1, 0]]), START);
    expect(r.today).toBe("hecho");
    expect(r.nextOn).toBe(addDays(START, 1));
  });
  it("día sin sesión planeada y al día: descanso, con la fecha de la próxima", () => {
    const r = resolveProgram(def, st(), done([[1, 1, 0], [1, 2, 1]]), addDays(START, 2));
    expect(r.today).toBe("descanso");
    expect(r.nextOn).toBe(addDays(START, 3));
    expect(r.next?.day).toBe(3);
  });
  it("si se le pasó un día, se pone al corriente al siguiente (sin dos sesiones el mismo día)", () => {
    const r = resolveProgram(def, st(), done([[1, 1, 0]]), addDays(START, 2));
    expect(r.today).toBe("entreno");
    expect(r.next?.day).toBe(2);
  });
  it("obligatorias primero; la opcional después; semana completa al terminar todas", () => {
    const three = done([[1, 1, 0], [1, 2, 1], [1, 3, 3]]);
    expect(resolveProgram(def, st(), three, addDays(START, 4)).next).toMatchObject({ day: 4 });
    expect(resolveProgram(def, st(), three, addDays(START, 4)).weekSessions.find((w) => w.day === 4)?.optional).toBe(true);
    const four = done([[1, 1, 0], [1, 2, 1], [1, 3, 3], [1, 4, 4]]);
    const r = resolveProgram(def, st(), four, addDays(START, 5));
    expect(r.today).toBe("semana-completa");
    expect(r.nextOn).toBe(addDays(START, 7));
    expect(r.extrasDone).toBe(1);
    expect(r.sessionsDone).toBe(3);
  });
  it("semana y día: el día 9 es la semana 2, con 'día 2' si hizo la 1", () => {
    const r = resolveProgram(def, st(), done([[1, 1, 0], [1, 2, 1], [1, 3, 3], [2, 1, 7]]), addDays(START, 9));
    expect(r.week).toBe(2);
    expect(r.dayInWeek).toBe(2);
    expect(r.next?.day).toBe(2);
    expect(r.phase.index).toBe(1);
  });
  it("las sesiones de semanas pasadas que no hizo cuentan como perdidas", () => {
    const r = resolveProgram(def, st(), done([[1, 1, 0]]), addDays(START, 8));
    expect(r.week).toBe(2);
    expect(r.sessionsMissed).toBe(2);
  });
  it("la semana 7 es de descarga y la 8 de cierre", () => {
    expect(phaseAt(recon.meta, 7)).toMatchObject({ index: 3, startWeek: 7, endWeek: 7 });
    expect(phaseAt(recon.meta, 7).phase.deload).toBe(true);
    expect(resolveProgram(def, st(), [], addDays(START, 6 * 7)).phase.phase.deload).toBe(true);
    expect(resolveProgram(def, st(), [], addDays(START, 7 * 7)).phase.phase.name).toBe("Cierre");
  });
  it("lo hecho antes de este inicio (una corrida anterior) no cuenta", () => {
    const old: DoneSession[] = [{ week: 1, day: 1, on: addDays(START, -30) }];
    expect(resolveProgram(def, st(), old, START).sessionsDone).toBe(0);
  });
  it("al terminar el calendario se puede cerrar; antes, solo con todas las sesiones", () => {
    expect(resolveProgram(def, st(), [], addDays(START, 55)).canFinish).toBe(false);
    const end = resolveProgram(def, st(), [], addDays(START, 56));
    expect(end).toMatchObject({ today: "terminado", canFinish: true, week: 8 });
    const all: DoneSession[] = [];
    for (let w = 1; w <= 8; w++) for (const d of [1, 2, 3]) all.push({ week: w, day: d, on: addDays(START, (w - 1) * 7 + d) });
    expect(resolveProgram(def, st(), all, addDays(START, 54)).canFinish).toBe(true);
  });
  it("próximo hito: fin de la fase actual, y el certificado al final", () => {
    expect(resolveProgram(def, st(), [], START).milestone).toMatchObject({ label: "Fin de la fase 1: Base y técnica", week: 3, left: 2 });
    expect(resolveProgram(def, st(), [], addDays(START, 7 * 7)).milestone).toMatchObject({ final: true, week: 8, left: 0 });
  });
});

describe("pausa y reanudación", () => {
  it("en pausa la semana no avanza", () => {
    const paused = st({ status: "pausado", pausedOn: addDays(START, 10) });
    expect(effectiveDay(paused, addDays(START, 40))).toBe(10);
    expect(resolveProgram(def, paused, [], addDays(START, 40))).toMatchObject({ week: 2, today: "pausado" });
  });
  it("al reanudar, los días en pausa se descuentan y sigue donde iba", () => {
    const pausedDays = resumePausedDays({ pausedOn: addDays(START, 10), pausedDays: 0 }, addDays(START, 24));
    expect(pausedDays).toBe(14);
    const resumed = st({ pausedDays });
    expect(effectiveDay(resumed, addDays(START, 24))).toBe(10);
    expect(resolveProgram(def, resumed, [], addDays(START, 24)).week).toBe(2);
    // Dos pausas se suman.
    expect(resumePausedDays({ pausedOn: addDays(START, 30), pausedDays: 14 }, addDays(START, 33))).toBe(17);
  });
  it("el calendario de la semana sigue la pausa: nada planeado mientras está en pausa", () => {
    expect(calendarSlot(def, st({ status: "pausado", pausedOn: START }), START, START)).toBeNull();
    expect(calendarSlot(def, st(), START, START)).toMatchObject({ week: 1, day: 1 });
    expect(calendarSlot(def, st(), START, addDays(START, 2))).toBeNull(); // miércoles de descanso
    expect(calendarSlot(def, st(), START, addDays(START, 3))).toMatchObject({ week: 1, day: 3 });
    expect(calendarSlot(def, st(), START, addDays(START, -1))).toBeNull();
    expect(calendarSlot(def, st(), START, addDays(START, 56))).toBeNull();
  });
});

describe("un solo programa activo", () => {
  const states = [{ slug: "a", status: "activo" as const }, { slug: "b", status: "pausado" as const }, { slug: "c", status: "abandonado" as const }];
  it("empezar otro con uno activo pide pausar el actual", () => {
    expect(startPlan(states, "d")).toEqual({ conflict: "a", action: "empezar" });
  });
  it("reanudar uno en pausa también choca con el activo", () => {
    expect(startPlan(states, "b")).toEqual({ conflict: "a", action: "reanudar" });
  });
  it("el activo no choca consigo mismo; uno abandonado se reinicia", () => {
    expect(startPlan(states, "a")).toEqual({ conflict: null, action: "activo" });
    expect(startPlan(states.slice(1), "c")).toEqual({ conflict: null, action: "reiniciar" });
  });
});

describe("nutrición del programa", () => {
  const meta = recon.meta;
  it("solo se aplica con nutrición: un programa nunca la da", () => {
    expect(programNutrition(meta, { nutrition: false })).toBeNull();
    expect(programNutrition(meta, { nutrition: true })).toEqual(meta.nutrition);
    expect(programNutrition({ nutrition: null }, { nutrition: true })).toBeNull();
    expect(programNutrition(PROGRAM_SEED_BY_SLUG["abdomen-21"].meta, { nutrition: true })).toBeNull();
  });
  it("cambia el modo de calorías y la proteína (g por kg), y recalcula carbohidratos", () => {
    const base = targets({ kg: 80, heightCm: 175, age: 30, mode: "acelerada" });
    const recomp = targets({ kg: 80, heightCm: 175, age: 30, mode: "recomp" });
    const n = programNutrition(PROGRAM_SEED_BY_SLUG["gluteos-30"].meta, { nutrition: true })!;
    expect(n.mode).toBe("fuerza");
    const t = withProgramProtein(targets({ kg: 80, heightCm: 175, age: 30, mode: n.mode }), n, 80);
    expect(t.kcal).toBeGreaterThan(base.kcal);
    expect(t.protein).toBe(145); // 1,8 g x 80 kg = 144, redondeado a 5
    expect(t.carbs).toBe(Math.round((t.kcal - t.protein * 4 - t.fat * 9) / 4));
    expect(recomp.kcal).toBeGreaterThan(base.kcal);
    expect(withProgramProtein(base, null, 80)).toEqual(base);
  });
});

describe("validación del panel", () => {
  const meta: ProgramMeta = { ...recon.meta, phases: [{ name: "Base", weeks: 2 }], daysPerWeek: 2, keyLifts: [] };
  const s = (day: number, ex: ProgramSession["exercises"]): ProgramSession => ({ phase: 1, day, title: `Día ${day}`, focus: "", exercises: ex });
  it("no se publica con sesiones vacías", () => {
    const errs = programErrors(meta, [s(1, [{ id: "squat", sets: 3, lo: 8, hi: 10, rest: 90 }]), s(2, [])], knownExercise);
    expect(errs.join(" ")).toMatch(/día 2: la sesión no tiene ejercicios/);
  });
  it("ni con un día sin sesión, ni con ejercicios que no existen", () => {
    expect(programErrors(meta, [s(1, [{ id: "squat", sets: 3, lo: 8, hi: 10, rest: 90 }])], knownExercise).join(" ")).toMatch(/día 2/);
    expect(programErrors(meta, [s(1, [{ id: "ds:9999", sets: 3, lo: 8, hi: 10, rest: 90 }]), s(2, [{ id: "noexiste", sets: 3, lo: 8, hi: 10, rest: 90 }])], knownExercise).join(" ")).toMatch(/no existen/);
  });
  it("completo: sin errores", () => {
    expect(programErrors(meta, [s(1, [{ id: "squat", sets: 3, lo: 8, hi: 10, rest: 90 }]), s(2, [{ id: "ds:0739", sets: 3, lo: 10, hi: 15, rest: 90 }])], knownExercise)).toEqual([]);
  });
  it("el saneado acota series, rangos, tempo e ids", () => {
    expect(parseSession({ phase: 1, day: 1, title: "x", exercises: [{ id: "squat", sets: 40, lo: 12, hi: 5, rest: 9999, tempo: "lento" }, { id: "<script>" }] })?.exercises)
      .toEqual([{ id: "squat", sets: 10, lo: 12, hi: 12, rest: 600 }]);
    expect(parseSession({ phase: 9, day: 1 })).toBeNull();
  });
});

describe("adaptación al equipo", () => {
  const info = (id: string) => exInfo(id);
  it("en el gimnasio no cambia nada", () => {
    expect(adaptId({ id: "squat" }, "gym", true, info)).toBe("squat");
    expect(adaptId({ id: "ds:0739", home: "goblet" }, "gym", true, info)).toBe("ds:0739");
  });
  it("en casa: los del motor usan su versión de casa; los de máquina, su alternativa", () => {
    expect(adaptId({ id: "squat" }, "casa", true, info)).toBe("goblet");
    expect(adaptId({ id: "ds:0739", home: "goblet" }, "casa", true, info)).toBe("goblet");
    expect(adaptId({ id: "ds:0381", home: "lunge" }, "casa", true, info)).toBe("ds:0381"); // mancuernas: se queda
    expect(adaptId({ id: "ds:0381", home: "lunge" }, "ninguno", true, info)).toBe("lunge");
  });
  it("un programa que no se adapta (dominadas) deja sus ejercicios", () => {
    expect(adaptId({ id: "lat" }, "ninguno", false, info)).toBe("lat");
  });
});

// ───────────── 0027: experiencias y programas nuevos ─────────────
import { ALL_PROGRAM_SEED, EXPERIENCES, PROGRAM_SEED_2, PROGRAM_UPGRADES, program0027Sql } from "./program-seed";
import { habitsToday, parseExperience, tipFor, type ProgramExperience } from "./programs";
import { RESTYLE } from "./catalog-0028";

const sql27 = readFileSync(new URL("../../supabase/migrations/0027_experiencias.sql", import.meta.url), "utf8");
const muscleOf = (id: string) => (exInfo(id)?.muscle ?? "").toLowerCase();

describe("0027 coincide con el código", () => {
  it("la siembra de 0027 es la de program-seed.ts (regenerar con scripts/gen-programas-seed.ts --0027)", () => {
    expect(sql27).toContain(program0027Sql().trim());
  });
  it("precios de los nuevos programas", () => {
    expect(Object.fromEntries(PROGRAM_SEED_2.map((p) => [p.slug, p.priceUsd]))).toEqual({ "abdomen-marcado": 7.99, "brazos-definidos": 6.99, "banana-girl": 7.99 });
  });
});

describe("programas de 0027", () => {
  const all = ALL_PROGRAM_SEED;
  it("todos los programas tienen experiencia completa: modo, 4 hábitos, un consejo por semana, comida y descanso", () => {
    for (const p of all) {
      const x = p.meta.experience!;
      expect(x, p.slug).toBeTruthy();
      expect(x.mode.length, p.slug).toBeGreaterThan(3);
      expect(x.habits.length, p.slug).toBe(4);
      expect(x.tips.length, p.slug).toBe(weeksOf(p.meta));
      expect(x.food.length, p.slug).toBeGreaterThanOrEqual(3);
      expect(x.restDay && x.coachFocus && x.welcome, p.slug).toBeTruthy();
      expect(parseExperience(JSON.parse(JSON.stringify(x))), p.slug).toEqual(x);
    }
  });
  it("ejercicios existentes y programas publicables", () => {
    for (const p of all) {
      for (const s of p.sessions) for (const e of s.exercises) {
        expect(knownExercise(e.id), `${p.slug} ${e.id}`).toBe(true);
        if (e.home) expect(knownExercise(e.home), `${p.slug} ${e.home}`).toBe(true);
      }
      expect(programErrors(p.meta, p.sessions, knownExercise), p.slug).toEqual([]);
      expect(parseMeta(JSON.parse(JSON.stringify(p.meta))), p.slug).toEqual(p.meta);
    }
  });
  it("textos sin emojis ni raya larga", () => {
    const bad = /[—\p{Extended_Pictographic}]/u;
    for (const p of all) expect(bad.test(JSON.stringify([p.title, p.description, p.meta, p.sessions, p.safetyNote])), p.slug).toBe(false);
  });
  it("Glúteos de acero: cada sesión obligatoria es de glúteo y pierna; nada de tren superior", () => {
    const g = PROGRAM_UPGRADES["gluteos-30"];
    for (const s of g.sessions) for (const e of s.exercises) {
      expect(/glúteo|piernas|femoral|cuádriceps|abductor|isquio|core|aductor/.test(muscleOf(e.id)) || ["ds:0628", "ds:1774", "ds:0710"].includes(e.id), `${s.title} ${e.id} ${muscleOf(e.id)}`).toBe(true);
    }
    // Hip thrust o puente en las 3 sesiones dedicadas de cada fase... al menos en 2 de 3, y abducción cada semana.
    for (const ph of [1, 2, 3]) {
      const req = g.sessions.filter((s) => s.phase === ph && !s.optional);
      expect(req.length).toBe(3);
      expect(req.filter((s) => s.exercises.some((e) => e.id === "ds:1409")).length).toBeGreaterThanOrEqual(2);
      expect(req.some((s) => s.exercises.some((e) => ["ds:0597", "ds:0710", "ds:1774"].includes(e.id)))).toBe(true);
    }
  });
  it("Brazos definidos: bíceps y tríceps en las 3 sesiones; nada de pierna", () => {
    const b = PROGRAM_SEED_2.find((p) => p.slug === "brazos-definidos")!;
    for (const s of b.sessions) for (const e of s.exercises) expect(/piernas|glúteo|femoral|cuádriceps/.test(muscleOf(e.id)), `${s.title} ${e.id}`).toBe(false);
    const req = b.sessions.filter((s) => s.phase === 2 && !s.optional);
    const sets = (re: RegExp) => req.reduce((a, s) => a + s.exercises.filter((e) => re.test(muscleOf(e.id))).reduce((x, e) => x + e.sets, 0), 0);
    expect(sets(/bíceps/)).toBeGreaterThanOrEqual(12);
    expect(sets(/tríceps/)).toBeGreaterThanOrEqual(12);
  });
  it("Abdomen marcado: core en todas las sesiones y déficit para bajar grasa", () => {
    const a = PROGRAM_SEED_2.find((p) => p.slug === "abdomen-marcado")!;
    for (const s of a.sessions) expect(s.exercises.some((e) => /core|abdom|oblicuo/.test(muscleOf(e.id))), s.title).toBe(true);
    expect(a.meta.nutrition?.mode).toBe("acelerada");
  });
  it("cada programa tiene su propia nutrición", () => {
    for (const p of all.filter((x) => x.slug !== "dominadas-desde-cero" && x.slug !== "abdomen-21")) expect(p.meta.nutrition, p.slug).toBeTruthy();
  });
  it("la experiencia viaja al catálogo de respaldo", () => {
    const by = Object.fromEntries(SEED_CHALLENGES.map((c) => [c.id, c]));
    for (const slug of Object.keys(EXPERIENCES)) expect(by[slug]?.program?.experience?.mode, slug).toBe(RESTYLE[slug]?.mode?.[1] ?? EXPERIENCES[slug].mode);
    expect(by["banana-girl"].cover).toBe("fresa");
  });
});

describe("hábitos del programa", () => {
  const x: ProgramExperience = {
    mode: "Modo prueba", welcome: "", tips: ["uno", "dos"], coachFocus: "", restDay: "Camina 20 minutos", food: [],
    habits: [{ key: "entreno", label: "Sesión", kind: "entreno" }, { key: "pasos", label: "Pasos", kind: "pasos", target: 8000 }, { key: "proteina", label: "Proteína", kind: "proteina" }, { key: "yo", label: "Para ti", kind: "check" }],
  };
  const log = { steps: 4000, water: 3, sleep: 6, protein: 90 };
  it("automáticos con lo que ya registra; manuales con sus marcas", () => {
    const h = habitsToday(x, log, { checks: ["yo"], proteinTarget: 120, trainedToday: false, sessionDay: true });
    expect(h.map((v) => [v.key, v.done, v.auto])).toEqual([["entreno", false, true], ["pasos", false, true], ["proteina", false, true], ["yo", true, false]]);
    expect(h[1].pct).toBe(0.5);
    expect(h[1].detail).toBe(`${(4000).toLocaleString("es-419")} de ${(8000).toLocaleString("es-419")} pasos`);
  });
  it("sin nutrición, la proteína se marca a mano; en día de descanso el entreno es el descanso activo", () => {
    const h = habitsToday(x, log, { checks: ["proteina", "entreno"], proteinTarget: null, trainedToday: false, sessionDay: false });
    expect(h[0]).toMatchObject({ label: "Camina 20 minutos", auto: false, done: true });
    expect(h[2]).toMatchObject({ auto: false, done: true });
  });
  it("entrenar hoy cumple el hábito de entreno", () => {
    expect(habitsToday(x, log, { checks: [], proteinTarget: null, trainedToday: true, sessionDay: false })[0].done).toBe(true);
  });
  it("consejo por semana; el último se repite", () => {
    expect([tipFor(x, 1), tipFor(x, 2), tipFor(x, 9), tipFor(null, 1)]).toEqual(["uno", "dos", "dos", null]);
  });
  it("saneado: claves inválidas, repetidas, tipos raros y metas fuera de rango", () => {
    const p = parseExperience({ mode: "Modo", habits: [{ key: "A B", label: "x", kind: "check" }, { key: "ok", label: "Bien", kind: "pasos", target: 999999 }, { key: "ok", label: "Otra", kind: "check" }, { key: "z", label: "Z", kind: "magia" }], tips: ["", "t"], food: "no" });
    expect(p?.habits).toEqual([{ key: "ok", label: "Bien", kind: "pasos", target: 30000 }]);
    expect(p?.tips).toEqual(["t"]);
    expect(p?.food).toEqual([]);
    expect(parseExperience({ mode: "" })).toBeNull();
  });
});

// ───────────── 0037: Pilates en casa 30 días con Coach Platanita ─────────────
import { PROGRAM_SEED_3, program0037Sql } from "./program-seed";
import { COACHES, coachArt, coachOf } from "./coaches";
import { daysOf, durationLabel } from "./programs";

const sql37 = readFileSync(new URL("../../supabase/migrations/0037_pilates_platanita.sql", import.meta.url), "utf8");

describe("0037: Pilates en casa 30 días", () => {
  const p = PROGRAM_SEED_3[0];
  it("la siembra de 0037 es la de program-seed.ts (regenerar con scripts/gen-programas-seed.ts --0037)", () => {
    expect(sql37).toContain(program0037Sql().trim());
    expect(sql37).toContain("'lila'");
  });
  it("dura 30 días exactos: 4 semanas de 5 sesiones y un cierre en los días 29 y 30", () => {
    expect(weeksOf(p.meta)).toBe(5);
    expect(daysOf(p.meta)).toBe(30);
    expect(durationLabel(p.meta)).toBe("30 días");
    for (const ph of [1, 2, 3, 4]) expect(p.sessions.filter((s) => s.phase === ph).length).toBe(5);
    expect(p.sessions.filter((s) => s.phase === 5).length).toBe(1);
    expect(sql37).toContain("'pilates-casa-30', 'Pilates en casa 30 días'");
    expect(sql37).toMatch(/'pilates-casa-30', 'Pilates en casa 30 días', '[^']+', 30,/);
  });
  it("calendario: el día 29 toca la prueba final y el día 31 ya terminó", () => {
    const def = { meta: p.meta, sessions: p.sessions };
    const st = { status: "activo" as const, startedOn: "2026-11-01", pausedOn: null, pausedDays: 0 };
    const d29 = resolveProgram(def, st, [], "2026-11-29");
    expect(d29.week).toBe(5);
    expect(d29.today).toBe("entreno");
    expect(d29.next?.session.title).toMatch(/Prueba final/);
    expect(d29.byDays).toBe(true);
    expect(resolveProgram(def, st, [], "2026-11-30").today).not.toBe("terminado");
    expect(resolveProgram(def, st, [], "2026-12-01").today).toBe("terminado");
    expect(calendarSlot(def, st, "2026-11-01", "2026-12-01")).toBeNull();
  });
  it("solo con tapete, mini banda y toalla: sin pesas ni máquinas", () => {
    for (const s of p.sessions) for (const e of s.exercises) {
      const eq = e.id.startsWith("ds:") ? exInfo(e.id)?.eq ?? "?" : ["glutebridge", "bicycle", "ytw", "plank"].includes(e.id) ? "body weight" : "?";
      expect(["body weight", "band", "resistance band"].includes(eq), `${s.title} ${e.id} ${eq}`).toBe(true);
    }
  });
  it("Coach Platanita acompaña el programa y aparece en cada ejercicio", () => {
    expect(p.meta.experience?.coach).toBe("platanita");
    const c = coachOf(p.meta.experience);
    expect(c.name).toBe("Coach Platanita");
    for (const s of p.sessions) for (const e of s.exercises) expect(coachArt(c, e.id), `${s.title} ${e.id}`).toBeTruthy();
    expect(PROGRAM_SEED_BY_SLUG["banana-girl"].meta.experience?.coach).toBe("platanita");
    expect(sql37).toContain(`jsonb_set(program, '{experience,coach}', '"platanita"'::jsonb) where slug = 'banana-girl'`);
    expect(coachOf(null)).toBe(COACHES.banana);
  });
  it("days fuera de rango se ignora", () => {
    const m = { ...p.meta, days: 40 };
    expect(daysOf(m)).toBe(35);
    expect(parseMeta(JSON.parse(JSON.stringify(m)))?.days).toBeUndefined();
  });
});

import { orderProgramsFor } from "./programs";
describe("orderProgramsFor: tienda según quién mira", () => {
  const P = (id: string, coach?: "platanita") => ({ id, program: { experience: coach ? { coach } : {} } as unknown as ProgramMeta });
  const list = [P("reconstruccion"), P("pilates", "platanita"), P("banana-girl", "platanita"), P("abdomen")];
  it("a un hombre, los programas de Coach Platanita van al final, en el mismo orden", () => {
    expect(orderProgramsFor(list, "m").map((c) => c.id)).toEqual(["reconstruccion", "abdomen", "pilates", "banana-girl"]);
  });
  it("no mueve lo que ya es suyo; para una mujer, los programas de chicas van primero", () => {
    expect(orderProgramsFor(list, "m", new Set(["pilates"])).map((c) => c.id)).toEqual(["reconstruccion", "pilates", "abdomen", "banana-girl"]);
    expect(orderProgramsFor(list, "f").map((c) => c.id)).toEqual(["pilates", "banana-girl", "reconstruccion", "abdomen"]);
    expect(orderProgramsFor(list, null)).toBe(list);
  });
});
