import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TemporadasLanding from "@/app/(marketing)/temporadas/page";
import { SEASONS_T1, SPORTS, longDate } from "@/lib/seasons";
import { usd2 } from "@/lib/num";

// Comprueba la oferta y el cierre con el calendario y los importes que usa la compra.
afterEach(() => vi.useRealTimers());
describe("oferta pública de Temporada 1", () => {
  it("ofrece cada deporte al precio compartido y enlaza a su compra", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-22T18:00:00Z"));
    const html = renderToStaticMarkup(<TemporadasLanding />);
    for (const s of SEASONS_T1) {
      expect(html).toContain(usd2(s.priceMinor / 100));
      expect(html).toContain(`href="/app/temporadas/${s.slug}"`);
      expect(html).toContain(`Comprar ${SPORTS[s.sport].name}`);
    }
    expect(html).toContain(longDate(SEASONS_T1[0].enrollUntil));
    expect(html).toContain("El plan anual incluye 1 temporada deportiva gratis");
    expect(html).toContain("Empieza 7 días gratis");
    expect(html).toContain("Continuar sin tarjeta");
    expect(html).toContain("La prueba no incluye la compra de una temporada");
  });
  it("retira los enlaces de compra después del cierre en Costa Rica", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T06:00:00Z"));
    const html = renderToStaticMarkup(<TemporadasLanding />);
    expect(html).toContain("Inscripciones cerradas");
    expect(html).not.toContain('data-cta="temporadas-comprar-');
  });
});
