import { describe, expect, it } from "vitest";
import { badgeLabel, checkXpDelta, cleanCountry, cleanEmail, cleanName, compExpiry, COMP_FOREVER_DAYS, isManualBadge, notSelf } from "./admin-manage";
import { can } from "./admin-perms";

const NOW = Date.parse("2026-10-26T12:00:00Z");
const DAY = 864e5;

describe("panel del superadmin: reglas puras (0056)", () => {
  it("solo el superadmin administra cuentas", () => {
    expect(can("superadmin", "users.manage")).toBe(true);
    for (const r of ["admin", "support", "coach", "pro", "free"] as const) expect(can(r, "users.manage")).toBe(false);
  });
  it("nombre: limpia espacios, 2 a 60 caracteres y sin etiquetas", () => {
    expect(cleanName("  Ana   María  ")).toEqual({ ok: true, value: "Ana María" });
    expect(cleanName("A").ok).toBe(false);
    expect(cleanName("x".repeat(61)).ok).toBe(false);
    expect(cleanName("<script>").ok).toBe(false);
  });
  it("correo: válido, en minúsculas y distinto del actual", () => {
    expect(cleanEmail(" Ana@Correo.COM ", "otra@correo.com")).toEqual({ ok: true, value: "ana@correo.com" });
    expect(cleanEmail("ana@correo.com", "ANA@correo.com").ok).toBe(false);
    expect(cleanEmail("no-es-correo", null).ok).toBe(false);
    expect(cleanEmail("a@b", null).ok).toBe(false);
  });
  it("país: 2 letras o vacío para no cambiarlo", () => {
    expect(cleanCountry("gt")).toEqual({ ok: true, value: "GT" });
    expect(cleanCountry("")).toEqual({ ok: true, value: null });
    expect(cleanCountry("Guatemala").ok).toBe(false);
  });
  it("nadie se bloquea, se cierra sesiones ni se cambia el correo a sí mismo desde el panel", () => {
    for (const w of ["block", "signout", "email", "delete"] as const) {
      expect(notSelf("u1", "u1", w).ok).toBe(false);
      expect(notSelf("u1", "u2", w).ok).toBe(true);
    }
  });
  it("XP: entero distinto de 0, con tope, y el total nunca bajo 0", () => {
    expect(checkXpDelta(150, 0).ok).toBe(true);
    expect(checkXpDelta(-100, 100).ok).toBe(true);
    expect(checkXpDelta(-101, 100).ok).toBe(false);
    expect(checkXpDelta(0, 100).ok).toBe(false);
    expect(checkXpDelta(1.5, 100).ok).toBe(false);
    expect(checkXpDelta(20001, 0).ok).toBe(false);
  });
  it("cortesía: días, fecha futura o sin vencimiento (10 años, dentro del tope de la base)", () => {
    const d7 = compExpiry({ kind: "dias", days: 7 }, NOW);
    expect(d7.ok && Date.parse(d7.iso) - NOW).toBe(7 * DAY);
    const f = compExpiry({ kind: "fecha", date: "2026-12-31" }, NOW);
    expect(f.ok && f.iso).toBe("2027-01-01T05:59:59.000Z");
    expect(compExpiry({ kind: "fecha", date: "2026-10-01" }, NOW).ok).toBe(false);
    expect(compExpiry({ kind: "fecha", date: "" }, NOW).ok).toBe(false);
    expect(compExpiry({ kind: "dias", days: 0 }, NOW).ok).toBe(false);
    const s = compExpiry({ kind: "siempre" }, NOW);
    expect(s.ok && Math.round((Date.parse(s.iso) - NOW) / DAY)).toBe(COMP_FOREVER_DAYS);
    expect(compExpiry({ kind: "fecha", date: "2040-01-01" }, NOW).ok).toBe(false);
  });
  it("insignias a mano: las de logros, certificados y medallas; nivel y verificado no", () => {
    expect(isManualBadge("w50")).toBe(true);
    expect(isManualBadge("prog:temporada-running-1")).toBe(true);
    expect(isManualBadge("reto:agua-21")).toBe(true);
    expect(isManualBadge("nivel")).toBe(false);
    expect(isManualBadge("verificado")).toBe(false);
    expect(isManualBadge("prog:<x>")).toBe(false);
    expect(badgeLabel("prog:abdomen-marcado", null, { "abdomen-marcado": "Abdomen marcado" })).toBe("Certificado: Abdomen marcado");
    expect(badgeLabel("w10")).toBe("10 entrenos");
  });
});
