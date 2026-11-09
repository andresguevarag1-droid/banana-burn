// Hábito semanal (#288): la meta, el conteo de la semana en la zona horaria de la persona, la racha semanal, los próximos
// días del cierre y cuándo sale el recordatorio (y que no se repita en la semana).
import { describe, expect, it } from "vitest";
import { dayList, localDayOf, progressLine, registrationDay, suggestDays, weekCount, weekMonday, weeklyGoal, weeklyNudgeCopy, weeklyNudgeDue, weeklyStreak, weeklyStreakLine } from "./meta-semanal";
import { scheduleFor } from "./engine";

// Noviembre de 2026: el lunes 2, el lunes 9, el lunes 16.
const MON = "2026-11-09";

describe("meta de la semana", () => {
  it("sale de los días de la bienvenida, con un máximo de 3 mientras dura la prueba", () => {
    expect(weeklyGoal({ trainDays: 5, regDay: "2026-11-09", monday: MON })).toBe(3);
    expect(weeklyGoal({ trainDays: 3, regDay: "2026-11-09", monday: MON })).toBe(3);
    // La semana en que termina la prueba (registro el jueves 5, la prueba llega al miércoles 11) sigue en 3.
    expect(weeklyGoal({ trainDays: 6, regDay: "2026-11-05", monday: MON })).toBe(3);
    // Después de la prueba, los días que eligió.
    expect(weeklyGoal({ trainDays: 5, regDay: "2026-10-01", monday: MON })).toBe(5);
    expect(weeklyGoal({ trainDays: 4, regDay: null, monday: MON })).toBe(4);
  });

  it("la semana del registro, nunca más días de los que quedaban", () => {
    expect(weeklyGoal({ trainDays: 5, regDay: "2026-11-13", monday: MON })).toBe(3); // viernes: viernes, sábado y domingo
    expect(weeklyGoal({ trainDays: 5, regDay: "2026-11-14", monday: MON })).toBe(2); // sábado
    expect(weeklyGoal({ trainDays: 5, regDay: "2026-11-15", monday: MON })).toBe(1); // domingo
    expect(weeklyGoal({ trainDays: 5, regDay: "2026-11-15", monday: "2026-11-16" })).toBe(3); // la semana siguiente, completa
  });
});

describe("conteo de la semana", () => {
  it("de lunes a hoy, un día con dos entrenos cuenta una vez", () => {
    const days = ["2026-11-08", "2026-11-09", "2026-11-09", "2026-11-11", "2026-11-13"];
    expect(weekCount(days, "2026-11-12")).toBe(2); // el domingo 8 es de la semana pasada; el viernes 13 todavía no llega
    expect(weekCount(days, "2026-11-15")).toBe(3);
    expect(weekCount(days, "2026-11-16")).toBe(0); // el lunes empieza de cero
  });

  it("el lunes es el de su zona horaria", () => {
    // Domingo 15 a las 23:30 en Costa Rica es lunes 16 en UTC: para ella sigue siendo la semana del 9.
    const at = "2026-11-16T05:30:00.000Z";
    expect(localDayOf(at, "America/Costa_Rica")).toBe("2026-11-15");
    expect(weekMonday(localDayOf(at, "America/Costa_Rica"))).toBe("2026-11-09");
    expect(weekMonday(localDayOf(at, "Europe/Madrid"))).toBe("2026-11-16");
    expect(registrationDay("2026-11-10T04:00:00.000Z", "America/Mexico_City")).toBe("2026-11-09");
    expect(registrationDay(null, "America/Costa_Rica")).toBeNull();
  });
});

describe("racha semanal", () => {
  const goal3 = () => 3;
  const three = (mon: string) => [0, 2, 4].map((k) => new Date(Date.parse(mon + "T12:00:00Z") + k * 864e5).toISOString().slice(0, 10));
  it("cuenta semanas seguidas cumpliendo la meta", () => {
    const days = [...three("2026-10-26"), ...three("2026-11-02")];
    expect(weeklyStreak(days, "2026-11-10", goal3)).toBe(2);
  });

  it("la semana en curso suma cuando se cumple y, mientras tanto, no corta la racha", () => {
    const days = [...three("2026-11-02"), "2026-11-09"];
    expect(weeklyStreak(days, "2026-11-10", goal3)).toBe(1);
    expect(weeklyStreak([...days, "2026-11-11", "2026-11-12"], "2026-11-12", goal3)).toBe(2);
  });

  it("una semana sin cumplir la corta; antes del registro no cuenta", () => {
    expect(weeklyStreak([...three("2026-10-19"), ...three("2026-11-02")], "2026-11-10", goal3)).toBe(1);
    expect(weeklyStreak([], "2026-11-10", goal3)).toBe(0);
    // Registro el sábado 7 con meta de 2 esa semana (sábado y domingo): la cumplió.
    const goalOf = (mon: string) => weeklyGoal({ trainDays: 3, regDay: "2026-11-07", monday: mon });
    expect(weeklyStreak(["2026-11-07", "2026-11-08"], "2026-11-10", goalOf, "2026-11-07")).toBe(1);
  });

  it("el texto", () => {
    expect(weeklyStreakLine(1)).toBe("1 semana cumpliendo tu meta");
    expect(weeklyStreakLine(2)).toBe("2 semanas cumpliendo tu meta");
  });
});

