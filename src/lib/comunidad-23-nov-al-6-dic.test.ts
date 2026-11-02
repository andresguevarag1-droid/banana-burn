import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FIRST_HOME_MIN, FIRST_MAX_MIN } from "@/lib/engine";
import { usd2 } from "@/lib/num";
import { annualSaving, PLANS } from "@/lib/plans";
import { REF_ANNUAL_MONTHS, REF_ATTRIBUTION_HOURS, REF_COOKIE_MAX_AGE, REF_GROUP_SIZE, REF_MAX_REWARDS_YEAR, REF_WINDOW_DAYS } from "@/lib/referrals";
import { PROMO_PCT, promoPrice } from "@/lib/trial";

// #220: la comunidad del 23 nov al 6 dic lleva al registro y al primer entreno, de noche. El 26 está archivado.
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const DAYS = [
  ...["23", "24", "25", "27", "28", "29", "30"].map((d) => `2026-11-${d}`),
  ...["01", "02", "03", "04", "05", "06"].map((d) => `2026-12-${d}`),
];
const WEEKS = ["semana-2026-11-23.md", "semana-2026-11-30.md"];
const SIGNUP = read("src/app/(marketing)/content.tsx").match(/export const SIGNUP = "([^"]+)"/)![1];
const SIGNUP_URL = `https://bananaburn.app${SIGNUP}`;
const doc = (date: string) => read(`marketing/comunidad/${date}.md`);
const week = (name: string) => read(`marketing/comunidad/${name}`);
const stories = (md: string) => md.slice(md.indexOf("## Historias"), md.indexOf("## Post del día"));
const all = () => [...DAYS.map(doc), ...WEEKS.map(week)];

