import { describe, expect, it } from "vitest";
import { cleanIdName, cleanLast3, idPhotoName, redactIds, validateSubmission, validIdPath } from "./identity";

const UID = "a1a1a1a1-0000-4000-8000-0000000000a1";
const ok = { consent: true, docType: "cedula_cr", country: "CR", last3: "678", fullName: "Ana Pérez Mora", front: `${UID}/frente-abc.jpg`, selfie: `${UID}/selfie-abc.jpg` };
const COUNTRIES = ["CR", "MX", "NI", "OT"];

describe("últimos 3 caracteres del documento (nunca el número completo)", () => {
  it("si pegan la cédula completa, solo quedan los últimos 3 y se avisa", () => {
    expect(cleanLast3("1-1234-0678", "cedula_cr")).toEqual({ value: "678", trimmed: true });
    expect(cleanLast3("678", "cedula_cr")).toEqual({ value: "678", trimmed: false });
  });
  it("cédula y DIMEX: solo dígitos; pasaporte: letras y números en mayúscula", () => {
    expect(cleanLast3("12a", "cedula_cr")).toBeNull();
    expect(cleanLast3("c4x", "pasaporte")).toEqual({ value: "C4X", trimmed: false });
    expect(cleanLast3(" a-1 ", "documento_nacional")).toBeNull();
    expect(cleanLast3(undefined, "dimex")).toBeNull();
  });
});

describe("nombre como aparece en el documento", () => {
  it("limpia espacios y acepta tildes, guion y apóstrofo", () => {
    expect(cleanIdName("  María   José  Núñez-O'Neil ")).toBe("María José Núñez-O'Neil");
  });
  it("rechaza una sola palabra, números, correos y textos larguísimos", () => {
    expect(cleanIdName("Ana")).toBeNull();
    expect(cleanIdName("Ana 123456789")).toBeNull();
    expect(cleanIdName("ana@correo.com Perez")).toBeNull();
    expect(cleanIdName("A".repeat(60) + " " + "B".repeat(61))).toBeNull();
  });
});

describe("rutas de las fotos", () => {
  it("solo dentro de tu carpeta y sin subcarpetas", () => {
    expect(validIdPath(`${UID}/frente-x.jpg`, UID)).toBe(true);
    expect(validIdPath(`b2b2b2b2-0000-4000-8000-0000000000b2/frente.jpg`, UID)).toBe(false);
    expect(validIdPath(`${UID}/../x.jpg`, UID)).toBe(false);
    expect(validIdPath(`${UID}/a/b.jpg`, UID)).toBe(false);
  });
  it("el nombre del archivo no usa el nombre original", () => {
    expect(idPhotoName("frente", "image/jpeg", "ab12$%cd")).toBe("frente-ab12cd.jpg");
    expect(idPhotoName("selfie", "image/png", "")).toBe("selfie-x.png");
  });
});

describe("validateSubmission (servidor)", () => {
  it("un envío válido sale limpio", () => {
    expect(validateSubmission(ok, UID, COUNTRIES)).toEqual({ ok: true, value: { ...ok, docType: "cedula_cr" } });
  });
  it("sin consentimiento no se revisa nada", () => {
    expect(validateSubmission({ ...ok, consent: false }, UID, COUNTRIES)).toMatchObject({ ok: false });
  });
  it("el servidor no recorta: más de 3 caracteres se rechaza (el número completo nunca se acepta)", () => {
    expect(validateSubmission({ ...ok, last3: "112340678" }, UID, COUNTRIES)).toMatchObject({ ok: false });
  });
  it("la cédula y el DIMEX son de Costa Rica aunque digan otro país", () => {
    const r = validateSubmission({ ...ok, docType: "dimex", country: "MX" }, UID, COUNTRIES);
    expect(r.ok && r.value.country).toBe("CR");
  });
  it("pasaporte necesita un país de la lista", () => {
    expect(validateSubmission({ ...ok, docType: "pasaporte", last3: "C4X", country: "ZZ" }, UID, COUNTRIES)).toMatchObject({ ok: false });
    expect(validateSubmission({ ...ok, docType: "pasaporte", last3: "c4x", country: "ni" }, UID, COUNTRIES)).toMatchObject({ ok: true, value: { country: "NI", last3: "C4X" } });
  });
  it("las dos fotos deben ser distintas y propias", () => {
    expect(validateSubmission({ ...ok, selfie: ok.front }, UID, COUNTRIES)).toMatchObject({ ok: false });
    expect(validateSubmission({ ...ok, front: "otro/x.jpg" }, UID, COUNTRIES)).toMatchObject({ ok: false });
  });
});

describe("nunca IDs en el log", () => {
  it("oculta secuencias largas de dígitos", () => {
    expect(redactIds("falló con 1-1234-0678 y 155812345678")).toBe("falló con [oculto] y [oculto]");
    expect(redactIds("código 42501")).toBe("código 42501");
  });
});
