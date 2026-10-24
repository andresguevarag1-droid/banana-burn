import { describe, expect, it } from "vitest";
import { ENDPOINT, MAX_PER_PAGE, createReporter } from "./client";

function setup(random = () => 0) {
  const sent: { url: string; body: Record<string, unknown> }[] = [];
  const report = createReporter({ release: "abc1234", random, path: () => "/app/retos/abdomen-21", transport: (url, body) => sent.push({ url, body: JSON.parse(body) }) });
  return { sent, report };
}

describe("reportes del navegador", () => {
  it("manda un reporte limpio al endpoint", () => {
    const { sent, report } = setup();
    expect(report("boundary", Object.assign(new TypeError("falló con ana@a.co"), { digest: "d1" }))).toBe(true);
    expect(sent[0].url).toBe(ENDPOINT);
    expect(sent[0].body).toEqual({ source: "boundary", kind: "TypeError", message: "falló con [correo]", route: "/app/retos/:id", digest: "d1", release: "abc1234" });
  });
  it("no repite el mismo error y tiene tope por página", () => {
    const { sent, report } = setup();
    report("client", new Error("a")); report("client", new Error("a"));
    expect(sent).toHaveLength(1);
    for (let i = 0; i < 20; i++) report("client", new Error(`b${String.fromCharCode(97 + i)}`));
    expect(sent).toHaveLength(MAX_PER_PAGE);
  });
  it("muestrea los errores sueltos pero no los de pantalla", () => {
    const { sent, report } = setup(() => 0.7);
    expect(report("client", new Error("x"))).toBe(false);
    expect(report("boundary", new Error("y"))).toBe(true);
    expect(sent).toHaveLength(1);
  });
  it("ignora ruido y valores vacíos", () => {
    const { sent, report } = setup();
    report("client", new Error("ResizeObserver loop limit exceeded"));
    report("client", null);
    report("client", { name: "AbortError", message: "x" });
    expect(sent).toHaveLength(0);
  });
  it("un transporte que falla no rompe nada", () => {
    const report = createReporter({ release: null, random: () => 0, path: () => "/", transport: () => { throw new Error("sin red"); } });
    expect(report("boundary", new Error("x"))).toBe(false);
  });
});
