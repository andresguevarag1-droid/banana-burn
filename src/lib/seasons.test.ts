import { describe, expect, it } from "vitest";
import {
  AREAS, INJURY_SWAPS, SEASONS_T1, SEASON_PRICE_MINOR, SPORTS, SPORT_IDS, aggregateFeedback, annualPeriodKey, canEnroll, canRedeemAnnual, currentSeason, daysToStart,
  intakeForCoach, intakeSummary, parseIntake, parseSeasonSlug, planWeek, purchaseBlock, retention, seasonStatus, seasonWeek, taperWeeks, toReplace,
  type SeasonIntake, type SportId,
} from "./seasons";

const base = (o: Partial<SeasonIntake> = {}): SeasonIntake => ({
  level: "recreativo", years: 3, trainDays: [0, 1, 2, 3, 4, 5, 6], time: "tarde", sessions: 3, minutes: 45, place: "gym", equipment: [], injuries: [], goal: "marca", eventDate: null, eventType: null, ...o,
});

describe("fechas de la Temporada 1", () => {
  const t1 = SEASONS_T1[0];
  it("8 semanas: del lunes 9 de noviembre al domingo 3 de enero", () => {
    expect(t1.startsOn).toBe("2026-11-09");
    expect(t1.endsOn).toBe("2027-01-03");
    expect(new Date(t1.startsOn + "T12:00:00Z").getUTCDay()).toBe(1);
    expect(new Date(t1.endsOn + "T12:00:00Z").getUTCDay()).toBe(0);
    expect(t1.enrollUntil).toBe("2026-11-22");
  });
  it("estado, semana e inscripción según el día", () => {
    expect(seasonStatus(t1, "2026-10-24")).toBe("preventa");
    expect(seasonStatus(t1, "2026-11-09")).toBe("activa");
    expect(seasonStatus(t1, "2027-01-03")).toBe("activa");
    expect(seasonStatus(t1, "2027-01-04")).toBe("terminada");
    expect(seasonWeek(t1, "2026-11-08")).toBe(0);
    expect(seasonWeek(t1, "2026-11-09")).toBe(1);
    expect(seasonWeek(t1, "2026-11-16")).toBe(2);
    expect(seasonWeek(t1, "2027-01-03")).toBe(8);
    expect(canEnroll(t1, "2026-10-24")).toBe(true);
    expect(canEnroll(t1, "2026-11-22")).toBe(true);
    expect(canEnroll(t1, "2026-11-23")).toBe(false);
    expect(daysToStart(t1, "2026-11-02")).toBe(7);
  });
  it("slug, temporada vigente y precios del servidor por deporte", () => {
    expect(parseSeasonSlug("temporada-running-1")).toEqual({ sport: "running", number: 1 });
    expect(parseSeasonSlug("temporada-futbol-1")).toBeNull();
    expect(currentSeason(SEASONS_T1, "raquetas", "2026-12-01")?.slug).toBe("temporada-raquetas-1");
    expect(currentSeason(SEASONS_T1, "raquetas", "2027-02-01")).toBeNull();
    expect(SEASON_PRICE_MINOR).toEqual({ running: 1499, raquetas: 1699, cross: 1899 });
    for (const s of SEASONS_T1) expect(s.priceMinor).toBe(SEASON_PRICE_MINOR[s.sport]);
  });
});

describe("compra: nunca se repite", () => {
  const s = SEASONS_T1[0];
  it("bloquea si ya la tienes, si cerró o sin plan ni prueba", () => {
    expect(purchaseBlock(s, { owned: true, today: "2026-10-24", hasAccess: true })).toMatch(/Ya tienes/);
    expect(purchaseBlock(s, { owned: false, today: "2026-11-23", hasAccess: true })).toMatch(/cerraron/);
    expect(purchaseBlock(s, { owned: false, today: "2026-10-24", hasAccess: false })).toMatch(/plan activo/);
    expect(purchaseBlock(s, { owned: false, today: "2026-10-24", hasAccess: true })).toBeNull();
  });
});

