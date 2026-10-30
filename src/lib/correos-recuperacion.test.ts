import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Correos de recuperación (marketing/estrategia/correos/recuperacion, issue #26). Solo documentos para Resend:
// estas pruebas cuidan las reglas del pedido (un solo CTA con UTM, evento real, cruce con la app, sin descuentos nuevos).
const DIR = join(process.cwd(), "marketing/estrategia/correos/recuperacion");
const read = (f: string) => readFileSync(join(DIR, f), "utf8");
const pieces = readdirSync(DIR).filter((f) => /^\d{2}-.+\.md$/.test(f)).sort();
const htmlOf = (md: string) => `html/${md.replace(/\.md$/, ".html")}`;
const textOf = (md: string) => read(md).match(/## Texto plano\s+```text\n([\s\S]*?)```/)?.[1] ?? "";
const field = (md: string, name: string) => read(md).match(new RegExp(`^\\| ${name} \\| (.+) \\|$`, "m"))?.[1]?.trim() ?? "";
const appLinks = (s: string) => s.match(/https:\/\/(?:www\.)?bananaburn\.app[^\s"'<>)]*/g) ?? [];
const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&")).filter((h) => !h.startsWith("https://fonts.googleapis.com/"));

describe("correos de recuperación", () => {
  it("son 3 piezas, cada una con asunto, evento, hora, CTA, HTML, texto plano y su cruce con la app", () => {
    expect(pieces).toEqual(["01-48h-sin-entrenar.md", "02-cancelo-la-prueba.md", "03-pago-fallido.md"]);
    for (const f of pieces) {
      for (const k of ["Asunto", "Preheader", "Evento que lo dispara", "Hora de envío \\(Costa Rica, UTC-6\\)", "CTA único", "Métrica que mueve"]) expect(field(f, k), `${f}: ${k}`).not.toBe("");
      expect(existsSync(join(DIR, htmlOf(f))), `${f}: falta ${htmlOf(f)}`).toBe(true);
      expect(textOf(f).length, `${f}: texto plano`).toBeGreaterThan(100);
      expect(read(f), f).toMatch(/## Relación con lo que la app ya envía/);
    }
  });

  it("cada correo tiene un solo enlace a bananaburn.app, el mismo en HTML y texto, con utm_source=resend y utm_medium=email", () => {
    for (const f of pieces) {
      const html = read(htmlOf(f));
      expect(html, f).toContain(field(f, "Preheader"));
      const cta = field(f, "CTA único").split(": ").slice(1).join(": ");
      const links = hrefs(html).filter((h) => /bananaburn\.app/.test(h) && !h.startsWith("mailto:"));
      expect(links, `${f}: enlaces en el HTML`).toEqual([cta]);
      expect(appLinks(textOf(f)), `${f}: enlaces en el texto plano`).toEqual([cta]);
      const u = new URL(cta);
      expect(u.searchParams.get("utm_source"), f).toBe("resend");
      expect(u.searchParams.get("utm_medium"), f).toBe("email");
      for (const h of hrefs(html).filter((x) => !links.includes(x))) expect(h, f).toMatch(/^mailto:|^\{\{baja_url\}\}$/);
    }
  });

  it("los disparadores son eventos que existen en el código", () => {
    const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    expect(src("src/lib/trial-billing.ts")).toMatch(/status: "canceled", canceled_at/);
    expect(src("src/lib/trial.ts")).toMatch(/return \{ status: "failed", nextAttemptAt: null \}/);
    expect(src("src/components/express-chips.tsx")).toContain("/app/entreno?expres=");
    expect(src("src/app/(app)/app/suscripcion/past-due-card.tsx")).toContain("Cambiar tarjeta y pagar");
    expect(src("src/app/(app)/app/suscripcion/card-panel.tsx")).toContain("Cambié de opinión");
    // Los correos de la app con los que se cruzan siguen existiendo con ese nombre.
    const t = src("src/lib/email/templates.ts");
    for (const name of ["primerEntreno", "cobroCancelado", "pagoFallido"]) expect(t).toContain(`function ${name}(`);
  });

  it("ningún correo ofrece descuentos, menciona IA ni usa testimonios, escasez, emojis o rayas largas", () => {
    for (const f of pieces) {
      const visible = read(htmlOf(f)).replace(/<[^>]+>/g, " ");
      const mail = [textOf(f), visible, field(f, "Asunto"), field(f, "Preheader")].join("\n");
      expect(mail, f).not.toMatch(/\d+\s?%|descuento|gratis por|cup[oó]n|c[oó]digo promocional|oferta/i);
      const all = [read(f), read(htmlOf(f))].join("\n");
      expect(all, f).not.toMatch(/\bIA\b|inteligencia artificial|\bAI\b|ChatGPT/i);
      expect(all, f).not.toMatch(/últimos? cupos|quedan pocos|solo por hoy|plazas limitadas|antes de que se acabe|última oportunidad/i);
      expect(all, f).not.toMatch(/testimonio|“[^”]+”,? (dice|cuenta)|personas como tú ya/i);
      expect(all, f).not.toMatch(/[—–]/);
      expect(all, f).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it("el README resume los 3 con su disparador, la hora de Costa Rica y el cruce con la app", () => {
    const readme = read("README.md");
    expect(readme).toMatch(/UTC-6/);
    const rows = readme.split("\n").filter((l) => /^\| R\d \| \[/.test(l));
    expect(rows).toHaveLength(3);
    for (const f of pieces) expect(rows.some((r) => r.includes(`](${f})`)), f).toBe(true);
    for (const r of rows) expect(r).toMatch(/\d{1,2}:\d{2} [ap]\. m\./);
    for (const name of ["primerEntreno", "cobroCancelado", "pagoFallido"]) expect(readme).toContain(`\`${name}\``);
  });
});
