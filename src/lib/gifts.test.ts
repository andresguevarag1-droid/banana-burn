import { describe, expect, it } from "vitest";
import { addMonths, compChainEnd, compGivesNutrition, compPlan, coveredUntil, giftStatus, giftTitle, giftWindow, toGiftView, type CoverComp } from "./gifts";

const NOW = new Date("2026-12-10T12:00:00Z");
const d = (n: number) => new Date(NOW.getTime() + n * 864e5).toISOString();
const PAST_BETA = "2026-11-01T06:00:00.000Z";
const gift = (o: Partial<CoverComp>): CoverComp => ({ plan: "completo", source: "regalo", starts_at: d(-1), expires_at: d(30), revoked_at: null, ...o });

describe("meses como Postgres", () => {
  it("suma meses manteniendo el día", () => expect(addMonths("2026-01-15T10:00:00Z", 3).toISOString()).toBe("2026-04-15T10:00:00.000Z"));
  it("31 de enero + 1 mes = último día de febrero", () => {
    expect(addMonths("2026-01-31T10:00:00Z", 1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addMonths("2028-01-31T10:00:00Z", 1).toISOString()).toBe("2028-02-29T10:00:00.000Z");
  });
  it("cruza de año", () => expect(addMonths("2026-11-30T00:00:00Z", 12).toISOString()).toBe("2027-11-30T00:00:00.000Z"));
});

describe("apilar regalos (espejo de _access_covered_until)", () => {
  const base = { now: NOW, betaEndsAt: PAST_BETA, createdAt: d(-60) };
  it("sin acceso: empieza hoy", () => {
    const w = giftWindow({ ...base, plan: "completo", months: 3 });
    expect(w.startsAt).toBe(NOW.toISOString());
    expect(w.expiresAt).toBe(addMonths(NOW, 3).toISOString());
  });
  it("en su prueba de 7 días: empieza cuando termina la prueba (no se pierden días)", () => {
    const w = giftWindow({ ...base, createdAt: d(-2), plan: "entreno", months: 1 });
    expect(w.startsAt).toBe(d(5));
  });
  it("durante la beta: empieza cuando termina la beta", () => {
    const now = new Date("2026-10-20T12:00:00Z");
    expect(coveredUntil({ now, plan: "completo", createdAt: "2026-09-01T00:00:00Z", betaEndsAt: PAST_BETA }).toISOString()).toBe(PAST_BETA);
  });
  it("con un regalo vigente: el nuevo empieza cuando termina el anterior", () => {
    const first = giftWindow({ ...base, plan: "completo", months: 3 });
    const comps = [gift({ starts_at: first.startsAt, expires_at: first.expiresAt })];
    const second = giftWindow({ ...base, plan: "entreno", months: 1, comps });
    expect(second.startsAt).toBe(first.expiresAt);
    expect(second.expiresAt).toBe(addMonths(first.expiresAt, 1).toISOString());
  });
  it("un regalo de Entreno no cubre uno de Entreno + Nutrición (el completo empieza ya)", () => {
    const comps = [gift({ plan: "entreno", expires_at: d(40) })];
    expect(coveredUntil({ ...base, plan: "completo", comps }).toISOString()).toBe(NOW.toISOString());
    expect(coveredUntil({ ...base, plan: "entreno", comps }).toISOString()).toBe(d(40));
  });
  it("una cortesía de siempre cuenta como completo", () => {
    expect(coveredUntil({ ...base, plan: "completo", comps: [gift({ plan: "entreno", source: "cortesia", expires_at: d(12) })] }).toISOString()).toBe(d(12));
  });
  it("suscripción pagada vigente: empieza al terminar el periodo pagado", () => {
    const subs = [{ plan: "completo", status: "active", current_period_end: d(20) }];
    expect(giftWindow({ ...base, plan: "completo", months: 2, subs }).startsAt).toBe(d(20));
  });
  it("suscripción cancelada al final del periodo también cubre; vencida o pendiente no", () => {
    expect(coveredUntil({ ...base, plan: "entreno", subs: [{ plan: "entreno", status: "canceled", cancel_at_period_end: true, current_period_end: d(9) }] }).toISOString()).toBe(d(9));
    expect(coveredUntil({ ...base, plan: "entreno", subs: [{ plan: "entreno", status: "incomplete", current_period_end: d(9) }] }).toISOString()).toBe(NOW.toISOString());
    expect(coveredUntil({ ...base, plan: "entreno", subs: [{ plan: "entreno", status: "active", current_period_end: d(-1) }] }).toISOString()).toBe(NOW.toISOString());
  });
  it("revocados no cubren", () => {
    expect(coveredUntil({ ...base, plan: "completo", comps: [gift({ expires_at: d(50), revoked_at: d(-1) })] }).toISOString()).toBe(NOW.toISOString());
  });
});

describe("estado y cadena de regalos", () => {
  it("estado: programado, activo, terminado, revocado", () => {
    expect(giftStatus({ starts_at: d(2), expires_at: d(30), revoked_at: null }, NOW)).toBe("programado");
    expect(giftStatus({ starts_at: d(-2), expires_at: d(30), revoked_at: null }, NOW)).toBe("activo");
    expect(giftStatus({ starts_at: d(-40), expires_at: d(-10), revoked_at: null }, NOW)).toBe("terminado");
    expect(giftStatus({ starts_at: d(-2), expires_at: d(30), revoked_at: d(-1) }, NOW)).toBe("revocado");
  });
  it("fin del acceso continuo: sigue la cadena de regalos apilados", () => {
    const comps = [gift({ starts_at: d(-5), expires_at: d(10) }), gift({ starts_at: d(10), expires_at: d(40) }), gift({ starts_at: d(60), expires_at: d(90) })];
    expect(compChainEnd(comps, NOW)).toBe(d(40));
  });
  it("sin nada vigente no hay fin", () => expect(compChainEnd([gift({ starts_at: d(3) })], NOW)).toBeUndefined());
  it("plan efectivo: cortesía = completo; regalo = su plan", () => {
    expect(compPlan({ plan: "entreno", source: "cortesia" })).toBe("completo");
    expect(compPlan({ plan: "entreno" })).toBe("completo");
    expect(compPlan({ plan: "entreno", source: "regalo" })).toBe("entreno");
    expect(compGivesNutrition({ plan: "completo", source: "referido" })).toBe(true);
  });
  it("títulos en español neutro", () => {
    expect(giftTitle({ months: 3, plan: "completo", source: "regalo" })).toBe("Te regalaron 3 meses de Entreno + Nutrición");
    expect(giftTitle({ months: 1, plan: "entreno", source: "referido" })).toBe("Ganaste 1 mes de Entreno");
  });
  it("lo que llega al navegador no trae motivo interno ni quién lo dio", () => {
    const v = toGiftView({ id: 7, source: "regalo", plan: "completo", months: 3, message: "Gracias", starts_at: d(-1), expires_at: d(90), revoked_at: null, reason: "interno", granted_by: "uuid-admin" } as never, NOW);
    expect(Object.keys(v).sort()).toEqual(["expiresAt", "id", "message", "months", "plan", "source", "startsAt", "status", "title"]);
    expect(JSON.stringify(v)).not.toMatch(/interno|uuid-admin/);
  });
});
