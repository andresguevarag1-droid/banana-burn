// El embudo de registro a pago (marketing/estrategia/embudo-noviembre.md) fija metas y techos con precios de plans.ts y
// trial.ts, y afirma qué eventos de Meta salen de verdad: estas pruebas vigilan que las cifras cuadren con el código.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { toMetaEvent } from "@/lib/meta-pixel";
import { BETA_GRACE_UNTIL, PLANS } from "@/lib/plans";
import { DAY_MS, REMINDER_DAYS_BEFORE, RETRY_AFTER_DAYS, afterDecline, discountedMinor, promoApplies, promoPrice, reminderDue } from "@/lib/trial";

const doc = readFileSync("marketing/estrategia/embudo-noviembre.md", "utf8");

const money = (s: string) => Number(s.replace(/[*$,]/g, "").replace(/ por .*$/, "").trim());
const pct = (s: string) => Number(s.match(/([\d.]+) %/)![1]) / 100;
const cells = (line: string) => line.split("|").slice(1, -1).map((c) => c.trim());
const floor2 = (n: number) => Math.floor(n * 100 + 1e-9) / 100;

function section(title: string): string {
  const start = doc.indexOf(title);
  expect(start, `falta la sección ${title}`).toBeGreaterThanOrEqual(0);
  const next = doc.indexOf("\n#", start + title.length);
  return doc.slice(start, next === -1 ? undefined : next);
}
function tableRows(text: string): string[][] {
  return text.split("\n").filter((l) => l.startsWith("|") && !/^\|\s*-/.test(l)).slice(1).map(cells);
}

const summary = tableRows(section("## Resumen"));
const cascade = tableRows(section("### Del techo a cada etapa"));
const price = (id: string) => PLANS.find((p) => p.id === id)!.price;

describe("las 6 etapas", () => {
  it("el resumen tiene las 6 etapas del issue, en orden", () => {
    expect(summary.map((r) => r[0])).toEqual(["1", "2", "3", "4", "5", "6"]);
    const names = summary.map((r) => r[1]);
    expect(names[0]).toMatch(/Clic en el anuncio/);
    expect(names[1]).toMatch(/Llegada a la web/);
    expect(names[2]).toMatch(/Crear mi plan gratis/);
    expect(names[3]).toMatch(/Registro/);
    expect(names[4]).toMatch(/Tarjeta agregada/);
    expect(names[5]).toMatch(/Primer pago del 8 de noviembre/);
  });

  it("cada etapa tiene evento o fuente, partida (o [PENDIENTE]) y meta", () => {
    for (const [, , source, start, goal] of summary) {
      expect(source.length).toBeGreaterThan(0);
      expect(start).toMatch(/\[PENDIENTE\]|\$[\d.]+/);
      expect(goal).toMatch(/\d+(\.\d+)? %/);
    }
    // Cada [PENDIENTE] de la partida dice de dónde sale.
    for (const [, , , start] of summary) if (start.includes("[PENDIENTE]")) expect(start.replace(/\[PENDIENTE\]/g, "").trim().length).toBeGreaterThan(3);
  });

  it("cada etapa tiene su sección con qué cambiar si queda por debajo", () => {
    for (let n = 1; n <= 6; n++) expect(section(`### ${n}. `)).toMatch(/\*\*Si queda por debajo/);
  });

  it("usa el píxel del código", () => {
    expect(doc).toContain("1544502257509303");
  });
});

describe("costo por registro real", () => {
  it("incluye US$0.64 (Reel Cuánto peso) y unos US$1.01 el 28 de octubre", () => {
    expect(doc).toMatch(/\*\*US\$0\.64\*\* con el Reel "Cuánto peso"/);
    expect(doc).toMatch(/\*\*unos US\$1\.01\*\* de promedio de la campaña el 28 de octubre/);
  });

  it("las cifras derivadas cuadran con 35.2 %, $14.98 y $4.99", () => {
    const rows = tableRows(section("### Lo que dice el costo por registro real"));
    for (const [, cpr, perPaying, minConv, greenConv] of rows) {
      const c = money(cpr.replace("unos ", ""));
      expect(money(perPaying)).toBeCloseTo(c / 0.352, 2);
      expect(Number(minConv.replace(" %", ""))).toBeCloseTo((c / 14.98) * 100, 1);
      expect(Number(greenConv.replace(" %", ""))).toBeCloseTo((c / 4.99) * 100, 1);
    }
  });
});

describe("techo por cliente que paga", () => {
  it("es el primer mes de Entreno con 50 % más el segundo mes al precio normal", () => {
    expect(promoPrice("entreno")).toBe(4.99);
    expect(promoPrice("completo")).toBe(7.49);
    expect(discountedMinor(999)).toBe(499);
    expect(promoApplies("primer_mes_50", "anual")).toBe(false);
    const ceiling = Math.round((promoPrice("entreno") + price("entreno").mes) * 100) / 100;
    expect(ceiling).toBe(14.98);
    expect(doc).toContain(`**$${ceiling.toFixed(2)}**`);
    expect(summary[5][5]).toContain("$14.98");
  });

  it("es el caso más bajo de todos los planes", () => {
    const others = [promoPrice("completo") + price("completo").mes, price("entreno").mes * 2, price("entreno").anual, price("completo").anual];
    for (const o of others) expect(o).toBeGreaterThan(14.98);
    expect(doc).toContain("$22.48");
    expect(doc).toContain("$19.98");
  });

  it("con una comisión de 5 % baja a $14.23", () => {
    expect(floor2(14.98 * 0.95)).toBe(14.23);
    expect(doc).toContain("$14.23");
  });
});

