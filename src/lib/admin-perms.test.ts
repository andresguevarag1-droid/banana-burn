import { describe, expect, it } from "vitest";
import { assignableRoles, can, canSee, checkRoleChange, MATRIX, ROLES, type Capability, type Section } from "./admin-perms";
import type { Role } from "@/lib/supabase/server";
import * as val from "./admin-validate";

describe("matriz de permisos", () => {
  it("usuarios finales no tienen ninguna capacidad", () => {
    for (const cap of Object.keys(MATRIX) as Capability[]) {
      expect(can("free", cap)).toBe(false);
      expect(can("pro", cap)).toBe(false);
      expect(can(null, cap)).toBe(false);
    }
  });
  it("admin y superadmin lo ven todo (salvo referidores: solo el dueño)", () => {
    for (const cap of Object.keys(MATRIX) as Capability[]) {
      expect(can("admin", cap)).toBe(cap !== "affiliates.manage");
      expect(can("superadmin", cap)).toBe(true);
    }
  });
  it("salud: coach sí, soporte no; facturación: soporte sí, coach no", () => {
    expect(can("coach", "users.health")).toBe(true);
    expect(can("support", "users.health")).toBe(false);
    expect(can("support", "users.activity")).toBe(false);
    expect(can("support", "users.billing")).toBe(true);
    expect(can("coach", "users.billing")).toBe(false);
    expect(can("coach", "metrics.revenue")).toBe(false);
    expect(can("support", "metrics.revenue")).toBe(false);
  });
  it("secciones visibles por rol", () => {
    const vis = (r: Role) => (["resumen", "usuarios", "pagos", "contenido", "retos", "comunidad", "auditoria"] as Section[]).filter((s) => canSee(r, s));
    expect(vis("coach")).toEqual(["resumen", "usuarios", "contenido", "retos", "comunidad"]);
    expect(vis("support")).toEqual(["resumen", "usuarios", "pagos", "comunidad"]);
    expect(vis("admin")).toHaveLength(7);
    expect(vis("superadmin")).toHaveLength(7);
    expect(vis("free")).toEqual([]);
  });
  it("soporte: la cola de casos es de soporte, admin y superadmin (coach no)", () => {
    expect(canSee("support", "soporte")).toBe(true);
    expect(canSee("admin", "soporte")).toBe(true);
    expect(canSee("superadmin", "soporte")).toBe(true);
    expect(canSee("coach", "soporte")).toBe(false);
    expect(can("free", "support.tickets")).toBe(false);
  });
  it("regalar meses y gestionar referidos: solo admin y superadmin; soporte solo mira referidos", () => {
    for (const r of ["coach", "support", "free", "pro"] as Role[]) {
      expect(can(r, "users.gift")).toBe(false);
      expect(can(r, "referrals.manage")).toBe(false);
    }
    expect(can("support", "referrals.view")).toBe(true);
    expect(can("coach", "referrals.view")).toBe(false);
    for (const r of ["admin", "superadmin"] as Role[]) expect(can(r, "users.gift") && can(r, "referrals.manage")).toBe(true);
  });
  it("testers: solo admin y superadmin asignan; soporte gestiona los reportes; tester no es un rol", () => {
    for (const r of ["coach", "support", "free", "pro"] as Role[]) expect(can(r, "users.tester")).toBe(false);
    for (const r of ["admin", "superadmin"] as Role[]) expect(can(r, "users.tester")).toBe(true);
    expect(can("support", "feedback.manage")).toBe(true);
    expect(can("coach", "feedback.manage")).toBe(false);
    expect(ROLES).not.toContain("tester");
    for (const r of ROLES) expect(assignableRoles(r)).not.toContain("tester");
  });
  it("suspender: soporte y admin; borrar cuentas: solo admin", () => {
    expect(can("support", "users.suspend")).toBe(true);
    expect(can("coach", "users.suspend")).toBe(false);
    expect(can("support", "users.delete")).toBe(false);
    expect(can("coach", "users.delete")).toBe(false);
    expect(can("admin", "users.delete")).toBe(true);
  });
  it("verificar identidad: soporte y admin (igual que is_billing_staff en 0030); coach no ve documentos", () => {
    expect(can("support", "users.verify")).toBe(true);
    expect(can("coach", "users.verify")).toBe(false);
    expect(canSee("support", "verificaciones")).toBe(true);
    expect(canSee("coach", "verificaciones")).toBe(false);
  });
  it("anuncios y auditoría solo admin", () => {
    expect(can("coach", "content.announcements")).toBe(false);
    expect(can("coach", "content.challenges")).toBe(true);
    expect(can("support", "audit.view")).toBe(false);
  });
});

