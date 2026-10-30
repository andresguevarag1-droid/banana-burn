import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Precios from "@/app/(marketing)/precios/page";
import Temporadas from "@/app/(marketing)/temporadas/page";
import { SPORTS } from "@/lib/seasons";

// #96: las correcciones de marca de /precios, /temporadas y Mi plan, contra el informe de docs/qa.
const src = (p: string) => readFileSync(p, "utf8");
const DOC = src("docs/qa/revision-marca-noviembre.md");
const PANEL = src("src/app/(app)/app/suscripcion/card-panel.tsx");
const MI_PLAN = src("src/app/(app)/app/suscripcion/page.tsx");
const ldFaq = (html: string) => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1]) as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };

describe("revisión de marca de noviembre (#96)", () => {
  it("/precios responde lo de GLP-1 sin prometer composición y con el aviso médico, también en el esquema", () => {
    const html = renderToStaticMarkup(<Precios />);
    expect(html).not.toContain("grasa y no músculo");
    const glp1 = ldFaq(html).mainEntity.find((e) => e.name === "Uso Ozempic o Mounjaro. ¿Es para mí?");
    expect(glp1?.acceptedAnswer.text).toContain("No sustituye la indicación de tu médico.");
    expect(glp1?.acceptedAnswer.text).not.toContain("grasa");
    expect(html).toContain("Conoce las condiciones de tu plan");
    expect(html).not.toMatch(/Sin riesgo y sin letra pequeña|cinco minutos/);
  });

  it("/temporadas no promete resultados ni usa colores fuera de la paleta en el panel de Running", () => {
    const html = renderToStaticMarkup(<Temporadas />);
    for (const claim of ["menos lesiones", "zancada más eficiente", "piernas pesadas", "golpear con más potencia", "tu opinión arma la siguiente", "llega con ejercicios nuevos", "brazo sano"]) expect(html).not.toContain(claim);
    for (const id of ["running", "raquetas"] as const) expect(html).not.toContain(SPORTS[id].tagline);
    expect(html).toMatch(/class="[^"]*bg-banana-soft[^"]*"><div><h2 id="run-plus"/);
    expect(src("src/app/(marketing)/temporadas/page.tsx")).not.toContain("bg-[#");
    expect(html).toContain("La Temporada Running trae Banana Run completo");
  });

  it("Mi plan pide no reintentar sin garantizar cero cobros dobles y no muestra un banner de versión de prueba", () => {
    expect(PANEL).toContain("No intentes pagar de nuevo mientras lo confirmamos.");
    expect(PANEL).not.toContain("nunca cobramos dos veces");
    expect(PANEL).not.toContain("Versión de prueba");
    expect(PANEL).toContain('beta ? "Acceso anticipado"');
    expect(MI_PLAN).toContain("<s>No incluidas</s>");
  });

  it("el informe cita la línea real de cada corrección y usa las gravedades del issue", () => {
    const rows = DOC.split("\n").filter((l) => /^\| `src\//.test(l));
    expect(rows.length).toBeGreaterThanOrEqual(14);
    const needles: Record<string, string> = {
      "precios/page.tsx|38": "No sustituye la indicación de tu médico.",
      "temporadas/page.tsx|24": "complementar tus carreras",
      "temporadas/page.tsx|25": "Trabajo de desplazamientos laterales",
      "temporadas/page.tsx|39": "puedes compartir tu opinión al terminar",
      "temporadas/page.tsx|50": "Puedes revisar tus entrenos",
      "temporadas/page.tsx|99": "SPORT_COPY[sport]",
      "temporadas/page.tsx|114": "bg-banana-soft",
      "card-panel.tsx|121": "mientras lo confirmamos",
      "card-panel.tsx|175": "Acceso anticipado",
      "suscripcion/page.tsx|131": "<s>No incluidas</s>",
      "pricing.tsx|121": "Conoce las condiciones de tu plan",
      "pricing.tsx|122": "para consultar antes de elegir tu plan",
    };
    for (const row of rows) {
      const [, file, line, , , sev] = row.split("|").map((c) => c.trim());
      expect(["Alta", "Media", "Baja"]).toContain(sev);
      const path = file.replaceAll("`", "");
      const key = Object.keys(needles).find((k) => path.endsWith(k.split("|")[0]) && k.endsWith(`|${line}`));
      expect(key, `${path}:${line}`).toBeDefined();
      // La línea citada, con margen de 5 líneas: otra PR puede mover el archivo unas líneas sin que el informe quede mal.
      const lines = src(path).split("\n");
      const near = lines.slice(Math.max(0, Number(line) - 6), Number(line) + 5);
      expect(near.some((l) => l.includes(needles[key!])), `${path}:${line}`).toBe(true);
    }
    expect(DOC).not.toMatch(/[—–]/);
    expect(DOC).toMatch(/visita|registro|prueba|pago|renovación/);
    expect(DOC).toContain("trial_charges");
  });
});