describe("comunidad del 23 nov al 6 dic: primer entreno de noche (#220)", () => {
  it.each(DAYS)("%s: historia principal de noche con el enlace al primer entreno", (date) => {
    const md = doc(date);
    expect(md).toContain("aprobación escrita de Andrés");
    expect(md).toContain("#220");
    const main = md.match(/^- (\d{2}):(\d{2}) Costa Rica: historia principal/m);
    expect(main, "falta la historia principal").not.toBeNull();
    const minutes = Number(main![1]) * 60 + Number(main![2]);
    expect(minutes).toBeGreaterThanOrEqual(20 * 60);
    expect(minutes).toBeLessThanOrEqual(22 * 60);
    expect(md).toContain(`«Tu primer entreno hoy»: ${SIGNUP_URL}`);
    expect(md).toContain("- 22:00 Costa Rica: última llamada");
    expect(md).toContain(`${FIRST_HOME_MIN} min, también en casa`);
    expect(md).not.toMatch(/^- 0[78]:00/m);
    // Nada le habla a una base que ya paga: ni renovación, ni fecha de cobro, ni segundo mes, ni Temporada a la venta.
    // La nota «Antes:» cuenta lo que se quitó y las respuestas pueden contestar dudas de quien ya paga.
    const published = stories(md) + md.split("## Post del día")[1].split("## Respuestas del día")[0];
    expect(published).not.toMatch(/renovaci|si pagaste|segundo mes|bananaburn\.app\/temporadas|bananaburn\.app\/app\/suscripcion/i);
  });

  it.each(DAYS)("%s: los carruseles de registro o entreno van de noche", (date) => {
    const post = doc(date).split("## Post del día")[1].split("## Respuestas del día")[0];
    const at = post.match(/^Carrusel[^\n]*? a las (\d{2}):00/m);
    if (!at) return;
    if (Number(at[1]) < 20) expect(post, "un carrusel de día solo puede vender plan o referidos").toMatch(/no registrarse/);
    else expect(post).toContain("bananaburn.app");
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
    const text = all().join("\n");
    expect(text).not.toMatch(/\b(10|15[-–]20|20) min\b/);
    expect(week("semana-2026-11-23.md")).toContain(`como máximo ${FIRST_MAX_MIN} min`);
  });

  it("solo usa precios de plans.ts y trial.ts, con USD e IVA incluido", () => {
    const known = new Set<string>();
    for (const p of PLANS) known.add(usd2(p.price.mes)).add(usd2(p.price.anual)).add(usd2(annualSaving(p))).add(usd2(promoPrice(p.id)));
    expect(PROMO_PCT).toBe(50);
    for (const [i, text] of all().entries()) {
      const prices = [...text.matchAll(/\$\d[\d,]*\.\d{2}/g)].map((m) => m[0]);
      for (const price of prices) expect(known.has(price), `pieza ${i}: precio desconocido ${price}`).toBe(true);
      if (prices.length) expect(text).toContain("USD, IVA incluido");
      expect(text).not.toMatch(/equivale a \$5|\/mes del anual/);
      // El 50 % siempre con sus condiciones.
      if (/50 %/.test(text)) expect(text).toMatch(/primer mes/);
    }
  });

  it("referidos con la regla de 0064: el amigo cuenta cuando paga", () => {
    for (const name of ["2026-11-25", "2026-12-04"]) {
      const md = doc(name);
      expect(md).toContain(`${REF_GROUP_SIZE} amigos que pagan = 1 mes gratis`);
      expect(md).toContain(`dentro de ${REF_WINDOW_DAYS} días`);
      expect(md).toContain("La prueba gratis no cuenta.");
      expect(md).toContain(`el grupo da ${REF_ANNUAL_MONTHS} meses en total`);
      expect(md).toContain(`Tope: ${REF_MAX_REWARDS_YEAR} recompensas`);
    }
    const weeks = WEEKS.map(week).join("\n");
    expect(weeks).toContain(`primeras ${REF_ATTRIBUTION_HOURS} horas`);
    expect(weeks).toContain(`cookie de ${REF_COOKIE_MAX_AGE / 86400} días`);
    expect(all().join("\n")).not.toMatch(/amigos? activos?|no necesita pagar|primeros 7 días/i);
  });

  it("respeta las reglas de marca", () => {
    for (const text of all()) {
      expect(text).not.toMatch(/\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u);
      expect(text).not.toMatch(/[–—]/u);
      expect(text).not.toMatch(/\bIA\b|banano|últimos cupos/i);
    }
  });

  it("los planes semanales enlazan cada día, sin historias de la mañana, y miden el primer entreno", () => {
    const weeks = WEEKS.map(week).join("\n");
    for (const date of DAYS) expect(weeks).toContain(`](${date}.md)`);
    expect(weeks).not.toMatch(/^- 0[78]:00|\| 0[78]:00/m);
    expect(weeks).toContain(SIGNUP_URL);
    for (const event of ["workout_open", "workout_first_set", "workout_saved"]) expect(weeks).toContain(event);
    expect(weeks).toContain("trial_charges` con status 'succeeded'");
    expect(weeks).toContain("por medir");
  });

  it("los enlaces relativos de los días, las semanas y el archivo existen", () => {
    const files = [
      ...DAYS.map((d) => `marketing/comunidad/${d}.md`),
      ...WEEKS.map((w) => `marketing/comunidad/${w}`),
      "marketing/archivo/README.md",
      "marketing/archivo/comunidad/2026-11-26.md",
      "marketing/archivo/comunidad/piezas-retiradas-23-nov-al-6-dic.md",
    ];
    for (const file of files) {
      for (const [, target] of read(file).matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
        if (target.startsWith("https:")) continue;
        expect(existsSync(new URL(target, new URL(`../../${file}`, import.meta.url))), `${file} -> ${target}`).toBe(true);
      }
    }
  });

  it("archiva el 26 nov (QUITAR) con su motivo", () => {
    expect(existsSync(new URL("../../marketing/comunidad/2026-11-26.md", import.meta.url))).toBe(false);
    expect(read("marketing/archivo/comunidad/2026-11-26.md")).toContain("ARCHIVADO (#220). No se publica.");
    const index = read("marketing/archivo/README.md");
    expect(index).toContain("comunidad/2026-11-26.md");
    expect(index).toContain("comunidad/piezas-retiradas-23-nov-al-6-dic.md");
    expect(read("marketing/archivo/comunidad/piezas-retiradas-23-nov-al-6-dic.md")).toContain("ARCHIVADO (#220)");
  });
});
