import { describe, expect, it } from "vitest";
import { ERROR_COPY, errorKind } from "./error-kind";

describe("errorKind", () => {
  it("reconoce una versión vieja tras un deploy", () => {
    expect(errorKind({ name: "ChunkLoadError", message: "Loading chunk 123 failed." })).toBe("stale");
    expect(errorKind({ message: 'Failed to find Server Action "abc". This request might be from an older or newer deployment.' })).toBe("stale");
    expect(errorKind({ message: "Failed to fetch dynamically imported module: /_next/static/chunks/x.js" })).toBe("stale");
  });
  it("reconoce la falta de red", () => {
    expect(errorKind({ message: "Failed to fetch" })).toBe("offline");
    expect(errorKind({ message: "algo" }, false)).toBe("offline");
  });
  it("lo demás es genérico", () => {
    expect(errorKind({ message: "Cannot read properties of null" })).toBe("generic");
    expect(errorKind(null)).toBe("generic");
  });
  it("el texto no usa guiones largos", () => {
    for (const c of Object.values(ERROR_COPY)) expect(`${c.title}${c.body}${c.action}`).not.toMatch(/[—–]/);
  });
});
