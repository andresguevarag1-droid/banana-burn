// El acta de los 100 usuarios de pago (docs/metas/100-usuarios-de-pago.md) cita cifras del embudo de noviembre y precios
// y fechas del código: estas pruebas vigilan que no se copien a mano con otros números ni nombren piezas que no existen.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { usd2 as usd } from "@/lib/num";
import { BETA_ENDS_AT, BETA_GRACE_UNTIL, PLANS } from "@/lib/plans";
import { SEASONS_T1, SEASON_WEEKS, T1_START } from "@/lib/seasons";
import { REMINDER_DAYS_BEFORE, RETRY_AFTER_DAYS, promoPrice } from "@/lib/trial";

const doc = readFileSync("docs/metas/100-usuarios-de-pago.md", "utf8");
const embudo = readFileSync("marketing/estrategia/embudo-noviembre.md", "utf8");

const cells = (line: string) => line.split("|").slice(1, -1).map((c) => c.trim());

function section(text: string, title: string): string {
  const start = text.indexOf(title);
  expect(start, `falta la sección ${title}`).toBeGreaterThanOrEqual(0);
  const next = text.indexOf("\n## ", start + title.length);
  return text.slice(start, next === -1 ? undefined : next);
}
function tableRows(text: string): string[][] {
  return text.split("\n").filter((l) => l.startsWith("|") && !/^\|\s*-/.test(l)).slice(1).map(cells);
}

const cuenta = tableRows(section(doc, "### Cuenta hacia atrás"));
const row = (paso: string) => {
  const r = cuenta.find((c) => c[0].startsWith(paso));
  expect(r, `falta la fila ${paso}`).toBeDefined();
  return r!;
};
// Metas del resumen del embudo: etapa 5 (tarjeta) y etapa 6 (cobro).
const resumen = tableRows(section(embudo, "## Resumen"));
const goal = (stage: string) => Number(resumen.find((r) => r[0] === stage)![4].match(/([\d.]+) %/)![1]) / 100;
const card = goal("5");
const charged = goal("6");
const conv = card * charged;
const costPerReg = 1.01;
const bestCostPerReg = 0.64;
const entreno = PLANS.find((p) => p.id === "entreno")!;
const ceiling = Math.round((promoPrice("entreno") + entreno.price.mes) * 100) / 100;
const regs = Math.ceil(100 / conv);

describe("la cuenta hacia atrás", () => {
  it("usa la conversión de registro a pago del embudo (40 % × 88 % = 35.2 %)", () => {
    expect(card).toBe(0.4);
    expect(charged).toBe(0.88);
    expect(embudo).toContain("**35.2 %**");
    expect(row("Conversión de registro a pago")[1]).toBe(`${(conv * 100).toFixed(1)} %`);
  });

  it("100 usuarios de pago piden 285 registros y 114 tarjetas", () => {
    expect(regs).toBe(285);
    expect(row("Registros completos")[1]).toBe(String(regs));
    expect(row("Tarjetas guardadas")[1]).toBe(String(Math.round(regs * card)));
    expect(regs * conv).toBeGreaterThanOrEqual(100);
  });

  it("el costo por registro sale del embudo: unos $1.01 de promedio y $0.64 del mejor anuncio", () => {
    expect(embudo).toMatch(/\*\*unos US\$1\.01\*\* de promedio de la campaña el 28 de octubre/);
    expect(embudo).toMatch(/\*\*US\$0\.64\*\* con el Reel "Cuánto peso"/);
    expect(row("Gasto en anuncios al costo real")[1]).toBe(`${usd(regs * costPerReg)} (unos $290)`);
    expect(Math.round((regs * costPerReg) / 10) * 10).toBe(290);
    expect(row("Gasto con el mejor anuncio")[1]).toBe(usd(regs * bestCostPerReg));
    expect(row("Costo por cliente que paga al costo real")[1]).toBe(usd(costPerReg / conv));
    expect(embudo).toContain(usd(costPerReg / conv));
  });

  it("el techo de $14.98 sale de los precios de plans.ts y trial.ts", () => {
    expect(ceiling).toBe(14.98);
    expect(row("Techo por cliente que paga")[1]).toBe(usd(ceiling));
    expect(row("Techo por cliente que paga")[2]).toContain(usd(promoPrice("entreno")));
    expect(row("Techo por cliente que paga")[2]).toContain(usd(entreno.price.mes));
    expect(embudo).toContain(`**${usd(ceiling)}**`);
    expect(row("Gasto máximo para 100 clientes")[1]).toBe(usd(100 * ceiling));
  });

  it("cada fila dice su fuente y el conteo actual queda [PENDIENTE]", () => {
    for (const r of cuenta) expect(r[3].length, r[0]).toBeGreaterThan(3);
    expect(section(doc, "## 1. La meta y la cuenta")).toMatch(/\*\*Conteo actual: \[PENDIENTE\]\.\*\*/);
  });
});

