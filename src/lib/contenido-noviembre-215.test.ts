// Reglas de contenido de noviembre (#215): Temporada 1 en una pieza por semana y sin venta después del 22,
// GLP-1 sin dosis ni gramos exactos, precios "USD, IVA incluido" como el checkout y planes de anuncios en pausa.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SEASONS_T1 } from "@/lib/seasons";

const read = (p: string) => readFileSync(p, "utf8");
const head = (p: string, lines = 4) => read(p).split("\n").slice(0, lines).join("\n");

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === "node_modules") return [];
    return statSync(p).isDirectory() ? files(p, ext) : ext.test(name) ? [p] : [];
  });
}

describe("Temporada 1: una pieza por semana", () => {
  const doc = read("marketing/estrategia/temporada-1-una-por-semana.md");
  const rows = doc.split("## La pieza de cada semana")[1].split("\n## ")[0]
    .split("\n").filter((l) => /^\| (\d|Desde)/.test(l))
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));

  it("nombra una sola pieza por semana y ninguna desde el 23 nov", () => {
    expect(rows.map((r) => [r[0], r[1].split(" ")[0]])).toEqual([
      ["2 al 8 nov", "R04"], ["9 al 15 nov", "K15"], ["16 al 22 nov", "K12"], ["Desde el 23 nov", "Ninguna"],
    ]);
  });

  it("el cierre del 22 nov coincide con seasons.ts", () => {
    for (const s of SEASONS_T1) expect(s.enrollUntil).toBe("2026-11-22");
    expect(doc).toContain("la inscripción cierra el 22");
  });

  it("las piezas archivadas llevan el aviso arriba", () => {
    for (const p of [
      "marketing/comunidad/2026-11-09.md", "marketing/comunidad/2026-11-20.md", "marketing/comunidad/2026-11-22.md",
      "marketing/comunidad/temporada-1-ventas.md", "marketing/videos/A03_temporada-incluida/guion.md",
    ]) expect(head(p), p).toMatch(/ARCHIVADO.*#215/);
    expect(read("marketing/comunidad/carruseles.md")).toMatch(/## C4[^\n]*\n\n> \*\*ARCHIVADO \(#215\)/);
    expect(read("marketing/calendario-redes-oct-nov-2026.md")).toContain("~~Carrusel K09 Raquetas y Cross~~ ARCHIVADO (#215)");
    expect(read("marketing/kit-reels-noviembre-2026.md")).toMatch(/\| 12 \| [^\n]*ARCHIVADO \(#215\), no se produce \|/);
  });

  it("K15 y A03 no venden la temporada después del 22 nov", () => {
    expect(head("marketing/instagram/K15/README.md")).toContain("Después del 22 nov no se publica");
    expect(read("marketing/instagram/K15/caption.txt")).toContain("inscripción hasta el 22 de noviembre");
    expect(head("marketing/videos/A03_temporada-incluida/guion.md")).toContain("No se publica ni se promociona después del 22 nov");
  });

  it("R09 (semana del 16 al 22) ya no vende la Temporada", () => {
    const post = read("marketing/videos/R09_fuerza-running/guion.md").split("## Post propuesto\n")[1].split("\n## ")[0];
    expect(post).not.toMatch(/Temporada/);
  });
});

describe("GLP-1: sin dosis ni gramos exactos", () => {
  const exact = /\d+(?:\.\d+)?\s*(?:a|-|–)\s*\d+(?:\.\d+)?\s*g\b|g\s*(?:\/|por)\s*kg|\d+\s*veces por semana|\bmg\b/i;
  const piezas = [
    "marketing/videos/R02_musculo-glp1/README.md", "marketing/videos/R02_musculo-glp1/proyecto/escenas.mjs",
    "marketing/instagram/K14/caption.txt", "marketing/instagram/K14/README.md", "marketing/instagram/K14/generar.mjs",
    "marketing/videos/R06_proteina-primero/guion.md", "marketing/videos/R06_proteina-primero/proyecto/escenas.mjs",
    "marketing/kit-reels-noviembre-2026.md",
  ];

  it.each(piezas)("%s no da gramos por kilo ni frecuencias exactas", (p) => {
    expect(read(p)).not.toMatch(exact);
  });

  it("R02 solo deja en pantalla los 7 días del cierre", async () => {
    const r02 = await import("../../marketing/videos/R02_musculo-glp1/proyecto/escenas.mjs");
    expect(r02.NUMEROS_PERMITIDOS).toEqual(["7"]);
  });

  it("las piezas GLP-1 conservan el aviso médico", () => {
    for (const p of ["marketing/instagram/K14/caption.txt", "marketing/videos/R02_musculo-glp1/README.md", "marketing/videos/R06_proteina-primero/guion.md"]) {
      expect(read(p), p).toContain("No sustituye la indicación de tu médico.");
    }
  });

  it("R11 (día de inyección) está archivado", () => {
    expect(head("marketing/videos/R11_dia-inyeccion/guion.md")).toMatch(/ARCHIVADO \(#215\): no se produce ni se publica/);
    expect(read("marketing/kit-reels-noviembre-2026.md")).toMatch(/\| 11 \| Día de inyección[^\n]*ARCHIVADO \(#215\), no se publica \|/);
  });
});

describe("Precios: USD, IVA incluido", () => {
  const checkout = read("src/app/pago/checkout/page.tsx");
  const price = /\$(?:9\.99|14\.99|59\.99|89\.99|4\.99|7\.49|16\.99|18\.99)\b/;

  it("el checkout dice lo mismo que el contenido", () => {
    expect(checkout).toContain("Precios en USD, IVA incluido.");
  });

  it("nadie dice que el anual equivale a $5 al mes", () => {
    for (const p of [...files("marketing", /\.(md|txt|json)$/), ...files("docs", /\.md$/)]) {
      expect(read(p), p).not.toMatch(/equivale a (?:US)?\$5|~\s?(?:US)?\$5\b/i);
    }
  });

  // Piezas que se publican o se envían y muestran un precio. Las de docs/emails/ las fija el código (templates.ts).
  const publicables = [
    ...readdirSync("marketing/comunidad").filter((f) => /^2026-1[12]-\d\d\.md$/.test(f)).map((f) => `marketing/comunidad/${f}`),
    "marketing/comunidad/respuestas-anuncios.md",
    ...readdirSync("marketing/videos").filter((d) => /^(A0[12]|E0[1-4]|R(06|1[3-6])|CP[2-4])_/.test(d)).map((d) => `marketing/videos/${d}/guion.md`),
    "marketing/instagram/K14/caption.txt", "marketing/instagram/K15/caption.txt",
    "marketing/estrategia/correos/07-dia-7-elegir-plan.md", "marketing/estrategia/correos/08-oferta-50-tarjeta.md",
    "marketing/condominios/fin-mes-gratis.md", "marketing/condominios/mes-gratis-semanal.md",
    "marketing/kit-reels-noviembre-2026.md",
  ];

  it.each(publicables)("%s dice «USD, IVA incluido» si muestra un precio", (p) => {
    const s = read(p);
    if (price.test(s)) expect(s).toContain("USD, IVA incluido");
  });
});

describe("Planes de anuncios en pausa", () => {
  const AVISO = "**EN PAUSA por decisión del dueño: $0 en anuncios hasta llegar al 30 % de activación.**";
  it.each([
    "marketing/estrategia/meta-ads-noviembre.md",
    "marketing/estrategia/variantes-ab-noviembre.md",
    "marketing/ads/boost-organico.md",
    "docs/metas/campana-conversion-noviembre.md",
    "docs/metas/campanas-9-noviembre-ficha.md",
    "marketing/anuncios/cuanto-peso-cr-co.md",
  ])("%s lleva el aviso arriba y no se borró", (p) => {
    const lines = read(p).split("\n");
    expect(lines[0]).toMatch(/^# /);
    expect(lines[2].startsWith(`> ${AVISO}`)).toBe(true);
    expect(lines.length).toBeGreaterThan(20);
  });
});
