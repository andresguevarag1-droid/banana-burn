import { describe, expect, it } from "vitest";
import { GET } from "./route";

const call = (code: string, cookie?: string, query = "") => GET(new Request(`https://bananaburn.app/r/${encodeURIComponent(code)}${query}`, { headers: cookie ? { cookie } : {} }), { params: Promise.resolve({ code }) });

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
  it("conserva los cinco UTM al abrir el registro", async () => {
    const res = await call("abcd2345", undefined, "?utm_source=instagram&utm_medium=bio&utm_campaign=lanzamiento%20nov&utm_content=reel-1&utm_term=recomposicion");
    const loc = new URL(res.headers.get("location") ?? "");
    expect(loc.pathname).toBe("/entrar");
    expect(Object.fromEntries(loc.searchParams)).toEqual({
      modo: "registro", utm_source: "instagram", utm_medium: "bio", utm_campaign: "lanzamiento nov", utm_content: "reel-1", utm_term: "recomposicion",
    });
  });
  it("sin UTM el destino queda igual", async () => {
    const res = await call("abcd2345", undefined, "");
    expect(res.headers.get("location")).toBe("https://bananaburn.app/entrar?modo=registro");
  });
  it("descarta parámetros extraños, UTM vacíos y no deja reemplazar el modo; recorta a 80 caracteres", async () => {
    const res = await call("abcd2345", undefined, `?modo=login&email=a%40b.co&next=https://mal.example&utm_id=9&utm_medium=%20%20&utm_source=${"x".repeat(120)}&utm_campaign=%20nov%20`);
    const loc = new URL(res.headers.get("location") ?? "");
    expect(Object.fromEntries(loc.searchParams)).toEqual({ modo: "registro", utm_source: "x".repeat(80), utm_campaign: "nov" });
    expect(loc.origin).toBe("https://bananaburn.app");
  });
});
