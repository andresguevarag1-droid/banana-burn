// Hoy en inglés (#299, #309): la pantalla /app renderizada en modo demo con locale en-US y libras, con la hora fija para
// que el snapshot no cambie. El primer día (?primera=1) y el Hoy completo sin programa (la rutina del motor), con el
// exprés, los retos, el anuncio, running y las comidas.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { EN } from "@/lib/i18n/en";
import { hasTranslation, translate } from "@/lib/i18n/t";
import { hasContentTranslation, translateContent } from "@/lib/i18n/content";
import { roundLb } from "@/lib/i18n/format";

const COOKIES: Record<string, string> = { bb_demo_programa: "no", bb_tz: "America/New_York" };
const prefs = vi.hoisted(() => ({ locale: "en-US", units: "imperial" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (k: string) => (k in COOKIES ? { name: k, value: COOKIES[k] } : undefined), getAll: () => [] }), headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("redirect"); }, usePathname: () => "/app", useRouter: () => ({ push() {}, refresh() {}, replace() {} }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/components/workout/workout.module.css", () => ({ default: {} }));
vi.mock("@/components/analytics", () => ({ FunnelTracker: () => null, track: () => {} }));
vi.mock("@/lib/i18n/server", () => ({ getPrefs: async () => prefs }));
vi.mock("@/app/actions/notifications", () => ({ getNotificationPrefs: async () => null, saveNotificationPrefs: async () => ({ ok: true }) }));

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-09T14:00:00Z"));
  await import("@/app/(app)/app/page"); // la primera importación de Hoy tarda más que los 5 s de cada prueba
}, 60_000);
afterAll(() => vi.useRealTimers());

async function hoy(sp: Record<string, string> = {}) {
  const { prerender } = await import("react-dom/static.edge");
  const { LocaleProvider } = await import("@/lib/i18n/client");
  const { default: Hoy } = await import("@/app/(app)/app/page");
  const el = await Hoy({ searchParams: Promise.resolve(sp) });
  const { prelude } = await prerender(<LocaleProvider locale={prefs.locale as "en-US"} units={prefs.units as "imperial"}>{el}</LocaleProvider>);
  const html = await new Response(prelude).text();
  return { html, text: html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim() };
}

