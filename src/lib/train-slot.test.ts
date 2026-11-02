// #197: la franja de entreno de la bienvenida fija la hora del recordatorio.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isHHMM } from "./notify";
import { TRAIN_SLOTS, isTrainSlot, reminderTimeFor } from "./train-slot";

describe("franja de entreno (#197)", () => {
  it("cada franja da una hora de recordatorio válida, antes o al inicio de la franja", () => {
    expect(TRAIN_SLOTS.map((s) => reminderTimeFor(s.id))).toEqual(["06:00", "11:00", "15:00", "18:00"]);
    for (const s of TRAIN_SLOTS) expect(isHHMM(reminderTimeFor(s.id))).toBe(true);
  });

  it("solo acepta las franjas conocidas", () => {
    expect(isTrainSlot("noche")).toBe(true);
    for (const v of ["", "madrugada", null, undefined, 7]) expect(isTrainSlot(v)).toBe(false);
  });

  it("la bienvenida pregunta la franja y la acción la guarda en notification_prefs", () => {
    const w = readFileSync(new URL("../app/bienvenida/wizard.tsx", import.meta.url), "utf8");
    expect(w).toContain("¿A qué hora sueles entrenar?");
    expect(w).toContain("up({ trainSlot: s.id })");
    const a = readFileSync(new URL("../app/bienvenida/actions.ts", import.meta.url), "utf8");
    expect(a).toMatch(/isTrainSlot\(o\.trainSlot\)\) await sb\.from\("notification_prefs"\)\.upsert\(\{ user_id: v\.id, reminder_time: reminderTimeFor\(o\.trainSlot\) \}/);
  });

  it("el workflow horario no hace nada sin el secreto", () => {
    const y = readFileSync(new URL("../../.github/workflows/recordatorios-cada-hora.yml", import.meta.url), "utf8");
    expect(y).toContain('cron: "5 * * * *"');
    expect(y).toContain('if [ -z "$CRON_SECRET" ]');
  });
});
