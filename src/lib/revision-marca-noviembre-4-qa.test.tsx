import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import RunningLanding from "@/app/(marketing)/running/page";
import { AnnualUpsell } from "@/components/hoy/annual-upsell";
import { PLANS, annualSaving } from "@/lib/plans";
import { usd2 } from "@/lib/num";

// El render de servidor no ejecuta efectos: hacemos visible el aviso para revisar
// la oferta que recibe una cuenta mensual, sin cambiar el componente evaluado.
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: () => [true, vi.fn()],
}));

const read = (path: string) => readFileSync(path, "utf8");

describe("revisión de marca #154, QA", () => {
  it("Running aclara el límite anual en la oferta y en las FAQ estructuradas", () => {
    const html = renderToStaticMarkup(<RunningLanding />);
    const faq = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1]);
    const priceAnswer = faq.mainEntity.find((q: { name: string }) => q.name === "¿Cuánto cuesta?").acceptedAnswer.text;
    expect(priceAnswer).toContain("1 temporada deportiva por año pagado");
    expect(html.match(/El anual incluye 1 temporada deportiva por año pagado/g)).toHaveLength(2);
    expect(html).toContain("Precios en USD, IVA incluido. El anual se paga completo.");
    expect(html).not.toMatch(/Incluida en el plan anual|Los planes anuales la incluyen gratis/);
    expect(html).toContain("si no has usado tu temporada incluida");
  });

  for (const plan of PLANS) {
    it(`el aviso de ${plan.name} muestra precio, ahorro y destino del mismo plan`, () => {
      const html = renderToStaticMarkup(<AnnualUpsell plan={plan.id} userId="qa" />);
      expect(html).toContain(`${usd2(plan.price.anual)}/año`);
      expect(html).toContain(usd2(annualSaving(plan)));
      expect(html).toContain("en USD, IVA incluido, en un solo pago por 12 meses");
      expect(html).toContain("reemplaza tu plan actual, sin prorrateo");
      expect(html).toContain(`/app/suscripcion?plan=${plan.id}&amp;pago=anual`);
      expect(html).toContain("Ahora no");
      expect(read("docs/upsell-anual.md")).toContain("en USD, IVA incluido, en un solo pago por 12 meses");
    });
  }

  it("el informe cubre el alcance y calcula escenarios desde los precios vigentes", () => {
    const doc = read("docs/qa/revision-marca-noviembre-4.md");
    for (const path of ["src/app/(marketing)/running/page.tsx", "src/components/hoy/annual-upsell.tsx", "docs/emails/primer-pago.md", "docs/upsell-anual.md"]) expect(doc).toContain(path);
    for (const plan of PLANS) {
      for (const value of [plan.price.mes, plan.price.anual, annualSaving(plan), plan.price.anual * 10, plan.price.mes * 100]) expect(doc).toContain(usd2(value));
    }
    expect(doc).toContain("trial_charges.status = 'succeeded'");
    expect(doc).toContain("no permite atribución causal");
    expect(doc).toContain("aprobación de Andrés");
  });
});
