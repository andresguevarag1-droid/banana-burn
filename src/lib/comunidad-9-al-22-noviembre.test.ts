import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FIRST_HOME_MIN, FIRST_MAX_MIN } from "@/lib/engine";
import { usd2 } from "@/lib/num";
import { PLANS } from "@/lib/plans";
import { PROMO_PCT } from "@/lib/trial";

// #214: la comunidad del 9 al 22 nov lleva al registro y al primer entreno, de noche. El 13 está archivado.
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const DAYS = ["09", "10", "11", "12", "14", "15", "16", "17", "18", "19", "20", "21", "22"].map((d) => `2026-11-${d}`);
const WEEKS = ["semana-2026-11-09.md", "semana-2026-11-16.md"];
const SIGNUP = read("src/app/(marketing)/content.tsx").match(/export const SIGNUP = "([^"]+)"/)![1];
const SIGNUP_URL = `https://bananaburn.app${SIGNUP}`;
const doc = (date: string) => read(`marketing/comunidad/${date}.md`);
const stories = (md: string) => md.slice(md.indexOf("## Historias"), md.indexOf("## Post del día"));

describe("comunidad del 9 al 22 nov: primer entreno de noche (#214)", () => {
  it("usa el enlace de registro de la portada, no /registro (no tiene página)", () => {
    expect(SIGNUP).toBe("/entrar?modo=registro");
    expect(existsSync(new URL("../app/registro", import.meta.url))).toBe(false);
  });

  it.each(DAYS)("%s: historia principal de noche con el enlace al primer entreno", (date) => {
    const md = doc(date);
    expect(md).toContain("aprobación escrita de Andrés");
    expect(md).toContain("#214");
    const main = md.match(/^- (\d{2}):(\d{2}) Costa Rica: historia principal/m);
    expect(main, "falta la historia principal").not.toBeNull();
    const minutes = Number(main![1]) * 60 + Number(main![2]);
    expect(minutes).toBeGreaterThanOrEqual(20 * 60);
    expect(minutes).toBeLessThanOrEqual(21 * 60 + 30);
    expect(md).toContain(`«Tu primer entreno hoy»: ${SIGNUP_URL}`);
    expect(md).toContain("- 22:00 Costa Rica: última llamada");
    expect(md).toContain(`${FIRST_HOME_MIN} min, también en casa`);
    expect(md).not.toMatch(/^- 0[78]:00/m);
    expect(md).not.toMatch(/bananaburn\.app\/registro|amigos activos|no necesita pagar/i);
    // Las historias no mandan a la temporada ni a Mi plan; las respuestas a dudas sí pueden enlazarlos.
    expect(stories(md)).not.toMatch(/bananaburn\.app\/(temporadas|app\/suscripcion)/);
  });

  it.each(DAYS)("%s: la base PNG/SVG sale de su JSON y cabe en la historia", (date) => {
    const json = JSON.parse(read(`marketing/comunidad/historias/${date}.json`)) as { lines: string[]; sub: string; url: string; hour: string };
    const md = doc(date);
    expect(md).toContain(`${json.hour} Costa Rica: historia principal`);
    expect(md).toContain(`Texto visible: ${json.lines.join(" / ")} ${json.sub}`);
    expect(json.url).toBe(SIGNUP_URL);
    const svg = read(`marketing/comunidad/historias/${date}.svg`);
    for (const line of [...json.lines, json.sub]) expect(svg).toContain(`>${line}</text>`);
    for (const line of json.lines) expect(line.length).toBeLessThanOrEqual(22);
    const png = readFileSync(new URL(`../../marketing/comunidad/historias/${date}.png`, import.meta.url));
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1080);
    expect(png.readUInt32BE(20)).toBe(1920);
  });

  it("dice la duración real del primer entreno", () => {
    expect(FIRST_HOME_MIN).toBe(12);
    const all = DAYS.map(doc).join("\n") + WEEKS.map((w) => read(`marketing/comunidad/${w}`)).join("\n");
    expect(all).not.toMatch(/\b(10|15[-–]20|20) min\b/);
    expect(all).toContain(`como máximo ${FIRST_MAX_MIN} min`);
  });

  it("solo usa precios de plans.ts, con USD e IVA incluido", () => {
    const known = new Set<string>([`${PROMO_PCT}`]);
    for (const p of PLANS) {
      known.add(usd2(p.price.mes)).add(usd2(p.price.anual)).add(usd2(Math.round((p.price.mes * 12 - p.price.anual) * 100) / 100));
    }
    for (const file of [...DAYS.map((d) => `marketing/comunidad/${d}.md`), ...WEEKS.map((w) => `marketing/comunidad/${w}`)]) {
      const text = read(file);
      const prices = [...text.matchAll(/\$\d[\d,]*\.\d{2}/g)].map((m) => m[0]);
      for (const price of prices) expect(known.has(price), `${file}: precio desconocido ${price}`).toBe(true);
      if (prices.length) expect(text, file).toContain("USD, IVA incluido");
      expect(text).not.toMatch(/equivale a \$5/);
    }
  });

  it("respeta las reglas de marca", () => {
    for (const text of [...DAYS.map(doc), ...WEEKS.map((w) => read(`marketing/comunidad/${w}`))]) {
      expect(text).not.toMatch(/\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u);
      expect(text).not.toMatch(/[–—]/u);
      expect(text).not.toMatch(/\bIA\b|banano/i);
    }
  });

  it("los planes semanales enlazan cada día y no programan historias de la mañana", () => {
    const weeks = WEEKS.map((w) => read(`marketing/comunidad/${w}`)).join("\n");
    for (const date of DAYS) expect(weeks).toContain(`](${date}.md)`);
    expect(weeks).not.toMatch(/^- 0[78]:00|\| 0[78]:00/m);
    expect(weeks).toContain(SIGNUP_URL);
  });

  it("archiva el 13 nov (QUITAR) con su motivo", () => {
    expect(existsSync(new URL("../../marketing/comunidad/2026-11-13.md", import.meta.url))).toBe(false);
    expect(read("marketing/archivo/comunidad/2026-11-13.md")).toContain("ARCHIVADO (#214). No se publica.");
    const index = read("marketing/archivo/README.md");
    expect(index).toContain("comunidad/2026-11-13.md");
    expect(index).toContain("comunidad/piezas-retiradas-9-al-22-nov.md");
    expect(read("marketing/archivo/comunidad/piezas-retiradas-9-al-22-nov.md")).toContain("ARCHIVADO (#214)");
  });
});
