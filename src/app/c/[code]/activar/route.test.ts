import { beforeEach, describe, expect, it, vi } from "vitest";

const viewer = vi.hoisted(() => ({ current: null as null | { id: string; demo: boolean } }));
const join = vi.hoisted(() => vi.fn(async () => ({ kind: "join", condo: { name: "Las Palmas", code: "las-palmas" } })));
vi.mock("@/lib/supabase/server", () => ({ getViewer: async () => viewer.current }));
vi.mock("@/lib/condos-server", () => ({ joinCondo: join }));

import { GET, POST } from "./route";

const params = (code: string) => ({ params: Promise.resolve({ code }) });
const get = (code: string, q = "") => GET(new Request(`https://www.bananaburn.app/c/${code}/activar${q}`), params(code));
const post = (code: string, origin = "https://www.bananaburn.app") =>
  POST(new Request(`https://www.bananaburn.app/c/${code}/activar`, { method: "POST", headers: { origin, host: "www.bananaburn.app", "sec-fetch-site": origin.includes("bananaburn") ? "same-origin" : "cross-site" } }), params(code));

beforeEach(() => { viewer.current = null; join.mockClear(); });

describe("enlace del condominio /c/<código>/activar", () => {
  it("sin sesión: guarda el código en una cookie (solo servidor) y abre el registro, que vuelve al condominio", async () => {
    const res = await get("Las-Palmas");
    expect(res.status).toBe(303);
    const to = new URL(res.headers.get("location")!);
    expect(to.pathname).toBe("/entrar");
    expect(to.searchParams.get("modo")).toBe("registro");
    expect(to.searchParams.get("next")).toBe("/c/las-palmas");
    const set = res.headers.get("set-cookie") ?? "";
    expect(set).toMatch(/bb_condo=las-palmas/);
    expect(set).toMatch(/HttpOnly/i);
    expect(set).toMatch(/SameSite=lax/i);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(join).not.toHaveBeenCalled();
  });
  it("?cuenta=1 abre la entrada (cuenta existente) y también guarda la cookie", async () => {
    const res = await get("las-palmas", "?cuenta=1");
    const to = new URL(res.headers.get("location")!);
    expect(to.searchParams.get("modo")).toBeNull();
    expect(res.headers.get("set-cookie")).toMatch(/bb_condo=las-palmas/);
  });
  it("un código inválido no guarda nada", async () => {
    const res = await get("<script>");
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
  });
  it("con sesión, un GET nunca vincula la cuenta: vuelve a la página del condominio", async () => {
    viewer.current = { id: "u1", demo: false };
    const res = await get("las-palmas");
    expect(new URL(res.headers.get("location")!).pathname).toBe("/c/las-palmas");
    expect(join).not.toHaveBeenCalled();
  });
  it("con sesión, el botón (POST del mismo sitio) vincula la cuenta y muestra el resultado", async () => {
    viewer.current = { id: "u1", demo: false };
    const res = await post("las-palmas");
    expect(join).toHaveBeenCalledWith("u1", "las-palmas");
    const to = new URL(res.headers.get("location")!);
    expect(to.pathname).toBe("/c/las-palmas");
    expect(to.searchParams.get("estado")).toBe("join");
  });
  it("un POST desde otro sitio no vincula nada", async () => {
    viewer.current = { id: "u1", demo: false };
    await post("las-palmas", "https://otro.example");
    expect(join).not.toHaveBeenCalled();
  });
});
