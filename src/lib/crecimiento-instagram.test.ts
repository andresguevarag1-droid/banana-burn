import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(`marketing/crecimiento/${name}`, "utf8");
const playbook = read("playbook-crecimiento.md");
const criteria = read("criterios-cuentas.md");
const messages = read("mensajes-colaboracion.md");
const sources = read("fuentes.md");
// These documents use single-line CSV records, including quoted criteria with commas.
const csv = (name: string) => read(name).trimEnd().split("\n").map((line) =>
  line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((cell) => cell.replace(/^"|"$/g, "").replace(/""/g, '"')),
);

describe("Instagram growth deliverables (#83)", () => {
  it("keeps an actionable daily routine and weekly editorial/collaboration cadence", () => {
    expect(playbook).toContain("Rutina diaria de 20 minutos");
    expect(playbook).toMatch(/Seguir solo los verificados en `fuentes.md`/);
    expect(playbook).toMatch(/\d+ comentarios de valor/);
    expect(playbook).toContain("encuesta o caja de preguntas");
    expect(playbook).toContain("responder todo comentario y mensaje en menos de 2 horas");
    expect(playbook).toContain("revisiones al menos cada hora");
    for (const term of ["carruseles", "Reels", "colaboración"]) expect(playbook).toContain(term);
    expect(playbook).not.toMatch(/100[,. ]?000|100\s*mil|12 meses/);
  });

  it("covers all five local segments, discovery, qualification and exclusion", () => {
    const rows = criteria.split("\n").filter((line) => line.startsWith("| ")).slice(2);
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      const cells = row.split("|").slice(1, -1).map((cell) => cell.trim());
      expect(cells).toHaveLength(4);
      expect(cells.every(Boolean)).toBe(true);
      expect(cells[1]).toMatch(/Buscar.*#/);
    }
    for (const term of ["condominios", "running", "GLP-1", "5k a 50k", "Marcas locales", "suplementos milagro", "antes y después", "compra de seguidores"]) expect(criteria).toContain(term);
  });

  it("has 40 properly structured pending candidates and no fabricated accounts", () => {
    expect(sources).toContain("No hay cuentas candidatas verificadas");
    const [header, ...rows] = csv("cuentas-semana.csv");
    expect(header).toEqual(["segmento", "cuenta", "por qué", "acción", "estado"]);
    expect(rows).toHaveLength(40);
    expect(new Set(rows.map((row) => row[0])).size).toBe(5);
    for (const row of rows) {
      expect(row).toHaveLength(5);
      expect(row[1]).toBe("");
      expect(row[2].length).toBeGreaterThan(0);
      expect(["seguir", "comentar", "proponer colaboración"]).toContain(row[3]);
      expect(row[4]).toBe("por buscar");
    }
    const all = [playbook, criteria, messages, sources, read("cuentas-semana.csv")].join("\n");
    expect(all.match(/@[\w]+(?:\.[\w]+)*/g)).toEqual(["@bananaburnapp"]);
    expect(all).not.toMatch(/\p{Extended_Pictographic}|\bIA\b|últimos cupos|—/u);
    for (const line of all.split("\n").filter((line) => line.includes("GLP-1"))) {
      expect(line).toContain("No sustituye la indicación de tu médico.");
    }
  });

  it("provides four short tú messages ending in concrete proposals", () => {
    const drafts = [...messages.matchAll(/^## [1-4]\. ([^\n]+)\n\n([^\n]+)/gm)];
    expect(drafts.map((draft) => draft[1])).toEqual(["Reel juntos", "Rutina de condominio", "Reto de running de la Temporada 1", "Intercambio de historias"]);
    for (const [, , draft] of drafts) {
      expect(draft.split(/\s+/).length).toBeLessThan(70);
      expect(draft).not.toMatch(/\b(usted|vos|vosotros)\b/i);
      expect(draft).toMatch(/¿Te envío .+\?$/);
    }
  });

  it("keeps metrics blank and hands Martín the two weekly winners with evidence", () => {
    expect(csv("registro-seguidores.csv")).toEqual([
      ["fecha", "seguidores", "nuevos", "alcance", "visitas al perfil", "post con más guardados"],
      ["", "", "", "", "", ""],
    ]);
    expect(playbook).toContain("Cada lunes");
    expect(playbook).toContain("guardados + compartidos de Instagram Insights");
    expect(playbook).toContain("Seleccionar los 2 primeros");
    expect(playbook).toContain("Preparar para Martín, cada semana");
    expect(playbook).toContain("Andrés revisa y le pasa ese paquete");
    expect(playbook).toContain("Si hay menos de 2 posts o faltan métricas");
  });
});
