import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { COACH_LIMITS, COACH_LOW_AT, COACH_MAX_TOKENS, coachPlanFeat, demoQuota, limitsFor, nextCrMidnight, nextCrMonth, parseQuota, quotaFrom, quotaLine, resetLabel, tierFromAccess } from "./coach-quota";
import { PLANS } from "./plans";
import { coachSystem, coachSystemBlocks, HISTORY, sanitizeMessages } from "./coach";
import type { Athlete } from "./athlete";

const T = new Date("2026-10-23T18:00:00Z"); // 12:00 m. en Costa Rica

describe("límites del coach", () => {
  it("son los mismos en la base (0032 _coach_limits)", () => {
    const sql = readFileSync(new URL("../../supabase/migrations/0032_coach_cuota.sql", import.meta.url), "utf8");
    const fn = sql.slice(sql.indexOf("function public._coach_limits"), sql.indexOf("$$;", sql.indexOf("function public._coach_limits")));
    const [dayCase, monthCase] = fn.split("\n").filter((l) => l.includes("case p_tier"));
    const read = (line: string, tier: string) => { const m = line.match(new RegExp(`when '${tier}' then (\\w+)`)); return m![1] === "null" ? null : Number(m![1]); };
    for (const tier of ["prueba", "entreno", "completo", "staff"] as const) {
      expect(read(dayCase, tier), tier).toBe(COACH_LIMITS[tier].day);
      expect(read(monthCase, tier), tier).toBe(COACH_LIMITS[tier].month);
    }
  });
  it("los valores que pidió el dueño", () => {
    expect(COACH_LIMITS.entreno).toEqual({ day: 10, month: 150 });
    expect(COACH_LIMITS.completo).toEqual({ day: 20, month: 300 });
    expect(COACH_LIMITS.prueba.day).toBe(10);
    expect(COACH_LIMITS.staff).toEqual({ day: null, month: null });
    expect(limitsFor("none")).toEqual({ day: 0, month: 0 });
    // Nunca más preguntas en prueba que pagando Entreno.
    expect(COACH_LIMITS.prueba.day!).toBeLessThanOrEqual(COACH_LIMITS.entreno.day!);
    expect(COACH_MAX_TOKENS).toBeGreaterThanOrEqual(500);
    expect(COACH_MAX_TOKENS).toBeLessThanOrEqual(600);
  });
});

describe("nivel de cupo según el acceso (igual que _coach_tier)", () => {
  it("elige el nivel", () => {
    expect(tierFromAccess({ app: false, nutrition: false, access: "none", plan: "free" })).toBe("none");
    expect(tierFromAccess({ app: true, nutrition: true, access: "staff", plan: "completo" })).toBe("staff");
    expect(tierFromAccess({ app: true, nutrition: true, access: "trial", plan: "free" })).toBe("prueba");
    expect(tierFromAccess({ app: true, nutrition: false, access: "subscription", plan: "entreno" })).toBe("entreno");
    expect(tierFromAccess({ app: true, nutrition: true, access: "comp", plan: "completo" })).toBe("completo");
  });
});

describe("estado del cupo", () => {
  it("restantes, tope del día y del mes", () => {
    expect(quotaFrom("entreno", 3, 40, T)).toMatchObject({ left: 7, reason: null, dayLimit: 10, monthLimit: 150 });
    expect(quotaFrom("entreno", 10, 40, T)).toMatchObject({ left: 0, reason: "day", resetsAt: "2026-10-24T06:00:00.000Z" });
    expect(quotaFrom("entreno", 2, 150, T)).toMatchObject({ left: 0, reason: "month", resetsAt: "2026-11-01T06:00:00.000Z" });
    expect(quotaFrom("entreno", 2, 145, T).left).toBe(5); // el mes manda cuando queda menos
    expect(quotaFrom("completo", 25, 25, T).left).toBe(0);
    expect(quotaFrom("staff", 500, 9000, T)).toMatchObject({ left: null, reason: null, resetsAt: null });
    expect(quotaFrom("none", 0, 0, T)).toMatchObject({ left: 0, reason: "locked" });
  });
  it("lee el jsonb de la base y rechaza lo raro", () => {
    const q = parseQuota({ ok: true, tier: "completo", day_used: 5, month_used: 50, ticket: "0b8f7a9e-2a51-4c55-9b0e-3d2b9f1f2c11", now: T.toISOString() });
    expect(q).toMatchObject({ ok: true, tier: "completo", left: 15, ticket: "0b8f7a9e-2a51-4c55-9b0e-3d2b9f1f2c11" });
    expect(parseQuota({ ok: true, tier: "vip", day_used: 1 })).toBeNull();
    expect(parseQuota(null)).toBeNull();
    expect(parseQuota({ tier: "entreno", day_used: "x", ticket: "'; drop" })).toMatchObject({ dayUsed: 0, ticket: null, ok: false });
  });
  it("cortes de Costa Rica", () => {
    expect(nextCrMidnight(new Date("2026-10-23T05:59:00Z"))).toBe("2026-10-23T06:00:00.000Z");
    expect(nextCrMidnight(new Date("2026-10-23T06:00:00Z"))).toBe("2026-10-24T06:00:00.000Z");
    expect(nextCrMonth(new Date("2026-12-31T23:00:00Z"))).toBe("2027-01-01T06:00:00.000Z");
    expect(nextCrMonth(new Date("2026-11-01T05:00:00Z"))).toBe("2026-11-01T06:00:00.000Z");
  });
  it("cuándo vuelve, en la hora de la persona", () => {
    const at = "2026-10-24T06:00:00.000Z";
    expect(resetLabel(at, "day", T, "America/Costa_Rica")).toMatch(/^mañana a las 12:00\sa/);
    expect(resetLabel(at, "day", T, "America/Bogota")).toMatch(/^mañana a la 1:00\sa/);
    expect(resetLabel(at, "day", T, "America/Tijuana")).toMatch(/^hoy a las 11:00\sp/);
    expect(resetLabel("2026-11-01T06:00:00.000Z", "month", T, "America/Costa_Rica")).toBe("el 1 de noviembre");
  });
  it("contador discreto y visible desde 3", () => {
    expect(quotaLine({ left: 8, reason: null })).toEqual({ text: "Te quedan 8 preguntas hoy", tone: "quiet" });
    expect(quotaLine({ left: COACH_LOW_AT, reason: null })?.tone).toBe("low");
    expect(quotaLine({ left: 1, reason: null })?.text).toBe("Te queda 1 pregunta hoy");
    expect(quotaLine({ left: 0, reason: "day" })?.tone).toBe("out");
    expect(quotaLine({ left: null, reason: null })).toBeNull();
    for (const l of [0, 1, 2, 3, 10]) expect(quotaLine({ left: l, reason: l ? null : "month" })!.text).not.toMatch(/—|·|IA\b/);
  });
  it("estados simulados del modo demo", () => {
    expect(demoQuota(undefined, "completo", T).left).toBe(20);
    expect(demoQuota("bajo", "entreno", T).left).toBe(2);
    expect(demoQuota("agotado", "entreno", T)).toMatchObject({ left: 0, reason: "day" });
    expect(demoQuota("mes", "entreno", T)).toMatchObject({ left: 0, reason: "month" });
  });
});

