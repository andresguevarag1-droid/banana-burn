import { describe, expect, it } from "vitest";
import {
  activeCounts, activityMap, addDays, addMonths, nextRenewal, cellRate, churn, cohortRetention, crDay, dailySeries, dayDiff, delta, monthlyValue, mrr, pct, resolvePlan, signupsWithin, weekOf,
} from "./admin-kpis";

describe("fechas", () => {
  it("día de Costa Rica (UTC−6)", () => {
    expect(crDay("2026-10-21T05:59:00Z")).toBe("2026-10-20");
    expect(crDay("2026-10-21T06:00:00Z")).toBe("2026-10-21");
    expect(crDay("2026-10-21")).toBe("2026-10-21");
  });
  it("aritmética de días y semanas", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(dayDiff("2026-10-01", "2026-10-21")).toBe(20);
    expect(weekOf("2026-10-21")).toBe("2026-10-19"); // miércoles → lunes
    expect(weekOf("2026-10-19")).toBe("2026-10-19");
    expect(weekOf("2026-10-25")).toBe("2026-10-19"); // domingo
  });
});

describe("renovaciones", () => {
  it("mensual = +1 mes calendario, anual = +1 año", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-10-21", 1)).toBe("2026-11-21");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(nextRenewal("2026-09-30", "mes")).toBe("2026-10-30");
    expect(nextRenewal("2026-02-10", "anual")).toBe("2027-02-10");
  });
});

describe("tasas", () => {
  it("celda de cohorte solo con cohorte completa", () => {
    expect(cellRate(3, 8, 8)).toBe(37.5);
    expect(cellRate(3, 7, 8)).toBeNull();
    expect(cellRate(0, 0, 0)).toBeNull();
  });
  it("pct con un decimal y sin dividir entre 0", () => {
    expect(pct(1, 3)).toBe(33.3);
    expect(pct(5, 0)).toBe(0);
    expect(delta(12, 10)).toBe(20);
    expect(delta(5, 0)).toBeNull();
  });
});

describe("suscripciones", () => {
  it("resuelve plan y periodicidad con columnas faltantes", () => {
    expect(resolvePlan({ plan: "completo", billing: "anual" })).toEqual({ plan: "completo", billing: "anual" });
    expect(resolvePlan({ price_id: "price_entreno_year" })).toEqual({ plan: "entreno", billing: "anual" });
    expect(resolvePlan({ status: "active" }, "pro")).toEqual({ plan: "completo", billing: "mes" });
    expect(resolvePlan({ status: "active" }, "free").plan).toBeNull();
  });
  it("valor mensual: anual ÷ 12, o columna amount", () => {
    expect(monthlyValue({ plan: "entreno", billing: "mes" })).toBe(9.99);
    expect(monthlyValue({ plan: "completo", billing: "anual" })).toBeCloseTo(89.99 / 12, 5);
    expect(monthlyValue({ plan: "entreno", billing: "anual", amount: 48 })).toBe(4);
  });
  it("MRR solo cuenta activas", () => {
    const m = mrr([
      { status: "active", plan: "entreno", billing: "mes" },
      { status: "active", plan: "completo", billing: "anual" },
      { status: "trialing", plan: "completo", billing: "mes" },
      { status: "past_due", plan: "completo", billing: "mes" },
      { status: "canceled", plan: "entreno", billing: "mes" },
    ]);
    expect(m.total).toBe(Math.round((9.99 + 89.99 / 12) * 100) / 100);
    expect(m.byPlan["entreno·mes"]).toEqual({ n: 1, mrr: 9.99 });
  });
  it("churn 30 d = cancelaciones en la ventana / base al inicio", () => {
    const now = new Date("2026-10-21T12:00:00Z");
    const subs = [
      { status: "active", created_at: "2026-08-01T00:00:00Z" },
      { status: "active", created_at: "2026-08-01T00:00:00Z" },
      { status: "canceled", created_at: "2026-08-01T00:00:00Z", canceled_at: "2026-10-10T00:00:00Z" },
      { status: "canceled", created_at: "2026-08-01T00:00:00Z", updated_at: "2026-10-15T00:00:00Z" }, // sin canceled_at
      { status: "canceled", created_at: "2026-07-01T00:00:00Z", canceled_at: "2026-09-01T00:00:00Z" }, // antes de la ventana
      { status: "active", created_at: "2026-10-15T00:00:00Z" },  // nueva: no es base
      { status: "trialing", created_at: "2026-08-01T00:00:00Z" }, // prueba: no cuenta
    ];
    expect(churn(subs, now, 30)).toEqual({ base: 4, lost: 2, rate: 50 });
    expect(churn([], now).rate).toBe(0);
  });
});

describe("actividad y retención", () => {
  const today = "2026-10-21";
  it("activos hoy / 7 d / 30 d", () => {
    const act = activityMap([
      { user_id: "a", day: today }, { user_id: "a", day: "2026-10-01" },
      { user_id: "b", day: "2026-10-15" },
      { user_id: "c", day: "2026-09-25" },
      { user_id: "d", day: "2026-08-01" },
    ]);
    expect(activeCounts(act, today)).toEqual({ today: 1, d7: 2, d30: 3 });
  });
  it("altas dentro de N días (incluye hoy)", () => {
    expect(signupsWithin(["2026-10-21T15:00:00Z", "2026-10-15T15:00:00Z", "2026-10-14T15:00:00Z"], today, 7)).toBe(2);
  });
  it("serie diaria rellena con ceros", () => {
    const s = dailySeries(["2026-10-21", "2026-10-21", "2026-10-19"], today, 3);
    expect(s).toEqual([{ day: "2026-10-19", n: 1 }, { day: "2026-10-20", n: 0 }, { day: "2026-10-21", n: 2 }]);
  });
  it("cohortes: solo elegibles con ventana cerrada", () => {
    const users = [
      { id: "u1", created_at: "2026-08-03T15:00:00Z" }, // lunes 3 ago
      { id: "u2", created_at: "2026-08-04T15:00:00Z" },
      { id: "u3", created_at: "2026-10-20T15:00:00Z" }, // ayer: D1 aún abierto si hoy es 21? (20+1 = 21 ≤ 21 → elegible)
      { id: "u4", created_at: "2026-10-21T15:00:00Z" }, // hoy: nada elegible
    ];
    const act = activityMap([
      { user_id: "u1", day: "2026-08-04" }, { user_id: "u1", day: "2026-08-12" }, { user_id: "u1", day: "2026-09-03" },
      { user_id: "u2", day: "2026-09-30" },
      { user_id: "u3", day: "2026-10-21" },
    ]);
    const rows = cohortRetention(users, act, today, 12);
    const aug = rows.find((r) => r.cohort === "2026-08-03")!;
    expect(aug.size).toBe(2);
    expect(aug.d1).toEqual({ n: 1, eligible: 2, rate: 50 });
    expect(aug.d7).toEqual({ n: 1, eligible: 2, rate: 50 });
    expect(aug.d30).toEqual({ n: 1, eligible: 2, rate: 50 }); // u1 activo el día 31; u2 el día 57 (fuera de ventana)
    const now = rows.find((r) => r.cohort === "2026-10-19")!;
    expect(now.size).toBe(2);
    expect(now.d1).toEqual({ n: 1, eligible: 1, rate: null }); // u4 aún no cumple D1: cohorte en curso
    expect(now.d7.rate).toBeNull();
    expect(rows[0].cohort).toBe("2026-10-19"); // más reciente primero
    expect(rows).toHaveLength(12);
  });
});
