import { describe, expect, it } from "vitest";
import { DEFAULT_VOICE, VOICES, dayTag, lastTimeLine, readinessEffects, sessionBenefit, coachRule, effortHints, isVoice, modeNote, muscleText, parseVoice, readinessTips, rirText, rxBadge, rxNote, sessionLine, setsReps, strengthCue, t, tempoText, voiceForLevel, whyItMatters, type Voice } from "./voice";
import { DEFAULT_WEEK, TPL, hookLine, planDay, prescribe, type TemplateId } from "./engine";

const ALL: Voice[] = ["basico", "intermedio", "tecnico"];
const JARGON = /\bRIR\b|\btempo\b|e1RM|doble progresión|\bLISS\b|\bRPE\b/i;
const HOUSE = /[·—]|banano|[\u{1F300}-\u{1FAFF}☀-➿]/u;
/** Todos los números de un texto, en orden ("2,5" cuenta como uno). */
const nums = (s: string) => s.match(/\d+(?:[.,]\d+)?/g) ?? [];

describe("registro (voice)", () => {
  it("elige el texto del registro y cae al intermedio", () => {
    expect(t("basico", { basico: "a", intermedio: "b", tecnico: "c" })).toBe("a");
    expect(t("tecnico", { basico: "a", intermedio: "b", tecnico: "c" })).toBe("c");
    expect(parseVoice("raro")).toBe(DEFAULT_VOICE);
    expect(parseVoice(null)).toBe("intermedio");
    expect(parseVoice("basico")).toBe("basico");
    expect(isVoice("tecnico")).toBe(true);
    expect(isVoice("experto")).toBe(false);
    expect(VOICES.map((v) => v.id)).toEqual(ALL);
  });
  it("sugiere el registro según la experiencia", () => {
    expect(voiceForLevel("principiante")).toBe("basico");
    expect(voiceForLevel("intermedio")).toBe("intermedio");
    expect(voiceForLevel("avanzado")).toBe("tecnico");
  });
  it("básico nunca usa jerga; técnico sí la usa", () => {
    const basico = [rirText("basico", 2), rirText("basico", 1, 2), rirText("basico", 0), tempoText("basico", "3-1-1"), strengthCue("basico", { rest: 90 }), sessionLine("basico", { exercises: 4, mins: 52, cardio: true }), whyItMatters("basico"), ...readinessTips("basico"), modeNote("basico", "suave"), modeNote("basico", "fuerte"), ...Object.values(effortHints("basico"))];
    for (const s of basico) expect(s).not.toMatch(JARGON);
    expect(rirText("tecnico", 2)).toBe("RIR 2");
    expect(tempoText("tecnico", "3-1-1")).toBe("tempo 3-1-1");
    expect(rirText("basico", 2)).toBe("detente cuando aún puedas hacer 2 más");
    expect(tempoText("basico", "3-1-1")).toBe("baja lento contando 3, aguanta 1 y sube con fuerza");
    expect(rirText("intermedio", 2)).toBe("RIR 2: te quedan 2 reps en reserva");
    expect(coachRule("basico")).toContain("palabras simples");
  });
  it("las series y reps tienen los mismos números en los tres registros", () => {
    for (const v of ALL) expect(nums(setsReps(v, 4, 6, 10))).toEqual(["4", "6", "10"]);
    expect(setsReps("basico", 4, 6, 10)).toBe("4 series de 6 a 10");
    expect(setsReps("tecnico", 3, 30, 60, "s")).toBe("3×30-60 s");
  });
  it("la indicación del motor conserva peso, reps y descanso en cada registro", () => {
    const cfg = TPL.pushA.ex[1]; // banca 4×6-10
    const cases = [
      prescribe("bench", cfg, []), // calibración
      prescribe("bench", cfg, [[{ kg: 60, reps: 10 }, { kg: 60, reps: 10 }, { kg: 60, reps: 10 }, { kg: 60, reps: 10 }]]), // sube carga
      prescribe("bench", cfg, [[{ kg: 60, reps: 7 }, { kg: 60, reps: 7 }, { kg: 60, reps: 6 }, { kg: 60, reps: 6 }]]), // +1 rep
      prescribe("bench", cfg, [[{ kg: 60, reps: 4 }, { kg: 60, reps: 4 }], [{ kg: 60, reps: 4 }, { kg: 60, reps: 5 }]]), // reinicio
      prescribe("bench", cfg, [[{ kg: 60, reps: 8 }]], { deload: true }),
      prescribe("pushup", { sets: 3, lo: 10, hi: 20, rest: 60 }, [[{ kg: null, reps: 20 }, { kg: null, reps: 20 }, { kg: null, reps: 20 }]]),
    ];
    for (const rx of cases) {
      const notes = ALL.map((v) => rxNote(v, rx, cfg, { weighted: rx.kg != null || rx.type === "cal" }));
      for (const n of notes) { expect(n.length).toBeGreaterThan(10); expect(n).not.toMatch(HOUSE); }
      expect(notes[0]).not.toMatch(JARGON); // básico
      // El peso que pide el motor aparece igual en los tres.
      if (rx.kg != null && rx.type !== "reps" && rx.type !== "hold" && rx.type !== "deload") for (const n of notes) expect(n).toContain(rx.kg.toLocaleString("es-419"));
    }
    const up = cases[1];
    expect(up.type).toBe("up");
    expect(rxNote("basico", up, cfg, { weighted: true })).toBe(`La vez pasada llegaste a 10 repeticiones: hoy sube a ${(62.5).toLocaleString("es-419")} kg y vuelve a 6. Así se gana fuerza.`);
    expect(rxNote("tecnico", up, cfg, { weighted: true })).toContain("doble progresión");
    expect(rxBadge("basico", "deload")).toBe("Semana suave");
    expect(rxBadge("tecnico", "up")).toBe("Progresión de carga");
  });
  it("intervalos exprés: mismos segundos en los tres registros", () => {
    const cfg = { sets: 3, lo: 30, hi: 40, rest: 20, unit: "s" as const };
    const rx = prescribe("burpee", cfg, []);
    for (const v of ALL) expect(nums(rxNote(v, rx, cfg, { weighted: false })).slice(0, 2)).toEqual(["40", "20"]);
  });
  it("sin raya larga, punto medio, emojis ni 'banano' en ningún texto", () => {
    for (const v of ALL) {
      const all = [whyItMatters(v), ...readinessTips(v), sessionLine(v, { exercises: 4, mins: 50 }), strengthCue(v, { rest: 120 }), strengthCue(v, { unit: "s", rest: 45 }), coachRule(v), ...VOICES.flatMap((x) => [x.label, x.d, x.sample])];
      for (const s of all) expect(s).not.toMatch(HOUSE);
    }
  });
});

