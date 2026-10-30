// El kit para el condominio que dijo que sí (marketing/condominios/kit-implementacion.md) es texto para que Harvey lo envíe:
// estas pruebas vigilan que siga el panel y el enlace /c/ tal como existen en el código, y que cada correo cumpla las reglas
// de Harvey (un solo enlace, sin precios, sin teléfonos ni WhatsApp propio, sin IA, sin exclamaciones).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONDO_FREE_DAYS, CONDO_NOTICE_DAYS, CONDO_STATUSES, condoCodeFromName, condoWhatsapp, joinMessage } from "@/lib/condos";

const kit = readFileSync("marketing/condominios/kit-implementacion.md", "utf8");
const panel = readFileSync("src/app/admin/condominios/page.tsx", "utf8");
const actions = readFileSync("src/app/admin/condominios/actions.ts", "utf8");
const landing = readFileSync("src/app/c/[code]/page.tsx", "utf8");
const afiche = readFileSync("src/app/admin/condominios/[id]/afiche/page.tsx", "utf8");
const server = readFileSync("src/lib/condos-server.ts", "utf8");
const templates = readFileSync("src/lib/email/templates.ts", "utf8");

const STEPS = [
  "## Paso 1. Crear el condominio en Admin",
  "## Paso 2. Enviar el enlace /c/",
  "## Paso 3. Imprimir y colocar el afiche",
  "## Paso 4. Publicar el mensaje en el grupo de residentes",
  "## Paso 5. Recordatorio a los 7 días",
  "## Paso 6. Aviso 3 días antes de que termine el mes",
];

function section(title: string): string {
  const start = kit.indexOf(title);
  expect(start, `falta la sección ${title}`).toBeGreaterThanOrEqual(0);
  const next = kit.indexOf("\n## ", start + title.length);
  return kit.slice(start, next === -1 ? undefined : next);
}
const blocks = (text: string) => [...text.matchAll(/```\n([\s\S]*?)```/g)].map((m) => m[1]);
const emailOf = (step: string) => blocks(section(step)).find((b) => b.startsWith("Asunto:"));

