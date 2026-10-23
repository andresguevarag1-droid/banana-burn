import { describe, expect, it } from "vitest";
import { daysLeftLabel, demoTesterRows, feedbackError, feedbackPage, testerDaysLeft, testerNoticeDue, testerState, TESTER_DAYS, type TesterGrantRow } from "./testers";
import { badges } from "./gamify";
import { entitlementsFrom, type CompRow } from "./entitlements";

const NOW = new Date("2026-11-20T15:00:00Z");
const DAY = 864e5;
const at = (d: number) => new Date(NOW.getTime() + d * DAY).toISOString();
const grant = (o: Partial<TesterGrantRow> = {}): TesterGrantRow => ({ id: 1, starts_at: at(-5), expires_at: at(TESTER_DAYS - 5), revoked_at: null, seen_at: at(-5), notified_at: at(-5), ...o });

describe("estado de tester", () => {
  it("sin asignaciones: ninguno y sin medalla", () => {
    expect(testerState([], NOW)).toMatchObject({ phase: "ninguno", daysLeft: 0, ever: false, unseenId: null });
  });
  it("vigente: días que quedan, avance del mes y ya vista", () => {
    const s = testerState([grant()], NOW);
    expect(s.phase).toBe("activo");
    expect(s.daysLeft).toBe(25);
    expect(s.used).toBeCloseTo(5 / 30, 3);
    expect(s.until).toBe(at(25));
    expect(s.unseenId).toBeNull();
    expect(s.ever).toBe(true);
  });
  it("recién asignada y sin ver: pide la bienvenida", () => {
    expect(testerState([grant({ id: 7, starts_at: at(-0.01), expires_at: at(TESTER_DAYS - 0.01), seen_at: null })], NOW).unseenId).toBe(7);
  });
  it("faltando 3 días o menos: aviso amable", () => {
    expect(testerState([grant({ starts_at: at(-27), expires_at: at(3) })], NOW).phase).toBe("pronto");
    expect(testerState([grant({ starts_at: at(-26), expires_at: at(4) })], NOW).phase).toBe("activo");
    expect(testerState([grant({ starts_at: at(-29.9), expires_at: at(0.1) })], NOW).daysLeft).toBe(1);
  });
  it("terminó hace poco: agradecimiento; hace mucho: ninguno, pero conserva la medalla", () => {
    expect(testerState([grant({ starts_at: at(-31), expires_at: at(-1) })], NOW)).toMatchObject({ phase: "terminado", daysLeft: 0, until: at(-1) });
    expect(testerState([grant({ starts_at: at(-40), expires_at: at(-10) })], NOW)).toMatchObject({ phase: "ninguno", ever: true });
  });
  it("quitado por un admin: sin agradecimiento", () => {
    expect(testerState([grant({ revoked_at: at(-1), end_kind: "quitado" })], NOW).phase).toBe("ninguno");
  });
  it("renovado: cuenta la asignación nueva, no la cerrada", () => {
    const rows = [grant({ id: 2, starts_at: at(-1), expires_at: at(29), renewal: true }), grant({ id: 1, starts_at: at(-20), expires_at: at(10), revoked_at: at(-1), end_kind: "renovado" })];
    expect(testerState(rows, NOW)).toMatchObject({ phase: "activo", daysLeft: 29, renewal: true });
  });
  it("días y etiquetas", () => {
    expect(testerDaysLeft(at(0.2), NOW)).toBe(1);
    expect(testerDaysLeft(at(-0.2), NOW)).toBe(0);
    expect(testerDaysLeft(null, NOW)).toBe(0);
    expect(daysLeftLabel(30)).toBe("30 días");
    expect(daysLeftLabel(1)).toBe("Último día");
  });
});

describe("avisos de tester (una vez por etapa)", () => {
  it("asignado sin avisar: correo y push", () => {
    expect(testerNoticeDue(grant({ notified_at: null }), NOW)).toBe("asignado");
  });
  it("3 días antes del final, una sola vez", () => {
    const g = grant({ starts_at: at(-28), expires_at: at(2) });
    expect(testerNoticeDue(g, NOW)).toBe("pronto");
    expect(testerNoticeDue({ ...g, soon_notified_at: at(-0.1) }, NOW)).toBeNull();
    expect(testerNoticeDue(grant(), NOW)).toBeNull();
  });
  it("al terminar: agradecimiento, salvo que haya renovado o sea muy viejo", () => {
    const g = grant({ starts_at: at(-31), expires_at: at(-1) });
    expect(testerNoticeDue(g, NOW)).toBe("terminado");
    expect(testerNoticeDue(g, NOW, true)).toBeNull();
    expect(testerNoticeDue({ ...g, ended_notified_at: at(-0.5) }, NOW)).toBeNull();
    expect(testerNoticeDue(grant({ starts_at: at(-50), expires_at: at(-20) }), NOW)).toBeNull();
  });
  it("cerrada (quitada o renovada): nada", () => {
    expect(testerNoticeDue(grant({ notified_at: null, revoked_at: at(-1), end_kind: "quitado" }), NOW)).toBeNull();
  });
});

describe("Reportar algo", () => {
  it("valida tipo y largo", () => {
    expect(feedbackError("error", "El botón no responde")).toBeNull();
    expect(feedbackError("queja", "algo pasó")).toMatch(/Elige/);
    expect(feedbackError("idea", "  a ")).toMatch(/un poco más/);
    expect(feedbackError("otro", "x".repeat(1001))).toMatch(/1\.000|1,000/);
  });
  it("solo guarda rutas internas, sin consulta", () => {
    expect(feedbackPage("/app/entrenar?x=1#y")).toBe("/app/entrenar");
    expect(feedbackPage("https://malo.com")).toBeNull();
    expect(feedbackPage("javascript:alert(1)")).toBeNull();
    expect(feedbackPage(null)).toBeNull();
  });
});

