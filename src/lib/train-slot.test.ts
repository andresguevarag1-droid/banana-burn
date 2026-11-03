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

  it("Hoy pregunta la franja después del primer entreno (#255) y la guarda como hora del recordatorio", () => {
    const c = readFileSync(new URL("../components/hoy/reminder-prompt.tsx", import.meta.url), "utf8");
    expect(c).toContain("¿A qué hora sueles entrenar?");
    expect(c).toContain("saveNotificationPrefs({ reminder_time: reminderTimeFor(slot) })");
    const hoy = readFileSync(new URL("../app/(app)/app/page.tsx", import.meta.url), "utf8");
    expect(hoy).toContain("(learnState.workouts > 0 || g.trainedToday) && prefs?.prefs.reminder_time === DEFAULT_PREFS.reminder_time && <ReminderPrompt />");
    // Antes del primer entreno, Hoy devuelve solo el saludo y el entreno: la tarjeta va después de ese return.
    expect(hoy.indexOf("<ReminderPrompt />")).toBeGreaterThan(hoy.indexOf("if (first) return ("));
  });

  it("la bienvenida ya no pregunta la franja ni la voz (#255)", () => {
    const w = readFileSync(new URL("../app/bienvenida/wizard.tsx", import.meta.url), "utf8");
    expect(w).not.toContain("TRAIN_SLOTS");
    expect(w).not.toContain("VoicePicker");
    // El nivel se elige a mano: empieza vacío y el paso 3 no avanza sin él.
    expect(w).toContain('level: startOnCard ? "intermedio" : null');
    expect(w).toContain("o.level != null, true, true,");
    expect(w).toContain("voice: voiceForLevel(o.level)");
    const a = readFileSync(new URL("../app/bienvenida/actions.ts", import.meta.url), "utf8");
    expect(a).not.toContain("trainSlot");
  });

  it("el workflow horario no hace nada sin el secreto", () => {
    const y = readFileSync(new URL("../../.github/workflows/recordatorios-cada-hora.yml", import.meta.url), "utf8");
    expect(y).toContain('cron: "5 * * * *"');
    expect(y).toContain('if [ -z "$CRON_SECRET" ]');
  });
});
