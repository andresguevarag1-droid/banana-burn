import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Precios, { generateMetadata } from "./page";
import { PLANS, ANNUAL_SEASON_NOTE } from "@/lib/plans";
import { money, noBreakGlp1 } from "@/lib/copy";
import { toMetaEvent } from "@/lib/meta-pixel";
import { pricingFaq } from "../content";

describe("/precios", () => {
  it("conserva los planes reales y las preguntas en el contenido y el esquema", () => {
    const html = renderToStaticMarkup(<Precios />);
    for (const plan of PLANS) {
      expect(html).toContain(plan.name.replaceAll("&", "&amp;"));
      expect(html).toContain(money(plan.price.anual));
      for (const feature of plan.excluded) expect(html).toContain(`<s>${noBreakGlp1(feature)}</s>`);
    }
    expect(html).toContain(ANNUAL_SEASON_NOTE);
    const script = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1];
    const schema = JSON.parse(script!);
    for (const [question] of pricingFaq()) {
      expect(schema.mainEntity.some((entry: { name: string }) => entry.name === question)).toBe(true);
      expect(html).toContain(question);
    }
    expect(html).toContain("No sustituye la indicación de tu médico.");
    expect(html).toContain("sin prorrateo");
    expect(html).toContain("ONVO Pay");
    expect(html).toContain("Tilopay");
  });

  it("mantiene los CTA como Lead y los metadatos para compartir", () => {
    const html = renderToStaticMarkup(<Precios />);
    const ctas = [...html.matchAll(/data-cta="([^"]+)"/g)].map((match) => match[1]);
    expect(ctas).toEqual(expect.arrayContaining(["precios-hero", "precios-final", "precios-sticky"]));
    for (const cta of ctas.filter((cta) => cta.startsWith("precios-"))) expect(toMetaEvent("cta_click", { cta })?.name).toBe("Lead");
    const meta = generateMetadata();
    expect(meta.title).toBeTruthy();
    expect(meta.description).toBeTruthy();
    expect(meta.openGraph).toBeTruthy();
  });
});