describe("demo y medalla", () => {
  it("estados de ejemplo del demo", () => {
    expect(testerState(demoTesterRows("demo", NOW), NOW)).toMatchObject({ phase: "activo", daysLeft: 30, unseenId: -1 });
    expect(testerState(demoTesterRows("pronto", NOW), NOW).phase).toBe("pronto");
    expect(testerState(demoTesterRows("fin", NOW), NOW).phase).toBe("terminado");
    expect(demoTesterRows(null, NOW)).toEqual([]);
  });
  it("medalla Tester beta solo para quien lo fue", () => {
    const base = { workouts: 3, streak: 2, prs: 1, weighIns: 2, lostKg: 1 };
    expect(badges(base).some((b) => b.id === "tester")).toBe(false);
    expect(badges({ ...base, tester: true }).find((b) => b.id === "tester")).toMatchObject({ got: true, n: "Tester beta" });
  });
});

describe("acceso del mes de tester (comp_grants con origen tester)", () => {
  const beta = "2026-11-01T06:00:00Z"; // NOW es después del fin de la beta
  const testerComp = (o: Partial<CompRow> = {}): CompRow => ({ plan: "completo", previous_plan: "free", starts_at: at(-5), expires_at: at(25), revoked_at: null, created_at: at(-5), source: "tester", ...o });
  const base = { profilePlan: "free", role: "free", createdAt: "2026-09-01T12:00:00Z", subs: [], now: NOW, betaEndsAt: beta };
  it("después de la beta, sin tarjeta: Entreno + Nutrición mientras dura", () => {
    const e = entitlementsFrom({ ...base, comps: [testerComp()] });
    expect(e).toMatchObject({ app: true, nutrition: true, locked: false, plan: "completo", access: "comp" });
  });
  it("al vencer vuelve a las reglas normales (cuenta de la beta sin plan: muro)", () => {
    const e = entitlementsFrom({ ...base, comps: [testerComp({ starts_at: at(-31), expires_at: at(-1) })] });
    expect(e).toMatchObject({ app: false, locked: true, plan: "free" });
  });
  it("quitado: sin acceso", () => {
    expect(entitlementsFrom({ ...base, comps: [testerComp({ revoked_at: at(-1) })] }).locked).toBe(true);
  });
});

describe("cobro aplazado por el mes de tester (copy honesta)", async () => {
  const { chargeView, chargeMoved, reminderLine } = await import("./trial");
  const { recordatorioCobro, testerAsignado } = await import("./email/templates");
  const row = { id: 1, user_id: "u", idem_key: "trial:u", kind: "beta" as const, plan: "completo" as const, billing: "mes" as const, amount_minor: 1499, trial_started_at: at(-30), trial_ends_at: at(-20), charge_at: at(10), next_attempt_at: at(10), status: "scheduled" as const, attempts: 0, last_attempt_at: null, provider_subscription_id: null, last_error: null, reminder_sent_at: null, failure_notified_attempt: null, canceled_at: null, created_at: at(-30), updated_at: at(-1), moved_from: at(-20), tester_hold: true };
  it("la vista sabe que está aplazado por tester y que se movió", () => {
    expect(chargeView(row, NOW)).toMatchObject({ testerHold: true, moved: true, daysToCharge: 10 });
    expect(chargeView({ ...row, tester_hold: false }, NOW)).toMatchObject({ testerHold: false, moved: true });
    expect(chargeView({ ...row, tester_hold: null, moved_from: null }, NOW)).toMatchObject({ testerHold: false, moved: false });
  });
  it("por qué se movió", () => {
    expect(chargeMoved(row)).toBe("tester");
    expect(chargeMoved({ ...row, tester_hold: false })).toBe("ajustado");
    expect(chargeMoved(null)).toBeNull();
  });
  it("aviso de 2 días antes: dice que termina el mes de tester, con la fecha, sin hablar del día 7", () => {
    expect(reminderLine(14.99, "prueba", "22 de noviembre", "tester")).toBe("Tu mes de tester termina en 2 días. El 22 de noviembre se cobra tu plan de $14.99. Puedes cancelar sin costo antes de esa fecha.");
    expect(reminderLine(14.99, "prueba", "22 de noviembre", "ajustado")).not.toMatch(/día 7/);
    const e = recordatorioCobro({ name: "Ana", plan: "Entreno + Nutrición", amount: 14.99, chargeAt: "2026-11-22T18:00:00Z", kind: "prueba", moved: "tester" });
    expect(e.text).toContain("Tu mes de tester termina en 2 días");
    expect(e.text).not.toMatch(/día 7/);
  });
  it("el correo de tester avisa que el cobro pasa al final del mes", () => {
    const e = testerAsignado({ name: "Ana", expiresAt: "2026-11-22T18:00:00Z", charge: { amount: 14.99, chargeAt: "2026-11-22T18:00:00Z" } });
    expect(e.text).toContain("Tu cobro programado pasa al final de tu mes de tester");
    expect(e.text).toContain("22 de noviembre de 2026");
    expect(testerAsignado({ name: "Ana", expiresAt: "2026-11-22T18:00:00Z" }).text).not.toContain("cobro programado");
  });
});
