import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Pricing } from "./pricing";
import { TrialBanner } from "@/app/(app)/app/suscripcion/trial-banner";
import { PLANS, annualSaving } from "@/lib/plans";
import { money } from "@/lib/copy";

vi.mock("next/navigation", () => ({ usePathname: () => "/app/hoy" }));
vi.mock("@/lib/env", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/env")>(), isSupabaseConfigured: false }));

describe("Elegir plan dentro de la app", () => {
  it("abre anual primero con ahorro real, temporada y el mismo destino de pago", () => {
    const html = renderToStaticMarkup(<Pricing compact loggedIn />);
    expect(html.indexOf("Anual")).toBeLessThan(html.indexOf("Mensual"));
    expect(html).toContain('aria-selected="true"');
    for (const p of PLANS) {
      expect(html).toContain(money(p.price.anual));
      expect(html).toContain(money(annualSaving(p)));
      expect(html).toContain(`plan=${p.id}&amp;pago=anual`);
    }
    expect(html).toContain("Incluye 1 temporada deportiva gratis");
    expect(html).toContain("Ver qué incluye");
    expect(html).toContain("No sustituye la indicación de tu médico.");
  });

  it.each([1, 2, 4])("muestra el tiempo restante (%i) y la pausa sin amenazar con borrar datos", days => {
    const html = renderToStaticMarkup(<TrialBanner daysLeft={days} />);
    expect(html).toContain(days === 1 ? "Hoy termina tu prueba gratis" : `Te quedan ${days} días de prueba`);
    expect(html).toContain("Tus datos quedan guardados.");
    expect(html).toContain("racha");
    expect(html).toContain("se pausa el acceso");
  });
});