describe("nombres y ganchos de los entrenos", () => {
  const CRYPTIC = /\b(empuje|tracción|tirón)\b|\s[ABC]$|\+/i;
  const BODY = /piernas|pecho|hombros|espalda|bíceps|brazos|glúteos|abdomen/i;
  it("cada plantilla tiene un nombre claro y atractivo, y un gancho", () => {
    for (const [id, tpl] of Object.entries(TPL)) {
      expect(tpl.n, id).not.toMatch(CRYPTIC);
      expect(tpl.n, id).toMatch(BODY); // dice qué se entrena
      expect(tpl.n.length, id).toBeLessThanOrEqual(40);
      expect(tpl.hook, id).toMatch(/^Hoy /);
      expect(tpl.hook.length, id).toBeLessThanOrEqual(90);
      expect(tpl.hook, id).not.toMatch(/[.:]$/); // hookLine agrega los minutos
      expect(tpl.n + tpl.hook, id).not.toMatch(HOUSE);
    }
    expect(new Set(Object.values(TPL).map((x) => x.n)).size).toBe(Object.keys(TPL).length);
  });
  it("los ids no cambian (así se guardan en workouts.template)", () => {
    expect(Object.keys(TPL).sort()).toEqual(["core", "pullA", "pullB", "pump", "pushA", "pushB"]);
    expect(Object.values(DEFAULT_WEEK).filter(Boolean).sort()).toEqual(["core", "pullA", "pullB", "pump", "pushA", "pushB"] as TemplateId[]);
  });
  it("el día planeado lleva su gancho con minutos", () => {
    const d = planDay(1, 0);
    expect(d.tpl).toBe("pushA");
    expect(d.hook).toBe(TPL.pushA.hook);
    expect(hookLine(d.hook, 52)).toBe("Hoy construyes la fuerza base de piernas, pecho y hombros: 52 minutos.");
    expect(hookLine(undefined, 52)).toBeNull();
    expect(planDay(0, 0).hook).toMatch(/^Hoy /); // descanso activo
  });
});

describe("Hoy: el entreno explicado", () => {
  it("cada plantilla dice qué hace por ti, sin repetir el gancho y sin jerga en básico", () => {
    for (const [id, tpl] of Object.entries(TPL)) for (const v of ALL) {
      const b = sessionBenefit(v, id)!;
      expect(b, `${id} ${v}`).toBeTruthy();
      expect(b).not.toMatch(HOUSE);
      expect(b.startsWith(tpl.hook.slice(0, 20))).toBe(false);
      if (v === "basico") expect(b).not.toMatch(JARGON);
    }
    expect(sessionBenefit("basico", null)).toBeNull();
    expect(dayTag("basico", "Volumen")).toBe("día para dar forma");
    expect(dayTag("tecnico", "Volumen")).toBe("día de volumen");
    for (const e of readinessEffects("basico")) expect(e).not.toMatch(JARGON);
  });
  it("la última vez: mismos números en los tres registros", () => {
    for (const v of ALL) {
      const s = lastTimeLine(v, { name: "Peso muerto rumano", lastKg: 70, lastReps: 10, kg: 72.5, reps: 8, type: "up" });
      expect(s).toContain("70 kg × 10");
      expect(s).toContain(`${(72.5).toLocaleString("es-419")} kg`);
    }
  });
});


describe("muscleText: músculos según el registro", () => {
  it("en básico, partes del cuerpo que cualquiera reconoce", () => {
    expect(muscleText("basico", "Isquiotibiales")).toBe("Parte de atrás del muslo");
    expect(muscleText("basico", "brazos, hombros y core")).toBe("brazos, hombros y abdomen y zona media");
    expect(muscleText("basico", "Deltoides posterior")).toBe("Parte de atrás del hombro");
    expect(muscleText("basico", "glúteos")).toBe("glúteos");
  });
  it("intermedio y técnico no cambian", () => {
    expect(muscleText("intermedio", "Isquiotibiales")).toBe("Isquiotibiales");
    expect(muscleText("tecnico", "core")).toBe("core");
  });
});
