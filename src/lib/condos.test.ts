import { describe, expect, it } from "vitest";
import {
  condoCodeFromName, condoLapsed, condoLink, condoOffer, condoWhatsapp, decideJoin, endingNoticeDue, joinMessage, normalizeCondoCode, syncGrant,
  CONDO_FREE_DAYS, type CondoGrant, type CondoRow,
} from "./condos";
import { entitlementsFrom, type CompRow } from "./entitlements";
import { parseLead } from "./condominios";

const NOW = new Date("2026-10-25T12:00:00Z");
const inDays = (n: number) => new Date(NOW.getTime() + n * 864e5).toISOString();
const condo = (o: Partial<CondoRow> = {}): CondoRow => ({ id: 7, code: "las-palmas", name: "Las Palmas", status: "mes_gratis", free_ends_at: inDays(30), paid_plan: null, paid_until: null, ...o });
const grant = (o: Partial<CondoGrant> = {}): CondoGrant => ({ id: 1, plan: "completo", starts_at: inDays(-5), expires_at: inDays(25), revoked_at: null, ...o });

describe("código del enlace del condominio", () => {
  it("acepta minúsculas, números y guiones de 3 a 30 (igual que el CHECK de la base)", () => {
    expect(normalizeCondoCode("las-palmas")).toBe("las-palmas");
    expect(normalizeCondoCode("  Las-Palmas ")).toBe("las-palmas");
    expect(normalizeCondoCode("torre%2Dnorte")).toBe("torre-norte");
    expect(normalizeCondoCode("a1b")).toBe("a1b");
  });
  it("rechaza lo que no sirve como código", () => {
    for (const bad of ["ab", "-palmas", "palmas-", "las palmas", "<script>", "a".repeat(31), "ñandú", "%E0%A4%A", "", null, 5]) expect(normalizeCondoCode(bad)).toBeNull();
  });
  it("propone un código a partir del nombre (sin tildes ni palabras de relleno)", () => {
    expect(condoCodeFromName("Condominio Las Palmas")).toBe("las-palmas");
    expect(condoCodeFromName("Residencial Bosque de Escazú")).toBe("bosque-de-escazu");
    expect(condoCodeFromName("Torre 2")).toBe("torre-2");
    expect(normalizeCondoCode(condoCodeFromName("Condominio Ñ"))).not.toBeNull();
    expect(normalizeCondoCode(condoCodeFromName("X".repeat(80)))).not.toBeNull();
  });
  it("enlace y mensaje de WhatsApp con el enlace del condominio, sin emojis", () => {
    expect(condoLink("las-palmas")).toMatch(/\/c\/las-palmas$/);
    const m = condoWhatsapp({ name: "Las Palmas", code: "las-palmas" });
    expect(m).toContain("Las Palmas");
    expect(m).toContain("/c/las-palmas");
    expect(m).toContain("primer mes es gratis");
    expect(m).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(m).not.toContain("—");
  });
});

describe("qué da el enlace", () => {
  it("mes gratis: plan completo por 30 días desde que el residente lo activa", () => {
    expect(condoOffer(condo(), NOW)).toEqual({ plan: "completo", expiresAt: inDays(CONDO_FREE_DAYS), free: true });
  });
  it("activo: el plan que paga el condominio hasta la fecha pagada", () => {
    expect(condoOffer(condo({ status: "activo", paid_plan: "entreno", paid_until: inDays(60) }), NOW)).toEqual({ plan: "entreno", expiresAt: inDays(60), free: false });
  });
  it("terminado o activo vencido: el enlace no da nada", () => {
    expect(condoOffer(condo({ status: "terminado" }), NOW)).toBeNull();
    expect(condoOffer(condo({ status: "activo", paid_plan: "completo", paid_until: inDays(-1) }), NOW)).toBeNull();
    expect(condoLapsed(condo({ status: "activo", paid_plan: "completo", paid_until: inDays(-1) }), NOW)).toBe(true);
  });
});

describe("vincular una cuenta al condominio", () => {
  const base = { condo: condo(), memberOf: null, hadCondoGrant: false, hasPaidPlan: false, now: NOW };
  it("cuenta nueva o existente sin plan pagado: se vincula con el mes gratis", () => {
    expect(decideJoin(base)).toEqual({ kind: "join", plan: "completo", expiresAt: inDays(30), free: true });
  });
  it("un solo mes gratis por cuenta: volver a abrir el enlace no da otro", () => {
    expect(decideJoin({ ...base, memberOf: 7, hadCondoGrant: true })).toEqual({ kind: "ya_vinculado" });
    expect(decideJoin({ ...base, hadCondoGrant: true })).toEqual({ kind: "ya_usado" });
  });
  it("una cuenta en un solo condominio", () => {
    expect(decideJoin({ ...base, memberOf: 99, hadCondoGrant: true })).toEqual({ kind: "otro_condominio" });
  });
  it("con un plan pagado no se vincula y recibe un mensaje amable", () => {
    expect(decideJoin({ ...base, hasPaidPlan: true })).toEqual({ kind: "plan_pagado" });
    const m = joinMessage("plan_pagado", "Las Palmas");
    expect(m.body).toContain("plan pagado");
  });
  it("enlace inexistente o terminado: inactivo", () => {
    expect(decideJoin({ ...base, condo: null })).toEqual({ kind: "inactivo" });
    expect(decideJoin({ ...base, condo: condo({ status: "terminado" }) })).toEqual({ kind: "inactivo" });
  });
  it("el aviso de bienvenida nombra al condominio", () => {
    expect(joinMessage("join", "Las Palmas").title).toBe("Tu condominio Las Palmas te regala el primer mes");
  });
});

