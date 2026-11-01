import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLANS } from "./plans";
import { usd2 } from "./num";
import {
  REF_GROUP_SIZE, REF_BASE_MONTHS, REF_ANNUAL_MONTHS, REF_WINDOW_DAYS,
  REF_ATTRIBUTION_HOURS, REF_COOKIE_MAX_AGE, REF_MAX_REWARDS_YEAR,
} from "./referrals";

const names = ["semana-2026-11-23", ...Array.from({ length: 7 }, (_, i) => `2026-11-${23 + i}`)];
const docs = names.map((name) => ({ name, text: readFileSync(`marketing/comunidad/${name}.md`, "utf8") }));
const entreno = PLANS.find((p) => p.id === "entreno")!.price;
const completo = PLANS.find((p) => p.id === "completo")!.price;
const monthly = [entreno.mes, completo.mes];
const annual = [entreno.anual, completo.anual];
const expectedMoney: Record<string, number[]> = {
  "semana-2026-11-23": [...monthly, ...annual, completo.mes - entreno.mes, completo.anual - entreno.anual, 0, ...monthly, ...annual],
  "2026-11-24": annual,
  "2026-11-26": monthly,
  "2026-11-27": [...annual, ...annual, ...annual],
};

// El plazo anual no tiene constante exportada: se contrasta con la regla documentada
// en referrals.ts, donde también se describe el tope que aplica la base de datos.
const referralSource = readFileSync("src/lib/referrals.ts", "utf8");
const rewardPeriod = Number(referralSource.match(/Tope: \d+ recompensas por persona en (\d+) días/)?.[1]);

function checkFigures(text: string, pattern: RegExp, expected: number[], count: number) {
  const matches = [...text.matchAll(pattern)];
  expect(matches, pattern.source).toHaveLength(count);
  for (const match of matches) {
    const values = match.slice(1).map((value) => value.toLowerCase() === "tres" ? 3 : Number(value));
    expect(values, match[0]).toEqual(expected);
  }
}

describe("comunidad del 23 al 29 de noviembre", () => {
  it.each(docs)("$name: cada importe, en orden, corresponde al plan y usa usd2", ({ name, text }) => {
    const amounts = [...text.matchAll(/\$[\d,]+(?:\.\d+)?/g)].map(([amount]) => amount);
    expect(amounts).toEqual((expectedMoney[name] ?? []).map(usd2));
  });

  it.each(docs)("$name: respeta las reglas de marca", ({ text }) => {
    expect(text).not.toMatch(/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u);
    expect(text).not.toMatch(/[\u2013\u2014]|\bbanano\b/i);
  });

  it.each([
    { name: "semana-2026-11-23", groups: 1, windows: 1, bonuses: 1, caps: 1 },
    { name: "2026-11-25", groups: 2, windows: 4, bonuses: 1, caps: 1 },
  ])("$name: todas las cifras de referidos siguen referrals.ts", ({ name, groups, windows, bonuses, caps }) => {
    const text = docs.find((doc) => doc.name === name)!.text;
    checkFigures(text, /(Tres|\d+) amigos activos (?:=|\/) (\d+) mes gratis/gi, [REF_GROUP_SIZE, REF_BASE_MONTHS], groups);
    checkFigures(text, /(?:primeros|se activa en) (\d+) días/g, [REF_WINDOW_DAYS], windows);
    checkFigures(text, /el grupo da (\d+) meses en total/g, [REF_ANNUAL_MONTHS], bonuses);
    expect(Number.isFinite(rewardPeriod)).toBe(true);
    checkFigures(text, /Tope(?: de|:) (\d+) recompensas en (\d+) días/g, [REF_MAX_REWARDS_YEAR, rewardPeriod], caps);
    if (name === "semana-2026-11-23") {
      checkFigures(text, /atribución en primeras (\d+) horas/g, [REF_ATTRIBUTION_HOURS], 1);
      checkFigures(text, /cookie de (\d+) días/g, [REF_COOKIE_MAX_AGE / 86400], 1);
      expect(text).toContain("no tres adicionales");
    }
  });
});
