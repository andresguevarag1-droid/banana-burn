import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Glp1Landing, { metadata } from "@/app/(marketing)/glp1/page";
import { PLANS } from "@/lib/plans";
import { usd2 } from "@/lib/num";
import { toMetaEvent } from "@/lib/meta-pixel";

describe("landing GLP-1", () => {
  it("presenta una oferta sin atribuir una condición ni garantizar resultados", () => {
    const html = renderToStaticMarkup(<Glp1Landing />);
    const copy = `${html} ${JSON.stringify(metadata)}`;
    expect(copy).not.toMatch(/Ozempic|Wegovy|Mounjaro|Zepbound|Saxenda|¿Usas|cada kilo|3 de cada 4/i);
    expect(html).toContain("Para quienes bajan con GLP-1");
    expect(html).toContain("1.2 a 1.6 g de proteína por kg al día");
    expect(html).toContain("Fuerza 3 veces por semana");
    expect(html).toContain("No sustituye la indicación de tu médico.");
    expect(html).toContain("es una estimación, no una medición clínica");
    expect(html).toContain('type="application/ld+json"');
  });
  it("ofrece el anual compartido y conserva las entradas al embudo", () => {
    const html = renderToStaticMarkup(<Glp1Landing />);
    for (const p of PLANS) expect(html).toContain(usd2(p.price.anual));
    expect(html).toMatch(/aria-selected="true"[^>]*>Anual/);
    expect(html).toContain("<s>Banana Shield para");
    expect(html).toContain("programa=glp1&amp;plan=completo&amp;pago=anual");
    for (const placement of ["hero", "sticky", "final"]) {
      const cta = `glp1-${placement}`;
      expect(html).toContain(`data-cta="${cta}"`);
      expect(toMetaEvent("cta_click", { cta })?.name).toBe("Lead");
    }
    expect(html).toContain("Empieza 7 días gratis");
    expect(html).toContain("Continuar sin tarjeta");
  });
});
