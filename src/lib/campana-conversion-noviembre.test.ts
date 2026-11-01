// La propuesta de campaña de conversión desde el 9 de noviembre (docs/metas/campana-conversion-noviembre.md) depende de la
// regla de rentabilidad-semanal.md: estas pruebas vigilan que sus techos y niveles cuadren con plans.ts y trial.ts, que las
// fechas y consultas sean las de los documentos y que nada quede activado ni con cifras inventadas.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { usd2 as usd } from "@/lib/num";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";
import { RETRY_AFTER_DAYS, promoPrice } from "@/lib/trial";

const doc = readFileSync("docs/metas/campana-conversion-noviembre.md", "utf8");
const regla = readFileSync("docs/metas/rentabilidad-semanal.md", "utf8");
const embudo = readFileSync("marketing/estrategia/embudo-noviembre.md", "utf8");

const cells = (line: string) => line.split("|").slice(1, -1).map((c) => c.trim());
function section(title: string): string {
  const start = doc.indexOf(title);
  expect(start, `falta la sección ${title}`).toBeGreaterThanOrEqual(0);
  const next = doc.indexOf("\n## ", start + title.length);
  return doc.slice(start, next === -1 ? undefined : next);
}
const tableRows = (text: string) => text.split("\n").filter((l) => l.startsWith("|") && !/^\|\s*-/.test(l)).slice(1).map(cells);
const price = (id: string) => PLANS.find((p) => p.id === id)!.price;
const cents = (n: number) => Math.round(n * 100);
/** Techo × 35.2 %, hacia abajo al centavo, en enteros para no arrastrar errores de coma flotante. */
const porPrueba = (n: number) => Math.floor((cents(n) * 352) / 1000) / 100;
const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

describe("la condición", () => {
  const s = section("## 1. La condición");

  it("lee la semana del 2 al 8 de noviembre y propone gastar desde el lunes 9", () => {
    expect(weekday("2026-11-02")).toBe(1);
    expect(weekday("2026-11-08")).toBe(0);
    expect(weekday("2026-11-09")).toBe(1);
    expect(s).toContain("semana del lunes 2 al domingo 8 de noviembre");
    expect(readFileSync("docs/metas/rentabilidad-semanal.sql", "utf8")).toContain("date '2026-11-02' as lunes");
  });

  it("reactivar cuenta como subir y exige pagos, margen, comisión, datos completos y máximo positivo", () => {
    for (const t of ["**N > 0**", "**I − G ≥ 0**", "**mínimo(I, tope semanal) > G**", "conciliados con Tilopay y ONVO"]) expect(s).toContain(t);
    expect(s).toMatch(/cuenta como \*\*subir\*\*/);
    expect(regla).toMatch(/la decisión puede ser "mantener" o "pausar", nunca "subir"/);
    expect(regla).toContain("mínimo(ingresos nuevos netos de la semana N, tope semanal)");
  });

  it("el reintento del 9 no cuenta para la condición", () => {
    expect(RETRY_AFTER_DAYS).toBe(1);
    expect(s).toContain("`RETRY_AFTER_DAYS` = 1");
    expect(s).toMatch(/no presta contra cobros futuros/);
  });

  it("distingue reactivar desde cero de mantener un gasto existente", () => {
    expect(s).toContain("Si la semana del 2 al 8 no tuvo gasto (G = 0), basta con que ese máximo sea mayor que cero");
    expect(s).toContain('si hubo gasto y el máximo queda en G o por debajo, la regla dice "mantener", no "subir"');
    expect(regla).toContain("el máximo de la semana siguiente es mayor que el gasto de esta semana");
  });
});

describe("qué leer el 9 de noviembre", () => {
  const s = section("## 2. Qué leer");

  it("usa las tres consultas de solo lectura que existen", () => {
    for (const q of ["rentabilidad-semanal.sql", "tablero-diario.sql", "embudo-de-pago.sql"]) {
      expect(existsSync(`docs/metas/${q}`)).toBe(true);
      expect(s).toContain(`\`${q}\``);
    }
  });

  it("las columnas que nombra existen en cada consulta", () => {
    const tablero = readFileSync("docs/metas/tablero-diario.sql", "utf8");
    for (const c of ["gasto_usd", "cobros_exitosos", "usuarios_pago", "total_usuarios_pago", "costo_cliente_pago_total_usd"]) expect(tablero).toContain(c);
    const funnel = readFileSync("docs/metas/embudo-de-pago.sql", "utf8");
    for (const c of ["tasa_pago_pct", "pagaron_mensual", "pagaron_anual", "pagaron_entreno", "pagaron_completo", "pagaron_sin_tarjeta", "paso_con_mas_perdida", "pago_cerrado"])
      expect(funnel).toContain(c);
    const semanal = readFileSync("docs/metas/rentabilidad-semanal.sql", "utf8");
    for (const c of ["pagos_nuevos", "ingresos_brutos_usd"]) expect(semanal).toContain(c);
  });

  it("dice que el plan de octubre no existe y deja sus datos por medir", () => {
    expect(existsSync("marketing/plan-ads-octubre-2026.md")).toBe(false);
    expect(s).toContain("**`marketing/plan-ads-octubre-2026.md` no existe en el repositorio**");
    for (const r of tableRows(s.slice(s.indexOf("| Dato |")))) expect(r[2]).toMatch(/^(por medir|por confirmar con Andrés)$/);
  });
});

