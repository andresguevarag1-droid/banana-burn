import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { FUNNEL_EVENTS, cleanEvent } from "@/app/api/track/event";
import { CoachPrompt } from "@/components/coach-prompt";
import { COACH_PROMPTS, COACH_PROMPT_DAYS, autoAsk, coachPromptAnswers, coachPromptHref, coachPromptMessage, inCoachPromptWindow, showHoyCoachPrompt } from "./coach-prompt";

const reg = "2026-11-01T20:00:00Z";
const at = (h: number) => new Date(Date.parse(reg) + h * 3_600_000);

describe("el coach se presenta el primer día (#198)", () => {
  it("la burbuja sale en los primeros 3 días desde el registro y no después", () => {
    expect(COACH_PROMPT_DAYS).toBe(3);
    expect(inCoachPromptWindow({ registeredAt: reg, now: at(1), demo: false })).toBe(true);
    expect(inCoachPromptWindow({ registeredAt: reg, now: at(71), demo: false })).toBe(true);
    expect(inCoachPromptWindow({ registeredAt: reg, now: at(72), demo: false })).toBe(false);
    expect(inCoachPromptWindow({ registeredAt: reg, now: at(24 * 5), demo: false })).toBe(false);
    expect(inCoachPromptWindow({ registeredAt: null, now: at(1), demo: false })).toBe(false);
    expect(inCoachPromptWindow({ registeredAt: null, now: at(1), demo: true })).toBe(true);
  });

  it("en Hoy: después del primer entreno, solo si hoy no entrenó y aún no le escribe al coach", () => {
    const base = { workouts: 1, trainedToday: false, coachMessages: 0, registeredAt: reg, now: at(30), demo: false };
    expect(showHoyCoachPrompt(base)).toBe(true);
    expect(showHoyCoachPrompt({ ...base, workouts: 0 })).toBe(false);
    expect(showHoyCoachPrompt({ ...base, trainedToday: true })).toBe(false);
    expect(showHoyCoachPrompt({ ...base, coachMessages: 1 })).toBe(false);
    expect(showHoyCoachPrompt({ ...base, now: at(80) })).toBe(false);
  });

  it("tres respuestas de un toque; en casa no se habla de máquinas", () => {
    expect(coachPromptAnswers(false).map((id) => COACH_PROMPTS[id].label)).toEqual(["Bien", "Me costó", "No sé usar una máquina"]);
    expect(coachPromptAnswers(true).map((id) => COACH_PROMPTS[id].label)).not.toContain("No sé usar una máquina");
    // Sin emojis en la interfaz (libro de marca).
    for (const p of Object.values(COACH_PROMPTS)) expect(p.label + p.message).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("tocar una respuesta abre /app/coach con esa pregunta y el chat la envía", () => {
    const html = renderToStaticMarkup(createElement(CoachPrompt, { where: "resumen" }));
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
    expect(hrefs).toEqual(coachPromptAnswers(false).map((id) => coachPromptHref(id, "resumen")));
    for (const [i, href] of hrefs.entries()) {
      const url = new URL(href, "https://bananaburn.app");
      expect(url.pathname).toBe("/app/coach");
      const ask = coachPromptMessage(url.searchParams.get("pregunta"));
      expect(ask).toBe(COACH_PROMPTS[coachPromptAnswers(false)[i]].message);
      expect(autoAsk({ ask, configured: true, out: false })).toBe("send");
    }
    // La pantalla del coach pasa el mensaje al chat, y el chat lo envía al abrir.
    expect(readFileSync("src/app/(app)/app/coach/page.tsx", "utf8")).toContain("ask={coachPromptMessage(pregunta)}");
    expect(readFileSync("src/app/(app)/app/coach/chat.tsx", "utf8")).toMatch(/void send\(pending\)/);
  });

  it("respeta el cupo y no acepta texto libre en el enlace", () => {
    expect(autoAsk({ ask: "Hola", configured: true, out: true })).toBe("fill");
    expect(autoAsk({ ask: "Hola", configured: false, out: false })).toBeNull();
    expect(autoAsk({ ask: null, configured: true, out: false })).toBeNull();
    expect(coachPromptMessage("Dime algo")).toBeNull();
    expect(coachPromptMessage("toString")).toBeNull();
    expect(coachPromptMessage(undefined)).toBeNull();
  });

  it("coach_prompt_tap es un evento permitido en /api/track", () => {
    expect(FUNNEL_EVENTS).toContain("coach_prompt_tap");
    expect(cleanEvent({ name: "coach_prompt_tap", props: { where: "hoy", answer: "costo" } })).toEqual({ name: "coach_prompt_tap", props: { where: "hoy", answer: "costo" } });
  });
});
