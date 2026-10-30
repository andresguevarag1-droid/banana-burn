// Referencias internas del checklist del lanzamiento y del primer cobro (docs/qa/lanzamiento-y-cobro.md): cada "Si algo
// falla, punto N" existe, los motivos y opciones del simulacro son los de docs/simulacro-cobros.md y scripts/simular-cobros.ts,
// y las horas de vercel.json son simples (sin pasos ni listas) para que la conversión a hora de Costa Rica tenga sentido.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SIMULACRO_AT } from "@/lib/cobros-simulacro";

const doc = readFileSync("docs/qa/lanzamiento-y-cobro.md", "utf8");
const simDoc = readFileSync("docs/simulacro-cobros.md", "utf8");
const simScript = readFileSync("scripts/simular-cobros.ts", "utf8");
const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons: { path: string; schedule: string }[] };

const fallas = doc.split("## Si algo falla")[1] ?? "";
const puntos = [...fallas.matchAll(/^(\d+)\. \*\*/gm)].map((m) => Number(m[1]));

describe("checklist del lanzamiento: referencias internas", () => {
  it("la sección Si algo falla tiene puntos numerados seguidos", () => {
    expect(puntos.length).toBeGreaterThanOrEqual(5);
    expect(puntos).toEqual(puntos.map((_, i) => i + 1));
  });

  it("cada referencia a un punto de Si algo falla existe", () => {
    const refs = [...doc.matchAll(/"Si algo falla", punto (\d+)/g)].map((m) => Number(m[1]));
    expect(refs.length).toBeGreaterThan(10);
    for (const n of refs) expect(puntos, `punto ${n}`).toContain(n);
    for (const m of fallas.matchAll(/punto (\d+)/g)) expect(puntos, m[0]).toContain(Number(m[1]));
  });

  it("los motivos y la opción del simulacro existen en el simulacro", () => {
    for (const motivo of ["monto_no_coincide", "llave_ocupada", "sin_llaves_0062"]) {
      expect(doc).toContain(motivo);
      expect(simDoc).toContain(`\`${motivo}\``);
    }
    expect(doc).toContain("--fecha 2026-11-08T06:20:00Z");
    expect(simScript).toContain("--fecha");
    expect(simScript).toContain("SIMULACRO_AT");
    expect(new Date(SIMULACRO_AT).toISOString()).toBe("2026-11-08T06:20:00.000Z");
  });

  it("las corridas del simulacro (C2 y C7) son antes del cobro del 8", () => {
    const fila = (id: string) => doc.split("\n").find((l) => l.startsWith(`| ${id} |`)) ?? "";
    expect(fila("C2")).toMatch(/\| Mar 3 nov, \d{2}:\d{2} \|.*simulacro/);
    expect(fila("C7")).toMatch(/\| Sáb 7 nov, \d{2}:\d{2} \|.*simulacro/);
  });

  it("los horarios de vercel.json usan minuto y hora simples", () => {
    for (const { path, schedule } of vercel.crons) {
      const [min, hour, ...rest] = schedule.split(" ");
      expect(min, path).toMatch(/^\d{1,2}$/);
      expect(hour, path).toMatch(/^\d{1,2}$/);
      expect(rest, path).toEqual(["*", "*", "*"]);
    }
  });
});