describe("las fechas que cobran pronto", () => {
  const fechas = tableRows(section(doc, "## 2. Fechas que cobran pronto"));
  const crDay = (iso: string) => new Date(Date.parse(iso) - 6 * 3600_000).toISOString().slice(0, 10);
  const day = (iso: string) => `${Number(iso.slice(8, 10))} nov`;
  const t1 = SEASONS_T1[0];

  it("lanzamiento, primer cobro, aviso y reintento coinciden con el código", () => {
    expect(fechas.find((f) => f[1].startsWith("Lanzamiento"))![0]).toContain(day(crDay(BETA_ENDS_AT)));
    expect(fechas.find((f) => f[1].startsWith("Primer cobro"))![0]).toContain(day(crDay(BETA_GRACE_UNTIL)));
    expect(BETA_GRACE_UNTIL).toBe("2026-11-08T06:00:00.000Z");
    expect(fechas.find((f) => f[1].startsWith("Aviso de 48 horas"))![0]).toContain(day(crDay(new Date(Date.parse(BETA_GRACE_UNTIL) - REMINDER_DAYS_BEFORE * 864e5).toISOString())));
    expect(fechas.find((f) => f[1].startsWith("Reintento"))![0]).toContain(day(crDay(new Date(Date.parse(BETA_GRACE_UNTIL) + RETRY_AFTER_DAYS * 864e5).toISOString())));
  });

  it("la Temporada 1 empieza el 9 de noviembre, dura 8 semanas y cierra inscripciones el 22", () => {
    expect(T1_START).toBe("2026-11-09");
    expect(SEASON_WEEKS).toBe(8);
    for (const s of SEASONS_T1) expect(s.enrollUntil).toBe("2026-11-22");
    expect(t1.endsOn).toBe("2027-01-03");
    expect(fechas.find((f) => f[1].startsWith("Cierran las inscripciones"))![0]).toContain(day(t1.enrollUntil));
    expect(doc).toContain("hasta el 3 de enero");
  });

  it("la oferta de condominios queda solo en Costa Rica", () => {
    expect(fechas.find((f) => f[1].startsWith("Condominios"))![1]).toContain("Solo Costa Rica.");
  });
});

describe("el equipo", () => {
  const agentes = tableRows(section(doc, "## 3. Meta, métrica y tareas"));

  it("cada Agente tiene paso del embudo, meta, métrica, tareas y lo que hay en main", () => {
    const names = agentes.map((a) => a[0].split(" (")[0]);
    expect(names).toEqual(["Martín", "Adrian", "Lucía", "Mateo", "Camila", "Valeria", "Bruno", "Sofía", "Grace", "Linus"]);
    expect(agentes.at(-1)![0]).toContain("Diego");
    for (const a of agentes) {
      expect(a).toHaveLength(6);
      for (const c of a) expect(c.length, a[0]).toBeGreaterThan(3);
    }
  });

  it("la meta de Lucía es la de tarjeta del embudo y la de Martín el techo", () => {
    expect(agentes.find((a) => a[0].startsWith("Lucía"))![2]).toContain(`${card * 100} %`);
    expect(agentes.find((a) => a[0].startsWith("Martín"))![2]).toContain(usd(ceiling));
    expect(agentes.find((a) => a[0].startsWith("Martín"))![2]).toContain(String(regs));
  });
});

describe("traspasos reales", () => {
  // Rutas del repo citadas entre comillas invertidas (los patrones con <código> son rutas web, no archivos).
  const paths = [...doc.matchAll(/`((?:src|docs|marketing|scripts|supabase)\/[^`<]+?)`/g)].map((m) => m[1]);
  const missing = ["docs/metas/tablero-diario.sql"];

  it("todo archivo citado existe en el repo, salvo los que el acta marca como pendientes", () => {
    expect(paths.length).toBeGreaterThan(15);
    for (const p of paths) if (!missing.includes(p)) expect(existsSync(p), p).toBe(true);
    for (const p of missing) {
      expect(existsSync(p), `${p} ya está en main: actualiza el acta`).toBe(false);
      expect(doc).toMatch(new RegExp(`\`${p.replace(/\./g, "\\.")}\`\\), que \\*\\*aún no está en main\\*\\*`));
    }
  });

  it("/r/<código> descarta los UTM hoy, como dice el acta", () => {
    const route = readFileSync("src/app/r/[code]/route.ts", "utf8");
    expect(route).toMatch(/new URL\("\/entrar", req\.url\)/);
    expect(route).not.toMatch(/searchParams\.get|utm_/);
    expect(readFileSync("marketing/estrategia/referidos/compartir.md", "utf8")).toContain("/r/{codigo}?utm_source=referido");
  });

  it("el aviso de tarjeta de la app y el correo 08 abren con la misma frase", () => {
    const frase = "Deja tu tarjeta lista y paga 50 % menos tu primer mes.";
    expect(doc).toContain(frase);
    // La app usa un espacio duro (U+00A0) antes de "%".
    expect(readFileSync("src/components/card-banner.tsx", "utf8").replace(/\u00a0/g, " ")).toContain(frase);
    expect(readFileSync("marketing/estrategia/correos/08-oferta-50-tarjeta.md", "utf8")).toContain(frase);
  });

  it("R04 y R12 siguen fuera de los anuncios de noviembre", () => {
    expect(readFileSync("marketing/estrategia/meta-ads-noviembre.md", "utf8")).toContain("**R04 y R12 (Temporada 1) no entran**");
  });
});

describe("reglas de comunicación y de marca", () => {
  it("cada PR dice qué paso del embudo mueve, con los 6 pasos", () => {
    const com = section(doc, "## 5. Cómo se comunica el equipo");
    expect(com).toMatch(/\*\*Cada PR dice qué paso del embudo mueve\*\* \(visitas, registros, primer entreno, tarjeta, primer pago o retención\)/);
    expect(com).toContain("**Cada lunes**");
  });

  it("dice lo que el equipo necesita de Andrés", () => {
    const pide = section(doc, "## 7. Lo que el equipo necesita de Andrés");
    for (const t of ["conteo actual de pagos", "cifras de Ads Manager", "presupuesto aprobado", "aprobación de los PRs pendientes"]) expect(pide).toContain(t);
  });

  it("sin guiones largos, sin emojis y con números es-419", () => {
    expect(doc).not.toContain("—");
    expect(doc).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(doc).not.toMatch(/\$\d+,\d{2}\b(?!\d)/);
    expect(doc).not.toMatch(/banano/i);
  });
});