describe("planes con los números reales", () => {
  it("cada plan dice su cupo del coach", () => {
    const [e, c] = PLANS;
    expect(e.feats).toContain(coachPlanFeat("entreno"));
    expect(c.feats).toContain(coachPlanFeat("completo"));
    expect(coachPlanFeat("entreno")).toBe("Coach Banana para tus dudas de entreno: hasta 10 preguntas al día y 150 al mes");
    expect(coachPlanFeat("completo")).toBe("Coach Banana también para tu comida: hasta 20 preguntas al día y 300 al mes");
    for (const p of PLANS) expect(p.feats.join(" ")).not.toMatch(/24\/7|ilimitad|IA\b|inteligencia artificial|—/);
  });
});

describe("tokens del coach", () => {
  const a = { name: "Ana", dob: "1995-01-01", heightCm: 165, startWeight: 80, currentWeight: 78, goalWeight: 68, goalDate: "2027-03-01", startDate: "2026-10-01", mode: "acelerada", complete: true, trainDays: 4, sex: "f", equipment: "gym", level: "intermedio", minutes: null, country: "CR", glp1: { on: false, med: "otro", injectionDow: null, since: null } } as unknown as Athlete;
  it("historial: últimos mensajes, recortados y con tope total", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `${i} ` + "y".repeat(3000) }));
    const cut = sanitizeMessages(many);
    expect(cut.length).toBeLessThanOrEqual(HISTORY.messages);
    expect(cut.reduce((s, m) => s + m.content.length, 0)).toBeLessThanOrEqual(HISTORY.totalChars);
    expect(cut[0].role).toBe("user");
    expect(cut.at(-1)!.content).toHaveLength(HISTORY.lastChars); // la pregunta actual llega casi completa
    expect(cut.at(-1)!.content.startsWith("29 ")).toBe(true);
    for (const m of cut.slice(0, -1)) expect(m.content.length).toBeLessThanOrEqual(HISTORY.oldChars);
  });
  it("historial corto: no cambia nada", () => {
    const few = [{ role: "user", content: "hola" }, { role: "assistant", content: "¡Hola!" }, { role: "user", content: "¿qué ceno?" }];
    expect(sanitizeMessages(few)).toEqual(few);
  });
  it("las reglas van en un bloque en caché, igual para todos los atletas del mismo plan", () => {
    const b1 = coachSystemBlocks(a, [], [], { nutrition: false });
    const b2 = coachSystemBlocks({ ...a, name: "Beto", currentWeight: 95 }, [], [], { nutrition: false });
    expect(b1[0].cache_control).toEqual({ type: "ephemeral" });
    expect(b1[0].text).toBe(b2[0].text);
    expect(b1[0].text).not.toContain("Ana");
    expect(b1[1].text).toContain("<datos_atleta>");
    expect(b1[1]).not.toHaveProperty("cache_control");
    expect(coachSystemBlocks(a, [], [], { nutrition: true })[0].text).not.toBe(b1[0].text);
    expect(coachSystem(a, [], [], { nutrition: false })).toBe(`${b1[0].text}\n\n${b1[1].text}`);
  });
  it("el prompt no está inflado", () => {
    for (const nutrition of [true, false]) {
      const [rules, data] = coachSystemBlocks(a, [], [], { nutrition });
      // ~3,4 caracteres por token en español: reglas < 1.400 tokens (cacheables: > 1.024), datos < 600.
      expect(rules.text.length).toBeGreaterThan(3000);
      expect(rules.text.length).toBeLessThan(4800);
      expect(data.text.length).toBeLessThan(2000);
    }
  });
});
