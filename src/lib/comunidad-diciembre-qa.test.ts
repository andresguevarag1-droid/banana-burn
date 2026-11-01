import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLANS, ANNUAL_SEASON_NOTE } from "./plans";
import { usd2 } from "./num";
import { REF_GROUP_SIZE, REF_BASE_MONTHS, REF_WINDOW_DAYS, REF_ATTRIBUTION_HOURS, REF_COOKIE_MAX_AGE, REF_MAX_REWARDS_YEAR, REF_ANNUAL_MONTHS } from "./referrals";

const root = new URL("../../marketing/comunidad/", import.meta.url);
const read = (file: string) => readFileSync(new URL(file, root), "utf8");
const dates = ["2026-11-30", ...Array.from({ length: 6 }, (_, i) => `2026-12-0${i + 1}`)];
const week = read("semana-2026-11-30.md");

describe("comunidad 30 noviembre a 6 diciembre: condiciones comerciales", () => {
  it("contrasta los cuatro cobros y sus netos con los planes y ambas comisiones", () => {
    const rows = week.split("\n").filter((line) => /^\| (Renovación Entreno|Entreno.*anual)/.test(line));
    expect(rows).toHaveLength(4);
    for (const plan of PLANS) {
      for (const billing of ["mes", "anual"] as const) {
        const label = billing === "mes" ? `Renovación ${plan.name} mensual` : `${plan.name} anual`;
        const amount = plan.price[billing];
        const net = (fee: number) => usd2(amount / 1.13 - amount * fee - 0.35);
        expect(rows).toContain(`| ${label} | ${usd2(amount)} | ${net(0.039)} | ${net(0.0425)} |`);
      }
    }
    const annual = read("2026-12-02.md");
    for (const plan of PLANS) expect(annual).toContain(`${plan.name}: ${usd2(plan.price.anual)} por año`);
    expect(annual).toContain(ANNUAL_SEASON_NOTE);
    expect(annual).toContain("Los retos Premium se compran aparte");
    const renewal = read("2026-12-03.md");
    for (const plan of PLANS) expect(renewal).toContain(`${usd2(plan.price.mes)} en ${plan.name}`);
  });

  it.fails("KNOWN BUG #178: 2026-12-04 y la semana dicen la regla vieja (activarse en 7 días, no necesita pagar); desde 0064 el amigo cuenta al pagar dentro de 60 días", () => {
    const referral = read("2026-12-04.md");
    for (const doc of [week, referral]) {
      expect(doc).toContain(`${REF_GROUP_SIZE} amigos activos = ${REF_BASE_MONTHS} mes gratis`);
      expect(doc).toContain(`primeros ${REF_WINDOW_DAYS} días`);
      expect(doc).toContain("No necesita pagar");
      expect(doc).toContain(`${REF_MAX_REWARDS_YEAR} recompensas en 365 días`);
      expect(doc).toContain(`grupo da ${REF_ANNUAL_MONTHS} meses en total`);
    }
    expect(week).toContain(`primeras ${REF_ATTRIBUTION_HOURS} horas`);
    expect(week).toContain(`cookie de ${REF_COOKIE_MAX_AGE / 86400} días`);
  });

  it.each(dates)("%s conserva formato, embudo, aprobación y recursos enlazados", (date) => {
    const doc = read(`${date}.md`);
    expect(doc).toContain(`# ${date}:`);
    for (const section of ["## Post del día", "## Respuestas del día", "## Producción y rutina", "- Paso del embudo:"]) expect(doc).toContain(section);
    expect(doc).toContain("aprobación escrita de Andrés por pieza y canal");
    expect(doc).toContain("Los votos no son ventas");
    expect(doc).toContain("No sustituye la indicación de tu médico.");
    expect(doc).not.toMatch(/\p{Extended_Pictographic}|inteligencia artificial|últimos cupos/iu);
    for (const match of doc.matchAll(/\]\(([^)]+)\)/g)) {
      if (!match[1].startsWith("https:")) expect(existsSync(new URL(match[1], root)), match[1]).toBe(true);
    }
    const svg = read(`historias/${date}.svg`);
    expect(svg).toContain('width="1080" height="1920"');
    expect(svg).toContain('font-family="Plus Jakarta Sans"');
    for (const color of ["#FFF8E3", "#FFD60A", "#1B1505"]) expect(svg).toContain(color);
  });

  it("separa preparación de renovación, cobros reales y señales sin atribución", () => {
    expect(week).toContain("no registrar anticipadamente una renovación de diciembre");
    expect(week).toContain("trial_charges con status 'succeeded'");
    expect(week).toContain("no atribuirlos a una historia sin evidencia");
    expect(week).toContain("Los regalos generan $0.00 de ingreso adicional");
    expect(week).toContain("seguimiento el 9 y el 15 de diciembre");
    expect(week).toContain("no ofrecer inscripción tardía");
  });
});
