// Segundo entreno (#286) en pantalla: la tarjeta del entreno del día en Hoy como "Tu segundo entreno" (duración, botón y
// racha real) y la línea del próximo entreno en el cierre del primer entreno, con o sin "Recuérdame ese día".
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { planDay, scheduleFor } from "@/lib/engine";

vi.mock("@/app/actions/notifications", () => ({ saveNotificationPrefs: async () => ({ ok: true }) }));
const { WorkoutHero, secondStreakLine } = await import("@/components/hoy/workout-hero");
vi.mock("@/components/workout/workout.module.css", () => ({ default: {} }));
const { RecapWeekPlan } = await import("@/components/workout/recap-next-day");

const plan = planDay(1, 0, scheduleFor(3), { equipment: "gym", level: "principiante", sex: "m" });
const hero = (second: { streak: number } | null, trainedToday = false) => renderToStaticMarkup(
  <WorkoutHero plan={plan} voice="basico" mins={plan.mins ?? 40} trainedToday={trainedToday} deload={false} dayName="lunes" yesterday={plan} tomorrow={plan} lastTime={null} second={second}
    readiness={{ initial: 0, dateKey: "2026-11-03", demo: false, suggestSoft: false }} />);
const title = (html: string) => html.match(/<h2 id="hoy-entreno"[^>]*>([^<]*)<\/h2>/)![1];

describe("Hoy: Tu segundo entreno", () => {
  it("reusa la tarjeta del entreno del día con su duración, el botón y la racha", () => {
    const html = hero({ streak: 1 });
    expect(title(html)).toBe("Tu segundo entreno");
    expect(html).toContain(plan.name);
    expect(html).toContain(`>${plan.mins ?? 40}<`);
    expect(html).toContain("Racha de 1 día. Con este entreno sube a 2.");
    expect(html).toContain("/app/entreno");
  });

  it("la racha es la real: sin racha no inventa una", () => {
    expect(secondStreakLine(0)).toBe("Con este entreno empiezas tu racha.");
    expect(secondStreakLine(3)).toBe("Racha de 3 días. Con este entreno sube a 4.");
  });

  it("sin segundo entreno (o ya entrenó hoy) la tarjeta sigue igual", () => {
    expect(title(hero(null))).toBe(plan.name);
    expect(title(hero({ streak: 1 }, true))).toBe(plan.name);
  });

  it("Hoy la muestra con isSecondDay y en un día de descanso adelanta la próxima sesión", () => {
    const page = readFileSync("src/app/(app)/app/page.tsx", "utf8");
    expect(page).toContain("isSecondDay({ program: !!d.program, workouts: learnState.workouts, trainedToday: g.trainedToday })");
    expect(page).toContain("nextSessionPlan(d)");
    expect(page).toContain("second={second ? { streak: g.streak.days } : null}");
  });
});

describe("cierre del entreno: el plan de la semana (#288, antes el próximo día de #286)", () => {
  const plan = { count: 1, goal: 3, week: "esta" as const, days: "martes y jueves", n: 2, remind: true };
  it("la meta con este entreno, los próximos días y, sin recordatorio, el botón", () => {
    const html = renderToStaticMarkup(<RecapWeekPlan plan={plan} />);
    expect(html).toContain("Esta semana: 1 de 3 entrenos");
    expect(html).toContain("Tus próximos entrenos");
    expect(html).toContain("martes y jueves");
    expect(html).toContain("Recuérdame esos días");
  });

  it("si ya tiene recordatorio, solo los días; con un día, en singular", () => {
    const html = renderToStaticMarkup(<RecapWeekPlan plan={{ ...plan, remind: false }} />);
    expect(html).toContain("martes y jueves");
    expect(html).not.toContain("Recuérdame");
    const one = renderToStaticMarkup(<RecapWeekPlan plan={{ ...plan, count: 2, days: "jueves", n: 1 }} />);
    expect(one).toContain("Tu próximo entreno");
    expect(one).toContain("Recuérdame ese día");
  });

  it("con la meta cumplida, la semana que viene", () => {
    const html = renderToStaticMarkup(<RecapWeekPlan plan={{ ...plan, count: 3, week: "proxima", days: "lunes, miércoles y viernes", n: 3, remind: false }} />);
    expect(html).toContain("Cumpliste tu meta de la semana: 3 de 3");
    expect(html).toContain("La próxima semana");
  });

  it("guarda con reminder_time y REMINDER_PROMPT_KEY, como /app/primer-entreno", () => {
    const src = readFileSync("src/components/workout/recap-next-day.tsx", "utf8");
    expect(src).toContain("saveNotificationPrefs({ reminder_time: reminderTimeFor(slot) })");
    expect(src).toContain("localStorage.setItem(REMINDER_PROMPT_KEY");
  });
});
