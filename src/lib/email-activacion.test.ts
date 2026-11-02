import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const doc = readFileSync(join(process.cwd(), "docs/emails/activacion.md"), "utf8");

const PIECES = ["A0", "A1", "A3", "B2", "B3"];

function section(id: string) {
  const start = doc.indexOf(`## ${id}.`);
  expect(start, `falta la sección ${id}`).toBeGreaterThanOrEqual(0);
  const rest = doc.slice(start + 3);
  const next = rest.search(/\n## /);
  return next === -1 ? rest : rest.slice(0, next);
}

describe("correo de activación", () => {
  it.each(PIECES)("la pieza %s trae asunto, preheader, cuerpo, botón, destino y push", (id) => {
    const s = section(id);
    for (const field of ["**Asunto:**", "**Preheader:**", "**Cuerpo:**", "**Botón:**", "**Destino:**", "**Push:**"]) {
      expect(s, `${id} sin ${field}`).toContain(field);
    }
  });

  it("cada push es una línea de 40 caracteres o menos", () => {
    const pushes = [...doc.matchAll(/\*\*Push:\*\* (.+)/g)].map((m) => m[1].trim());
    expect(pushes).toHaveLength(PIECES.length);
    for (const p of pushes) expect([...p].length, p).toBeLessThanOrEqual(40);
  });

  it("la tabla de envío cubre las cinco piezas", () => {
    for (const id of PIECES) expect(doc).toMatch(new RegExp(`^\\| ${id}[ ,]`, "m"));
  });

  it("el correo de A3 no usa testimonio ni cita atribuida", () => {
    const s = section("A3");
    expect(s).not.toMatch(/“[^”]+”|"[^"]+"/);
  });

  it("los correos de fin de beta usan la misma hora de envío y la fecha de Costa Rica", () => {
    expect(doc).toContain("5 nov 2026, 9:00 a. m. Costa Rica (15:00 UTC)");
    expect(doc).toContain("7 nov 2026, 9:00 a. m. Costa Rica (15:00 UTC)");
  });
});