describe("Hoy en inglés (#299)", () => {
  it("primer día: saludo, fecha, el primer entreno y sus botones en inglés", async () => {
    const { text } = await hoy({ primera: "1" });
    expect(text).toContain("Monday, November 9");
    expect(text).toContain("Good morning");
    expect(text).toContain("Your first workout");
    expect(text).toMatch(/Start my (first )?workout/);
    expect(text).not.toMatch(/Empezar|Tu primer entreno|Buenos días/);
    expect(text).toMatchSnapshot();
  });

  it("Hoy completo: meta semanal, tu semana, números y peso en lb", async () => {
    const { text } = await hoy();
    for (const s of ["This week:", "Daily streak:", "Your week", "Workouts", "Your numbers today", "Your challenges", "Did you weigh in yet?", "How does it work?", "205.3 lb Save", "lb lost", "lb to goal"]) expect(text).toContain(s);
    expect(text).not.toMatch(/kg perdidos|kg a la meta|Tu semana|Esta semana: \d+ de|Racha diaria|Tus números/);
    expect(text).not.toMatch(/\p{Extended_Pictographic}|\bAI\b|\bIA\b/u);
    expect(text).toMatchSnapshot();
  });

  it("exprés, retos, anuncio, running y comidas (#309)", async () => {
    const { text } = await hoy();
    for (const s of ["Running out of time?", "Express workout, 10 min", "New: train at home", "Switch to home mode", "Try it", "48 days to your race",
      "Rice and beans with scrambled eggs", "For your snack: Microwave egg mug", "Push-up King", "Day 11 of 30", "Today: 16 push-ups total today", "free passes", "See calendar"]) expect(text).toContain(s);
    expect(text).not.toMatch(/¿Te estás quedando|Nuevo: entrena|Faltan \d+ días|Arroz con frijoles|Huevos en taza|Rey de las flexiones|Día \d+ de|comodines|Ver calendario|Hecho/);
  });

  it("no queda ningún texto del diccionario en español en Hoy en inglés", async () => {
    // Las frases del diccionario que cambian al traducirse (con más de una palabra, para no confundir "No" o "Normal").
    const spanish = Object.entries(EN).filter(([es, en]) => es !== en && /\s/.test(es.trim()) && !/\{\w+\}/.test(es)).map(([es]) => es.replace(/[\u00a0\u202f]/g, " ").trim());
    for (const sp of [{}, { primera: "1" }, { primera: "2" }] as Record<string, string>[]) {
      const { text } = await hoy(sp);
      const flat = text.replace(/[\u00a0\u202f]/g, " ");
      expect(spanish.filter((es) => flat.includes(es))).toEqual([]);
    }
  });

  it("el coach pregunta al día siguiente del primer entreno (?primera=2), en inglés (#309)", async () => {
    const { html, text } = await hoy({ primera: "2" });
    expect(html).toContain('aria-label="Coach Banana asks you"');
    for (const s of ["How did your first workout go?", "Good", "It was hard", "I don't know how to use a machine"]) expect(text).toContain(s);
    expect(text).not.toMatch(/¿Cómo te fue|Me costó|No sé usar/);
  });

  it("en español la misma pantalla no cambia de idioma", async () => {
    prefs.locale = "es-419"; prefs.units = "metric";
    try {
      const { text } = await hoy();
      for (const s of ["Esta semana:", "Racha diaria:", "Tu semana", "Tus números de hoy", "kg perdidos", "kg a la meta",
        "¿Te estás quedando sin tiempo? Termina con estos exprés", "Cuenta para tu racha", "Nuevo: entrena en casa", "Probar", "Faltan 48 días para tu carrera",
        "Arroz con frijoles y huevos revueltos", "Rey de las flexiones", "Día 11 de 30", "Hoy: 16 flexiones en total hoy", "Ver calendario"]) expect(text).toContain(s);
      expect(text).not.toMatch(/Running out|Push-up King|Microwave egg|free passes/);
      expect(text).toContain("lunes, 9 de noviembre");
    } finally { prefs.locale = "en-US"; prefs.units = "imperial"; }
  });

  it("las cargas en lb se redondean a 2.5 lb", async () => {
    expect(roundLb(20)).toBe(45);
    expect(roundLb(60)).toBe(132.5);
    const { lastTimeLineEn } = await import("@/components/hoy/workout-hero");
    expect(lastTimeLineEn("imperial")("basico", { name: "Remo con mancuerna", lastKg: 24, lastReps: 10, kg: 26, reps: 10, type: "up" }))
      .toBe("Last time you did dumbbell row with 52.5 lb × 10: today try 57.5 lb.");
    expect(lastTimeLineEn("metric")("intermedio", { name: "Remo con mancuerna", lastKg: 24, lastReps: 10, kg: 26, reps: 10, type: "up" }))
      .toBe("Last time: Dumbbell row, 24 kg × 10. Today it's 26 kg.");
  });

  it("cada frase de Hoy tiene su traducción en src/lib/i18n/en/today.ts", () => {
    const files = ["src/app/(app)/app/page.tsx", "src/components/hoy/today-panel.tsx", "src/components/hoy/week-card.tsx", "src/components/hoy/week-line.tsx", "src/components/hoy/workout-hero.tsx",
      "src/components/hoy/exercise-tiles.tsx", "src/components/hoy/first-partial-card.tsx", "src/components/hoy/reminder-prompt.tsx", "src/components/hoy/annual-upsell.tsx", "src/components/hoy/prompt-queue.tsx",
      "src/components/readiness.tsx", "src/components/trial-card-notice.tsx", "src/components/card-banner.tsx", "src/lib/plan-access.ts", "src/components/weigh-in.tsx", "src/components/primeros-pasos/page-tour.tsx",
      // #309
      "src/components/express-chips.tsx", "src/components/workout/interval-screen.tsx", "src/components/challenge-card.tsx", "src/components/correr/run-hoy.tsx", "src/components/admin/announcement-banner.tsx",
      // #309, camino de activación
      "src/components/primeros-pasos/first-steps.tsx", "src/components/coach-prompt.tsx", "src/components/primeros-pasos/week-recap.tsx", "src/components/primeros-pasos/lo-mejor.tsx",
      "src/components/install/push-when-ready.tsx", "src/components/install/install-card.tsx", "src/components/install/install-helper.tsx", "src/components/notifications/enable-push.tsx", "src/components/notifications/native-push.tsx"];
    const keys = files.flatMap((f) => [...readFileSync(f, "utf8").matchAll(/\b(?:tx|t|translate\(locale,)\(\s*(?:[\w.?! =]+\?\s*)?"((?:[^"\\]|\\.)+)"/g)].map((m) => JSON.parse(`"${m[1]}"`) as string));
    expect(keys.length).toBeGreaterThan(100);
    expect(keys.filter((k) => !hasTranslation("en-US", k))).toEqual([]);
  });
});

describe("Camino de activación en inglés (#309)", () => {
  it("cada paso de primeros pasos, respuesta del coach y línea del resumen tiene su traducción", async () => {
    const { firstSteps } = await import("@/lib/primeros-pasos");
    const { COACH_PROMPTS, COACH_PROMPT_QUESTION } = await import("@/lib/coach-prompt");
    const { recapFrom } = await import("@/lib/week-recap");
    const base = { keys: [], workouts: 1, weights: 1, coachMessages: 0, push: false, pushSupported: true };
    const steps = [{ ...base }, { ...base, mobile: true }, { ...base, pushSupported: false }].flatMap((s) => firstSteps(s)).filter((s) => s.id !== "coach");
    const texts = [...steps.flatMap((s) => [s.title, s.why, s.cta]), COACH_PROMPT_QUESTION, ...Object.values(COACH_PROMPTS).map((p) => p.label)];
    for (const [workouts, heavier, moreReps] of [[4, ["Sentadilla"], 1], [2, ["Sentadilla", "Remo"], 3], [1, [], 0]] as const) {
      const r = recapFrom({ weekOf: "2026-11-02", workouts, sets: 12, planned: 4, heavier: [...heavier], moreReps })!;
      texts.push(r.headline, ...r.lines.map((l) => l.tpl));
    }
    expect(texts.filter((x) => !hasTranslation("en-US", x))).toEqual([]);
    expect(translate("en-US", "Pregúntale algo a {coach}", { coach: "Coach Platanita" })).toBe("Ask Coach Platanita something");
  });
});

describe("Retos y comidas en inglés (#309)", () => {
  it("cada título, medalla y tarea del catálogo de retos tiene su traducción", async () => {
    const { SEED } = await import("@/lib/challenge-seed");
    const { fromSeed } = await import("@/lib/challenges");
    const { RESTYLE } = await import("@/lib/catalog-0028");
    const { es419Text } = await import("@/lib/num");
    const texts = new Set<string>();
    for (const s of SEED) {
      const c = fromSeed(s);
      texts.add(c.title); texts.add(c.badge);
      for (let d = 1; d <= c.days; d++) texts.add(c.task(d));
    }
    for (const r of Object.values(RESTYLE)) if (r.title) texts.add(es419Text(r.title));
    expect(texts.size).toBeGreaterThan(100);
    expect([...texts].filter((x) => !hasContentTranslation("en-US", x))).toEqual([]);
  });

  it("las tareas que cambian cada día se traducen con sus números e ideas", () => {
    expect(translateContent("en-US", "Llega a 10,000 pasos. Idea de hoy: usa escaleras en vez de ascensor")).toBe("Reach 10,000 steps. Today's idea: take the stairs instead of the elevator");
    expect(translateContent("en-US", "Plancha total de 1 min 4 s (puedes partirla)")).toBe("1 min 4 s of plank in total (you can split it up)");
    expect(translateContent("en-US", "Se marca solo al registrar 8,000 pasos en Hoy")).toBe("Checks off on its own when you log 8,000 steps in Today");
    // Lo que el equipo escribe sin traducción sale tal cual (y el anuncio no se muestra en inglés).
    expect(translateContent("en-US", "Reto nuevo del panel")).toBe("Reto nuevo del panel");
    expect(translateContent("es-419", "Rey de las flexiones")).toBe("Rey de las flexiones");
  });

  it("cada receta del recetario tiene su nombre en inglés", async () => {
    const { RECIPES } = await import("@/lib/recipes");
    const names = RECIPES.map((r) => r.t);
    expect(names.length).toBeGreaterThan(10);
    expect(names.filter((n) => !hasTranslation("en-US", n))).toEqual([]);
    expect(translate("en-US", "Ceviche de pescado")).toBe("Fish ceviche");
  });
});