describe("costo máximo por usuario de pago", () => {
  const rows = tableRows(section("## 3. Costo máximo"));
  const cases: [string, number, number][] = [
    ["Entreno, primer mes con 50 %", promoPrice("entreno"), promoPrice("entreno") + 2 * price("entreno").mes],
    ["Entreno, mensual sin 50 %", price("entreno").mes, 3 * price("entreno").mes],
    ["Entreno, anual", price("entreno").anual, price("entreno").anual],
    ["Entreno + Nutrición, primer mes con 50 %", promoPrice("completo"), promoPrice("completo") + 2 * price("completo").mes],
    ["Entreno + Nutrición, mensual sin 50 %", price("completo").mes, 3 * price("completo").mes],
    ["Entreno + Nutrición, anual", price("completo").anual, price("completo").anual],
  ];

  it("tiene las 6 combinaciones de la regla", () => {
    expect(rows.map((r) => r[0])).toEqual(cases.map((c) => c[0]));
  });

  it.each(cases)("%s: primer mes, 3 meses y por prueba iniciada cuadran con el código", (name, first, three) => {
    const r = rows.find((x) => x[0] === name)!;
    expect(r[1]).toBe(usd(first));
    expect(r[2]).toBe(usd(cents(three) / 100));
    expect(r[3]).toBe(usd(porPrueba(first)));
    expect(r[4]).toBe(usd(porPrueba(cents(three) / 100)));
    expect(regla).toContain(`| ${name} | ${usd(first)} |`);
  });

  it("el caso más exigente es Entreno con 50 % y la renovación queda por medir", () => {
    const s = section("## 3. Costo máximo");
    expect(s).toContain(`**${usd(promoPrice("entreno"))} por usuario de pago y ${usd(porPrueba(promoPrice("entreno")))} por prueba iniciada**`);
    expect(s).toMatch(/renovación de los meses 2 y 3 está por medir/);
    expect(s).toContain("35.2 %");
  });
});

describe("la campaña si se cumple", () => {
  const s = section("## 4. Si la regla se cumple");

  it("es solo Costa Rica, con prueba iniciada o Subscribe y sin nada activado", () => {
    expect(s).toMatch(/\| País \| Solo Costa Rica \|/);
    expect(s).toMatch(/\*\*prueba iniciada\*\* \(`CompleteRegistration`\)/);
    expect(s).toContain("**Subscribe**");
    expect(s).toMatch(/se configura solo después del sí de Andrés/);
  });

  it("la prueba empieza sin tarjeta y dura lo que dice plans.ts", () => {
    expect(TRIAL_DAYS).toBe(7);
    expect(s).toContain("La prueba de 7 días empieza al crear la cuenta, sin tarjeta");
    expect(readFileSync("src/lib/meta-capi.ts", "utf8")).toMatch(/export async function sendChargeSubscribe[\s\S]*?\n}/);
    expect(readFileSync("src/lib/meta-capi.ts", "utf8")).toContain('action_source: "system_generated"');
  });

  it("el único dato de octubre por anuncio es el de embudo-noviembre.md", () => {
    expect(embudo).toMatch(/\| Reel "Cuánto peso" \| \$0\.64 \|/);
    expect(embudo).toMatch(/\| Promedio de la campaña el 28 oct \| unos \$1\.01 \|/);
    expect(s).toContain("costó $0.64 por registro completado contra unos $1.01");
    expect(s).toMatch(/\| B \|.*\| por medir: sale del export/);
  });

  it("las URLs llevan los UTM de su fila y van a la portada", () => {
    const rows = tableRows(s.slice(s.indexOf("| Anuncio | utm_campaign")));
    expect(rows).toHaveLength(2);
    for (const [, campaign, content, url] of rows) {
      const u = new URL(url);
      expect(u.origin + u.pathname).toBe("https://www.bananaburn.app/");
      expect(u.searchParams.get("utm_source")).toBe("meta");
      expect(u.searchParams.get("utm_medium")).toBe("paid_social");
      expect(u.searchParams.get("utm_campaign")).toBe(campaign);
      expect(u.searchParams.get("utm_content")).toBe(content);
    }
  });

  it("pausar un anuncio es el doble del caso más exigente", () => {
    const strict = porPrueba(promoPrice("entreno"));
    expect(s).toContain(`pasa de ${usd(strict * 2)}, el doble del caso más exigente de la sección 3 (${usd(strict)})`);
  });

  it("GLP-1 lleva la leyenda médica", () => {
    expect(s).toContain("No sustituye la indicación de tu médico.");
  });
});

