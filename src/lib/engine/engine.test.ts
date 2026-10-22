import { describe, expect, it } from "vitest";
import { ageOn, e1rm, planWeek, prescribe, targets, weeklyTrend, kcalAdjustment, isDeloadWeek, TPL } from ".";

describe("nutrición", () => {
  it("calcula objetivos de Andrés (94 kg, 182 cm, 27 años)", () => {
    const t = targets({ kg: 94, heightCm: 182, age: 27, mode: "acelerada" });
    expect(t.bmr).toBe(Math.round(10 * 94 + 6.25 * 182 - 5 * 27 + 5));
    expect(t.protein).toBe(190);
    expect(t.fat).toBe(70);
    expect(t.kcal % 50).toBe(0);
    expect(t.kcal).toBeLessThan(t.tdee);
  });
  it("edad correcta antes y después del cumpleaños", () => {
    expect(ageOn("1999-01-27", new Date("2026-01-26T12:00:00"))).toBe(26);
    expect(ageOn("1999-01-27", new Date("2026-10-21T12:00:00"))).toBe(27);
  });
});

describe("progresión", () => {
  const cfg = TPL.pushA.ex[1]; // banca 4×6–10
  it("calibra sin historial", () => expect(prescribe("bench", cfg, []).type).toBe("cal"));
  it("sube carga al tope del rango", () => {
    const p = prescribe("bench", cfg, [[{ kg: 80, reps: 10 }, { kg: 80, reps: 10 }, { kg: 80, reps: 10 }, { kg: 80, reps: 10 }]]);
    expect(p).toMatchObject({ type: "up", kg: 82.5 });
  });
  it("suma reps dentro del rango", () => {
    const p = prescribe("bench", cfg, [[{ kg: 80, reps: 7 }, { kg: 80, reps: 7 }, { kg: 80, reps: 6 }, { kg: 80, reps: 6 }]]);
    expect(p.type).toBe("reps");
    expect(p.reps).toEqual([8, 8, 7, 7]);
  });
  it("reinicia −10 % tras dos sesiones flojas", () => {
    const bad = [{ kg: 80, reps: 4 }, { kg: 80, reps: 4 }, { kg: 80, reps: 5 }, { kg: 80, reps: 6 }];
    expect(prescribe("bench", cfg, [bad, bad])).toMatchObject({ type: "reset", kg: 72.5 });
  });
  it("e1RM Epley", () => expect(e1rm(100, 5)).toBe(116.7));
  it("descarga cada 6ª semana", () => { expect(isDeloadWeek(5)).toBe(true); expect(isDeloadWeek(4)).toBe(false); });
});

describe("plan semanal anti-aburrimiento", () => {
  it("ningún día repite la rutina del día anterior ni del siguiente", () => {
    for (let w = 0; w < 6; w++) {
      const days = planWeek(w);
      days.forEach((d, i) => {
        const next = days[(i + 1) % days.length];
        if (d.tpl && next.tpl) expect(d.tpl).not.toBe(next.tpl);
      });
    }
  });
  it("los accesorios rotan semana a semana", () => {
    const a = planWeek(0).find((d) => d.tpl === "core")!.exercises.map((e) => e.id);
    const b = planWeek(1).find((d) => d.tpl === "core")!.exercises.map((e) => e.id);
    expect(a).not.toEqual(b);
  });
});

describe("tendencia de peso", () => {
  it("detecta −0.7 kg/sem y no ajusta", () => {
    const ws = [0, 2, 4, 7, 9, 11, 14].map((d) => ({ d: `2026-10-${String(d + 1).padStart(2, "0")}`, kg: 94 - d * 0.1 }));
    const r = weeklyTrend(ws)!;
    expect(r).toBeCloseTo(-0.7, 1);
    expect(kcalAdjustment(r, 0.8)).toBe(0);
    expect(kcalAdjustment(r, 0.95)).toBe(-75);
  });
  it("pide recorte si no baja", () => expect(kcalAdjustment(0, 0.8)).toBe(-150));
  it("null con pocos datos", () => expect(weeklyTrend([{ d: "2026-10-01", kg: 94 }])).toBeNull());
});

import { scheduleFor } from ".";
describe("horario por días disponibles", () => {
  it.each([3, 4, 5, 6])("%i días: cuenta correcta y sin repetir seguidos", (n) => {
    const s = scheduleFor(n);
    expect(Object.values(s).filter(Boolean).length).toBe(n);
    const w = planWeek(0, s);
    w.forEach((d, i) => { const nx = w[(i + 1) % 7]; if (d.tpl && nx.tpl) expect(d.tpl).not.toBe(nx.tpl); });
  });
});

import { platesPerSide, ALTS, EX } from ".";
describe("discos y alternativas", () => {
  it("100 kg = 25+15 por lado", () => expect(platesPerSide(100)).toEqual([25, 15]));
  it("82,5 kg = 25+5+1,25", () => expect(platesPerSide(82.5)).toEqual([25, 5, 1.25]));
  it("menos que la barra = null", () => expect(platesPerSide(15)).toBeNull());
  it("todas las alternativas existen", () => Object.values(ALTS).flat().forEach((id) => expect(EX[id]).toBeDefined()));
});

import { planDay as pd, HOME, BARBELL } from ".";
describe("entreno en casa", () => {
  it("ningún ejercicio de barra ni barra fija en casa", () => {
    for (let w = 0; w < 3; w++) for (const d of [1, 2, 3, 4, 5, 6]) {
      pd(d, w, undefined, "casa").exercises.forEach((e) => {
        expect(BARBELL.has(e.id)).toBe(false);
        expect(["pullup", "chinup", "kneeraise", "legraise", "twistraise", "dips", "lat"]).not.toContain(e.id);
      });
    }
  });
  it("todos los reemplazos existen", () => Object.values(HOME).forEach((id) => expect(EX[id!]).toBeDefined()));
});

import { expressDay, estimateMinutes, personalize, NOEQUIP } from ".";
describe("personalización", () => {
  it("sin equipo: todo es peso corporal", () => {
    for (const d of [1, 2, 3, 4, 5, 6]) pd(d, 0, undefined, { equipment: "ninguno" }).exercises.forEach((e) => expect(EX[e.id].inc, e.id).toBe(0));
    Object.values(NOEQUIP).forEach((id) => expect(EX[id!]).toBeDefined());
  });
  it("respeta el tiempo disponible", () => {
    for (const min of [30, 45]) for (const d of [1, 2, 4, 5]) expect(estimateMinutes(pd(d, 0, undefined, { minutes: min }).exercises)).toBeLessThanOrEqual(min + 3);
  });
  it("principiante: menos series y más reps", () => {
    const base = pd(1, 0).exercises, beg = pd(1, 0, undefined, { level: "principiante" }).exercises;
    expect(beg.reduce((a, e) => a + e.cfg.sets, 0)).toBeLessThan(base.reduce((a, e) => a + e.cfg.sets, 0));
    expect(personalize(base, "avanzado")[0].cfg.sets).toBe(base[0].cfg.sets + 1);
  });
  it.each([10, 20, 30])("exprés de %i min cabe en el tiempo", (m) => {
    const x = expressDay(m);
    const secs = x.exercises.reduce((a, e) => a + e.cfg.sets * (e.cfg.hi + e.cfg.rest), 0);
    expect(secs / 60).toBeLessThanOrEqual(m);
    expect(secs / 60).toBeGreaterThanOrEqual(m * 0.6);
    x.exercises.forEach((e) => expect(EX[e.id].inc).toBe(0));
  });
});
