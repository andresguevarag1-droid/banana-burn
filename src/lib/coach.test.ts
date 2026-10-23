import { describe, expect, it } from "vitest";
import { COACH_STYLE_RULE, coachSystem, demoReply, safetyCheck, stripEmoji, todayLine } from "./coach";
import type { Athlete } from "./athlete";
import { ruleFeedback } from "./feedback";

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}]/u;

describe("stripEmoji", () => {
  it("quita emojis, banderas, tonos de piel y secuencias ZWJ", () => {
    expect(stripEmoji("¡Pura vida! 🍌 Hoy toca pierna 💪🏽.")).toBe("¡Pura vida! Hoy toca pierna.");
    expect(stripEmoji("Hecho en Costa Rica 🇨🇷")).toBe("Hecho en Costa Rica ");
    expect(stripEmoji("Equipo 👨‍👩‍👧 listo")).toBe("Equipo listo");
    expect(stripEmoji("⚠️ Para ahora")).toBe(" Para ahora");
    expect(stripEmoji("Racha 🔥")).not.toMatch(EMOJI);
  });
  it("no toca texto normal, markdown ni saltos de línea", () => {
    const md = "**Sentadilla** 4×6-8\n  - Baja en 3 s\n- 1,6 g/kg de proteína";
    expect(stripEmoji(md)).toBe(md);
    expect(stripEmoji("")).toBe("");
    expect(stripEmoji(" ")).toBe(" ");
  });
  it("funciona trozo por trozo, como llega el stream", () => {
    const chunks = ["Completaste ", "todo 💪", " Así ", "se hace 🔥\n", "- Proteína"];
    expect(chunks.map(stripEmoji).join("")).not.toMatch(EMOJI);
  });
});

describe("copy del coach sin emojis", () => {
  it("la regla de estilo prohíbe emojis y raya larga", () => {
    expect(COACH_STYLE_RULE).toContain("No uses emojis");
    expect(COACH_STYLE_RULE).toContain("**negritas**");
  });
  it("respuestas demo, de seguridad y feedback por reglas", () => {
    for (const q of ["quiero cambiar un ejercicio", "qué ceno", "me duele la rodilla", "estoy estancado", "hola", "me duele el pecho", "no quiero vivir", "dolor abdominal fuerte"]) {
      expect(demoReply(q, "Andrés")).not.toMatch(EMOJI);
      expect(demoReply(q, "Andrés")).not.toContain("—");
    }
    expect(safetyCheck("hola")).toBeNull();
    const fb = ruleFeedback({ prs: ["Banca"], done: 12, total: 12, fun: 1, easy: 3, streak: 5 });
    expect(fb).not.toMatch(EMOJI);
    expect(fb).not.toContain("⇄");
  });
});

describe("coach según el plan", () => {
  const a = { name: "Ana", dob: "1995-01-01", heightCm: 165, startWeight: 80, currentWeight: 78, goalWeight: 68, goalDate: "2027-03-01", startDate: "2026-10-01", mode: "acelerada", complete: true, trainDays: 4, sex: "f", equipment: "gym", level: "intermedio", minutes: null, glp1: { on: true, med: "semaglutida", injectionDow: 1, since: "2026-09-01" } } as unknown as Athlete;
  const data = (sys: string) => JSON.parse(sys.slice(sys.lastIndexOf("<datos_atleta>") + 14, sys.lastIndexOf("</datos_atleta>")).replace(/\\u003c/g, "<"));

  it("Entreno + Nutrición: recibe calorías, macros y Banana Shield", () => {
    const sys = coachSystem(a, [], [], { nutrition: true });
    const d = data(sys);
    expect(d.plan).toBe("Entreno + Nutrición");
    expect(d.objetivos_diarios.kcal).toBeGreaterThan(0);
    expect(d.objetivos_diarios.protein).toBeGreaterThan(0);
    expect(d.glp1).not.toBeNull();
    expect(sys).toContain("1,6-2,2 g/kg");
    expect(sys).not.toContain("Plan del atleta: Entreno (sin nutrición)");
  });

  it("Entreno: sin metas de calorías ni macros ni GLP-1, y con la regla de principios generales", () => {
    const sys = coachSystem(a, [], [], { nutrition: false });
    const d = data(sys);
    expect(d.plan).toBe("Entreno");
    expect(d.objetivos_diarios).toEqual({ pasos: expect.any(Number), sueno_h: expect.any(Number) });
    expect(JSON.stringify(d)).not.toMatch(/kcal|protein|carbs|fat|proteina_meta/);
    expect(d.glp1).toBeNull();
    expect(sys).toContain("Plan del atleta: Entreno (sin nutrición)");
    expect(sys).toContain("parte de Entreno + Nutrición");
    expect(sys).not.toContain("1,6-2,2 g/kg");
  });
});

describe("todayLine: saludo del coach sobre el entreno de hoy", () => {
  const today = { name: "Cuerpo completo B", exercises: 6, training: true };
  it("no dice 'ayer fue X' si ayer tocaba la misma sesión", () => {
    expect(todayLine({ today, yesterday: { name: "Cuerpo completo B", training: true }, trainedToday: false })).toBe("Hoy te toca **Cuerpo completo B** (6 ejercicios).");
  });
  it("menciona ayer cuando fue otra sesión o descanso, sin género", () => {
    expect(todayLine({ today, yesterday: { name: "Pierna", training: true }, trainedToday: false })).toContain("Ayer fue Pierna: hoy trabajas otros músculos.");
    const r = todayLine({ today, yesterday: { name: "Descanso", training: false }, trainedToday: false });
    expect(r).toContain("Ayer descansaste");
    expect(r).not.toMatch(/fresco|fresca|listo|lista/);
  });
  it("ya entrenó y día de descanso", () => {
    expect(todayLine({ today, yesterday: { name: "x", training: true }, trainedToday: true })).toBe("Ya hiciste **Cuerpo completo B** hoy. Buen trabajo.");
    expect(todayLine({ today: { ...today, training: false }, yesterday: { name: "x", training: true }, trainedToday: false })).toContain("descanso activo");
  });
});
