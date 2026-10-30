import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const doc = readFileSync("marketing/ads/boost-organico.md", "utf8");
const calendar = readFileSync("marketing/calendario-redes-oct-nov-2026.md", "utf8");
const kit = readFileSync("marketing/kit-reels-noviembre-2026.md", "utf8");
const rows = (text: string) => text.split("\n")
  .filter((line) => line.startsWith("|") && !/^\|\s*-/.test(line))
  .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
const section = (title: string) => {
  expect(doc).toContain(title);
  return doc.split(title)[1].split("\n## ")[0];
};
const money = (value: string) => Number(value.replace(/[$,]/g, ""));

describe("boost orgánico de noviembre", () => {
  it("cuadra los tres niveles, sin sumar alternativas ni consumir conversión", () => {
    const budgets = rows(section("## Presupuesto: decisión de Andrés")).slice(1);
    expect(budgets.map((row) => row[0])).toEqual(["Bajo", "Medio", "Alto"]);
    for (const [, profile, reels, daily, duration, weekly, monthly] of budgets) {
      expect(money(profile) + money(reels)).toBe(money(daily));
      expect(duration).toBe("7 días");
      expect(money(weekly)).toBe(money(daily) * 7);
      expect(money(monthly)).toBe(money(weekly) * 4);
    }
    expect(doc).toContain("no se suman niveles");
    expect(doc).toContain("no se resta ni se transfiere dinero de la campaña de registros");
    expect(doc).toContain("Andrés debe aprobar por escrito");
    expect(doc).toContain("confirmar cargos e impuestos antes de aprobar el techo final");
    expect(doc).toContain("no recuperar días perdidos ni reasignar saldo sin autorización");
  });

  it("cubre cuatro lunes con ventanas completas de siete días anteriores", () => {
    const weeks = rows(section("## Calendario de revisión y prioridad")).slice(1);
    expect(weeks).toHaveLength(4);
    for (let index = 0; index < weeks.length; index++) {
      const start = 2 + index * 7;
      expect(new Date(Date.UTC(2026, 10, start)).getUTCDay()).toBe(1);
      expect(weeks[index][0]).toBe(`${start} al ${start + 6} nov`);
      expect(weeks[index][1]).toBe(index === 0 ? "26 oct al 1 nov" : `${start - 7} al ${start - 1} nov`);
    }
    // Las prioridades deben provenir de piezas reales, sin inventar publicación de Reels.
    for (const [, , candidates] of weeks) {
      for (const [id] of candidates.matchAll(/K\d{2}/g)) expect(calendar).toContain(id);
    }
    expect(calendar).toMatch(/Vie 30 oct[^\n]*K02 Condominio residentes/);
    expect(kit).toContain("La Temporada 1 empieza el 9 de noviembre");
    expect(doc).toContain("no boostear su original desde el 9");
    expect(doc).toContain("Descartar K12 y R12 por cierre de inscripciones el 22");
    expect(doc).toContain("No inventar fechas de publicación para los Reels");
  });

  it("elige por señal orgánica y no gasta si faltan datos o elegibilidad", () => {
    expect(doc).toContain("(guardados + compartidos) / alcance orgánico × 100");
    expect(doc).toContain("Elegir los 2 posts o Reels elegibles con mayor tasa");
    expect(doc).toContain("Sofía entrega los datos orgánicos");
    expect(doc).toContain("si no hay datos suficientes, no gastar");
    expect(doc).toContain("alcance cero no permite dividir");
    expect(doc).toContain("ausencia de permiso de uso publicitario");
    expect(doc).toContain("No tomar resultados pagados como señal orgánica");
    expect(doc).toContain("No sustituye la indicación de tu médico.");
    expect(doc).toContain("solo aplica en Costa Rica cuando el condominio se suma");
    expect(doc).not.toContain("\u2014");
  });

  it("mantiene los KPIs sin resultados fabricados y con reglas de apagado", () => {
    const kpis = rows(section("## KPIs, registro y apagado")).slice(1, 6);
    expect(kpis).toHaveLength(5);
    expect(kpis.slice(0, 3).map((row) => row[0])).toEqual([
      "Costo por seguidor nuevo", "Costo por visita al perfil", "Tasa de reproducción completa",
    ]);
    for (const row of kpis) expect(row[2]).toBe("por medir");
    expect(doc).toContain("No sustituir reproducciones al 100 % por ThruPlay");
    expect(doc).toContain("Apagar de inmediato ante enlace roto");
    expect(doc).toContain("A las 72 h pausar la línea perfil si registra cero visitas atribuidas");
    expect(doc).toContain("Antes de activar, Andrés fija un techo");
    expect(doc).toContain("Cada anuncio se apaga al alcanzar su límite aprobado o fecha de fin");
  });

  it("define públicos para ambas líneas limitados a Costa Rica", () => {
    const audiences = section("## Dos objetivos y públicos separados");
    for (const city of ["San José", "Heredia", "Escazú", "Santa Ana", "Curridabat"]) {
      expect(audiences).toContain(city);
    }
    for (const term of ["running", "gimnasio", "pérdida de peso", "50 %", "similares al 1 %", "Costa Rica"]) {
      expect(audiences).toContain(term);
    }
    expect(rows(audiences).slice(1).map((row) => row[0])).toEqual([
      "Seguidores y visitas al perfil", "Interacción con Reels",
    ]);
  });
});
