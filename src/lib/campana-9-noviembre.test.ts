// Guiones de los 3 anuncios de la campaña del 9 de noviembre (marketing/anuncios/campana-9-noviembre.md): estas pruebas
// vigilan que los minutos, ejercicios, botones y precios que prometen salgan del código, y las reglas de marca.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FIRST_HOME_MIN, FIRST_MAX_MIN, firstSessionDay, planDay } from "@/lib/engine";
import { usd2 } from "@/lib/num";
import { PLANS, TRIAL_DAYS, perMonthAnnual } from "@/lib/plans";

const doc = readFileSync("marketing/anuncios/campana-9-noviembre.md", "utf8");
const entreno = PLANS.find((p) => p.id === "entreno")!;
const ads = [...doc.matchAll(/^## (Anuncio \d): ([^\n]*)\n([\s\S]*?)(?=\n## |(?![\s\S]))/gm)].map(([, id, title, body]) => ({ id, title, body }));
const ad = (n: number) => ads[n - 1].body;

/** Las 3 líneas del texto principal (en Markdown van sangradas bajo la viñeta). */
function mainText(body: string) {
  const start = body.indexOf("- **Texto principal:**\n");
  expect(start).toBeGreaterThanOrEqual(0);
  const lines: string[] = [];
  for (const line of body.slice(start).split("\n").slice(1)) {
    if (!line.startsWith("  ")) break;
    lines.push(line.trim());
  }
  return lines;
}

describe("anuncios de la campaña del 9 de noviembre", () => {
  it("tiene los 3 anuncios con todas sus partes y todos llevan a Empieza 7 días gratis", () => {
    expect(ads.map((a) => a.id)).toEqual(["Anuncio 1", "Anuncio 2", "Anuncio 3"]);
    expect(TRIAL_DAYS).toBe(7);
    for (const { id, body } of ads) {
      for (const part of ["**Gancho de los primeros 2 segundos:**", "### Guion (", "| Segundo | Escena | Texto en pantalla |", "**Versión de 15 s:**", "- **Texto principal:**", "- **Título:** Empieza 7 días gratis", "- **Descripción:**", "- **Botón:** Registrarte"]) {
        expect(body, `${id}: ${part}`).toContain(part);
      }
      const main = mainText(body);
      expect(main, id).toHaveLength(3);
      expect(main.join(" "), id).toContain("Empieza 7 días gratis");
      expect(body, id).toContain("| Cierre: Coach Banana señalando, botón ink y logo | Empieza 7 días gratis en bananaburn.app |");
    }
  });

  it("cada guion dura de 15 a 25 s, empieza en 0 y no se salta segundos", () => {
    for (const { id, body } of ads) {
      const rows = [...body.matchAll(/^\| ([\d.]+) a ([\d.]+) \|/gm)].map(([, a, b]) => [Number(a), Number(b)]);
      expect(rows[0][0], id).toBe(0);
      rows.slice(1).forEach(([a], i) => expect(a, id).toBe(rows[i][1]));
      const total = rows.at(-1)![1];
      expect(total, id).toBeGreaterThanOrEqual(15);
      expect(total, id).toBeLessThanOrEqual(25);
      expect(body, id).toContain(`### Guion (${total} s)`);
      rows.forEach(([a, b]) => expect(b - a, id).toBeLessThanOrEqual(3));
    }
  });

  it("los 12 y 15 minutos y los ejercicios del primer entreno salen del motor", () => {
    const base = planDay(1, 1, undefined, {});
    const home = firstSessionDay(base, { equipment: "gym" }, true);
    const sinEquipo = firstSessionDay(base, { equipment: "ninguno" });
    const gym = firstSessionDay(base, { equipment: "gym" });
    expect(FIRST_HOME_MIN).toBe(12);
    expect(FIRST_MAX_MIN).toBe(15);
    expect(home.mins).toBeLessThanOrEqual(FIRST_HOME_MIN);
    expect(sinEquipo.mins).toBeGreaterThan(FIRST_HOME_MIN);
    expect(ad(1)).toContain(`"Empezar mi primer entreno (${sinEquipo.mins} min)"`);
    expect(home.exercises.map((e) => e.name)).toEqual(["Sentadilla con peso corporal", "Flexiones", "Puente de glúteo"]);
    expect(home.exercises.every((e) => e.cfg.sets === 2 && e.cfg.rest === 30)).toBe(true);
    expect(ad(1)).toContain(`"Ejercicio 1 de ${home.exercises.length}", ${home.exercises[0].name}, "Serie 1 de 2"`);
    expect(ad(1)).toContain(`"Sigue: ${home.exercises[1].name}"`);
    expect(ad(1)).toContain("| Descansas 30 segundos |");
    expect(ad(1)).toContain(`| ${home.exercises.length} ejercicios, 2 series cada uno |`);
    expect(gym.exercises[0].name).toBe("Sentadilla goblet");
    expect(doc).toContain(`"Ejercicio 1 de ${gym.exercises.length}", Sentadilla goblet`);
  });

  it("los textos de pantalla que se citan existen en la app", () => {
    const readiness = readFileSync("src/components/readiness.tsx", "utf8");
    const guided = readFileSync("src/components/workout/guided.tsx", "utf8");
    const recap = readFileSync("src/components/workout/recap.tsx", "utf8");
    const wizard = readFileSync("src/app/bienvenida/wizard.tsx", "utf8");
    expect(readiness).toContain("Empezar en casa<span");
    expect(readiness).toContain("Sin equipo, unos {home.mins} min");
    expect(doc).toContain(`"Empezar en casa" ("Sin equipo, unos ${FIRST_HOME_MIN} min")`);
    expect(readiness).toContain("Empezar mi entreno<span");
    expect(doc).toContain('botón "Empezar mi entreno"');
    for (const s of ["Sugerido. Ajústalo si quieres.", "Descansa", "Sigue", "Terminé la serie", "Ver cómo se hace"]) expect(guided).toContain(s);
    expect(recap).toContain('"Entreno completado"');
    for (const s of ['t="Gimnasio"', 't="Sin equipo"', 't="En casa con mancuernas"']) expect(wizard).toContain(s);
    expect(existsSync("public/landing/entreno.png")).toBe(true);
    expect(existsSync("public/brand/mascota-sola.webp")).toBe(true);
    expect(existsSync("src/lib/pay-provider.ts") && readFileSync("src/lib/pay-provider.ts", "utf8")).toContain("export function providerFor");
  });

  it("el anuncio de Estados Unidos usa el precio mensual en USD, cancela cuando quieras y nada de Costa Rica", () => {
    const us = ad(3);
    const prices = [...us.matchAll(/US\$[\d,.]+/g)].map(([p]) => p);
    expect(prices.length).toBeGreaterThanOrEqual(2);
    expect(new Set(prices)).toEqual(new Set([`US${usd2(entreno.price.mes)}`]));
    expect(mainText(us).join(" ")).toContain(`US${usd2(entreno.price.mes)} al mes`);
    expect(us).toContain("- **Descripción:** Sin tarjeta. Cancela cuando quieras.");
    expect(us).not.toMatch(/\b(?:mae|tico|tica|pura vida|diay|tuanis|brete|parqueo|chunche|rojos?|colones|₡|chamba|jale|laburo|chévere|parce|guagua)\b/i);
    expect(us).not.toMatch(/Planet Fitness|LA Fitness|Crunch|24 Hour|Anytime/i);
  });

  it("respeta la marca y las reglas del issue", () => {
    expect(doc).not.toMatch(/\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u);
    expect(doc).not.toContain("—");
    // "banano" e "IA" solo aparecen en la lista de reglas, nunca en un anuncio.
    for (const { id, body } of ads) expect(body, id).not.toMatch(/\bbanano\b|\bIA\b|inteligencia artificial|\bAI\b/i);
    for (const p of PLANS) expect(doc).not.toContain(usd2(perMonthAnnual(p)));
    expect(doc).not.toMatch(/\d+\s?(?:kilos|libras)\b/i);
    expect(doc).toContain("EN PAUSA por decisión del dueño: $0 en anuncios hasta llegar al 30 % de activación.");
    expect(doc).toContain("Andrés aprueba antes de producir nada.");
    for (const n of ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"]) expect(doc).toMatch(new RegExp(`^\\| ${n} \\|`, "m"));
  });
});
