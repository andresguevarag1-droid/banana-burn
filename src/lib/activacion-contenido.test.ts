// La lista para Business Suite (docs/metas/business-suite-cambios.md) y las 10 piezas de activación
// (marketing/comunidad/activacion/) se publican a mano: estas pruebas vigilan orden, horas, duración y precios contra el código.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FIRST_HOME_MIN } from "@/lib/engine";
import { PLANS } from "@/lib/plans";
import { promoPrice } from "@/lib/trial";

const list = readFileSync("docs/metas/business-suite-cambios.md", "utf8");
const dir = "marketing/comunidad/activacion";
const pieces = readdirSync(dir).filter((f) => /^\d{2}-2026-\d{2}-\d{2}-.+\.md$/.test(f)).sort();
const read = (f: string) => readFileSync(`${dir}/${f}`, "utf8");
const cells = (line: string) => line.split("|").slice(1, -1).map((c) => c.trim());
const field = (doc: string, name: string) => doc.split("\n").map(cells).find((r) => r[0] === name)?.[1] ?? "";
const CTA = `Regístrate y haz tu primer entreno hoy (${FIRST_HOME_MIN} min, también en casa)`;
const usd = (n: number) => `$${n.toFixed(2)}`;

describe("lista para Business Suite", () => {
  const rows = list.split("\n").filter((l) => /^\| \d+ \|/.test(l)).map(cells);

  it("cada fila tiene una acción válida y va ordenada por fecha", () => {
    expect(rows.length).toBeGreaterThanOrEqual(20);
    expect(rows.map((r) => Number(r[0]))).toEqual(rows.map((_, i) => i + 1));
    const days = rows.map((r) => Number(r[1].match(/(\d+) nov/)![1]));
    expect(days).toEqual([...days].sort((a, b) => a - b));
    for (const r of rows) expect(r[4]).toMatch(/^(Mover y cambiar texto|Cambiar texto|Borrar)$/);
  });

  it("resuelve cada choque de las 12:00 con la comunidad (2, 4, 6 y 10 a 14 nov)", () => {
    for (const d of [2, 4, 6, 10, 12, 13, 14]) {
      const noon = rows.find((r) => r[1].startsWith(`${["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][(d + 5) % 7]} ${d} nov, 12:00`));
      expect(noon, `falta el 12:00 del ${d} nov`).toBeDefined();
      expect(noon![4]).toMatch(/Mover|Borrar/);
    }
  });
});

describe("10 piezas de activación", () => {
  it("son 10, la primera es el entreno en casa y van ordenadas por fecha", () => {
    expect(pieces).toHaveLength(10);
    expect(pieces.map((f) => f.slice(0, 2))).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"]);
    const dates = pieces.map((f) => f.slice(3, 13));
    expect(dates).toEqual([...dates].sort());
    expect(read(pieces[0])).toContain(`Tu primer entreno de ${FIRST_HOME_MIN} minutos en casa`);
  });

  it.each(pieces)("%s tiene gancho, texto, llamada a la acción y hora de noche", (f) => {
    const doc = read(f);
    expect(field(doc, "Gancho").length).toBeGreaterThan(5);
    expect(field(doc, "Llamada a la acción").length).toBeGreaterThan(5);
    expect(doc).toMatch(/## (Guion|Pantallas|Láminas|Qué se graba)/);
    const [, h, m] = field(doc, "Fecha y hora").match(/, (\d{2}):(\d{2}) Costa Rica/)!;
    const mins = Number(h) * 60 + Number(m);
    expect(mins).toBeGreaterThanOrEqual(20 * 60);
    expect(mins).toBeLessThanOrEqual(22 * 60);
    expect(doc).toContain(`${FIRST_HOME_MIN} min`);
    expect(doc).toContain("BORRADOR. Pendiente de aprobación escrita de Andrés");
  });

  it("las piezas de registro usan la llamada principal de noviembre", () => {
    const withCta = pieces.filter((f) => read(f).toLowerCase().includes(CTA.toLowerCase()));
    expect(withCta.length).toBeGreaterThanOrEqual(7);
  });

  it("el precio honesto cuadra con plans.ts y trial.ts", () => {
    const doc = read(pieces.find((f) => f.includes("precio"))!);
    for (const p of PLANS) for (const n of [p.price.mes, p.price.anual]) expect(doc).toContain(usd(n));
    for (const p of PLANS) expect(doc).toContain(usd(promoPrice(p.id)));
    expect(doc).toContain("USD, IVA incluido");
  });
});

describe("reglas de marca y de noviembre", () => {
  const all = [list, ...pieces.map(read), read("README.md")].join("\n");
  it("sin guiones largos, sin banano, sin otras duraciones ni el precio por mes del anual como promesa", () => {
    expect(all).not.toContain("—");
    expect(all.replace(/nunca «banano»/g, "")).not.toMatch(/banano/i);
    expect(all.replace(/No usar 10, 15 ni 15–20 min\./g, "")).not.toMatch(/\b(10|15|15–20) min\b/);
    expect(all.replace(/«equivale a \$5[^»]*»/g, "")).not.toMatch(/equivale a \$5/);
  });
  it("no inventa resultados", () => {
    for (const f of pieces) expect(read(f)).toMatch(/Resultado: por medir\./);
  });
});