describe("plan anual: 1 temporada gratis por periodo pagado", () => {
  const now = new Date("2026-11-15T12:00:00Z");
  const annual = { id: 7, billing: "anual", status: "active", current_period_start: "2026-11-01T06:00:00Z", current_period_end: "2027-11-01T06:00:00Z", plan: "entreno" };
  it("anual pagado sí; mensual no; sin suscripción (en prueba) no", () => {
    expect(annualPeriodKey([annual], now)).toEqual({ subId: "7", periodStart: "2026-11-01" });
    expect(annualPeriodKey([{ ...annual, billing: "mes" }], now)).toBeNull();
    expect(annualPeriodKey([], now)).toBeNull();
    expect(annualPeriodKey([{ ...annual, status: "incomplete" }], now)).toBeNull();
    expect(annualPeriodKey([{ ...annual, status: "past_due" }], now)).toBeNull();
  });
  it("uno por periodo; la renovación da otro", () => {
    expect(canRedeemAnnual([annual], [{ sub_id: "7", period_start: "2026-11-01" }], now)).toBeNull();
    const renewed = { ...annual, current_period_start: "2027-11-01T06:00:00Z", current_period_end: "2028-11-01T06:00:00Z" };
    expect(canRedeemAnnual([renewed], [{ sub_id: "7", period_start: "2026-11-01" }], new Date("2027-11-10T12:00:00Z"))).toEqual({ subId: "7", periodStart: "2027-11-01" });
  });
});

describe("cuestionario", () => {
  it("sanea lo que llega del navegador y exige días para entrenar", () => {
    expect(parseIntake({ trainDays: [] }, "running")).toBeNull();
    const i = parseIntake({ trainDays: [1, 1, 9, 3], sessions: 9, minutes: 50, injuries: ["rodilla", "nariz"], goal: "x", eventDate: "2026-12-06", eventType: "10K de la ciudad", running: { runDays: [1, 5, 6], longRunDay: 6, kmWeek: 999, target: "10k", paceDist: "5k", paceTime: "25:30", watch: "strava" } }, "running")!;
    expect(i.trainDays).toEqual([1, 3]);
    expect(i.sessions).toBe(4);
    expect(i.minutes).toBe(45);
    expect(i.injuries).toEqual(["rodilla"]);
    expect(i.goal).toBe("marca");
    expect(i.running).toMatchObject({ runDays: [1, 5, 6], longRunDay: 6, kmWeek: 250, paceTime: "25:30", watch: "strava" });
    const r = parseIntake({ trainDays: [0], raquetas: { playDays: [2, 5], competitiveDays: [5, 6] } }, "raquetas")!;
    expect(r.raquetas?.competitiveDays).toEqual([5]);
  });
});

/** Días pesados (fuerza y potencia) de un plan. */
const heavyDays = (sport: SportId, i: SeasonIntake) => planWeek(sport, i).slots.filter((s) => s.kind === "fuerza" || s.kind === "potencia").map((s) => s.dow);

describe("la semana se arma alrededor del deporte", () => {
  it("running: nada de piernas pesadas el día de la carrera larga ni el anterior", () => {
    const i = base({ running: { runDays: [1, 3, 6], longRunDay: 6, kmWeek: 30, paceDist: null, paceTime: null, target: "21k", surface: ["calle"], watch: "no" } });
    const p = planWeek("running", i);
    expect(p.slots).toHaveLength(3);
    for (const d of heavyDays("running", i)) expect([5, 6]).not.toContain(d);
    expect(p.warnings).toEqual([]);
  });
  it("recuperación el día después de la carrera larga", () => {
    const i = base({ sessions: 4, running: { runDays: [2, 6], longRunDay: 6, kmWeek: 30, paceDist: null, paceTime: null, target: "21k", surface: [], watch: "no" } });
    const p = planWeek("running", i);
    expect(p.slots.find((s) => s.kind === "recuperacion")?.dow).toBe(0);
  });
  it("raquetas: fuerza y potencia a 48 h o más de los partidos competitivos", () => {
    const i = base({ goal: "potencia", raquetas: { which: "padel", playDays: [2, 5], competitiveDays: [5], hand: "derecha", category: "", matchMin: 90, pains: [] } });
    for (const d of heavyDays("raquetas", i)) { expect(d).not.toBe(5); expect(d).not.toBe(4); }
  });
  it("respeta cuántas sesiones eligió y solo sus días disponibles", () => {
    const i = base({ sessions: 2, trainDays: [0, 2], running: { runDays: [5], longRunDay: 5, kmWeek: 20, paceDist: null, paceTime: null, target: "10k", surface: [], watch: "no" } });
    const p = planWeek("running", i);
    expect(p.slots.map((s) => s.kind)).toEqual(["fuerza", "potencia"]);
    for (const s of p.slots) expect([0, 2]).toContain(s.dow);
  });
  it("si sus días hacen imposible la regla, no la rompe: avisa y sugiere", () => {
    // Solo puede el viernes y el sábado, y su carrera larga es el sábado.
    const i = base({ trainDays: [4, 5], running: { runDays: [5], longRunDay: 5, kmWeek: 20, paceDist: null, paceTime: null, target: "10k", surface: [], watch: "no" } });
    const p = planWeek("running", i);
    for (const d of heavyDays("running", i)) expect([4, 5]).not.toContain(d);
    expect(p.warnings.length).toBeGreaterThan(0);
  });
  it("cross: la fuerza no va el mismo día que el box", () => {
    const i = base({ goal: "fuerza", cross: { boxDays: [0, 2, 4], oly: "basica", gymnastics: "basica", benchWod: null, squat1rm: null, avoid: [] } });
    const p = planWeek("cross", i);
    expect([0, 2, 4]).not.toContain(p.slots.find((s) => s.kind === "fuerza")!.dow);
  });
});

