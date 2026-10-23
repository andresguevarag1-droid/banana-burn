import { describe, expect, it } from "vitest";
import { errInfo } from "./log";
import { OnvoError } from "@/lib/onvo";

describe("errInfo (logs sin datos personales)", () => {
  it("de un error del procesador solo deja tipo y estado, nunca el cuerpo", () => {
    const e = new OnvoError("Customer ana@correo.com already exists", 409, { email: "ana@correo.com", name: "Ana Pérez" });
    const out = JSON.stringify(errInfo(e));
    expect(out).not.toMatch(/ana@correo\.com|Ana/);
    expect(errInfo(e)).toEqual({ name: "OnvoError", status: 409 });
  });
  it("errores de PostgREST: solo el código", () => {
    const pg = { code: "23505", message: "duplicate", details: "Key (email)=(ana@correo.com) already exists." };
    expect(errInfo(pg)).toEqual({ name: "Error", code: "23505" });
  });
  it("valores raros", () => {
    expect(errInfo(null)).toEqual({ name: "object" });
    expect(errInfo("texto con ana@correo.com")).toEqual({ name: "string" });
  });
});
