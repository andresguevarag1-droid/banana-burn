// Segundo entreno (#286) en pantalla: la tarjeta del entreno del día en Hoy como "Tu segundo entreno" (duración, botón y
// racha real) y la línea del próximo entreno en el cierre del primer entreno, con o sin "Recuérdame ese día".
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { planDay, scheduleFor } from "@/lib/engine";

vi.mock("@/app/actions/notifications", () => ({ saveNotificationPrefs: async () => ({ ok: true }) }));
const { WorkoutHero, secondStreakLine } = await import("@/components/hoy/workout-hero");
const { RecapNextDay } = await import("@/components/workout/recap-next-day");

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

describe("cierre del primer entreno", () => {
  it("una línea con el día y, sin recordatorio, el botón", () => {
    const html = renderToStaticMarkup(<RecapNextDay when="el miércoles" remind />);
    expect(html).toContain("Tu próximo entreno: el miércoles");
    expect(html).toContain("Recuérdame ese día");
  });

  it("si ya tiene recordatorio, solo el día", () => {
    const html = renderToStaticMarkup(<RecapNextDay when="mañana" remind={false} />);
    expect(html).toContain("Tu próximo entreno: mañana");
    expect(html).not.toContain("Recuérdame");
  });

  it("guarda con reminder_time y REMINDER_PROMPT_KEY, como /app/primer-entreno", () => {
    const src = readFileSync("src/components/workout/recap-next-day.tsx", "utf8");
    expect(src).toContain("saveNotificationPrefs({ reminder_time: reminderTimeFor(slot) })");
    expect(src).toContain("localStorage.setItem(REMINDER_PROMPT_KEY");
  });
});
