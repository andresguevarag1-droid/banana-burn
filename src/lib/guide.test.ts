import { describe, expect, it } from "vitest";
import { GUIDE_VERSION, afterTrialLines, demoGuideInput, guideSteps, guideVariant, isTipKey, listEs, shouldAutoOpen, type GuideInput, type GuideStep } from "./guide";
import { PLANS } from "./plans";
import { money } from "./copy";

const D = { lastFree: "31 de octubre", firstPaid: "1 de noviembre", day: (iso: string) => `día ${iso.slice(0, 10)}` };
const base: GuideInput = { name: "Andrés Guevara", plan: "entreno", nutrition: false, trial: null, charge: null, cardStep: "none", program: null };
const entreno = base;
const completo: GuideInput = { ...base, plan: "completo", nutrition: true };
const beta: GuideInput = { ...base, plan: "free", nutrition: true, trial: { beta: true, endsAt: "2026-11-01T06:00:00.000Z", daysLeft: 9 }, cardStep: "beta" };
const prueba: GuideInput = { ...base, plan: "free", nutrition: true, trial: { beta: false, endsAt: "2026-11-20T12:00:00.000Z", daysLeft: 5 },
  charge: { kind: "prueba", phase: "programado", plan: "completo", amount: 14.99, chargeAt: "2026-11-20T12:00:00.000Z" } };
const program = { slug: "gluteos-de-acero", title: "Glúteos de acero", mode: "Modo glúteo", welcome: "Bienvenida al modo glúteo.", habits: ["Activación de glúteo", "8.000 pasos"], hasTips: true, week: 2, weeks: 8, cover: "fresa", icon: "banana" };
const ids = (s: GuideStep[]) => s.map((x) => x.id);
const text = (s: GuideStep[]) => s.map((x) => [x.chapter, x.title, x.body, ...x.bullets, x.note ?? "", x.cta?.label ?? ""].join("\n")).join("\n");

describe("variante de la guía", () => {
  it("elige la variante por plan y prueba", () => {
    expect(guideVariant(entreno)).toBe("entreno");
    expect(guideVariant(completo)).toBe("completo");
    expect(guideVariant(beta)).toBe("prueba");
    expect(guideVariant(prueba)).toBe("prueba");
    // Con plan pagado durante la beta, cuenta el plan (no la prueba).
    expect(guideVariant({ ...completo, trial: beta.trial })).toBe("completo");
  });
});

describe("capítulos por plan", () => {
  it("Entreno: sin recetas, con un solo paso honesto de nutrición y su precio", () => {
    const s = guideSteps(entreno, D);
    expect(ids(s)).toEqual(["inicio", "hoy", "plan", "reproductor", "progresion", "tecnica", "retos", "nutricion", "coach", "comunidad", "progreso", "final"]);
    const n = s.find((x) => x.id === "nutricion")!;
    const full = PLANS.find((p) => p.id === "completo")!;
    expect(n.title).toContain(full.name);
    expect(n.body).toContain("no incluye nutrición");
    expect(n.note).toContain(money(full.price.mes));
    expect(n.note).toContain(money(full.price.anual));
    expect(n.cta?.href).toBe("/app/suscripcion");
    // Fuera del paso de mejora, Entreno nunca promete comida, macros ni Banana Shield.
    // La captura de Hoy (con calorías) no se usa en Entreno.
    expect(s.find((x) => x.id === "hoy")!.visual.kind).toBe("hoy");
    const rest = text(s.filter((x) => x.id !== "nutricion"));
    expect(rest).not.toMatch(/Banana Shield|macros|calorías|Menú flash|recetas/i);
  });

  it("Entreno + Nutrición: nutrición completa con recetas, Menú flash y Banana Shield", () => {
    const s = guideSteps(completo, D);
    expect(ids(s)).toEqual(["inicio", "hoy", "plan", "reproductor", "progresion", "tecnica", "retos", "nutricion", "recetas", "coach", "comunidad", "progreso", "final"]);
    expect(text(s)).toMatch(/Menú flash/);
    expect(text(s)).toMatch(/Banana Shield/);
    expect(s.find((x) => x.id === "nutricion")!.cta?.href).toBe("/app/nutricion");
    expect(s.find((x) => x.id === "hoy")!.visual.kind).toBe("captura");
    expect(s.find((x) => x.id === "final")!.body).toContain("Entreno + Nutrición");
  });

  it("prueba y beta: todo incluido y, al final, qué pasa después", () => {
    for (const i of [beta, prueba]) {
      const s = guideSteps(i, D);
      expect(ids(s)).toContain("recetas");
      const f = s.at(-1)!;
      expect(f.id).toBe("final");
      expect(f.chapter).toBe("Tu prueba");
      expect(f.cta?.href).toBe("/app/suscripcion");
      expect(s.find((x) => x.id === "nutricion")!.note).toContain("Después, solo en Entreno + Nutrición");
    }
  });

  it("programa activo: un capítulo más con su modo, sus hábitos y su enlace", () => {
    for (const i of [entreno, completo, beta]) {
      const s = guideSteps({ ...i, program }, D);
      const p = s.find((x) => x.id === "programa")!;
      expect(p).toBeTruthy();
      expect(ids(s).indexOf("programa")).toBe(ids(s).indexOf("tecnica") + 1);
      expect(p.chapter).toBe("Tu programa");
      expect(p.title).toContain("Glúteos de acero");
      expect(p.body).toBe(program.welcome);
      expect(p.bullets.join(" ")).toContain("activación de glúteo y 8.000 pasos");
      expect(p.cta?.href).toBe("/app/retos/gluteos-de-acero/progreso");
    }
    expect(ids(guideSteps(completo, D))).not.toContain("programa");
  });

  it("programa sin experiencia: textos genéricos", () => {
    const s = guideSteps({ ...completo, program: { ...program, mode: null, welcome: null, habits: [], hasTips: false } }, D);
    const p = s.find((x) => x.id === "programa")!;
    expect(p.body).toContain("Mientras dura tu programa");
    expect(p.bullets.join(" ")).not.toContain("hábitos");
  });

  it("cada paso salvo el primero tiene un Probar ahora con ruta de la app", () => {
    for (const i of [entreno, completo, beta, { ...prueba, program }]) {
      for (const st of guideSteps(i, D).slice(1)) expect(st.cta?.href).toMatch(/^\/app(\/|$|\?)/);
    }
  });
});

