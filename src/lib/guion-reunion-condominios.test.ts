// El guion de la reunión de 30 minutos con administraciones (marketing/condominios/guion-reunion.md): estas pruebas vigilan
// que el minuto a minuto sume 30, que las capturas existan, que las objeciones repitan respuestas-harvey.txt, que los
// correos del mismo día cumplan las reglas de Harvey y que precios, estados y botones sean los del código.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONDO_STATUSES, condoOffer } from "@/lib/condos";
import { STATUSES } from "@/lib/condominios";
import { usd2 } from "@/lib/num";
import { PLANS } from "@/lib/plans";

const guion = readFileSync("marketing/condominios/guion-reunion.md", "utf8");
const respuestas = readFileSync("marketing/condominios/respuestas-harvey.txt", "utf8");
const kit = readFileSync("marketing/condominios/kit-implementacion.md", "utf8");
const panel = readFileSync("src/app/admin/condominios/page.tsx", "utf8");
const landing = readFileSync("src/app/c/[code]/page.tsx", "utf8");
const metas = readFileSync("docs/metas/100-usuarios-de-pago.md", "utf8");

function section(title: string): string {
  const start = guion.indexOf(title);
  expect(start, `falta la sección ${title}`).toBeGreaterThanOrEqual(0);
  const next = guion.indexOf("\n## ", start + title.length);
  return guion.slice(start, next === -1 ? undefined : next);
}
const blocks = (text: string) => [...text.matchAll(/```\n([\s\S]*?)```/g)].map((m) => m[1]);
const emails = blocks(section("## Correo de seguimiento del mismo día"));
const price = (id: string, b: "mes" | "anual") => PLANS.find((p) => p.id === id)!.price[b];

describe("estructura", () => {
  it("trae todas las secciones que pide el issue", () => {
    for (const s of [
      "## Minuto a minuto", "## Preguntas para descubrir si el gimnasio se usa", "## Demostración con capturas reales",
      "## Cómo cerrar el sí ese mismo día", "## Respuestas a objeciones", "## Correo de seguimiento del mismo día", "## Embudo y rentabilidad",
    ]) section(s);
  });
  it("el minuto a minuto va de 0 a 30 sin huecos", () => {
    const rows = [...section("## Minuto a minuto").matchAll(/^\| (\d+) a (\d+) \|/gm)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows[0][0]).toBe(0);
    expect(rows.at(-1)![1]).toBe(30);
    for (let i = 1; i < rows.length; i++) expect(rows[i][0]).toBe(rows[i - 1][1]);
  });
});

