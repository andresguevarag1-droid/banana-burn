import { describe, expect, it } from "vitest";
import { integrationsFrom, missingFor } from "./health";

describe("salud", () => {
  it("solo devuelve booleanos, nunca valores", () => {
    const i = integrationsFrom({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon", ANTHROPIC_API_KEY: "sk-secreta", VAPID_PUBLIC_KEY: "p", VAPID_PRIVATE_KEY: " " }, { full: false, oneTime: false });
    expect(Object.values(i).every((x) => typeof x === "boolean")).toBe(true);
    expect(JSON.stringify(i)).not.toContain("sk-secreta");
    expect(i.supabase).toBe(true);
    expect(i.anthropic).toBe(true);
    expect(i.vapid).toBe(false); // llave privada en blanco
  });
  it("lista lo que falta", () => {
    const i = integrationsFrom({}, { full: false, oneTime: false });
    expect(missingFor(i).length).toBeGreaterThanOrEqual(6);
    expect(missingFor(i).join(" ")).toContain("Coach Banana");
  });
  it("#228: Meta CAPI es solo si existe META_CAPI_TOKEN, sin el valor", () => {
    expect(integrationsFrom({}, { full: false, oneTime: false }).metaCapi).toBe(false);
    expect(missingFor(integrationsFrom({}, { full: false, oneTime: false })).join(" ")).toContain("META_CAPI_TOKEN");
    const i = integrationsFrom({ META_CAPI_TOKEN: "EAAG-secreto" }, { full: false, oneTime: false });
    expect(i.metaCapi).toBe(true);
    expect(JSON.stringify(i)).not.toContain("EAAG-secreto");
    expect(missingFor(i).join(" ")).not.toContain("META_CAPI_TOKEN");
  });
});
