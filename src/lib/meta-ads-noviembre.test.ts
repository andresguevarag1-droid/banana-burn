// La propuesta de Meta Ads de noviembre (marketing/estrategia/meta-ads-noviembre.md) se aprueba por sus cifras y su tabla
// de UTMs: estas pruebas vigilan que las sumas cuadren, que cada anuncio tenga UTMs únicos y que los Reels sean los del kit.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const doc = readFileSync("marketing/estrategia/meta-ads-noviembre.md", "utf8");
const kit = readFileSync("marketing/kit-reels-noviembre-2026.md", "utf8");

const money = (s: string) => Number(s.replace(/[*$,]/g, "").replace(/ por día/, "").trim());
const cells = (line: string) => line.split("|").slice(1, -1).map((c) => c.trim());

function section(title: string): string {
  const start = doc.indexOf(title);
  expect(start, `falta la sección ${title}`).toBeGreaterThanOrEqual(0);
  const next = doc.indexOf("\n#", start + title.length);
  return doc.slice(start, next === -1 ? undefined : next);
}

function tableRows(text: string): string[][] {
  return text.split("\n").filter((l) => l.startsWith("|") && !/^\|\s*-/.test(l)).slice(1).map(cells);
}

const COUNTRIES = [
  { name: "Costa Rica", code: "cr" },
  { name: "Guatemala", code: "gt" },
  { name: "Colombia", code: "co" },
];
const DAYS = 26;

const utmRows = tableRows(section("## Tabla de UTMs por país y anuncio"));

describe("fechas", () => {
  it("arranca el 5 de noviembre y termina el 30, 26 días", () => {
    expect(doc).toMatch(/Arranca el jueves 5 de noviembre/);
    expect(new Date(Date.UTC(2026, 10, 5)).getUTCDay()).toBe(4);
    expect(doc).toMatch(/Termina el lunes 30 de noviembre/);
    expect(new Date(Date.UTC(2026, 10, 30)).getUTCDay()).toBe(1);
    expect(doc).toContain(`${DAYS} días`);
  });

  it("deja claro que no toca la campaña activa ni crea nada en Meta", () => {
    expect(doc).toMatch(/no se crea, edita ni pausa nada en Meta/);
    expect(doc).toMatch(/No toca la campaña activa/);
  });
});

describe("presupuesto", () => {
  const rows = tableRows(section("## Total diario para aprobar"));
  const byCountry = rows.filter((r) => !r[0].includes("Total"));
  const total = rows.find((r) => r[0].includes("Total"))!;

  it("cada país multiplica bien por 26 días y el total suma", () => {
    expect(byCountry.map((r) => r[0])).toEqual(COUNTRIES.map((c) => c.name));
    for (const [, daily, period] of byCountry) expect(money(period)).toBeCloseTo(money(daily) * DAYS, 2);
    expect(money(total[1])).toBeCloseTo(byCountry.reduce((s, r) => s + money(r[1]), 0), 2);
    expect(money(total[2])).toBeCloseTo(byCountry.reduce((s, r) => s + money(r[2]), 0), 2);
    expect(money(total[1])).toBe(40);
  });

  it("los conjuntos de cada país suman su diario y siguen el reparto 40/30/30", () => {
    for (const { name } of COUNTRIES) {
      const daily = money(byCountry.find((r) => r[0] === name)![1]);
      const sec = section(`### ${name}: $`);
      expect(sec).toContain(`### ${name}: $${daily.toFixed(2)} por día`);
      const sets = tableRows(sec).map((r) => money(r[2]));
      expect(sets).toHaveLength(3);
      expect(sets.reduce((a, b) => a + b, 0)).toBeCloseTo(daily, 2);
      expect(sets.map((s) => Math.round((s / daily) * 100))).toEqual([40, 30, 30]);
    }
  });

  it("el techo de costo por registro es la meta por la conversión", () => {
    expect(doc).toMatch(/\| Costo por registro \(techo\) \| \$5\.25 \|/);
    expect(15 * 0.35).toBeCloseTo(5.25, 2);
    expect(doc).toContain("$10.50 (el doble del techo)");
  });
});

