import { describe, expect, it } from "vitest";
import { looksMinified, scan } from "./check-client-bundle.mjs";

const min = "var a=1;".repeat(1000);

describe("revisión del bundle del cliente", () => {
  it("un bundle limpio pasa", () => {
    expect(scan([{ path: "static/chunks/a.js", text: min }], { CRON_SECRET: "valor-canario-123456" })).toEqual([]);
  });
  it("detecta mapas de fuente", () => {
    expect(scan([{ path: "static/chunks/a.js.map", text: "" }]).length).toBe(1);
    expect(scan([{ path: "static/chunks/a.js", text: `${min}\n//# sourceMappingURL=a.js.map` }])[0]).toMatch(/sourceMappingURL/);
  });
  it("detecta un .js.map en lo que se publica (.next/static o public/)", () => {
    expect(scan([{ path: "static/chunks/app/layout-1a2b.js.map", text: "" }])).toEqual(["static/chunks/app/layout-1a2b.js.map: mapa de fuente publicado"]);
    expect(scan([{ path: "public/sw.js.map", text: "" }]).length).toBe(1);
  });
  it("detecta el valor canario y el nombre de una variable secreta, sin imprimir el valor", () => {
    const p = scan([{ path: "static/chunks/a.js", text: `${min}"valor-canario-123456"` }], { CRON_SECRET: "valor-canario-123456" });
    expect(p.join()).toMatch(/valor de CRON_SECRET/);
    expect(p.join()).not.toMatch(/valor-canario/);
    expect(scan([{ path: "static/chunks/a.js", text: `${min}process.env.SUPABASE_SERVICE_ROLE_KEY` }]).join()).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });
  it("detecta prefijos de llaves reales", () => {
    expect(scan([{ path: "static/chunks/a.js", text: `${min}"onvo_live_secret_key_abc"` }]).length).toBe(1);
    expect(scan([{ path: "static/chunks/a.js", text: `${min}"sk-ant-api03-xyz"` }]).length).toBe(1);
  });
  it("detecta JavaScript sin minificar", () => {
    expect(looksMinified("const a = 1;\n".repeat(1000))).toBe(false);
    expect(looksMinified(min)).toBe(true);
  });
});
