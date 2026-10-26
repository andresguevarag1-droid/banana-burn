import { describe, expect, it } from "vitest";
import { addDays, cleanHealth, dailyTotals, isIsoDay, latestWeights, planDailyRows, planWeights } from "./salud-sync";

const TODAY = "2026-10-26";

describe("cleanHealth (lo que manda el teléfono)", () => {
  it("acepta pasos y energía activa de los últimos 7 días, redondeados y con tope", () => {
    const p = cleanHealth({ days: [
      { day: TODAY, steps: 8123.6, activeKcal: 412.4 },
      { day: addDays(TODAY, -6), steps: 99999 },
      { day: addDays(TODAY, -7), steps: 5000 }, // fuera de la ventana
      { day: addDays(TODAY, 1), steps: 5000 }, // mañana (otra zona horaria)
    ] }, TODAY);
    expect(p.days).toEqual([{ day: addDays(TODAY, -6), steps: 80000 }, { day: TODAY, steps: 8124, activeKcal: 412 }]);
  });

  it("descarta basura: negativos, NaN, texto, fechas imposibles, objetos raros", () => {
    const p = cleanHealth({ days: [
      { day: TODAY, steps: -5 }, { day: TODAY, steps: Number.NaN }, { day: TODAY, steps: "900" },
      { day: "2026-02-30", steps: 10 }, null, 7, { steps: 10 },
    ], weights: "nada" }, TODAY);
    expect(p).toEqual({ days: [], weights: [] });
    expect(cleanHealth(null, TODAY)).toEqual({ days: [], weights: [] });
    expect(cleanHealth("x", TODAY)).toEqual({ days: [], weights: [] });
  });

  it("pesos de los últimos 30 días entre 30 y 300 kg, a un decimal", () => {
    const p = cleanHealth({ weights: [
      { day: TODAY, kg: 82.46 }, { day: addDays(TODAY, -29), kg: 83 }, { day: addDays(TODAY, -30), kg: 84 },
      { day: addDays(TODAY, -1), kg: 12 }, { day: addDays(TODAY, -2), kg: 400 }, { day: addDays(TODAY, -3), kg: Infinity },
    ] }, TODAY);
    expect(p.weights).toEqual([{ day: addDays(TODAY, -29), kg: 83 }, { day: TODAY, kg: 82.5 }]);
  });

  it("isIsoDay solo acepta fechas reales", () => {
    expect(isIsoDay("2026-10-26")).toBe(true);
    expect(isIsoDay("2024-02-29")).toBe(true);
    expect(isIsoDay("2026-02-29")).toBe(false);
    expect(isIsoDay("2026-1-5")).toBe(false);
    expect(isIsoDay(20261026)).toBe(false);
  });
});