describe("orden y estructura", () => {
  it("trae los 6 pasos del issue en orden", () => {
    const at = STEPS.map((s) => kit.indexOf(s));
    for (const [i, p] of at.entries()) expect(p, STEPS[i]).toBeGreaterThanOrEqual(0);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
  it("cada paso trae su correo listo para copiar, con asunto y la firma de Harvey", () => {
    for (const s of STEPS) {
      const e = emailOf(s);
      expect(e, `${s} sin correo`).toBeDefined();
      expect(e).toMatch(/^Asunto: .+\n\nHola, administración de \[Nombre del condominio\]\./);
      expect(e!.trimEnd()).toMatch(/Andrés Guevara\nFundador, Banana Burn\nbananaburn\.app$/);
    }
  });
  it("la lista de verificación tiene exactamente 6 puntos para marcar", () => {
    const list = blocks(section("## Lista de verificación para la administración"))[0];
    const items = list.split("\n").filter((l) => l.startsWith("[ ]"));
    expect(items.map((l) => l.match(/^\[ \] (\d)\./)?.[1])).toEqual(["1", "2", "3", "4", "5", "6"]);
  });
});

describe("reglas de Harvey en cada correo", () => {
  const all = STEPS.map((s) => [s, emailOf(s)!] as const);
  it("un solo enlace, y es el /c/ del condominio", () => {
    for (const [s, e] of all) {
      const links = e.match(/https?:\/\/\S+|\bbananaburn\.app\/\S+/g) ?? [];
      expect(links.length, s).toBeLessThanOrEqual(1);
      for (const l of links) expect(l, s).toBe("https://www.bananaburn.app/c/[codigo]");
      expect(e, s).not.toMatch(/\/condominios/);
    }
  });
  it("sin precios, teléfonos, WhatsApp, IA, emojis, exclamaciones ni guiones largos", () => {
    for (const [s, e] of all) {
      expect(e, s).not.toMatch(/\$\s?\d|\bUSD\b|colones/i);
      expect(e, s).not.toMatch(/\+?\d[\d\s-]{7,}\d/);
      expect(e, s).not.toMatch(/whats ?app|wa\.me/i);
      expect(e, s).not.toMatch(/\bIA\b|\bAI\b|inteligencia artificial/i);
      expect(e, s).not.toMatch(/[!¡—]/);
      expect(e, s).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(e, s).not.toMatch(/\bbanano\b|\busted\b/i);
    }
  });
  it("ningún correo dice que la administración o el condominio paga", () => {
    for (const [s, e] of all) expect(e, s).not.toMatch(/(administración|condominio) (paga|pagará|cubre)\b/i);
    expect(emailOf(STEPS[1])).toMatch(/La administración no paga nada/);
  });
});

describe("el panel y el enlace /c/ tal como existen en el código", () => {
  it("los campos y botones que nombra existen en el panel", () => {
    for (const label of [
      "Condominios afiliados", "Crear un condominio", "Nombre del condominio", "Administradora (opcional)",
      "Unidades aprox. (opcional)", "Código del enlace (opcional)", "Solicitud de origen (opcional)", "Crear condominio",
      "Residentes vinculados", "Entrenaron esta semana", "Copiar enlace", "Copiar mensaje de WhatsApp", "Afiche con QR",
      "Notas internas", "Solicitudes de reunión virtual",
    ]) {
      expect(kit, label).toContain(`"${label}"`);
      expect(panel, label).toContain(label);
    }
  });
  it("los estados que nombra son los del código", () => {
    const labels = CONDO_STATUSES.map(([, l]) => l);
    for (const l of ["Mes gratis", "Activo", "Terminado"]) {
      expect(labels).toContain(l);
      expect(kit).toContain(`"${l}"`);
    }
  });
  it("el nombre lleva de 2 a 80 caracteres y el código no se puede cambiar después", () => {
    expect(kit).toMatch(/de 2 a 80 caracteres/);
    expect(actions).toMatch(/label: "Nombre del condominio", required: true, min: 2, max: 80/);
    const patch = actions.slice(actions.indexOf("export async function updateCondo(")).match(/const patch[^\n]*/)?.[0];
    expect(patch).toMatch(/status, name/);
    expect(patch).not.toMatch(/\bcode\b/);
  });
  it("el ejemplo de código sale del nombre como dice el kit", () => {
    expect(kit).toContain("\"Condominio Las Palmas\" queda `las-palmas`");
    expect(condoCodeFromName("Condominio Las Palmas")).toBe("las-palmas");
  });
  it("el mensaje de creación y el botón de la página /c/ son los del código", () => {
    expect(kit).toContain("Condominio creado. Su enlace: https://www.bananaburn.app/c/codigo");
    expect(actions).toContain("Condominio creado. Su enlace: ${condoLink(tryCode)}");
    expect(kit).toContain("\"Activar mi mes gratis\"");
    expect(landing).toContain("\"Activar mi mes gratis\"");
    expect(kit).toContain("\"Imprimir afiche\"");
    expect(afiche).toContain("\"Imprimir afiche\"");
  });
  it("30 días desde que cada residente lo activa, y aviso 3 días antes", () => {
    expect(CONDO_FREE_DAYS).toBe(30);
    expect(CONDO_NOTICE_DAYS).toBe(3);
    expect(kit).toMatch(/30 días del plan completo .* desde el día en que lo activa/);
  });
  it("el mensaje del grupo del paso 4 es el que copia el botón del panel", () => {
    const e = emailOf(STEPS[3])!;
    // SITE_URL cambia por entorno: el kit usa el dominio de producción.
    const body = condoWhatsapp({ name: "[Nombre del condominio]", code: "[codigo]" }).replace(/https?:\/\/[^/]+\/c\//, "https://www.bananaburn.app/c/");
    expect(e).toContain(body);
  });
  it("lo que dice que la página /c/ explica, la página lo explica", () => {
    expect(landing).toMatch(/tú decides si sigues .*No te cobramos nada automáticamente/);
  });
  it("lo que dice que el sistema ya envía es lo que envía", () => {
    expect(kit).toContain(`"${joinMessage("join", "[nombre]").title}"`);
    expect(server).toContain("Tu mes gratis del condominio termina pronto");
    expect(templates).toContain("Tu mes gratis del condominio termina pronto");
    expect(templates).toMatch(/Mi plan/);
    expect(templates).toMatch(/No te cobramos nada automáticamente/);
    expect(templates).toMatch(/historial/);
  });
});
