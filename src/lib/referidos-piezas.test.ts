// Piezas del programa de referidos (marketing/estrategia/referidos/): cada enlace lleva UTM de referido, ningún texto
// trae números de WhatsApp ni menciona IA, y las reglas dicen las mismas cifras que src/lib/referrals.ts.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REF_ANNUAL_MONTHS, REF_ATTRIBUTION_HOURS, REF_BASE_MONTHS, REF_COOKIE_MAX_AGE, REF_GROUP_SIZE, REF_MAX_REWARDS_YEAR, REF_WINDOW_DAYS } from "./referrals";

const DIR = "marketing/estrategia/referidos";
const FILES = ["README.md", "compartir.md", "correo-invita-y-gana.md", "reglas.md"];
const docs = Object.fromEntries(FILES.map((f) => [f, readFileSync(`${DIR}/${f}`, "utf8")]));
const pieces = ["compartir.md", "correo-invita-y-gana.md", "reglas.md"];

/** Enlaces completos a bananaburn.app (con o sin www), sin el cierre de markdown ni de atributo HTML. */
const links = (s: string) => (s.match(/https:\/\/(?:www\.)?bananaburn\.app[^\s"'`)<]*/g) ?? []).map((u) => u.replace(/&amp;/g, "&"));

describe("enlaces", () => {
  it.each(pieces)("%s: cada enlace lleva utm_source=referido y utm_campaign=invita-y-gana", (f) => {
    const found = links(docs[f]);
    expect(found.length).toBeGreaterThan(0);
    for (const u of found) {
      const p = new URL(u.replace("{codigo}", "abcd2345")).searchParams;
      expect(p.get("utm_source"), u).toBe("referido");
      expect(p.get("utm_campaign"), u).toBe("invita-y-gana");
      expect(p.get("utm_medium"), u).toBeTruthy();
    }
  });

  it("el correo tiene un solo CTA en el HTML", () => {
    const html = docs["correo-invita-y-gana.md"].split("```html")[1].split("```")[0];
    expect(links(html)).toHaveLength(1);
  });
});

describe("textos", () => {
  it.each(FILES)("%s: sin números de teléfono, sin IA, sin guiones largos ni emojis", (f) => {
    const s = docs[f];
    expect(s).not.toMatch(/wa\.me\/\d|\+\d{3}|\b\d{4}[ -]?\d{4}\b/);
    expect(s).not.toContain("—");
    expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(s).not.toMatch(/banano/i);
  });
});

/** Lo que lee el usuario: los bloques de texto y HTML de las piezas y la página de reglas completa. */
const copy = [...pieces.flatMap((f) => [...docs[f].matchAll(/```(?:text|html)\n([\s\S]*?)```/g)].map((m) => m[1])), docs["reglas.md"]];

describe("lo que lee el usuario", () => {
  it("hay bloques que revisar (2 de compartir, 1 texto y 1 HTML del correo y las reglas)", () => {
    expect(copy.length).toBeGreaterThanOrEqual(6);
  });
  it.each(copy.map((c, i) => [i, c]))("bloque %i: no menciona IA ni testimonios ni escasez", (_, c) => {
    expect(c).not.toMatch(/\bIA\b|inteligencia artificial|algoritmo/i);
    expect(c).not.toMatch(/últim[oa]s? (cupos|lugares|horas)|solo hoy|quedan \d/i);
  });
});

describe("reglas contra el código", () => {
  const r = docs["reglas.md"];
  it("dicen la oferta con las cifras de referrals.ts", () => {
    expect(REF_GROUP_SIZE).toBe(3);
    expect(REF_BASE_MONTHS).toBe(1);
    expect(REF_ANNUAL_MONTHS).toBe(3);
    expect(r).toContain("**3 amigos activos = 1 mes gratis.**");
    expect(r).toContain("1 trimestre gratis");
    expect(r).toContain(`de a ${REF_GROUP_SIZE}`);
    expect(r).toContain("de 1 a 3 meses");
  });
  it("dicen las ventanas y el tope del código", () => {
    expect(r).toContain(`primeros ${REF_WINDOW_DAYS} días`);
    expect(r).toContain(`primeras **${REF_ATTRIBUTION_HOURS} horas**`);
    expect(r).toContain(`**${REF_COOKIE_MAX_AGE / 86400} días**`);
    expect(r).toContain(`**${REF_MAX_REWARDS_YEAR} recompensas**`);
  });
});