describe("del techo a cada etapa", () => {
  // Metas del resumen, de la etapa 2 a la 6 (cada una respecto de la anterior).
  const goals = summary.slice(1).map((r) => pct(r[4]));

  it("las metas suman 35.2 % de registro a pago", () => {
    expect(goals[3] * goals[4]).toBeCloseTo(0.352, 6);
  });

  it("cada fila es la anterior por la meta de la etapa siguiente, redondeada hacia abajo como dice el documento", () => {
    expect(section("### Del techo a cada etapa")).toMatch(/redondeado hacia abajo al centavo/);
    expect(money(cascade[0][2])).toBe(14.98);
    for (let i = 1; i < cascade.length; i++) {
      const prev = money(cascade[i - 1][2]);
      const goal = goals[goals.length - i];
      expect(money(cascade[i][2]), `fila ${cascade[i][0]}`).toBe(floor2(prev * goal));
    }
  });

  it("el resumen usa los mismos máximos que la cascada", () => {
    const byStage = new Map(cascade.map((r) => [r[0].split(".")[0], money(r[2])]));
    for (const r of summary) expect(money(r[5]), `etapa ${r[0]}`).toBe(byStage.get(r[0]));
  });
});

describe("eventos que se disparan de verdad", () => {
  it("Lead sale de los botones de la landing y también de los del formulario de registro (cuenta de más)", () => {
    for (const cta of ["hero", "final", "nav", "sticky", "glp1-hero", "glp1-final", "glp1-sticky", "glp1-banda", "registro-google", "registro-password"])
      expect(toMetaEvent("cta_click", { cta })?.name, cta).toBe("Lead");
  });

  it("lo-mejor, pasos y oferta no dan Lead (cuenta de menos)", () => {
    for (const cta of ["lo-mejor", "pasos", "oferta"]) expect(toMetaEvent("cta_click", { cta }), cta).toBeNull();
  });

  it("la consulta de la etapa 3 toma los botones de la landing y deja fuera los del registro", () => {
    const re = new RegExp(section("### 3. ").match(/props->>'cta' ~ '([^']+)'/)![1]);
    for (const cta of ["hero", "final", "nav", "sticky", "lo-mejor", "pasos", "oferta", "glp1-hero", "glp1-banda"]) expect(re.test(cta), cta).toBe(true);
    for (const cta of ["registro-google", "registro-password", "hero-entrar", "nav-entrar"]) expect(re.test(cta), cta).toBe(false);
  });

  it("registro, tarjeta y pago a mano tienen su evento; la página no tiene evento propio en el mapa", () => {
    expect(toMetaEvent("onboarding_done", { trial: true })?.name).toBe("CompleteRegistration");
    expect(toMetaEvent("card_saved", { outcome: "rechazado" })?.name).toBe("AddPaymentInfo");
    expect(toMetaEvent("page_view")).toBeNull();
  });

  it("Subscribe manda el precio completo aunque el cobro lleve el 50 %", () => {
    const e = toMetaEvent("purchase_success", { plan: "Entreno", billing: "mes" });
    expect(e?.name).toBe("Subscribe");
    expect(e?.params.value).toBe(9.99);
  });
});

describe("fechas del cobro", () => {
  const charge = Date.parse(BETA_GRACE_UNTIL);

  it("el primer cobro de la cohorte es el 8 de noviembre a medianoche de Costa Rica, como en la consulta 6", () => {
    expect(BETA_GRACE_UNTIL).toBe("2026-11-08T06:00:00.000Z");
    expect(doc).toContain("t.charge_at = '2026-11-08 06:00+00'");
  });

  it("el aviso sale el 6 de noviembre y el reintento es el 9", () => {
    const row = { status: "scheduled" as const, kind: "beta" as const, charge_at: BETA_GRACE_UNTIL, reminder_sent_at: null };
    expect(REMINDER_DAYS_BEFORE).toBe(2);
    expect(reminderDue(row, new Date(charge - REMINDER_DAYS_BEFORE * DAY_MS))).toBe(true);
    expect(reminderDue(row, new Date(charge - REMINDER_DAYS_BEFORE * DAY_MS - 1))).toBe(false);
    expect(RETRY_AFTER_DAYS).toBe(1);
    expect(afterDecline({ attempts: 1 }, new Date(charge)).nextAttemptAt).toBe("2026-11-09T06:00:00.000Z");
    expect(doc).toMatch(/Vie 6 nov \| Sale el aviso de 48 horas/);
    expect(doc).toMatch(/Lun 9 nov \| Reintento/);
  });
});
