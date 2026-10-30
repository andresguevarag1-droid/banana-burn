// Fin del mes gratis del condominio (marketing/condominios/fin-mes-gratis.md): textos para que Harvey y Mateo los usen.
// Estas pruebas vigilan que los precios salgan de plans.ts con el anual primero, que no haya descuentos, teléfonos, IA ni
// emojis, que el mensaje del grupo no repita el correo condominioMesTermina y que lo que dice del panel y de Mi plan exista.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { condominioMesTermina } from "@/lib/email/templates";
import { CONDO_FREE_DAYS, CONDO_NOTICE_DAYS, CONDO_STATUSES } from "@/lib/condos";
import { ANNUAL_SEASON_NOTE, PLANS, annualSaving } from "@/lib/plans";
import { usd2 } from "@/lib/num";

const doc = readFileSync("marketing/condominios/fin-mes-gratis.md", "utf8");
const panel = readFileSync("src/app/admin/condominios/page.tsx", "utf8");
const miPlan = readFileSync("src/app/(app)/app/suscripcion/page.tsx", "utf8");
const manager = readFileSync("src/app/(app)/app/suscripcion/manager.tsx", "utf8");
const wall = readFileSync("src/app/(app)/app/suscripcion/plan-wall.tsx", "utf8");
const pricing = readFileSync("src/components/pricing.tsx", "utf8");
const nav = readFileSync("src/components/app-nav.tsx", "utf8");
const migrations = ["0001_init", "0004_payments", "0005_admin", "0053_condominios_afiliados"].map((m) => readFileSync(`supabase/migrations/${m}.sql`, "utf8")).join("\n");

const PIECES = [
  "## 1. Mensaje para el grupo de residentes (día 20)",
  "## 2. Afiche \"te quedan 10 días\" (texto para Mateo)",
  "## 3. Respuesta a \"¿cuánto cuesta después?\"",
  "## 4. Qué ve la administración y qué le reportamos",
];

function section(title: string): string {
  const start = doc.indexOf(title);
  expect(start, `falta la sección ${title}`).toBeGreaterThanOrEqual(0);
  const next = doc.indexOf("\n## ", start + title.length);
  return doc.slice(start, next === -1 ? undefined : next);
}
const blocks = (text: string) => [...text.matchAll(/```(?:sql)?\n([\s\S]*?)```/g)].map((m) => m[1]);
const [grupo] = blocks(section(PIECES[0]));
const [afiche] = blocks(section(PIECES[1]));
const [precio] = blocks(section(PIECES[2]));
const reporte = blocks(section(PIECES[3])).find((b) => b.startsWith("Asunto:"))!;
const sql = blocks(section(PIECES[3])).find((b) => b.startsWith("select"))!;
const texts = [["grupo", grupo], ["afiche", afiche], ["precio", precio], ["reporte", reporte]] as const;

describe("estructura", () => {
  it("trae las 4 piezas del issue en orden, cada una con su texto", () => {
    const at = PIECES.map((p) => doc.indexOf(p));
    for (const [i, p] of at.entries()) expect(p, PIECES[i]).toBeGreaterThanOrEqual(0);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    for (const [k, t] of texts) expect(t, k).toBeTruthy();
  });
  it("los correos a la administración llevan asunto en minúscula y la firma de Harvey", () => {
    for (const e of [grupo, reporte]) {
      expect(e).toMatch(/^Asunto: [a-záéíóúñ ]+\n\nHola, administración de \[Nombre del condominio\]\./);
      expect(e.trimEnd()).toMatch(/Andrés Guevara\nFundador, Banana Burn\nbananaburn\.app$/);
      expect(e.match(/\?/g)?.length, e.slice(0, 40)).toBe(1);
    }
  });
  it("dice qué paso del embudo mueve, cómo se mide y por qué no agrega costo", () => {
    const s = section("## Embudo y rentabilidad");
    expect(s).toMatch(/Paso del embudo: pago/);
    expect(s).toMatch(/Cómo se mide/);
    expect(s).toMatch(/no agrega costo/);
    expect(s).toMatch(/aprobación de Andrés/);
  });
});

describe("reglas de marca y de Harvey", () => {
  it("sin teléfonos, WhatsApp, IA, emojis, exclamaciones, rayas largas ni banano", () => {
    for (const [k, t] of texts) {
      expect(t, k).not.toMatch(/\+?\d[\d\s-]{7,}\d/);
      expect(t, k).not.toMatch(/whats ?app|wa\.me/i);
      expect(t, k).not.toMatch(/\bIA\b|\bAI\b|inteligencia artificial/i);
      expect(t, k).not.toMatch(/[!¡—]/);
      expect(t, k).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(t, k).not.toMatch(/\bbanano\b|\busted\b/i);
    }
    expect(doc).not.toMatch(/\p{Extended_Pictographic}|—/u);
  });
  it("ningún descuento ni porcentaje, y nadie dice que la administración paga", () => {
    for (const [k, t] of texts) {
      expect(t, k).not.toMatch(/%|descuento|oferta especial|última oportunidad/i);
      expect(t, k).not.toMatch(/(administración|condominio) (paga|pagará|cubre)\b/i);
    }
    for (const [k, t] of texts) if (k !== "grupo") expect(t, k).toMatch(/La administración no paga nada/);
  });
  it("un solo enlace en los textos para residentes, y es el /c/ del condominio", () => {
    for (const t of [grupo, reporte, precio]) {
      const links = t.match(/https?:\/\/\S+|\bbananaburn\.app\/\S+/g) ?? [];
      expect(links.length).toBeLessThanOrEqual(1);
      for (const l of links) expect(l).toBe("https://www.bananaburn.app/c/[codigo]");
    }
    expect(afiche).toContain("bananaburn.app/c/[codigo]");
    expect(doc).not.toMatch(/\/condominios\?c=/);
  });
  it("el afiche usa los colores y la fuente de la marca y se retira el día 30", () => {
    const s = section(PIECES[1]);
    for (const c of ["#FFF8E3", "#FFD60A", "#1B1505"]) expect(s).toContain(c);
    expect(s).toMatch(/Plus Jakarta Sans/);
    expect(s).toMatch(/se retira el día 30/);
    expect(afiche).toMatch(/te quedan 10 días/);
  });
  it("lo de GLP-1 lleva la frase del médico", () => {
    expect(precio).toMatch(/GLP-1\. No sustituye la indicación de tu médico\./);
  });
});

