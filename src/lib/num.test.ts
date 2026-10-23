import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { clamp01, es419Deep, es419Text, frac, nfmt } from "./num";

describe("frac y clamp01", () => {
  it("no deja pasar NaN ni Infinity", () => {
    expect(frac(5, 0)).toBe(0);
    expect(frac(0, 0)).toBe(0);
    expect(frac(NaN, 3)).toBe(0);
    expect(frac(3, 4)).toBe(0.75);
    expect(clamp01(Infinity)).toBe(0);
    expect(clamp01(NaN, 0.02)).toBe(0.02);
    expect(clamp01(1.4)).toBe(1);
  });
});

describe("cifras en es-419", () => {
  it("punto decimal y coma de miles", () => {
    expect(nfmt(93.14)).toBe("93.1");
    expect(nfmt(1276)).toBe("1,276");
    expect(nfmt(2.5, 1, 1)).toBe("2.5");
  });
  it("pasa a es-419 los textos guardados con el formato contrario", () => {
    expect(es419Text("Camina 8.000 pasos hoy")).toBe("Camina 8,000 pasos hoy");
    expect(es419Text("Bajar unos 0,5 kg por semana")).toBe("Bajar unos 0.5 kg por semana");
    expect(es419Text("1.250.000 pasos")).toBe("1,250,000 pasos");
    for (const same of ["10,000 pasos", "93.1 kg", "8 vasos, 3 comidas", "1,2 y 3", "semana 1.2"]) expect(es419Text(same)).toBe(same === "1,2 y 3" ? "1.2 y 3" : same);
  });
  it("es419Deep cambia textos y respeta ids, claves y funciones", () => {
    const task = () => "x";
    const r = es419Deep({ id: "pasos-1.000", title: "10.000 pasos", plan: [{ t: "0,5 kg", type: "habito" }], task, n: 3 });
    expect(r).toEqual({ id: "pasos-1.000", title: "10,000 pasos", plan: [{ t: "0.5 kg", type: "habito" }], task, n: 3 });
  });
  it("nadie formatea números de la app fuera de es-419", () => {
    // es-CO (1.276 y 93,1) solo en los correos, que tienen su propio formato.
    const co = execSync("grep -rln --include=*.ts --include=*.tsx 'es-CO' src || true", { encoding: "utf8" }).split("\n").filter(Boolean);
    expect(co.filter((f) => !["src/lib/email/templates.ts", "src/lib/num.test.ts"].includes(f))).toEqual([]);
  });
  it("sin miles con punto ni decimales con coma escritos a mano en la interfaz", () => {
    // Siembras ya aplicadas en migraciones (deben coincidir byte a byte): las corrige es419Deep al mostrarlas.
    const skip = /\.test\.|src\/lib\/email\/|challenge-seed\.ts|catalog-00\d\d\.ts|program-seed\.ts/;
    const files = execSync("grep -rlE --include=*.ts --include=*.tsx '[0-9]' src", { encoding: "utf8" }).split("\n").filter((f) => f && !skip.test(f));
    const bad: string[] = [];
    for (const f of files) {
      readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // comentarios
        for (const m of line.matchAll(/["'`>]([^"'`<>]*)/g)) {
          const txt = m[1];
          if (/(?<![\d.,])\d{1,3}\.\d{3}(?![\d.]*\d)\s*(pasos|kcal|kg|g|ml|XP|ejercicios|alimentos|personas|preguntas)\b/.test(txt) || /(?<![\d.,])\d+,\d{1,2}\s*(kg|g|g\/kg|L|h|km|cm|t|min|kcal|%)(?![\w])/.test(txt)) bad.push(`${f}:${i + 1}: ${txt.slice(0, 60)}`);
        }
      });
    }
    expect(bad).toEqual([]);
  });
});
