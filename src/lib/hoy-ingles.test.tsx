// Hoy en inglés (#299): la pantalla /app renderizada en modo demo con locale en-US y libras, con la hora fija para que
// el snapshot no cambie. El primer día (?primera=1) y el Hoy completo sin programa (la rutina del motor).
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasTranslation } from "@/lib/i18n/t";
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

  it("en español la misma pantalla no cambia de idioma", async () => {
    prefs.locale = "es-419"; prefs.units = "metric";
    try {
      const { text } = await hoy();
      for (const s of ["Esta semana:", "Racha diaria:", "Tu semana", "Tus números de hoy", "kg perdidos", "kg a la meta"]) expect(text).toContain(s);
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
      "src/components/readiness.tsx", "src/components/trial-card-notice.tsx", "src/components/card-banner.tsx", "src/lib/plan-access.ts", "src/components/weigh-in.tsx", "src/components/primeros-pasos/page-tour.tsx"];
    const keys = files.flatMap((f) => [...readFileSync(f, "utf8").matchAll(/\b(?:tx|t|translate\(locale,)\(\s*(?:[\w.?! =]+\?\s*)?"((?:[^"\\]|\\.)+)"/g)].map((m) => m[1]));
    expect(keys.length).toBeGreaterThan(100);
    expect(keys.filter((k) => !hasTranslation("en-US", k))).toEqual([]);
  });
});
