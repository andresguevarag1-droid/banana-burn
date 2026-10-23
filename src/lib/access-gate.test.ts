import { describe, expect, it } from "vitest";
import { gateAction, isAlwaysOpen, isPrivatePath, needsAccessCheck, WALL_PATH } from "./access-gate";

const get = (path: string, o: Partial<{ method: string; isAction: boolean }> = {}) => ({ path, method: "GET", isAction: false, ...o });

describe("muro de planes en el servidor", () => {
  it("las secciones pagadas se comprueban", () => {
    for (const p of ["/app", "/app/entreno", "/app/comunidad", "/app/comunidad/u/beto", "/app/coach", "/app/nutricion/recetas", "/app/progreso", "/app/retos/gluteos-30"]) {
      expect(needsAccessCheck(get(p))).toBe(true);
    }
  });
  it("cuenta, pago e Invita y gana siempre abren", () => {
    for (const p of ["/app/perfil", "/app/suscripcion", "/app/referidos"]) {
      expect(isAlwaysOpen(p)).toBe(true);
      expect(needsAccessCheck(get(p))).toBe(false);
    }
    expect(isAlwaysOpen("/app/perfilx")).toBe(false);
    expect(isAlwaysOpen("/app/suscripcion/algo")).toBe(true);
  });
  it("fuera de /app no aplica (el panel exige staff por su cuenta)", () => {
    for (const p of ["/admin", "/bienvenida", "/api/coach", "/application", "/"]) expect(needsAccessCheck(get(p))).toBe(false);
  });
  it("server actions y escrituras no se reescriben (validan por su cuenta)", () => {
    expect(needsAccessCheck(get("/app/entreno", { isAction: true }))).toBe(false);
    expect(needsAccessCheck(get("/app/entreno", { method: "POST" }))).toBe(false);
    expect(needsAccessCheck(get("/app/entreno", { method: "HEAD" }))).toBe(true);
  });
  it("sin acceso confirmado por la base: se reescribe al muro", () => {
    expect(gateAction({ ...get("/app/entreno"), signedIn: true, hasAccess: false })).toBe("rewrite");
    expect(WALL_PATH).toBe("/app/suscripcion");
  });
  it("con acceso, sin sesión o si la base falla: pasa (el layout y la base siguen protegiendo)", () => {
    expect(gateAction({ ...get("/app/entreno"), signedIn: true, hasAccess: true })).toBe("pass");
    expect(gateAction({ ...get("/app/entreno"), signedIn: true, hasAccess: null })).toBe("pass");
    expect(gateAction({ ...get("/app/entreno"), signedIn: false, hasAccess: false })).toBe("pass");
    expect(gateAction({ ...get("/app/perfil"), signedIn: true, hasAccess: false })).toBe("pass");
  });
  it("rutas privadas sin caché compartida", () => {
    for (const p of ["/app", "/app/progreso", "/admin/usuarios", "/bienvenida", "/pago/checkout", "/r/abcd2345", "/entrar"]) expect(isPrivatePath(p)).toBe(true);
    for (const p of ["/", "/precios", "/og", "/llms.txt", "/apple"]) expect(isPrivatePath(p)).toBe(false);
  });
});