describe("demostración con capturas reales", () => {
  it("solo nombra capturas que existen en public/landing", () => {
    const shots = [...section("## Demostración con capturas reales").matchAll(/`(public\/landing\/[^`]+)`/g)].map((m) => m[1]);
    expect(shots.length).toBeGreaterThanOrEqual(4);
    for (const s of shots) expect(existsSync(s), s).toBe(true);
  });
  it("no presenta nutricion.png como Banana Shield y no muestra relojes", () => {
    expect(guion).toMatch(/`nutricion\.png` es el modo normal, no Banana Shield/);
    expect(guion).toMatch(/conexión con relojes o dispositivos: todavía no existe/);
  });
});

describe("objeciones", () => {
  it("cada respuesta numerada repite una frase de respuestas-harvey.txt", () => {
    const flat = respuestas.replace(/\s+/g, " ");
    const rows = section("## Respuestas a objeciones").split("\n").filter((l) => /^\| .+\((\d)\) \|/.test(l));
    expect(rows.map((r) => r.match(/\((\d)\) \|/)![1]).sort()).toEqual(["1", "2", "3", "4", "5", "6"]);
    for (const r of rows) {
      const answer = r.split(" | ")[1];
      const first = answer.split(/(?<=\.) /)[0];
      expect(flat, r).toContain(first);
    }
  });
  it("lo de GLP-1 lleva la frase del médico y el mes gratis da el plan completo", () => {
    const row = section("## Respuestas a objeciones").split("\n").find((l) => l.includes("GLP-1"));
    expect(row).toContain("No sustituye la indicación de tu médico.");
    expect(condoOffer({ status: "mes_gratis", paid_plan: null, paid_until: null })?.plan).toBe("completo");
  });
});

describe("la oferta y lo que no se promete", () => {
  it("dice que el condominio y la administración no pagan y que el ingreso viene de los residentes", () => {
    expect(guion).toMatch(/El condominio y la administración no pagan nada, ni durante el mes ni después/);
    expect(guion).toMatch(/El ingreso viene de los residentes/);
  });
  it("sin precios por volumen, descuentos ni resultados prometidos", () => {
    expect(guion).not.toMatch(/descuento del|\d+ ?% de descuento|precio especial|garantiza/i);
    expect(guion).not.toMatch(/se usa más|se va a usar más/i);
    expect(guion).toMatch(/Precios por volumen: no hay precio para la administración/);
    expect(guion).toMatch(/No te prometo un número/);
  });
  it("sin emojis, exclamaciones, guiones largos, banano ni usted", () => {
    expect(guion).not.toMatch(/[!¡—]/);
    expect(guion).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(guion).not.toMatch(/\bbanano\b|\busted\b/i);
  });
});

describe("correos del mismo día", () => {
  it("son dos, con asunto en minúscula, saludo y firma de Harvey", () => {
    expect(emails).toHaveLength(2);
    for (const e of emails) {
      expect(e).toMatch(/^Asunto: [a-záéíóúñ ]+\n\nHola, administración de \[Nombre del condominio\]\./);
      expect(e.match(/^Asunto: (.+)$/m)![1].split(" ").length).toBeLessThanOrEqual(5);
      expect(e.trimEnd()).toMatch(/Andrés Guevara\nFundador, Banana Burn\nbananaburn\.app$/);
      expect(e).toMatch(/La administración y el condominio no pagan nada/);
    }
  });
  it("un solo enlace /c/ en el A, ninguno en el B, y una sola pregunta", () => {
    const links = (e: string) => e.match(/https?:\/\/\S+|\bbananaburn\.app\/\S+/g) ?? [];
    expect(links(emails[0])).toEqual(["https://www.bananaburn.app/c/[codigo]"]);
    expect(links(emails[1])).toEqual([]);
    for (const e of emails) expect(e.match(/\?/g)).toHaveLength(1);
  });
  it("sin precios, teléfonos, WhatsApp, IA, exclamaciones ni guiones largos", () => {
    for (const e of emails) {
      expect(e).not.toMatch(/\$\s?\d|\bUSD\b|colones/i);
      expect(e).not.toMatch(/\+?\d[\d\s-]{7,}\d/);
      expect(e).not.toMatch(/whats ?app|wa\.me/i);
      expect(e).not.toMatch(/\bIA\b|\bAI\b|inteligencia artificial/i);
      expect(e).not.toMatch(/[!¡—]/);
    }
  });
});

describe("lo que nombra del código y del kit", () => {
  it("los estados son los del código", () => {
    const condo = CONDO_STATUSES.map(([, l]) => l);
    const lead = STATUSES.map(([, l]) => l);
    for (const l of ["Mes gratis", "Activo"]) expect(condo).toContain(l);
    for (const l of ["Reunión agendada", "Cerrado"]) expect(lead).toContain(l);
    for (const l of ["Mes gratis", "Activo", "Reunión agendada", "Cerrado"]) expect(guion).toContain(`"${l}"`);
  });
  it("los botones y secciones del panel y de /c/ existen", () => {
    for (const l of ["Solicitudes de reunión virtual", "Copiar enlace", "Residentes vinculados", "Entrenaron esta semana", "Notas internas"]) {
      expect(guion, l).toContain(`"${l}"`);
      expect(panel, l).toContain(l);
    }
    expect(guion).toContain("\"Activar mi mes gratis\"");
    expect(landing).toContain("\"Activar mi mes gratis\"");
  });
  it("los pasos del kit que nombra existen", () => {
    for (const s of ["## Paso 1. Crear el condominio", "## Paso 2. Enviar el enlace /c/", "## Paso 3. Imprimir y colocar el afiche", "## Paso 5.", "## Paso 6."]) {
      expect(kit).toContain(s);
    }
    expect(kit).toContain("Asunto: datos del condominio");
    expect(existsSync("marketing/condominios/presentacion-junta.pdf")).toBe(true);
    expect(existsSync("marketing/condominios/one-pager-junta.pdf")).toBe(true);
  });
  it("la meta de 3 condominios es la de docs/metas", () => {
    expect(metas).toMatch(/3 condominios activados en Costa Rica en noviembre/);
    expect(guion).toMatch(/3 condominios en "Mes gratis" en Costa Rica/);
  });
});

describe("precios y cálculo del embudo", () => {
  it("la tabla de planes usa los precios de plans.ts", () => {
    const t = section("## Embudo y rentabilidad");
    expect(t).toContain(`| Entreno | ${usd2(price("entreno", "mes"))} | ${usd2(price("entreno", "anual"))} |`);
    expect(t).toContain(`| Entreno + Nutrición | ${usd2(price("completo", "mes"))} | ${usd2(price("completo", "anual"))} |`);
  });
  it("el ejemplo de 10 residentes cuadra con plans.ts", () => {
    const ten = (id: string, b: "mes" | "anual") => usd2(Math.round(price(id, b) * 10 * 100) / 100);
    expect(guion).toContain(`entre ${ten("entreno", "mes")} y ${ten("completo", "mes")} al mes`);
    expect(guion).toContain(`entre ${ten("entreno", "anual")} y ${ten("completo", "anual")} si pagan anual`);
  });
  it("los precios mensuales que dice en la reunión son los de plans.ts", () => {
    expect(guion).toContain(`Entreno ${usd2(price("entreno", "mes"))} al mes o Entreno + Nutrición ${usd2(price("completo", "mes"))} al mes`);
  });
});
