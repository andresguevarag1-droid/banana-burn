// La secuencia de Harvey para constructoras (marketing/condominios/secuencia-desarrolladoras.txt) se pega tal cual en
// harvey-config: estas pruebas vigilan el issue #7 (3 correos, saludo, enlaces, menos de 80 palabras) y las reglas de
// Harvey y de marca (límites por correo, asuntos, oferta, nada de IA, precios, teléfonos, rayas ni exclamaciones).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { condoName } from "./condominios";

const doc = readFileSync("marketing/condominios/secuencia-desarrolladoras.txt", "utf8");
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const LINK = /https:\/\/www\.bananaburn\.app\/condominios\?c=(\S+)/g;

const emails = doc.split(/\nCORREO \d[^\n]*\n/).slice(1).map((raw) => {
  const text = raw.trim();
  const subject = text.match(/^Asunto: (.+)$/m)![1];
  const body = text.slice(text.indexOf("\n") + 1).trim();
  const firma = body.indexOf("Andrés Guevara, Fundador");
  return { text, subject, body, sinFirma: body.slice(0, firma), firma: body.slice(firma) };
});

describe("estructura del issue #7", () => {
  it("tiene 3 correos en texto plano", () => {
    expect(emails).toHaveLength(3);
    for (const e of emails) expect(e.text).not.toMatch(/^\s*([-*•]|#)|\*\*/m);
  });

  it("cada correo saluda 'Hola, equipo de [Empresa]'", () => {
    for (const e of emails) expect(e.body.split("\n")[0]).toBe("Hola, equipo de [Empresa].");
  });

  it("el correo 1 no lleva enlace y los correos 2 y 3 llevan uno solo, a /condominios con ?c=", () => {
    expect(emails[0].body).not.toMatch(/https?:\/\//);
    for (const e of emails.slice(1)) {
      const links = [...e.body.matchAll(/https?:\/\/\S+/g)].map((m) => m[0]);
      expect(links.filter((l) => !l.startsWith("https://www.bananaburn.app/condominios?c="))).toEqual([]);
      expect(links).toHaveLength(1);
    }
  });

  it("los enlaces codifican los espacios como %20 y la landing saluda con ese nombre", () => {
    const params = [...doc.matchAll(LINK)].map((m) => m[1]);
    expect(params.length).toBeGreaterThanOrEqual(2);
    for (const p of params) {
      expect(p).not.toMatch(/[ +]/);
      expect(p).toContain("%20");
      expect(condoName(decodeURIComponent(p))).toBe(decodeURIComponent(p));
    }
  });

  it("cada correo tiene menos de 80 palabras, con firma", () => {
    for (const e of emails) expect(words(e.body)).toBeLessThan(80);
  });
});

describe("reglas de Harvey", () => {
  it("respeta los límites por correo: 75, 75 y 40 palabras", () => {
    expect(words(emails[0].sinFirma)).toBeLessThan(75);
    expect(words(emails[1].sinFirma)).toBeLessThan(75);
    expect(words(emails[2].sinFirma)).toBeLessThan(40);
  });

  it("el correo 1 no nombra el producto y hace una sola pregunta", () => {
    expect(emails[0].sinFirma).not.toMatch(/banana/i);
    expect(emails[0].sinFirma.match(/\?/g)).toHaveLength(1);
  });

  it("los asuntos van en minúscula, de 2 a 5 palabras, sin 'gratis' ni el prospecto", () => {
    for (const { subject } of emails) {
      expect(subject).toBe(subject.toLowerCase());
      expect(words(subject)).toBeGreaterThanOrEqual(2);
      expect(words(subject)).toBeLessThanOrEqual(5);
      expect(subject).not.toMatch(/gratis|\[/);
    }
  });

  it("firma solo como Andrés y sin teléfonos ni WhatsApp", () => {
    for (const e of emails) {
      expect(e.firma).toBe("Andrés Guevara, Fundador\nBanana Burn\nbananaburn.app");
      expect(e.text).not.toMatch(/whatsapp|\+?\d[\d\s-]{6,}\d/i);
    }
  });

  it("los correos 1 y 2 dicen la oferta como Harvey: nadie de la torre paga y cada residente decide después del mes", () => {
    for (const e of emails.slice(0, 2)) {
      expect(e.sinFirma).toMatch(/mes gratis/);
      expect(e.sinFirma).toMatch(/administración nunca pagan?/);
      expect(e.sinFirma).toMatch(/después del mes, cada residente decide su plan/);
    }
  });

  it("no empieza por 'Yo' o 'Nosotros'", () => {
    for (const e of emails) expect(e.sinFirma.split("\n").slice(1).join(" ").trim()).not.toMatch(/^(Yo|Nosotros)\b/);
  });
});

describe("reglas de marca", () => {
  it("no menciona IA, bots, precios, descuentos ni escasez", () => {
    expect(doc).not.toMatch(/\bIA\b|inteligencia artificial|\bbots?\b|\$|%\s?de descuento|garantizad|oferta especial|última oportunidad|cupos/i);
  });

  it("sin rayas largas, exclamaciones ni emojis, y 'banana', nunca 'banano'", () => {
    expect(doc).not.toMatch(/[—–!¡]/);
    expect(doc).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(doc).not.toMatch(/banano/i);
  });
});
