import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLANS } from "@/lib/plans";
import { PROMO_TERMS, firstChargeMinor, reminderLine } from "@/lib/trial";

// Secuencia de correos de la prueba gratis (marketing/estrategia/correos, issue #22). Solo documentos para Resend:
// estas pruebas cuidan las reglas del pedido (un solo CTA con UTM, montos de trial.ts, sin IA ni escasez).
const DIR = join(process.cwd(), "marketing/estrategia/correos");
// Las frases de trial.ts usan espacio de no separación antes de "%"; en los documentos da igual.
const read = (f: string) => readFileSync(join(DIR, f), "utf8").replace(/\u00a0/g, " ");
const nb = (s: string) => s.replace(/\u00a0/g, " ");
const pieces = readdirSync(DIR).filter((f) => /^\d{2}-.+\.md$/.test(f)).sort();
const htmlOf = (md: string) => `html/${md.replace(/\.md$/, ".html")}`;
const textOf = (md: string) => read(md).match(/## Texto plano\s+```text\n([\s\S]*?)```/)?.[1] ?? "";
const field = (md: string, name: string) => read(md).match(new RegExp(`^\\| ${name} \\| (.+) \\|$`, "m"))?.[1]?.trim() ?? "";
const appLinks = (s: string) => s.match(/https:\/\/(?:www\.)?bananaburn\.app[^\s"'<>)]*/g) ?? [];
const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&")).filter((h) => !h.startsWith("https://fonts.googleapis.com/"));
const usd = (minor: number) => `$${(minor / 100).toFixed(2)}`;

describe("secuencia de correos de la prueba", () => {
  it("son 9 piezas, cada una con asunto, preheader, evento, hora, HTML y texto plano", () => {
    expect(pieces).toHaveLength(9);
    for (const f of pieces) {
      for (const k of ["Asunto", "Preheader", "Evento que lo dispara", "Hora de envío \\(Costa Rica, UTC-6\\)", "CTA único"]) expect(field(f, k), `${f}: ${k}`).not.toBe("");
      expect(existsSync(join(DIR, htmlOf(f))), `${f}: falta ${htmlOf(f)}`).toBe(true);
      expect(textOf(f).length, `${f}: texto plano`).toBeGreaterThan(100);
    }
  });

  it("el HTML lleva el preheader oculto y el texto plano el mismo CTA", () => {
    for (const f of pieces) {
      const html = read(htmlOf(f));
      expect(html, f).toContain(field(f, "Preheader"));
      const cta = field(f, "CTA único").split(": ").slice(1).join(": ");
      expect(hrefs(html), f).toContain(cta);
      expect(textOf(f), f).toContain(cta);
    }
  });

  it("cada correo tiene un solo enlace a bananaburn.app, con utm_source=resend y utm_medium=email", () => {
    for (const f of pieces) {
      const html = read(htmlOf(f));
      const links = hrefs(html).filter((h) => /bananaburn\.app/.test(h) && !h.startsWith("mailto:"));
      expect(links, `${f}: enlaces en el HTML`).toHaveLength(1);
      expect(appLinks(textOf(f)), `${f}: enlaces en el texto plano`).toHaveLength(1);
      for (const link of [...links, ...appLinks(textOf(f))]) {
        const u = new URL(link);
        expect(u.searchParams.get("utm_source"), f).toBe("resend");
        expect(u.searchParams.get("utm_medium"), f).toBe("email");
      }
      // Los demás enlaces solo pueden ser el correo de ayuda o la baja.
      for (const h of hrefs(html).filter((x) => !links.includes(x))) expect(h, f).toMatch(/^mailto:|^\{\{baja_url\}\}$/);
    }
  });

  it("ningún correo menciona IA ni usa escasez, contadores, emojis o rayas largas", () => {
    for (const f of pieces) {
      const all = [read(f), read(htmlOf(f))].join("\n");
      expect(all, f).not.toMatch(/\bIA\b|inteligencia artificial|\bAI\b|ChatGPT/i);
      expect(all, f).not.toMatch(/últimos? cupos|quedan pocos|solo por hoy|plazas limitadas|antes de que se acabe|última oportunidad/i);
      expect(all, f).not.toMatch(/[—–]/);
      expect(all, f).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it("los precios salen de plans.ts y el 50 % de trial.ts", () => {
    const m = (id: string) => PLANS.find((p) => p.id === id)!;
    const entreno = PLANS[0];
    const completo = PLANS[1];
    expect(m(entreno.id).price).toEqual({ mes: 9.99, anual: 59.99 });
    expect(m(completo.id).price).toEqual({ mes: 14.99, anual: 89.99 });
    const oferta = textOf("08-oferta-50-tarjeta.md");
    expect(oferta).toContain(nb(PROMO_TERMS));
    expect(oferta).toContain(`${usd(firstChargeMinor(entreno.id, "mes", "primer_mes_50"))} el primer mes, después $9.99`);
    expect(oferta).toContain(`${usd(firstChargeMinor(completo.id, "mes", "primer_mes_50"))} el primer mes, después $14.99`);
  });

  it("el aviso de cobro dice el monto de trial.ts y cómo cancelar", () => {
    const md = read("09-aviso-48h-cobro.md");
    const day = "8 de noviembre de 2026";
    for (const p of PLANS)
      for (const billing of ["mes", "anual"] as const)
        for (const promo of billing === "mes" ? ["primer_mes_50", null] : [null]) {
          const amount = firstChargeMinor(p.id, billing, promo);
          expect(md, `${p.id} ${billing} ${promo}`).toContain(nb(reminderLine(amount / 100, "beta", day, null, promo === "primer_mes_50")));
          expect(md).toContain(`| ${usd(amount)} |`);
        }
    expect(md).toContain("| $4.99 |");
    expect(md).toContain("| $7.49 |");
    const text = textOf("09-aviso-48h-cobro.md");
    expect(text).toMatch(/Cómo cancelar sin costo/);
    expect(text).toMatch(/Cancelar sin costo/);
    expect(text).toContain("{{monto}}");
    expect(read("html/09-aviso-48h-cobro.html")).toMatch(/Cómo cancelar sin costo/);
  });

  it("el README tiene la tabla resumen con los 9 correos, su disparador y la hora de Costa Rica", () => {
    const readme = read("README.md");
    expect(readme).toMatch(/UTC-6/);
    const rows = readme.split("\n").filter((l) => /^\| \d \| \[/.test(l));
    expect(rows).toHaveLength(9);
    for (const f of pieces) expect(rows.some((r) => r.includes(`](${f})`)), f).toBe(true);
    for (const r of rows) expect(r).toMatch(/\d{1,2}:\d{2} [ap]\. m\./);
  });
});
