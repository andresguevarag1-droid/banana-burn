import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLANS } from "@/lib/plans";
import { usd2 } from "@/lib/num";
import { canEnroll, longDate, SEASONS_T1, SPORTS } from "@/lib/seasons";

const doc = readFileSync("docs/emails/temporada-1-cierre.md", "utf8");
const fullDate = (iso: string) => `${longDate(iso)} de ${iso.slice(0, 4)}`;
const emails = doc.split(/^## Correo /m).slice(1).map((part) => part.split(/^## /m)[0]);

describe("correos de cierre de Temporada 1", () => {
  it("entrega dos cuerpos breves con destino a Temporadas", () => {
    expect(emails).toHaveLength(2);
    for (const email of emails) {
      const body = email.split("**Cuerpo:**")[1].split("**Botón:**")[0].trim();
      expect(body.split(/\s+/).length).toBeLessThan(120);
      expect(email).toContain("**Asunto:**");
      expect(email).toContain("**Vista previa:**");
      expect(email).toContain("https://bananaburn.app/app/temporadas");
      for (const plan of PLANS) expect(body).toContain(usd2(plan.price.anual));
      for (const season of SEASONS_T1) expect(body).toContain(usd2(season.priceMinor / 100));
    }
  });

  it("mantiene precios y fechas unidos a sus fuentes", () => {
    for (const season of SEASONS_T1) {
      expect(doc).toContain(`| ${SPORTS[season.sport].name} | ${usd2(season.priceMinor / 100)} |`);
      for (const date of [season.startsOn, season.endsOn, season.enrollUntil]) expect(doc).toContain(fullDate(date));
      expect(canEnroll(season, "2026-11-22")).toBe(true);
      expect(canEnroll(season, "2026-11-23")).toBe(false);
    }
    for (const plan of PLANS) {
      expect(doc).toContain(`| ${plan.name} mensual | ${usd2(plan.price.mes)}/mes |`);
      expect(doc).toContain(`| ${plan.name} anual | ${usd2(plan.price.anual)}/año |`);
    }
    expect(doc).not.toMatch(/\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u2013\u2014]|\bIA\b/u);
  });
});
