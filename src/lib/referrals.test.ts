import { describe, expect, it } from "vitest";
import {
  annualPaid, ipPrefix, monthsEarned, normalizeCode, normEmail, referralLabel, referralLink, referralProgress, revokeReward, settle, shareMessage, simMonths,
  REF_MAX_REWARDS_YEAR, type SimRef, type SimState,
} from "./referrals";

const NOW = Date.parse("2026-12-10T12:00:00Z");
const q = (id: number, o: Partial<SimRef> = {}): SimRef => ({ id, status: "calificado", qualifiedAt: NOW - (100 - id) * 1000, annual: false, group: null, ...o });
const st = (refs: SimRef[]): SimState => ({ refs, rewards: [] });

describe("código y enlace", () => {
  it("acepta 8 caracteres sin ambiguos, sin distinguir mayúsculas", () => {
    expect(normalizeCode(" AbCd2345 ")).toBe("abcd2345");
    expect(normalizeCode("abcd234")).toBeNull();
    expect(normalizeCode("abcd0345")).toBeNull(); // 0
    expect(normalizeCode("abcdl345")).toBeNull(); // l
    expect(normalizeCode("abc'; --")).toBeNull();
    expect(normalizeCode(undefined)).toBeNull();
  });
  it("enlace y mensaje para compartir", () => {
    expect(referralLink("https://bananaburn.app/", "abcd2345")).toBe("https://bananaburn.app/r/abcd2345");
    expect(shareMessage("https://x/r/abcd2345")).toContain("https://x/r/abcd2345");
    expect(shareMessage("x")).not.toMatch(/\bIA\b|inteligencia artificial/i);
  });
});

describe("señales anti abuso", () => {
  it("correo normalizado: misma bandeja con alias, puntos de Gmail o googlemail", () => {
    expect(normEmail("Rita.Gomez+banana@GoogleMail.com")).toBe(normEmail("ritagomez@gmail.com"));
    expect(normEmail("ana+1@hotmail.com")).toBe("ana@hotmail.com");
    expect(normEmail("a.na@hotmail.com")).not.toBe(normEmail("ana@hotmail.com")); // los puntos solo se ignoran en Gmail
  });
  it("prefijo de red: /24 en IPv4 y /48 en IPv6; locales no cuentan", () => {
    expect(ipPrefix("201.204.33.17")).toBe("201.204.33.0/24");
    expect(ipPrefix("::ffff:201.204.33.99")).toBe("201.204.33.0/24");
    expect(ipPrefix("2800:860:1234:5678::1")).toBe("2800:860:1234::/48");
    expect(ipPrefix("192.168.1.5")).toBeNull();
    expect(ipPrefix("10.0.0.1")).toBeNull();
    expect(ipPrefix("local")).toBeNull();
    expect(ipPrefix("999.1.1.1")).toBeNull();
  });
});

describe("recompensas: grupos de 3", () => {
  it("3 calificados = 1 mes", () => {
    const s = settle(st([q(1), q(2), q(3)]), NOW);
    expect(s.rewards).toHaveLength(1);
    expect(s.rewards[0]).toMatchObject({ group: 1, months: 1 });
    expect(simMonths(s)).toBe(1);
  });
  it("2 calificados no pagan; registrados, en revisión o descartados no cuentan", () => {
    const s = settle(st([q(1), q(2), q(3, { status: "registrado" }), q(4, { status: "sospechoso" }), q(5, { status: "descartado" })]), NOW);
    expect(s.rewards).toHaveLength(0);
  });
  it("7 calificados = 2 grupos (2 meses) y 1 esperando", () => {
    const s = settle(st([1, 2, 3, 4, 5, 6, 7].map((i) => q(i))), NOW);
    expect(s.rewards.map((w) => w.months)).toEqual([1, 1]);
    expect(s.refs.filter((r) => r.group == null && r.status === "calificado")).toHaveLength(1);
  });
  it("se agrupan por orden de calificación", () => {
    const s = settle(st([q(1, { qualifiedAt: 30 }), q(2, { qualifiedAt: 10 }), q(3, { qualifiedAt: 20 }), q(4, { qualifiedAt: 5 })]), NOW);
    expect(s.refs.filter((r) => r.group === 1).map((r) => r.id).sort()).toEqual([2, 3, 4]);
  });
  it("liquidar dos veces no paga de nuevo", () => {
    const once = settle(st([q(1), q(2), q(3)]), NOW);
    expect(settle(once, NOW).rewards).toHaveLength(1);
  });
  it("tope de 12 recompensas por año", () => {
    const s = settle(st(Array.from({ length: 3 * (REF_MAX_REWARDS_YEAR + 2) }, (_, i) => q(i + 1))), NOW);
    expect(s.rewards).toHaveLength(REF_MAX_REWARDS_YEAR);
  });
});

