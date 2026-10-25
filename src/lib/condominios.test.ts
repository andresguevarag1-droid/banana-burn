import { describe, expect, it } from "vitest";
import { clean, cleanMulti, condoName, isStatus, parseLead } from "./condominios";

const base = { name: "Laura Mora", role: "administrador", org: "Condominio Los Robles", email: "Laura@Ejemplo.com" };

describe("condominios: formulario", () => {
  it("acepta lo mínimo y normaliza el correo", () => {
    const r = parseLead(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lead.email).toBe("laura@ejemplo.com");
      expect(r.lead.phone).toBeNull();
      expect(r.lead.times).toEqual([]);
    }
  });
  it("pide nombre, cargo válido, condominio y correo", () => {
    expect(parseLead({ ...base, name: " " })).toEqual({ ok: false, error: "Escribe tu nombre." });
    expect(parseLead({ ...base, role: "dueño" })).toEqual({ ok: false, error: "Elige tu cargo." });
    expect(parseLead({ ...base, org: "" })).toEqual({ ok: false, error: "Escribe el nombre del condominio." });
    expect(parseLead({ ...base, email: "no-es-correo" })).toEqual({ ok: false, error: "Revisa tu correo." });
  });
  it("valida el teléfono si viene y lo limpia", () => {
    expect(parseLead({ ...base, phone: "123" }).ok).toBe(false);
    const r = parseLead({ ...base, phone: "+506 8888-4821<script>" });
    expect(r.ok && r.lead.phone).toBe("+506 8888-4821");
  });
  it("solo guarda horarios conocidos, sin repetir", () => {
    const r = parseLead({ ...base, times: ["manana", "noche", "manana", "madrugada"] });
    expect(r.ok && r.lead.times).toEqual(["manana", "noche"]);
  });
  it("quita etiquetas y recorta a los topes de la tabla", () => {
    const r = parseLead({ ...base, name: "<b>Laura</b> Mora", comment: "x".repeat(2000), units: "y".repeat(100) });
    expect(r.ok && r.lead.name).toBe("Laura Mora");
    expect(r.ok && r.lead.comment?.length).toBe(1000);
    expect(r.ok && r.lead.units?.length).toBe(40);
  });
  it("clean y cleanMulti", () => {
    expect(clean("  hola\n\tmundo ", 50)).toBe("hola mundo");
    expect(cleanMulti("uno\r\n\r\n\r\n\r\ndos", 50)).toBe("uno\n\ndos");
    expect(clean(42, 10)).toBe("");
  });
});

describe("condominios: saludo personalizado (?c=)", () => {
  it("texto plano de hasta 60 caracteres", () => {
    expect(condoName("Torres del Valle")).toBe("Torres del Valle");
    expect(condoName("<script>alert(1)</script>Vista Linda")).toBe("alert(1)Vista Linda"); // sin etiquetas: queda texto plano
    expect(condoName("Vista <b>Linda</b> #1 \"x\"")).toBe("Vista Linda 1 x");
    expect(condoName("a".repeat(80))?.length).toBe(60);
    expect(condoName(["Primero", "Segundo"])).toBe("Primero");
  });
  it("descarta vacíos o con símbolos raros", () => {
    expect(condoName("")).toBeNull();
    expect(condoName("$$$")).toBeNull();
    expect(condoName(undefined)).toBeNull();
  });
  it("estados válidos", () => {
    expect(isStatus("reunion")).toBe(true);
    expect(isStatus("borrado")).toBe(false);
  });
});