describe("planDailyRows (qué se escribe en daily_logs)", () => {
  const p = (days: { day: string; steps?: number; activeKcal?: number }[]) => ({ days, weights: [] });

  it("hoy sin registro: lo crea y da el XP de registro", () => {
    const r = planDailyRows(p([{ day: TODAY, steps: 4200, activeKcal: 180 }]), [], TODAY, true);
    expect(r).toEqual({ rows: [{ day: TODAY, steps: 4200, active_kcal: 180 }], createsToday: true });
  });

  it("hoy con 0 pasos y 0 kcal (recién pasada la medianoche): no crea nada", () => {
    expect(planDailyRows(p([{ day: TODAY, steps: 0, activeKcal: 0 }]), [], TODAY, true)).toEqual({ rows: [], createsToday: false });
  });

  it("nunca crea un día pasado (la racha no se reescribe hacia atrás)", () => {
    const ayer = addDays(TODAY, -1);
    expect(planDailyRows(p([{ day: ayer, steps: 12000 }]), [], TODAY, true).rows).toEqual([]);
  });

  it("completa los pasos de un día pasado que ya tenía registro", () => {
    const ayer = addDays(TODAY, -1);
    const r = planDailyRows(p([{ day: ayer, steps: 12000, activeKcal: 500 }]), [{ day: ayer, steps: 3000, active_kcal: null }], TODAY, true);
    expect(r).toEqual({ rows: [{ day: ayer, steps: 12000, active_kcal: 500 }], createsToday: false });
  });

  it("los pasos solo suben: lo anotado a mano que sea mayor se respeta", () => {
    const r = planDailyRows(p([{ day: TODAY, steps: 5000, activeKcal: 200 }]), [{ day: TODAY, steps: 9000, active_kcal: 150 }], TODAY, true);
    expect(r.rows).toEqual([{ day: TODAY, steps: 9000, active_kcal: 200 }]);
  });

  it("sin cambios no escribe", () => {
    expect(planDailyRows(p([{ day: TODAY, steps: 5000, activeKcal: 200 }]), [{ day: TODAY, steps: 5000, active_kcal: 200 }], TODAY, true).rows).toEqual([]);
  });

  it("0 pasos de Salud no borra ni pone 0 sobre un registro vacío", () => {
    const r = planDailyRows(p([{ day: TODAY, steps: 0, activeKcal: 90 }]), [{ day: TODAY, steps: null, active_kcal: null }], TODAY, true);
    expect(r.rows).toEqual([{ day: TODAY, steps: null, active_kcal: 90 }]);
  });

  it("sin la columna active_kcal (0058 sin aplicar): solo pasos, y la energía sola no crea el día", () => {
    expect(planDailyRows(p([{ day: TODAY, steps: 300, activeKcal: 40 }]), [], TODAY, false).rows).toEqual([{ day: TODAY, steps: 300 }]);
    expect(planDailyRows(p([{ day: TODAY, activeKcal: 40 }]), [], TODAY, false).rows).toEqual([]);
  });
});

describe("planWeights", () => {
  it("solo días sin peso: lo anotado a mano manda", () => {
    const ws = [{ day: addDays(TODAY, -2), kg: 80 }, { day: TODAY, kg: 79.5 }];
    expect(planWeights({ days: [], weights: ws }, [TODAY])).toEqual([{ day: addDays(TODAY, -2), kg: 80 }]);
  });
});

describe("del plugin a días locales", () => {
  it("dailyTotals asigna cada tramo a su día local por el centro del tramo", () => {
    const tz = "America/Costa_Rica"; // UTC-6, sin horario de verano
    const m = dailyTotals([
      { startDate: "2026-10-25T06:00:00Z", endDate: "2026-10-26T06:00:00Z", value: 7000 },
      { startDate: "2026-10-26T06:00:00Z", endDate: "2026-10-26T15:30:00Z", value: 1200 },
      { startDate: "malo", endDate: "2026-10-26T15:30:00Z", value: 1 },
    ], tz);
    expect(Object.fromEntries(m)).toEqual({ "2026-10-25": 7000, "2026-10-26": 1200 });
  });

  it("un día con cambio de horario (tramo de 23 h) sigue en su fecha", () => {
    const m = dailyTotals([{ startDate: "2026-03-08T05:00:00Z", endDate: "2026-03-09T04:00:00Z", value: 10 }], "America/New_York");
    expect([...m.keys()]).toEqual(["2026-03-08"]);
  });

  it("latestWeights: el último pesaje de cada día", () => {
    const tz = "America/Costa_Rica";
    expect(latestWeights([
      { startDate: "2026-10-26T13:00:00Z", value: 81.24 }, // 7:00
      { startDate: "2026-10-26T20:00:00Z", value: 82.01 }, // 14:00
      { startDate: "2026-10-26T03:00:00Z", value: 80 }, // 25 a las 21:00
    ], tz)).toEqual([{ day: "2026-10-25", kg: 80 }, { day: "2026-10-26", kg: 82 }]);
  });
});
