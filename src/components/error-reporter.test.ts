import { describe, expect, it } from "vitest";
import { errorOrigin } from "./error-reporter";

describe("origen del error", () => {
  it("toma el primer script del stack sin query ni línea", () => {
    expect(errorOrigin("TypeError: x\n    at f (https://connect.facebook.net/en_US/fbevents.js?v=2:12:30)")).toBe("https://connect.facebook.net/en_US/fbevents.js");
  });
  it("prefiere ev.filename", () => {
    expect(errorOrigin("", "https://www.bananaburn.app/_next/static/chunks/1255-abc.js")).toBe("https://www.bananaburn.app/_next/static/chunks/1255-abc.js");
  });
  it("sin url no inventa nada", () => {
    expect(errorOrigin("TypeError: x at f (native)")).toBeNull();
    expect(errorOrigin(undefined)).toBeNull();
  });
});
