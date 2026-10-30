// Las 6 variantes A/B de noviembre (marketing/estrategia/variantes-ab-noviembre.md) se aprueban por sus textos, sus
// hipótesis y su tabla de UTMs: estas pruebas vigilan que cada variante tenga todos sus campos, que use piezas del kit,
// que siga las reglas de GLP-1 y condominios y que sus UTMs cuadren con la convención de meta-ads-noviembre.md.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const doc = readFileSync("marketing/estrategia/variantes-ab-noviembre.md", "utf8");
const kit = readFileSync("marketing/kit-reels-noviembre-2026.md", "utf8");
const plan = readFileSync("marketing/estrategia/meta-ads-noviembre.md", "utf8");

const cells = (line: string) => line.split("|").slice(1, -1).map((c) => c.trim());
const tableRows = (text: string) =>
  text.split("\n").filter((l) => l.startsWith("|") && !/^\|\s*-/.test(l)).slice(1).map(cells);

function section(title: string): string {
  const start = doc.indexOf(title);
  expect(start, `falta la sección ${title}`).toBeGreaterThanOrEqual(0);
  const next = doc.indexOf("\n## ", start + title.length);
  return doc.slice(start, next === -1 ? undefined : next);
}

function variant(n: number): string {
  const start = doc.indexOf(`### V${n}:`);
  expect(start, `falta V${n}`).toBeGreaterThanOrEqual(0);
  const next = doc.slice(start + 1).search(/\n##/);
  return doc.slice(start, next === -1 ? undefined : start + 1 + next);
}

function field(v: string, name: string): string {
  const m = v.match(new RegExp(`^- \\*\\*${name}[^*]*\\*\\*: (.+)$`, "m"));
  expect(m, `falta el campo ${name}`).not.toBeNull();
  return m![1];
}

const VARIANTS = [1, 2, 3, 4, 5, 6];
const GROUPS: Record<number, { section: string; reel: string; set: string; path: string }> = {
  1: { section: "## Principiantes", reel: "R01", set: "princ", path: "/" },
  2: { section: "## Principiantes", reel: "R01", set: "princ", path: "/" },
  3: { section: "## GLP-1 y bajada rápida", reel: "R02", set: "glp1", path: "/glp1" },
  4: { section: "## GLP-1 y bajada rápida", reel: "R02", set: "glp1", path: "/glp1" },
  5: { section: "## Condominios (solo Costa Rica)", reel: "R07", set: "condo", path: "/" },
  6: { section: "## Condominios (solo Costa Rica)", reel: "R03", set: "condo", path: "/" },
};
const summary = tableRows(section("## Resumen"));
const utmRows = tableRows(section("## Tabla de UTMs"));

const kitHooks = new Map<string, string>();
for (const r of tableRows(kit.slice(kit.indexOf("## Plan de Reels de noviembre")))) {
  if (!/^\d+$/.test(r[1] ?? "")) break;
  kitHooks.set(`R${r[1].padStart(2, "0")}`, r[2]);
}

describe("las 6 variantes", () => {
  it("hay 6: 2 de principiantes, 2 de GLP-1 y 2 de condominios", () => {
    expect([...doc.matchAll(/^### V(\d):/gm)].map((m) => Number(m[1]))).toEqual(VARIANTS);
    for (const n of VARIANTS) {
      const sec = section(GROUPS[n].section);
      expect(sec, `V${n} no está en ${GROUPS[n].section}`).toContain(`### V${n}:`);
    }
    expect(summary.map((r) => r[0])).toEqual(VARIANTS.map((n) => `V${n}`));
  });

  it.each(VARIANTS)("V%i tiene gancho, texto, título, CTA, hipótesis y métrica con mínimo de datos", (n) => {
    const v = variant(n);
    for (const f of ["Pieza del kit", "Gancho", "Texto principal", "Título", "CTA", "Hipótesis", "Decide"]) {
      expect(field(v, f).length, `V${n}: ${f} vacío`).toBeGreaterThan(5);
    }
    expect(field(v, "CTA")).toMatch(/^Registrarte\./);
    expect(field(v, "Decide")).toMatch(/^costo por registro .+ con \$\d+ gastados y 7 días como mínimo\./);
  });

  it.each(VARIANTS)("V%i: la hipótesis es una línea con si X y el costo por registro a Y, igual al resumen", (n) => {
    const h = field(variant(n), "Hipótesis");
    const m = h.match(/^si .+, .*el costo por registro baja a (\$\d+\.\d{2})\.$/);
    expect(m, `V${n}: ${h}`).not.toBeNull();
    expect(summary[n - 1][6]).toBe(m![1]);
    // Y es una meta por debajo del techo de $5.25 del plan.
    expect(Number(m![1].slice(1))).toBeLessThan(5.25);
  });

  it.each(VARIANTS)("V%i: el gancho del primer segundo cabe en 8 palabras y coincide con el resumen", (n) => {
    const hook = field(variant(n), "Gancho");
    expect(hook.split(/\s+/).length).toBeLessThanOrEqual(8);
    expect(summary[n - 1][3]).toBe(hook);
  });

  it("el mínimo para decidir de cada público es el del plan de Meta Ads", () => {
    expect(section("## Principiantes")).toContain("**$15 gastados por variante y 7 días**");
    expect(section("## GLP-1 y bajada rápida")).toContain("**$20 gastados por variante y 7 días**");
    expect(section("## Condominios (solo Costa Rica)")).toContain("**$15 gastados por variante y 7 días**");
    expect(plan).toMatch(/GLP-1 .+mínimo \$20 gastados por anuncio/);
    expect(plan).toMatch(/Principiantes .+mínimo \$15 gastados por anuncio/);
  });
});

describe("piezas del kit de Reels", () => {
  it.each(VARIANTS)("V%i usa un Reel que existe en el kit, con su mismo gancho", (n) => {
    const piece = field(variant(n), "Pieza del kit");
    // V2 y V4 citan el Reel sin repetir su gancho; si lo citan, tiene que ser el del kit.
    const m = piece.match(/^(R\d{2})(?: "([^"]+)")?/);
    expect(m, piece).not.toBeNull();
    expect(m![1]).toBe(GROUPS[n].reel);
    expect(kitHooks.has(m![1])).toBe(true);
    if (m![2]) expect(kitHooks.get(m![1])).toBe(m![2]);
    expect(summary[n - 1][2]).toMatch(new RegExp(`^${m![1]} `));
  });

  it.each(VARIANTS)("V%i solo usa videos base 1 a 5 y capturas del kit", (n) => {
    const piece = field(variant(n), "Pieza del kit");
    for (const [, num] of piece.matchAll(/[Vv]ideo base (\d)/g)) expect(Number(num)).toBeGreaterThanOrEqual(1);
    for (const [, num] of piece.matchAll(/[Vv]ideo base (\d)/g)) expect(Number(num)).toBeLessThanOrEqual(5);
    for (const [, cap] of piece.matchAll(/captura `([a-z0-9]+)`/g)) expect(kit, `captura ${cap}`).toContain(`| ${cap} |`);
  });
});

describe("reglas de GLP-1", () => {
  it.each([3, 4])("V%i termina su texto con la leyenda médica y la lleva en el Reel", (n) => {
    const v = variant(n);
    expect(field(v, "Texto principal")).toMatch(/No sustituye la indicación de tu médico\.$/);
    expect(field(v, "Pieza del kit")).toMatch(/[Ll]eyenda/);
  });

  it("ninguna variante dice ¿usas GLP-1? ni tu tratamiento en su texto", () => {
    for (const n of VARIANTS) {
      const v = variant(n);
      const copy = ["Gancho", "Texto principal", "Título", "Guion de 15 s"].map((f) => field(v, f)).join(" ");
      expect(copy).not.toMatch(/usas GLP-1|tu tratamiento|GLP-1/i);
    }
  });

  it("los datos de proteína y fuerza son los del consenso 2025 de evidencia-programas.md", () => {
    const evidencia = readFileSync("investigacion/evidencia-programas.md", "utf8");
    expect(evidencia).toMatch(/Advisory conjunto 2025 \(ACLM, ASN, OMA, TOS\)/);
    expect(evidencia).toContain("1,2 a 1,6 g/kg/día");
    expect(evidencia).toContain("al menos 3 sesiones por semana");
    expect(field(variant(4), "Texto principal")).toContain("de 1.2 a 1.6 g de proteína por kg al día");
    expect(field(variant(4), "Texto principal")).toContain("fuerza al menos 3 veces por semana");
  });
});

describe("reglas de condominios", () => {
  it.each([5, 6])("V%i dice primer mes gratis para todos los residentes y que la administración no paga", (n) => {
    const t = field(variant(n), "Texto principal");
    expect(t).toContain("el primer mes es gratis para todos los residentes");
    expect(t).toMatch(/[Ee]l condominio no paga nada/);
    // La oferta es del condominio que se suma, no de cualquiera que vea el anuncio.
    expect(t).toMatch(/[Ss]i tu administración suma el condominio/);
    expect(field(variant(n), "Guion de 15 s")).toMatch(/Primer mes gratis para todos los residentes/);
  });

  it("V5 y V6 solo corren en Costa Rica salvo que Andrés confirme la oferta en GT y CO", () => {
    for (const r of utmRows.filter((x) => x[1] === "Condominios")) {
      if (r[0] === "CR") expect(r[4]).toBe("Al aprobarse");
      else expect(r[4]).toBe("Solo si Andrés confirma la oferta en el país");
    }
  });
});

describe("tabla de UTMs", () => {
  it("tiene 18 filas: 6 variantes en 3 países, todas únicas", () => {
    expect(utmRows).toHaveLength(18);
    expect(new Set(utmRows.map((r) => r[5])).size).toBe(18);
    expect(new Set(utmRows.map((r) => r[6])).size).toBe(18);
  });

  it("sigue la convención de meta-ads-noviembre.md y la URL lleva los mismos UTMs", () => {
    for (const [country, , v, start, , campaign, content, url] of utmRows) {
      const n = Number(v.slice(1));
      const g = GROUPS[n];
      const code = country.toLowerCase();
      expect(campaign).toBe(`bb-nov26-${code}-${g.set}-${g.reel.toLowerCase()}v${n}`);
      expect(content).toBe(`${campaign.replace(/^bb-nov26-/, "")}-15s`);
      expect(campaign.length).toBeLessThan(80);
      expect(summary[n - 1][5]).toBe(start);
      const u = new URL(url);
      expect(u.origin).toBe("https://www.bananaburn.app");
      expect(u.pathname).toBe(g.path);
      expect(u.searchParams.get("utm_source")).toBe("meta");
      expect(u.searchParams.get("utm_medium")).toBe("paid_social");
      expect(u.searchParams.get("utm_campaign")).toBe(campaign);
      expect(u.searchParams.get("utm_content")).toBe(content);
      // El plan usa la misma estructura para el Reel base.
      expect(plan).toContain(`bb-nov26-${code}-${g.set}-${g.reel.toLowerCase()} `);
    }
  });

  it("la lista para aprobar cuenta 14 anuncios en la base y 4 más si se confirma GT y CO", () => {
    expect(utmRows.filter((r) => r[4] === "Al aprobarse")).toHaveLength(14);
    expect(doc).toContain("14 anuncios");
    expect(doc).toContain("se suman 4 anuncios");
  });
});

describe("reglas de la marca", () => {
  it("ningún texto menciona IA, medicamentos, escasez ni testimonios; sin guiones largos ni exclamaciones", () => {
    const meds = /semaglut|tirzepat|liraglut|retatrut|orforglip|cagrisema|ozempic|wegovy|mounjaro|zepbound|saxenda/i;
    for (const n of VARIANTS) {
      const v = variant(n);
      const copy = ["Gancho", "Texto principal", "Título", "Guion de 15 s"].map((f) => field(v, f)).join(" ");
      expect(copy).not.toMatch(/\bIA\b|inteligencia artificial|últimos cupos|solo hoy|quedan|testimonio|!|¡/i);
      expect(copy).not.toMatch(/banano/i);
    }
    expect(doc).not.toMatch(meds);
    expect(doc).not.toContain("—");
  });

  it("el README de marketing enlaza el documento", () => {
    expect(readFileSync("marketing/README.md", "utf8")).toContain("variantes-ab-noviembre.md");
  });
});