describe("precios: los de plans.ts, con el anual primero", () => {
  it("cada precio y ahorro sale de plans.ts", () => {
    for (const p of PLANS) {
      expect(precio).toContain(`${p.name}: ${usd2(p.price.anual)} al año. Ahorras ${usd2(annualSaving(p))} frente a pagar ${usd2(p.price.mes)} al mes.`);
      expect(precio).toContain(`${p.name}: ${usd2(p.price.mes)} al mes.`);
    }
    const amounts = precio.match(/\$[\d,.]+/g)!.map((a) => Number(a.slice(1).replace(/,/g, "")));
    const known = PLANS.flatMap((p) => [p.price.mes, p.price.anual, annualSaving(p)]);
    for (const a of amounts) expect(known).toContain(a);
  });
  it("el anual va antes que el mensual, como en la pantalla de planes", () => {
    expect(precio.indexOf("Plan anual")).toBeGreaterThanOrEqual(0);
    expect(precio.indexOf("Plan anual")).toBeLessThan(precio.indexOf("Plan mensual"));
    expect(pricing).toMatch(/useState<Billing>\("anual"\)/);
  });
  it("la temporada del anual es la del código", () => {
    expect(precio).toContain(`${ANNUAL_SEASON_NOTE.replace("Incluye", "El plan anual incluye")}.`);
  });
});

describe("calza con el correo condominioMesTermina sin repetirlo", () => {
  const mail = condominioMesTermina({ name: "Ana", condo: "[Nombre del condominio]", until: "2026-12-01T06:00:00.000Z" });
  it("nombra el correo y su asunto tal como existen", () => {
    expect(doc).toContain("`condominioMesTermina`");
    expect(doc).toContain(`"${mail.subject}"`);
    expect(CONDO_NOTICE_DAYS).toBe(3);
    expect(CONDO_FREE_DAYS).toBe(30);
    expect(doc).toMatch(/3 días antes de que terminen los 30 días de cada residente/);
  });
  it("el mensaje del grupo no copia ninguna línea del correo", () => {
    const lines = mail.text.split("\n").map((l) => l.replace(/^- /, "").trim()).filter((l) => l.length > 20);
    expect(lines.length).toBeGreaterThan(2);
    for (const l of lines) for (const t of [grupo, afiche, precio]) expect(t).not.toContain(l);
    expect(grupo).not.toMatch(/No te cobramos nada automáticamente/);
  });
  it("no anuncia a los residentes una fecha de cierre única", () => {
    const residentes = grupo.slice(grupo.indexOf("Hola, vecinos"));
    expect(residentes).not.toMatch(/quedan 10 días|termina el \d/);
    expect(residentes).toMatch(/cada residente termina en una fecha distinta/);
  });
});

describe("lo que nombra del panel, de Mi plan y de la base existe", () => {
  it("los conteos y estados del panel", () => {
    for (const l of ["Residentes vinculados", "Entrenaron esta semana", "Copiar enlace", "Condominios afiliados"]) {
      expect(doc, l).toContain(`"${l}"`);
      expect(panel, l).toContain(l);
    }
    expect(CONDO_STATUSES.map(([, l]) => l)).toContain("Mes gratis");
  });
  it("Mi plan existe con ese nombre y muestra la fecha de la cortesía", () => {
    expect(nav).toContain('label: "Mi plan"');
    expect(miPlan).toContain('label: "Cortesía"');
    expect(miPlan).toContain("Es un plan regalado");
    expect(miPlan).toContain("no tiene cobros automáticos");
    expect(doc).toContain('"Es un plan regalado hasta el [fecha]; no tiene cobros automáticos."');
  });
  it("los hallazgos citan el código tal como está", () => {
    expect(manager).toMatch(/current\.billing === null/);
    expect(manager).toMatch(/const paid = current\.plan !== "free"/);
    expect(wall).toContain("Tu prueba gratis terminó");
  });
  it("la consulta usa tablas, columnas y estados que existen y devuelve solo conteos", () => {
    for (const col of ["condo_id", "grant_id", "expires_at", "current_period_end"]) expect(migrations).toContain(col);
    for (const st of sql.match(/'([a-z_]+)'/g)!.map((s) => s.slice(1, -1))) expect(migrations, st).toContain(`'${st}'`);
    expect(sql).toMatch(/^select\n\s+count\(\*\)/);
    expect(sql).not.toMatch(/\b(email|name|user_id\s+as|full_name)\b/i);
    expect(sql).not.toMatch(/\b(insert|update|delete)\b/i);
  });
});