describe("recompensas: plan anual = trimestre", () => {
  it("si alguien del grupo ya compró anual, el grupo da 3 meses", () => {
    const s = settle(st([q(1), q(2, { annual: true }), q(3)]), NOW);
    expect(s.rewards[0].months).toBe(3);
    expect(simMonths(s)).toBe(3);
  });
  it("compra anual después: el grupo sube de 1 a 3 meses una sola vez", () => {
    const s0 = settle(st([q(1), q(2), q(3)]), NOW);
    const a = annualPaid(s0, 2, NOW);
    expect(a.result).toBe("trimestre");
    expect(simMonths(a.state)).toBe(3);
    // La renovación del año siguiente no suma.
    expect(annualPaid(a.state, 2, NOW).result).toBe("sin_cambio");
    // Otra persona del mismo grupo también compra anual: no se cuenta doble.
    const b = annualPaid(a.state, 3, NOW);
    expect(b.result).toBe("sin_cambio");
    expect(simMonths(b.state)).toBe(3);
  });
  it("dos compras anuales en el mismo grupo antes de completarse: 3 meses, no 6", () => {
    let s = st([q(1), q(2, { status: "registrado" }), q(3, { status: "registrado" })]);
    s = annualPaid(s, 2, NOW).state;
    s = annualPaid(s, 3, NOW).state;
    s = { ...s, refs: s.refs.map((r) => ({ ...r, status: "calificado" as const })) };
    s = settle(s, NOW);
    expect(s.rewards.map((w) => w.months)).toEqual([3]);
    expect(simMonths(s)).toBe(3);
  });
  it("la compra anual cuenta solo para su grupo", () => {
    let s = settle(st([1, 2, 3, 4, 5, 6].map((i) => q(i))), NOW);
    s = annualPaid(s, 5, NOW).state;
    expect(s.rewards.map((w) => w.months)).toEqual([1, 3]);
    expect(simMonths(s)).toBe(4);
  });
  it("compra anual antes de calificar: se anota y cuenta al completar el grupo", () => {
    let s = st([q(1), q(2), q(3, { status: "registrado" })]);
    const a = annualPaid(s, 3, NOW);
    expect(a.result).toBe("anotado");
    s = { ...a.state, refs: a.state.refs.map((r) => (r.id === 3 ? { ...r, status: "calificado" as const } : r)) };
    expect(settle(s, NOW).rewards[0].months).toBe(3);
  });
  it("la compra anual saca a alguien de revisión (pero igual debe activarse)", () => {
    const a = annualPaid(st([q(9, { status: "sospechoso" })]), 9, NOW);
    expect(a.state.refs[0].status).toBe("registrado");
    expect(a.state.rewards).toHaveLength(0);
  });
});

describe("revocación por fraude", () => {
  it("quita los meses del grupo, sus referidos no vuelven a contar y la compra anual tampoco suma", () => {
    let s = settle(st([q(1), q(2), q(3), q(4)]), NOW);
    s = revokeReward(s, 1);
    expect(simMonths(s)).toBe(0);
    expect(settle(s, NOW).rewards).toHaveLength(1);
    expect(annualPaid(s, 2, NOW).result).toBe("sin_cambio");
  });
});

describe("lo que ve quien invita", () => {
  it("estados en español", () => {
    expect(referralLabel({ status: "calificado", annual: false, expired: false }).label).toBe("Activo");
    expect(referralLabel({ status: "calificado", annual: true, expired: false }).label).toBe("Compró anual");
    expect(referralLabel({ status: "registrado", annual: false, expired: false }).label).toBe("Registrado");
    expect(referralLabel({ status: "registrado", annual: false, expired: true }).label).toBe("No se activó a tiempo");
    expect(referralLabel({ status: "sospechoso", annual: false, expired: false }).label).toBe("En revisión");
    expect(referralLabel({ status: "descartado", annual: false, expired: false }).label).toBe("No cuenta");
  });
  it("progreso: 2 de 3 para tu próximo mes gratis", () => {
    const list = [{ status: "calificado" as const, group_no: 1 }, { status: "calificado" as const, group_no: 1 }, { status: "calificado" as const, group_no: 1 },
      { status: "calificado" as const, group_no: null }, { status: "calificado" as const, group_no: null }, { status: "registrado" as const, group_no: null }];
    expect(referralProgress(list).text).toBe("2 de 3 para tu próximo mes gratis");
    expect(referralProgress([]).have).toBe(0);
  });
  it("meses ganados sin contar revocados", () => {
    expect(monthsEarned([{ months: 3, revoked_at: null }, { months: 1, revoked_at: null }, { months: 1, revoked_at: "x" }])).toBe(4);
  });
});
