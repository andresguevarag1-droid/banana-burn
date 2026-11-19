// Segundo entreno (#286): el conteo del embudo, cuándo Hoy muestra "Tu segundo entreno" y la franja del "Recuérdame ese
// día" del cierre del primer entreno. El correo pasó a la secuencia de regreso (#320): regreso.test.ts.
import { describe, expect, it } from "vitest";
import { finishedInTrial } from "./segundo-entreno";
import { isSecondDay } from "./hoy-first";
import { reminderTimeFor, slotAt } from "./train-slot";

const SIGNUP = "2026-11-02T12:00:00.000Z"; // lunes 2 nov, 06:00 en Costa Rica
const FIRST = "2026-11-02T20:00:00.000Z"; // primer entreno terminado, 14:00 CR

describe("embudo del segundo entreno", () => {
  it("finishedInTrial cuenta solo lo terminado en los primeros 7 días", () => {
    expect(finishedInTrial(SIGNUP, [FIRST, null, "2026-11-09T12:00:00.000Z", "2026-11-09T11:59:00.000Z"])).toBe(2);
    expect(finishedInTrial(null, [FIRST])).toBe(0);
  });
});

describe("Hoy: tarjeta del segundo entreno", () => {
  it("desde el día siguiente al primer entreno y mientras lleve uno solo, sin programa", () => {
    expect(isSecondDay({ program: false, workouts: 1, trainedToday: false })).toBe(true);
    expect(isSecondDay({ program: false, workouts: 1, trainedToday: true })).toBe(false); // el mismo día del primero
    expect(isSecondDay({ program: false, workouts: 0, trainedToday: false })).toBe(false);
    expect(isSecondDay({ program: false, workouts: 2, trainedToday: false })).toBe(false);
    expect(isSecondDay({ program: true, workouts: 1, trainedToday: false })).toBe(false);
  });
});

describe("Recuérdame ese día", () => {
  it("guarda la franja de la hora en que entrenó", () => {
    expect([3, 4, 10, 11, 15, 16, 18, 19, 23].map(slotAt)).toEqual(["noche", "manana", "manana", "mediodia", "mediodia", "tarde", "tarde", "noche", "noche"]);
    expect(reminderTimeFor(slotAt(17))).toBe("15:00");
  });
});