describe("si no se cumple", () => {
  const s = section("## 5. Si la regla no se cumple");

  it("el gasto es $0.00 y la siguiente lectura es el lunes 16", () => {
    expect(s).toContain("**$0.00**");
    expect(weekday("2026-11-16")).toBe(1);
    expect(s).toContain("**La siguiente lectura es el lunes 16 de noviembre**, con `lunes` = `date '2026-11-09'`");
  });

  it("sigue el orden de la regla: pausar, mantener y solo subir hasta el máximo", () => {
    expect(tableRows(s).map((r) => r[1])).toEqual(["Pausar", "Pausar", "Mantener en $0.00", "Subir solo hasta el máximo"]);
  });
});

describe("presupuesto en 3 niveles", () => {
  const s = section("## 6. Presupuesto en 3 niveles");
  const rows = tableRows(s);
  const money = (t: string) => Number(t.replace(/[$,]/g, ""));
  const prices = [promoPrice("entreno"), promoPrice("completo"), price("entreno").mes, price("completo").mes];

  it("es decisión de Andrés y está pendiente", () => {
    expect(s).toMatch(/^## 6\. Presupuesto en 3 niveles: decisión de Andrés/);
    expect(s).toMatch(/Aprobación de Andrés: \*\*pendiente\*\*/);
  });

  it("cada nivel multiplica por 7 días, pide su máximo y calcula los pagos para recuperarse", () => {
    expect(rows.map((r) => r[0])).toEqual(["1", "2", "3"]);
    for (const r of rows) {
      const week = money(r[1]) * 7;
      expect(r[2]).toBe(usd(week));
      expect(r[7]).toBe(`Máximo de la regla de ${usd(week)} o más`);
      prices.forEach((p, i) => expect(Number(r[3 + i]), `${r[0]} a ${usd(p)}`).toBe(Math.ceil(cents(week) / cents(p))));
    }
    expect(s).toContain(`(${usd(promoPrice("entreno"))})`);
  });

  it("los pagos anuales por nivel cuadran", () => {
    const [e, c] = [price("entreno").anual, price("completo").anual];
    const n = (week: number, p: number) => Math.ceil(cents(week) / cents(p));
    const weeks = rows.map((r) => money(r[2]));
    expect(n(weeks[0], e)).toBe(1);
    expect(n(weeks[0], c)).toBe(1);
    expect(s).toContain(`nivel 2, ${n(weeks[1], e)} pagos de ${usd(e)} o ${n(weeks[1], c)} de ${usd(c)}`);
    expect(s).toContain(`nivel 3, ${n(weeks[2], e)} pagos de ${usd(e)} o ${n(weeks[2], c)} de ${usd(c)}`);
  });

  it("el mínimo de la sección 8 son los pagos de $4.99 de cada nivel", () => {
    const need = rows.map((r) => r[3]);
    expect(section("## 8. Qué paso")).toContain(`${need[0]}, ${need[1]} o ${need[2]} pagos de ${usd(promoPrice("entreno"))}`);
  });
});

describe("medición y reglas de la oficina", () => {
  it("explica la meta redondeada sin cambiar la tasa usada para calcular los techos", () => {
    const acta = readFileSync("docs/metas/100-usuarios-de-pago.md", "utf8");
    expect(acta).toContain("35.2 %");
    const s = section("## 8. Qué paso");
    expect(s).toContain("35 %, la meta redondeada de la oficina");
    expect(s).toContain("35.2 % porque es la cifra exacta del acta (40 % deja la tarjeta × 88 % se cobra bien)");
    expect(40 * 88 / 100).toBe(35.2);
  });

  it("la cohorte del 9 al 15 se cierra el miércoles 25", () => {
    expect(weekday("2026-11-23")).toBe(1);
    expect(weekday("2026-11-25")).toBe(3);
    expect(section("## 7. Cómo se mide")).toContain("Provisional el lunes 23 de noviembre; cerrado el miércoles 25");
  });

  it("dice qué paso mueve, cómo se mide y cuánto dinero, con precios del código", () => {
    const s = section("## 8. Qué paso");
    expect(s).toMatch(/\*\*Paso: prueba a pago\*\*/);
    expect(s).toMatch(/\*\*Cómo se mide:\*\*/);
    expect(s).toContain(`entre ${usd(promoPrice("entreno"))} (Entreno con 50 %) y ${usd(price("completo").anual)} (Entreno + Nutrición anual)`);
    expect(s).toContain(`${usd(price("entreno").mes)} o ${usd(price("completo").mes)}`);
  });

  it("nada se activa sin Andrés", () => {
    expect(doc).toContain("**Nada se activa sin la aprobación de Andrés por escrito**");
    expect(doc).toMatch(/\*\*Es una propuesta, no un gasto\.\*\*/);
  });

  it("sigue las reglas de marca", () => {
    expect(doc).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(doc).not.toMatch(/—|\bIA\b|banano|!/);
  });
});
