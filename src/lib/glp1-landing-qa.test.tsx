import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Glp1Landing, { metadata } from "@/app/(marketing)/glp1/page";
import { BETA_ENDS_AT, PLANS } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/copy";
import { usd2 } from "@/lib/num";

// QA de #92: la página se calcula en cada render con offer(), así que se revisa antes y después del fin de la beta.
const BEFORE = new Date(Date.parse(BETA_ENDS_AT) - 864e5);
const AFTER = new Date(Date.parse(BETA_ENDS_AT) + 864e5);
const render = (now: Date) => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now); return renderToStaticMarkup(<Glp1Landing />); };
const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const DOC = readFileSync("marketing/estrategia/glp1-conversion.md", "utf8");

afterEach(() => { vi.useRealTimers(); });

describe("landing GLP-1 (QA #92)", () => {
  for (const [label, now] of [["en la beta", BEFORE], ["después de la beta", AFTER]] as const) {
    it(`${label}: beneficio, prueba y botón van primero en el hero`, () => {
      const html = render(now);
      const hero = html.slice(html.indexOf('id="hero"'), html.indexOf('id="como"'));
      const order = ["Para quienes bajan con GLP-1", "Fuerza para cuidar el músculo", `${TRIAL_DAYS} días gratis, sin tarjeta`, 'data-cta="glp1-hero"', "No sustituye la indicación de tu médico."].map((s) => hero.indexOf(s));
      expect(order.every((i) => i >= 0)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it(`${label}: sin promesas de kilos, medicamentos ni preguntas sobre la condición`, () => {
      const copy = `${text(render(now))} ${JSON.stringify(metadata)}`;
      expect(copy).not.toMatch(/semaglutida|tirzepatida|liraglutida|Rybelsus|\btu (tratamiento|medicamento)\b|\bsi usas\b|\busas GLP|\bbajar[aá]s \d|\d+\s?kg (menos|en)/i);
      expect(copy).not.toMatch(/\bIA\b|inteligencia artificial/);
      expect(copy).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(copy).not.toMatch(/—/);
    });

    it(`${label}: los planes salen de plans.ts y el anual va primero`, () => {
      const html = render(now);
      const planes = html.slice(html.indexOf('id="planes"'), html.indexOf('id="preguntas"'));
      expect(planes.indexOf(">Anual")).toBeGreaterThan(-1);
      expect(planes.indexOf(">Anual")).toBeLessThan(planes.indexOf(">Mensual"));
      for (const p of PLANS) expect(planes).toContain(usd2(p.price.anual));
      expect(planes).toContain('data-cta="glp1-banda"');
      expect(html).toContain('data-cta="glp1-sticky"');
    });
  }

  it("cada sección y las preguntas frecuentes llevan el aviso médico", () => {
    const html = render(AFTER);
    for (const id of ['id="hero"', 'id="como"', 'id="habitos-title"', 'id="planes"']) {
      const from = html.indexOf(id);
      const to = html.indexOf("</section>", from);
      expect(html.slice(from, to), id).toContain("No sustituye la indicación de tu médico.");
    }
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
    expect(ld["@type"]).toBe("FAQPage");
    expect(JSON.stringify(ld)).toContain("No sustituye la indicación de tu médico.");
  });

  it("conserva SEO: canónica, descripción y og con aviso médico", () => {
    expect(metadata.alternates?.canonical).toBe("/glp1");
    expect(metadata.description).toContain("No sustituye la indicación de tu médico.");
    expect(decodeURIComponent(String((metadata.openGraph?.images as { url: string }[])[0].url)).replaceAll("+", " ")).toContain("No sustituye la indicación de tu médico.");
  });

  it("el documento del embudo dice qué paso mueve, cómo se mide y por qué no agrega costo", () => {
    expect(DOC).toMatch(/visita → registro → prueba/);
    for (const cta of ["glp1-hero", "glp1-sticky", "glp1-banda", "glp1-final"]) expect(DOC).toContain(cta);
    expect(DOC).toContain("trial_charges");
    expect(DOC).toContain("succeeded");
    expect(DOC).toMatch(/No agrega costo/);
    expect(DOC).toContain("aprobación de Andrés");
    expect(DOC).toContain("No sustituye la indicación de tu médico.");
    expect(DOC).not.toMatch(/Ozempic|Wegovy|Mounjaro|—/);
  });
});