describe("cada país", () => {
  it.each(COUNTRIES)("$name tiene objetivo, 3 públicos, ubicaciones, exclusiones y Reels", ({ name }) => {
    const sec = section(`### ${name}: $`);
    expect(sec).toMatch(/Objetivo: registros \(`CompleteRegistration`\)/);
    const sets = tableRows(sec);
    expect(sets.map((r) => r[0].split(" ").slice(1).join(" "))).toEqual(["GLP-1", "Condominios", "Principiantes"]);
    for (const r of sets) {
      expect(r[1].length).toBeGreaterThan(10);
      expect(r[3]).toMatch(/^R\d{2} /);
      expect(r[4]).toMatch(/^R\d{2} .+\(\d{1,2} nov\)$/);
    }
    // Ubicaciones y exclusiones son comunes a todos los conjuntos.
    expect(doc).toMatch(/### Ubicaciones \(manuales, todos los conjuntos\)/);
    expect(doc).toMatch(/### Exclusiones \(todos los conjuntos\)/);
  });

  it("las exclusiones cubren registrados y suscriptores", () => {
    const ex = section("### Exclusiones");
    expect(ex).toContain("`CompleteRegistration`");
    expect(ex).toContain("`Subscribe`");
  });
});

describe("Reels del kit", () => {
  const kitHooks = new Map<number, string>();
  let week = "";
  for (const r of tableRows(kit.slice(kit.indexOf("## Plan de Reels de noviembre")))) {
    if (!/^\d+$/.test(r[1] ?? "")) break;
    if (r[0]) week = r[0];
    kitHooks.set(Number(r[1]), `${r[2]}|${week}`);
  }
  const weekStart = (n: number) => Number(kitHooks.get(n)!.split("|")[1].match(/^(\d+) al/)![1]);
  const weekEnd = (n: number) => Number(kitHooks.get(n)!.split("|")[1].match(/al (\d+) nov/)![1]);

  it("cada Reel citado existe en el kit con el mismo gancho", () => {
    const refs = [...doc.matchAll(/R(\d{2}) ([^|(]+?)\s*(?:\(\d+ nov\))?\s*\|/g)];
    expect(refs.length).toBeGreaterThan(0);
    for (const [, n, hook] of refs) {
      expect(kitHooks.has(Number(n)), `R${n} no está en el kit`).toBe(true);
      expect(kitHooks.get(Number(n))!.split("|")[0]).toBe(hook.trim());
    }
  });

  it("ningún anuncio empieza antes de la semana en que su Reel se publica", () => {
    for (const r of utmRows) {
      const n = Number(r[2].slice(1));
      const day = Number(r[3].match(/^(\d+) nov$/)![1]);
      expect(day, `R${n}`).toBeGreaterThanOrEqual(weekStart(n));
      expect(day).toBeGreaterThanOrEqual(5);
    }
  });

  it("el Reel B entra cuando su semana del kit ya empezó (y no después de terminar la siguiente)", () => {
    for (const r of utmRows.filter((x) => x[3] !== "5 nov")) {
      const n = Number(r[2].slice(1));
      const day = Number(r[3].split(" ")[0]);
      expect(day).toBeLessThanOrEqual(weekEnd(n) + 7);
    }
  });
});

describe("tabla de UTMs", () => {
  it("tiene 18 anuncios: 3 países × 3 públicos × 2 Reels", () => {
    expect(utmRows).toHaveLength(18);
    expect(doc).toContain("Los 18 anuncios de la tabla de UTMs");
  });

  it("cada anuncio tiene utm_campaign y utm_content únicos", () => {
    const campaigns = utmRows.map((r) => r[4]);
    const contents = utmRows.map((r) => r[5]);
    expect(new Set(campaigns).size).toBe(utmRows.length);
    expect(new Set(contents).size).toBe(utmRows.length);
  });

  it("los valores siguen el patrón, en minúsculas y bajo 80 caracteres", () => {
    for (const [country, , reel, , campaign, content] of utmRows) {
      const code = country.toLowerCase();
      expect(campaign).toMatch(new RegExp(`^bb-nov26-${code}-(glp1|condo|princ)-${reel.toLowerCase()}$`));
      expect(content).toBe(`${campaign.replace(/^bb-nov26-/, "")}-15s`);
      for (const v of [campaign, content]) expect(v.length).toBeLessThan(80);
    }
  });

  it("la URL final lleva los mismos UTMs que sus columnas y la página de su público", () => {
    for (const [, set, , , campaign, content, url] of utmRows) {
      const u = new URL(url);
      expect(u.origin).toBe("https://www.bananaburn.app");
      expect(u.pathname).toBe(set === "GLP-1" ? "/glp1" : "/");
      expect(u.searchParams.get("utm_source")).toBe("meta");
      expect(u.searchParams.get("utm_medium")).toBe("paid_social");
      expect(u.searchParams.get("utm_campaign")).toBe(campaign);
      expect(u.searchParams.get("utm_content")).toBe(content);
    }
  });

  it("los Reels de la tabla coinciden con los de cada país", () => {
    for (const { name, code } of COUNTRIES) {
      const sets = tableRows(section(`### ${name}: $`));
      const fromSets = sets.flatMap((r) => [r[3].slice(0, 3), r[4].slice(0, 3)]);
      const fromUtm = utmRows.filter((r) => r[0].toLowerCase() === code).map((r) => r[2]);
      expect(fromUtm).toEqual(fromSets);
    }
  });
});

describe("reglas de la marca", () => {
  it("todo texto de GLP-1 lleva la leyenda médica", () => {
    const glp1Copy = doc.split("\n").find((l) => l.startsWith("- **GLP-1 y bajada rápida**"))!;
    expect(glp1Copy).toContain("No sustituye la indicación de tu médico.");
  });

  it("los textos del anuncio no mencionan IA, escasez ni testimonios, y nada usa guiones largos", () => {
    const sec = section("Texto principal sugerido por público");
    const copy = [...sec.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(copy.length).toBeGreaterThanOrEqual(5);
    for (const t of copy) expect(t).not.toMatch(/\bIA\b|inteligencia artificial|últimos cupos|solo hoy|quedan|testimonio/i);
    expect(doc).not.toContain("\u2014");
  });
});