describe("reglas de los textos", () => {
  const all = [entreno, completo, beta, prueba, { ...completo, program }, { ...beta, charge: { kind: "beta" as const, phase: "programado" as const, plan: "entreno" as const, amount: 9.99, chargeAt: "2026-11-01T06:00:00.000Z" } }];
  it("sin IA, sin emojis, sin rayas largas, sin cadenas con punto medio y con banana", () => {
    for (const i of all) {
      const t = text(guideSteps(i, D));
      expect(t).not.toMatch(/\bIA\b|inteligencia artificial/i);
      expect(t).not.toMatch(/[—–]/);
      expect(t).not.toMatch(/·/);
      expect(t).not.toMatch(/banano/i);
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(t).toContain("Coach Banana");
    }
  });
  it("saluda con el primer nombre y funciona sin nombre", () => {
    expect(guideSteps(completo, D)[0].title).toMatch(/^Hola, Andrés\./);
    expect(guideSteps({ ...completo, name: "  " }, D)[0].title).toMatch(/^Hola\./);
  });
});

describe("después de la prueba", () => {
  it("beta sin tarjeta: fechas de la beta, sin días extra", () => {
    const a = afterTrialLines(beta, D);
    expect(a.body).toContain("31 de octubre");
    expect(a.body).toContain("1 de noviembre");
    expect(a.bullets.join(" ")).toContain("No hay días gratis extra");
  });
  it("beta con tarjeta: plan, monto y fecha del cobro", () => {
    const a = afterTrialLines({ ...beta, charge: { kind: "beta", phase: "programado", plan: "entreno", amount: 9.99, chargeAt: "2026-11-01T06:00:00.000Z" } }, D);
    expect(a.bullets[0]).toContain("Entreno por $9.99");
    expect(a.bullets[0]).toContain("día 2026-11-01");
  });
  it("prueba de 7 días con cobro programado o cancelado", () => {
    expect(afterTrialLines(prueba, D).bullets[0]).toContain("Entreno + Nutrición por $14.99");
    expect(afterTrialLines(prueba, D).body).toContain("7 días");
    expect(afterTrialLines({ ...prueba, charge: { ...prueba.charge!, phase: "cancelado" } }, D).bullets[0]).toContain("no se te cobrará");
  });
});

describe("cuándo se abre sola", () => {
  const at = { seenVersion: null, localVersion: null, locked: false, busy: false, path: "/app" };
  it("la primera vez en Hoy", () => expect(shouldAutoOpen(at)).toBe(true));
  it("no si ya vio esta versión (servidor o dispositivo)", () => {
    expect(shouldAutoOpen({ ...at, seenVersion: GUIDE_VERSION })).toBe(false);
    expect(shouldAutoOpen({ ...at, localVersion: GUIDE_VERSION })).toBe(false);
  });
  it("una versión nueva se vuelve a mostrar", () => expect(shouldAutoOpen({ ...at, seenVersion: GUIDE_VERSION - 1, localVersion: GUIDE_VERSION - 1 })).toBe(true));
  it("nunca encima del muro, de otra pantalla ni fuera de Hoy", () => {
    expect(shouldAutoOpen({ ...at, locked: true })).toBe(false);
    expect(shouldAutoOpen({ ...at, busy: true })).toBe(false);
    expect(shouldAutoOpen({ ...at, path: "/app/entreno" })).toBe(false);
  });
});

describe("utilidades", () => {
  it("lista en español", () => {
    expect(listEs(["a"])).toBe("a");
    expect(listEs(["a", "b", "c"])).toBe("a, b y c");
  });
  it("claves de consejos", () => {
    expect(isTipKey("entrenar")).toBe(true);
    expect(isTipKey("otro")).toBe(false);
  });
  it("variantes de demo", () => {
    expect(guideVariant(demoGuideInput({ ...completo, program }, "entreno")!)).toBe("entreno");
    expect(demoGuideInput({ ...completo, program }, "entreno")!.program).toBeNull();
    expect(guideVariant(demoGuideInput(completo, "prueba")!)).toBe("prueba");
    expect(demoGuideInput({ ...completo, program }, "programa")!.program).not.toBeNull();
    expect(demoGuideInput(completo, "otra")).toBeNull();
  });
});