describe("cambio de rol", () => {
  const base = { actorId: "A", targetId: "T" };
  it("referidores (0051): solo superadmin invita, asigna y paga", () => {
    for (const r of ["free", "pro", "coach", "support", "admin"] as Role[]) expect(can(r, "affiliates.manage")).toBe(false);
    expect(can("superadmin", "affiliates.manage")).toBe(true);
    expect(canSee("admin", "referidores")).toBe(false);
  });
  it("solo superadmin otorga admin/superadmin", () => {
    expect(assignableRoles("admin")).toEqual(["free", "pro", "coach", "support"]);
    expect(assignableRoles("superadmin")).toEqual(ROLES);
    expect(assignableRoles("coach")).toEqual([]);
    expect(checkRoleChange({ ...base, actorRole: "admin", targetRole: "free", newRole: "admin" }).ok).toBe(false);
    expect(checkRoleChange({ ...base, actorRole: "superadmin", targetRole: "free", newRole: "admin" }).ok).toBe(true);
    expect(checkRoleChange({ ...base, actorRole: "superadmin", targetRole: "admin", newRole: "superadmin" }).ok).toBe(true);
  });
  it("admin no puede degradar a otro admin", () => {
    expect(checkRoleChange({ ...base, actorRole: "admin", targetRole: "admin", newRole: "free" })).toMatchObject({ ok: false });
  });
  it("admin puede asignar staff no privilegiado", () => {
    expect(checkRoleChange({ ...base, actorRole: "admin", targetRole: "free", newRole: "coach" }).ok).toBe(true);
    expect(checkRoleChange({ ...base, actorRole: "admin", targetRole: "coach", newRole: "support" }).ok).toBe(true);
  });
  it("nadie cambia su propio rol, ni staff no admin cambia roles", () => {
    expect(checkRoleChange({ actorId: "A", targetId: "A", actorRole: "superadmin", targetRole: "superadmin", newRole: "free" }).ok).toBe(false);
    expect(checkRoleChange({ ...base, actorRole: "support", targetRole: "free", newRole: "pro" }).ok).toBe(false);
    expect(checkRoleChange({ ...base, actorRole: "coach", targetRole: "free", newRole: "pro" }).ok).toBe(false);
  });
  it("rechaza rol inválido o sin cambio", () => {
    expect(checkRoleChange({ ...base, actorRole: "superadmin", targetRole: "free", newRole: "dios" as Role }).ok).toBe(false);
    expect(checkRoleChange({ ...base, actorRole: "superadmin", targetRole: "pro", newRole: "pro" }).ok).toBe(false);
  });
});

describe("validación manual", () => {
  const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
  it("texto, enteros y números", () => {
    expect(val.text(fd({ a: "  hola " }), "a")).toBe("hola");
    expect(() => val.text(fd({}), "a", { required: true, label: "Nombre" })).toThrow("Nombre es obligatorio.");
    expect(() => val.text(fd({ a: "x".repeat(5) }), "a", { max: 4 })).toThrow(val.ValidationError);
    expect(val.int(fd({ n: "12" }), "n", { min: 1, max: 20 })).toBe(12);
    expect(() => val.int(fd({ n: "1.5" }), "n")).toThrow();
    expect(val.num(fd({ n: "2,5" }), "n")).toBe(2.5);
    expect(val.int(fd({}), "n")).toBeNull();
  });
  it("JSON de reglas debe ser objeto", () => {
    expect(val.json(fd({ r: '{"min": 3}' }), "r")).toEqual({ min: 3 });
    expect(val.json(fd({ r: "" }), "r")).toEqual({});
    expect(() => val.json(fd({ r: "[1]" }), "r")).toThrow();
    expect(() => val.json(fd({ r: "{nope" }), "r")).toThrow();
  });
  it("fechas en hora de Costa Rica", () => {
    expect(val.date(fd({ d: "2026-11-01" }), "d")).toBe("2026-11-02T05:59:59.000Z");
    expect(val.date(fd({ d: "2026-11-01T08:30" }), "d")).toBe("2026-11-01T14:30:00.000Z");
    expect(() => val.date(fd({ d: "mañana" }), "d")).toThrow();
  });
  it("ids, enums, casillas y slugs", () => {
    expect(val.isUuid("00000000-0000-4000-8000-000000000001")).toBe(true);
    expect(() => val.id(fd({ t: "x; drop table" }), "t")).toThrow();
    expect(val.oneOf(fd({ r: "coach" }), "r", ["coach", "admin"] as const)).toBe("coach");
    expect(() => val.oneOf(fd({ r: "root" }), "r", ["coach"] as const)).toThrow();
    expect(val.bool(fd({ c: "on" }), "c")).toBe(true);
    expect(val.bool(fd({}), "c")).toBe(false);
    expect(val.slugify("Reto 21 días ¡sin excusas!")).toBe("reto-21-dias-sin-excusas");
    expect(val.lines(fd({ l: "a\n\n b \nc" }), "l")).toEqual(["a", "b", "c"]);
  });
});

describe("sección Retos (tienda)", () => {
  it("la ven superadmin, admin y coach (gestionan contenido); soporte y usuarios no", () => {
    expect(canSee("superadmin", "retos")).toBe(true);
    expect(canSee("admin", "retos")).toBe(true);
    expect(canSee("coach", "retos")).toBe(true);
    expect(canSee("support", "retos")).toBe(false);
    expect(canSee("free", "retos")).toBe(false);
  });
  it("ventas y cortesías de retos: solo staff de cuentas", () => {
    expect(can("superadmin", "challenges.sales")).toBe(true);
    expect(can("coach", "challenges.sales")).toBe(false);
    expect(can("coach", "challenges.grant")).toBe(false);
    expect(can("admin", "challenges.grant")).toBe(true);
  });
});
