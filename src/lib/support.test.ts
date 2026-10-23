import { describe, expect, it } from "vitest";
import { deviceLabel, shotError, shotName, slaLate, staffCanMove, staffMoves, statusAfterStaffReply, statusAfterUserReply, ticketError, ticketNumber, timeline, userCan, waitLabel, SUPPORT_STATUSES } from "./support";
import { soporteAviso, type SupportMailKind } from "./email/templates";

const NOW = new Date("2026-11-20T15:00:00Z");
const ago = (h: number) => new Date(NOW.getTime() - h * 3600e3).toISOString();

describe("estados del caso", () => {
  it("el equipo solo hace transiciones válidas", () => {
    expect(staffCanMove("recibido", "en_proceso")).toBe(true);
    expect(staffCanMove("recibido", "resuelto")).toBe(true);
    expect(staffCanMove("resuelto", "necesita_info")).toBe(false);
    expect(staffCanMove("cerrado", "resuelto")).toBe(false);
    expect(staffCanMove("cerrado", "en_proceso")).toBe(true);
    expect(staffCanMove("en_proceso", "en_proceso")).toBe(false);
    expect(staffCanMove("raro", "en_proceso")).toBe(false);
    for (const s of SUPPORT_STATUSES) expect(staffMoves(s)).not.toContain(s);
  });
  it("respuestas: la persona saca el caso de 'necesita información'; el equipo saca el de 'recibido'", () => {
    expect(statusAfterUserReply("necesita_info")).toBe("en_proceso");
    expect(statusAfterUserReply("recibido")).toBe("recibido");
    expect(statusAfterStaffReply("recibido")).toBe("en_proceso");
    expect(statusAfterStaffReply("recibido", "resuelto")).toBe("resuelto");
    expect(statusAfterStaffReply("en_proceso")).toBe("en_proceso");
  });
  it("la persona responde mientras está abierto y reabre hasta 7 días después (máx. 3 veces)", () => {
    expect(userCan({ status: "en_proceso" }, NOW)).toMatchObject({ reply: true, reopen: false });
    expect(userCan({ status: "resuelto", resolved_at: ago(24) }, NOW)).toMatchObject({ reply: false, reopen: true, confirm: true });
    expect(userCan({ status: "cerrado", closed_at: ago(24 * 8) }, NOW).reopen).toBe(false);
    expect(userCan({ status: "resuelto", resolved_at: ago(1), reopened_count: 3 }, NOW).reopen).toBe(false);
    expect(userCan({ status: "cerrado", closed_at: ago(1) }, NOW).confirm).toBe(false);
  });
  it("atrasado: más de 24 h sin primera respuesta y abierto", () => {
    expect(slaLate({ status: "recibido", created_at: ago(25), first_response_at: null }, NOW)).toBe(true);
    expect(slaLate({ status: "recibido", created_at: ago(23), first_response_at: null }, NOW)).toBe(false);
    expect(slaLate({ status: "en_proceso", created_at: ago(30), first_response_at: ago(29) }, NOW)).toBe(false);
    expect(slaLate({ status: "resuelto", created_at: ago(30), first_response_at: null }, NOW)).toBe(false);
    expect(waitLabel(ago(5), NOW)).toBe("5 h");
    expect(waitLabel(ago(72), NOW)).toBe("3 d");
  });
  it("línea de tiempo para la persona", () => {
    const ev = [{ kind: "creado", status: "recibido", created_at: ago(30) }, { kind: "estado", status: "en_proceso", created_at: ago(20) }];
    expect(timeline({ status: "en_proceso", created_at: ago(30) }, ev).map((s) => [s.key, s.state])).toEqual([["recibido", "hecho"], ["en_proceso", "actual"], ["resuelto", "pendiente"]]);
    expect(timeline({ status: "necesita_info", created_at: ago(30) }, ev).map((s) => s.key)).toEqual(["recibido", "en_proceso", "necesita_info", "resuelto"]);
    const done = timeline({ status: "cerrado", created_at: ago(30) }, [...ev, { kind: "estado", status: "cerrado", created_at: ago(1) }]);
    expect(done.at(-1)).toMatchObject({ label: "Cerrado", state: "hecho", at: ago(1) });
  });
});

describe("formulario y contexto", () => {
  it("valida categoría, título y descripción", () => {
    expect(ticketError({ category: "app", title: "No guarda", body: "Toco guardar y no pasa nada." })).toBeNull();
    expect(ticketError({ category: "quejas", title: "No guarda", body: "Toco guardar y no pasa nada." })).toMatch(/categoría/);
    expect(ticketError({ category: "app", title: "ay", body: "Toco guardar y no pasa nada." })).toMatch(/título/);
    expect(ticketError({ category: "app", title: "No guarda", body: "corto" })).toMatch(/un poco más/);
  });
  it("captura: tipo y tamaño, y nombre sin datos de la persona", () => {
    expect(shotError({ type: "image/png", size: 1000 })).toBeNull();
    expect(shotError({ type: "application/pdf", size: 1000 })).toMatch(/JPG/);
    expect(shotError({ type: "image/jpeg", size: 6 * 1024 * 1024 })).toMatch(/5 MB/);
    expect(shotName("image/webp", "Ab3/../x")).toBe("captura-Ab3x.webp");
  });
  it("dispositivo en palabras, sin versión ni huella", () => {
    expect(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 Version/17.1 Mobile/15E148 Safari/604.1")).toBe("iPhone, Safari");
    expect(deviceLabel("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36")).toBe("Android, Chrome");
    expect(deviceLabel(null)).toBe("Otro, otro navegador");
    expect(ticketNumber(42)).toBe("BB-00042");
  });
});

describe("correos de soporte", () => {
  const base = { name: "Ana López", number: "BB-00042", title: "No guarda mi peso", url: "/app/soporte/42" };
  it("recibido con número de caso y enlace", () => {
    const e = soporteAviso({ ...base, kind: "recibido" });
    expect(e.subject).toBe("Recibimos tu reporte BB-00042");
    expect(e.html).toContain("BB-00042");
    expect(e.html).toContain("/app/soporte/42");
    expect(e.text).toContain("No guarda mi peso");
  });
  it("resuelto con el resumen del equipo (escapado) y la opción de reabrir", () => {
    const e = soporteAviso({ ...base, kind: "resuelto", message: "Corregimos el guardado. <b>listo</b>" });
    expect(e.subject).toBe("Resolvimos tu reporte BB-00042");
    expect(e.html).toContain("Resumen");
    expect(e.html).not.toContain("<b>listo</b>");
    expect(e.text).toMatch(/reabrirlo/);
  });
  it("cada aviso tiene su asunto, sin emojis, raya larga ni modismos", () => {
    const kinds: SupportMailKind[] = ["recibido", "en_proceso", "respuesta", "necesita_info", "resuelto", "cerrado"];
    const subjects = kinds.map((k) => soporteAviso({ ...base, kind: k, message: "Hola" }).subject);
    expect(new Set(subjects).size).toBe(kinds.length);
    for (const k of kinds) {
      const e = soporteAviso({ ...base, kind: k, message: "Hola" });
      expect(e.subject + e.text + e.html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]|\u2014|·|pura vida|\bmae\b|banano/u);
      expect(e.html).toContain('Banana <span style="color:#8A5300;">Burn</span>');
    }
    expect(soporteAviso({ ...base, kind: "respuesta" }).html).toContain("Responder en la app");
  });
});
