import { describe, expect, it } from "vitest";
import { GET } from "./route";

const call = (code: string, cookie?: string) => GET(new Request(`https://bananaburn.app/r/${encodeURIComponent(code)}`, { headers: cookie ? { cookie } : {} }), { params: Promise.resolve({ code }) });

describe("enlace de invitación /r/<código>", () => {
  it("guarda el código (solo servidor) y abre el registro", async () => {
    const res = await call("AbCd2345");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://bananaburn.app/entrar?modo=registro");
    const set = res.headers.get("set-cookie") ?? "";
    expect(set).toMatch(/bb_ref=abcd2345/);
    expect(set).toMatch(/HttpOnly/i);
    expect(set).toMatch(/SameSite=lax/i);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
  it("un código con otro formato no guarda nada (y no consulta la base)", async () => {
    const res = await call("<script>");
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("location")).toContain("/entrar?modo=registro");
  });
  it("primer enlace gana: no reemplaza un código ya guardado", async () => {
    const res = await call("zzzz2345", "bb_ref=abcd2345; otra=1");
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
