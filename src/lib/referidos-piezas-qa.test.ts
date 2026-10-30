// QA de las piezas de referidos: cada bloque que se comparte o se envía lleva un solo enlace, con el utm_medium de su canal,
// el correo dice la oferta y su CTA de texto plano es el mismo que el del HTML y abre una pantalla que existe.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (f: string) => readFileSync(new URL(`../../marketing/estrategia/referidos/${f}`, import.meta.url), "utf8");
const blocks = (s: string, lang: string) => [...s.matchAll(new RegExp("```" + lang + "\\n([\\s\\S]*?)```", "g"))].map((m) => m[1]);
const links = (s: string) => (s.match(/https:\/\/(?:www\.)?bananaburn\.app[^\s"'`)<]*/g) ?? []).map((u) => u.replace(/&amp;/g, "&"));
const medium = (u: string) => new URL(u.replace("{codigo}", "abcd2345")).searchParams.get("utm_medium");

describe("compartir.md", () => {
  const [wa, ...redes] = blocks(read("compartir.md"), "text");
  it("tiene la versión WhatsApp y las de otras redes", () => {
    expect(wa).toBeDefined();
    expect(redes.length).toBeGreaterThanOrEqual(1);
  });
  it("WhatsApp: un solo enlace con utm_medium=whatsapp", () => {
    expect(links(wa)).toHaveLength(1);
    expect(medium(links(wa)[0])).toBe("whatsapp");
  });
  it.each(redes.map((b, i) => [i, b]))("otras redes %i: un solo enlace con utm_medium=redes", (_, b) => {
    expect(links(b)).toHaveLength(1);
    expect(medium(links(b)[0])).toBe("redes");
  });
});

describe("correo-invita-y-gana.md", () => {
  const doc = read("correo-invita-y-gana.md");
  const [text] = blocks(doc, "text");
  const [html] = blocks(doc, "html");
  it("el texto plano tiene un solo CTA y es el mismo del HTML", () => {
    expect(links(text)).toHaveLength(1);
    expect(links(text)).toEqual(links(html));
    expect(medium(links(text)[0])).toBe("email");
  });
  it("asunto, texto y HTML dicen la oferta: 3 amigos = 1 mes, plan anual = trimestre", () => {
    expect(doc).toMatch(/\*\*Asunto:\*\* Invita a 3 amigos y gana 1 mes gratis/);
    for (const b of [text, html]) {
      expect(b).toContain("Invita a 3 amigos y gana 1 mes gratis");
      expect(b).toMatch(/plan anual[\s\S]*trimestre/);
    }
  });
  it("lleva enlace de baja", () => {
    expect(text).toContain("{enlace_baja}");
    expect(html).toContain('href="{enlace_baja}"');
  });
  it("el CTA abre una pantalla que existe en la app", () => {
    const path = new URL(links(html)[0]).pathname;
    expect(path).toBe("/app/referidos");
    expect(existsSync(new URL("../app/(app)/app/referidos/page.tsx", import.meta.url))).toBe(true);
  });
});
