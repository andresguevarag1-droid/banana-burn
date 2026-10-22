import { describe, expect, it } from "vitest";
import { cleanEvent } from "./event";

describe("cleanEvent", () => {
  it("acepta eventos conocidos y props simples", () => {
    expect(cleanEvent({ name: "cta_click", props: { cta: "hero", path: "/", n: 2, ok: true } })).toEqual({ name: "cta_click", props: { cta: "hero", path: "/", n: 2, ok: true } });
  });
  it("descarta nombres desconocidos y basura", () => {
    expect(cleanEvent({ name: "hack" })).toBeNull();
    expect(cleanEvent(null)).toBeNull();
    expect(cleanEvent("cta_click")).toBeNull();
  });
  it("quita objetos anidados, claves raras y recorta textos", () => {
    const e = cleanEvent({ name: "page_view", props: { path: "x".repeat(500), nested: { a: 1 }, "Bad-Key": "y", nan: Number.NaN } });
    expect(e?.props).toEqual({ path: "x".repeat(120) });
  });
});