describe("acceso del residente (comp_grants source 'condominio')", () => {
  const row = (o: Partial<CompRow>): CompRow => ({ plan: "completo", previous_plan: null, starts_at: inDays(-5), expires_at: inDays(25), revoked_at: null, created_at: inDays(-5), source: "condominio", ...o });
  const base = { profilePlan: "free", role: "free", now: NOW, subs: [], betaEndsAt: "2000-01-01T00:00:00Z", createdAt: inDays(-40) };
  it("durante el mes gratis: todo incluido, sin pedir tarjeta", () => {
    const e = entitlementsFrom({ ...base, comps: [row({})] });
    expect(e).toMatchObject({ access: "comp", plan: "completo", app: true, nutrition: true, locked: false, cardStep: "none" });
  });
  it("con el condominio activo en Entreno: entreno sin nutrición hasta la fecha pagada", () => {
    const e = entitlementsFrom({ ...base, comps: [row({ plan: "entreno", expires_at: inDays(60) })] });
    expect(e).toMatchObject({ access: "comp", plan: "entreno", app: true, nutrition: false });
  });
  it("al vencer sin acuerdo: el acceso termina como una prueba (muro de planes)", () => {
    const e = entitlementsFrom({ ...base, comps: [row({ starts_at: inDays(-31), expires_at: inDays(-1), created_at: inDays(-31) })] });
    expect(e).toMatchObject({ app: false, locked: true });
  });
});

describe("barrido diario del condominio", () => {
  it("activo: pasa la cortesía al plan del condominio y a la fecha pagada (extiende, reactiva o acorta)", () => {
    const c = condo({ status: "activo", paid_plan: "entreno", paid_until: inDays(60) });
    expect(syncGrant(c, grant())).toEqual({ plan: "entreno", expires_at: inDays(60) });
    expect(syncGrant(c, grant({ expires_at: inDays(-3) }))).toEqual({ plan: "entreno", expires_at: inDays(60) });
    expect(syncGrant(condo({ status: "activo", paid_plan: "completo", paid_until: inDays(10) }), grant())).toEqual({ plan: "completo", expires_at: inDays(10) });
  });
  it("sin cambios si ya está igual, si está revocada o si el condominio no está activo", () => {
    const c = condo({ status: "activo", paid_plan: "completo", paid_until: inDays(25) });
    expect(syncGrant(c, grant())).toBeNull();
    expect(syncGrant(condo({ status: "activo", paid_plan: "entreno", paid_until: inDays(60) }), grant({ revoked_at: inDays(-1) }))).toBeNull();
    expect(syncGrant(condo(), grant())).toBeNull();
    expect(syncGrant(condo({ status: "terminado", paid_plan: "completo", paid_until: inDays(90) }), grant())).toBeNull();
  });
  it("nunca deja una fecha de fin antes del inicio (CHECK de comp_grants)", () => {
    expect(syncGrant(condo({ status: "activo", paid_plan: "completo", paid_until: inDays(-10) }), grant({ starts_at: inDays(-5) }))).toBeNull();
  });
  it("aviso 3 días antes del fin del mes gratis, una vez, si el condominio no lo extiende", () => {
    const g = grant({ expires_at: inDays(2) });
    expect(endingNoticeDue(condo(), g, null, NOW)).toBe(true);
    expect(endingNoticeDue(condo(), g, inDays(-1), NOW)).toBe(false);
    expect(endingNoticeDue(condo(), grant({ expires_at: inDays(5) }), null, NOW)).toBe(false);
    expect(endingNoticeDue(condo(), grant({ expires_at: inDays(-1) }), null, NOW)).toBe(false);
    expect(endingNoticeDue(condo({ status: "activo", paid_plan: "completo", paid_until: inDays(40) }), g, null, NOW)).toBe(false);
  });
});

describe("solicitud de reunión: cuántos condominios administran", () => {
  it("es opcional y se limpia a 40 caracteres", () => {
    const f = { name: "Laura Mora", role: "administrador", org: "Las Palmas", email: "laura@ejemplo.com" };
    const a = parseLead(f);
    expect(a.ok && a.lead.portfolio).toBe(null);
    const b = parseLead({ ...f, portfolio: "  Sí, <b>4</b> condominios " + "x".repeat(60) });
    expect(b.ok && b.lead.portfolio).toBe(("Sí, 4 condominios " + "x".repeat(60)).slice(0, 40));
  });
});