describe("descarga y afinamiento", () => {
  const s = SEASONS_T1[0];
  it("semana 4 siempre; con evento, la semana del evento (y la anterior si cae al inicio)", () => {
    expect(taperWeeks(s, null)).toEqual([4]);
    expect(taperWeeks(s, "2026-12-26")).toEqual([4, 7]); // sábado de la semana 7
    expect(taperWeeks(s, "2026-12-22")).toEqual([4, 6, 7]); // martes de la semana 7: afina desde la 6
    expect(taperWeeks(s, "2027-03-01")).toEqual([4]); // fuera de la temporada
  });
});

describe("lo que gustó y lo que se cambia", () => {
  it("agrega votos, saltos y dificultad por ejercicio", () => {
    const rows = [
      ...Array.from({ length: 6 }, (_, k) => ({ exercise_id: "rdl", week: 1, liked: k < 5, difficulty: null, skipped: false, completed: true })),
      ...Array.from({ length: 6 }, (_, k) => ({ exercise_id: "ds:3361", week: 1, liked: k < 1, difficulty: k < 3 ? ("dificil" as const) : null, skipped: k >= 4, completed: k < 4 })),
    ];
    const st = aggregateFeedback(rows);
    expect(st[0]).toMatchObject({ id: "rdl", likes: 5, dislikes: 1 });
    const hop = st.find((s) => s.id === "ds:3361")!;
    expect(hop.hard).toBe(3);
    expect(hop.skipRate).toBeCloseTo(2 / 6);
    expect(toReplace(st)).toEqual(["ds:3361"]);
  });
  it("retención por semana", () => {
    expect(retention([[1, 2, 3], [1], [1, 2]], 3).map((r) => r.users)).toEqual([3, 2, 1]);
  });
  it("resumen anónimo del cuestionario", () => {
    const a = base({ running: { runDays: [6], longRunDay: 6, kmWeek: 20, paceDist: null, paceTime: null, target: "10k", surface: [], watch: "no" } });
    const b = base({ running: { runDays: [6], longRunDay: 6, kmWeek: 20, paceDist: null, paceTime: null, target: "21k", surface: [], watch: "reloj" } });
    const s = intakeSummary([a, a, b], "running") as ReturnType<typeof intakeSummary> & { target: { k: string; pct: number }[] };
    expect(s.target[0]).toMatchObject({ k: "10k" });
    expect(s.target[0].pct).toBeCloseTo(2 / 3);
  });
  it("la coach recibe sus respuestas", () => {
    const i = base({ eventDate: "2026-12-06", eventType: "10K", running: { runDays: [6], longRunDay: 6, kmWeek: 20, paceDist: null, paceTime: null, target: "10k", surface: [], watch: "no" } });
    expect(intakeForCoach("running", i, "2026-11-30")).toMatch(/faltan 6 días/);
  });
});

describe("marca", () => {
  // Contraste WCAG con blanco: acento como fondo con texto blanco o como texto sobre blanco.
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  it("cada acento pasa 4.5:1 con blanco; ninguno pasa sobre el amarillo banana (por eso no se usa ahí)", () => {
    for (const s of SPORT_IDS) {
      expect(ratio(SPORTS[s].accent, "#FFFFFF"), s).toBeGreaterThanOrEqual(4.5);
      expect(ratio(SPORTS[s].accent, "#1B1505"), s).toBeLessThan(4.5);
    }
  });
  it("nada de marcas registradas ni rayas largas en los textos", () => {
    const all = JSON.stringify(SPORTS);
    expect(all).not.toMatch(/crossfit/i);
    expect(all).not.toMatch(/—/);
  });
  it("cada zona tiene sus cambios", () => { for (const a of AREAS) expect(INJURY_SWAPS[a]).toBeTruthy(); });
});