describe("próximos días del cierre", () => {
  const s3 = scheduleFor(3); // lunes, miércoles y viernes
  it("los días de entreno que quedan esta semana, solo los que faltan", () => {
    expect(suggestDays(s3, "2026-11-09", 1, 3)).toEqual({ week: "esta", dows: [3, 5] });
    expect(dayList([3, 5])).toBe("miércoles y viernes");
    expect(suggestDays(scheduleFor(5), "2026-11-09", 1, 3)).toEqual({ week: "esta", dows: [2, 3] });
  });

  it("con la meta cumplida o sin días de entreno por delante, la semana que viene", () => {
    expect(suggestDays(s3, "2026-11-13", 3, 3)).toEqual({ week: "proxima", dows: [1, 3, 5] });
    expect(suggestDays(s3, "2026-11-14", 1, 3)).toEqual({ week: "proxima", dows: [1, 3, 5] });
    expect(dayList([1, 3, 5])).toBe("lunes, miércoles y viernes");
    expect(dayList([2])).toBe("martes");
  });
});

describe("recordatorio si va atrasado", () => {
  const due = (today: string, days: string[], over: { goal?: number; sent?: boolean } = {}) =>
    weeklyNudgeDue({ today, goal: over.goal ?? 3, days, sentThisWeek: over.sent ?? false });
  const before = ["2026-11-04"]; // ya entrenó alguna vez (la semana pasada)

  it("el jueves con 0 de 3: todavía llega", () => {
    expect(due("2026-11-12", before)).toBe(true);
  });

  it("antes de ir atrasado no sale", () => {
    expect(due("2026-11-10", before)).toBe(false); // martes 0 de 3
    expect(due("2026-11-11", before)).toBe(false); // miércoles 0 de 3: le quedan 5 días
    expect(due("2026-11-12", [...before, "2026-11-10"])).toBe(false); // jueves 1 de 3
  });

  it("va atrás y todavía llega: viernes 1 de 3, sábado o domingo con 2 de 3", () => {
    expect(due("2026-11-13", [...before, "2026-11-10"])).toBe(true);
    expect(due("2026-11-14", [...before, "2026-11-10", "2026-11-11"])).toBe(true);
    expect(due("2026-11-15", [...before, "2026-11-10", "2026-11-11"])).toBe(true);
  });

  it("si ya no llega, si ya cumplió o si hoy ya entrenó, no sale", () => {
    expect(due("2026-11-14", before)).toBe(false); // sábado 0 de 3
    expect(due("2026-11-13", [...before, "2026-11-10", "2026-11-11", "2026-11-12"])).toBe(false);
    expect(due("2026-11-12", [...before, "2026-11-12"])).toBe(false);
  });

  it("sin ningún entreno no sale (de eso se encargan los correos de activación)", () => {
    expect(due("2026-11-12", [])).toBe(false);
  });

  it("una sola vez por semana", () => {
    expect(due("2026-11-13", before, { sent: true })).toBe(false);
  });

  it("copy con cifras reales y sin culpa", () => {
    const c = weeklyNudgeCopy(0, 3, 12);
    expect(c.title).toBe("Todavía llegas a tu meta");
    expect(c.body).toBe("Llevas 0 de 3 entrenos esta semana. Hoy son 12 minutos. Coach Banana te guía paso a paso.");
    expect(weeklyNudgeCopy(1, 3, null).body).not.toMatch(/minutos/);
    expect(`${c.title} ${c.body}`).not.toMatch(/!|—|falla|culpa|perd/i);
  });
});

describe("progreso entre entrenos", () => {
  it("compara la mejor serie de la vez pasada con la de hoy", () => {
    expect(progressLine([{ kg: 6, reps: 10 }, { kg: 6, reps: 9 }], [{ kg: 6, reps: 12 }, { kg: 6, reps: 11 }])).toEqual({ line: "La vez pasada: 6 kg × 10. Hoy: 6 kg × 12.", up: true });
    expect(progressLine([{ kg: 20, reps: 10 }], [{ kg: 22.5, reps: 8 }])).toEqual({ line: "La vez pasada: 20 kg × 10. Hoy: 22.5 kg × 8.", up: true });
    expect(progressLine([{ kg: 20, reps: 10 }], [{ kg: 20, reps: 10 }])!.up).toBe(false);
  });

  it("sin peso, repeticiones o segundos", () => {
    expect(progressLine([{ kg: null, reps: 8 }], [{ kg: null, reps: 10 }])!.line).toBe("La vez pasada: 8 repeticiones. Hoy: 10 repeticiones.");
    expect(progressLine([{ kg: null, reps: 30 }], [{ kg: null, reps: 40 }], "s")!.line).toBe("La vez pasada: 30 s. Hoy: 40 s.");
  });

  it("sin la vez pasada (o sin series hoy) no inventa nada", () => {
    expect(progressLine(null, [{ kg: 6, reps: 10 }])).toBeNull();
    expect(progressLine([{ kg: 6, reps: 10 }], [])).toBeNull();
  });
});
