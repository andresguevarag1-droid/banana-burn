// #348: con la tarjeta obligatoria, CompleteRegistration salía solo al guardar la tarjeta y Meta se quedó sin señal (0 el 23 nov).
// Ahora sale al guardar el perfil (profile_done, antes del paso de la tarjeta) y no se repite al terminar con tarjeta.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { toMetaEvent } from "@/lib/meta-pixel";
import { cleanEvent, ONCE_PER_ACCOUNT } from "@/app/api/track/event";

describe("#348 registro antes de la tarjeta", () => {
  it("profile_done es el CompleteRegistration de Meta", () => {
    expect(toMetaEvent("profile_done", { goal: "bajar" })).toEqual({ name: "CompleteRegistration", params: { status: "card_step" } });
  });

  it("onboarding_done con tarjeta obligatoria no repite el CompleteRegistration", () => {
    expect(toMetaEvent("onboarding_done", { trial: true, card: true })).toBeNull();
  });

  it("sin tarjeta obligatoria (cuentas anteriores) onboarding_done sigue siendo el registro", () => {
    expect(toMetaEvent("onboarding_done", { trial: true, card: false })?.name).toBe("CompleteRegistration");
    expect(toMetaEvent("onboarding_done", { trial: true })?.name).toBe("CompleteRegistration");
  });

  it("profile_done es un evento válido y cuenta una sola vez por cuenta", () => {
    expect(cleanEvent({ name: "profile_done", props: { goal: "bajar" } })?.name).toBe("profile_done");
    expect(ONCE_PER_ACCOUNT.has("profile_done")).toBe(true);
  });

  it("la bienvenida manda profile_done al guardar el perfil antes de la tarjeta, y marca card en onboarding_done", () => {
    const src = readFileSync("src/app/bienvenida/wizard.tsx", "utf8");
    const next = src.slice(src.indexOf("function next()"), src.indexOf("async function saveBeforeTilopay"));
    expect(next).toMatch(/setProfileSaved\(true\);[\s\S]*trackOnce\("profile_done"[\s\S]*go\(STEPS\)/);
    expect(src).toContain("card: cardRequired });");
  });
});
