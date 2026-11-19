// #323: confianza para dejar la tarjeta. Antes de CARD_REQUIRED_FROM nada cambia; desde esa fecha, la línea de tiempo de la
// prueba, el pago seguro, las preguntas del cobro (con JSON-LD FAQPage) y la línea bajo los botones, con los precios reales.
import { renderToStaticMarkup } from "react-dom/server";
import { prerender } from "react-dom/static.edge";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ STAFF: ["admin", "superadmin"], createClient: async () => ({}) }));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }), usePathname: () => "/", useSearchParams: () => new URLSearchParams(), notFound: () => { throw new Error("404"); } }));

const { CARD_REQUIRED_FROM } = await import("./card-required");
const { CHARGE_DAY, NOTICE_DAY, cardTrust, trustCopy } = await import("./card-trust");
const { PLANS } = await import("./plans");
const { promoPrice } = await import("./trial");
const { money } = await import("./copy");
const Home = (await import("@/app/(marketing)/page")).default;
const Anuncio = (await import("@/app/(marketing)/anuncio/[variante]/page")).default;
const Precios = (await import("@/app/(marketing)/precios/page")).default;
const English = (await import("@/app/en/page")).default;
const EnglishPricing = (await import("@/app/en/pricing/page")).default;
const { Wizard } = await import("@/app/bienvenida/wizard");

const before = new Date(Date.parse(CARD_REQUIRED_FROM) - 60_000);
const after = new Date(CARD_REQUIRED_FROM);
const nb = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");
const text = (html: string) => nb(html).replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");
const clock = (now: Date) => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now); };
const prerendered = async (el: React.ReactElement) => { const { prelude } = await prerender(el); return new Response(prelude).text(); };
/** Las páginas a revisar: portada, anuncio, precios y las dos en inglés. */
const PAGES: [string, () => Promise<string>][] = [
  ["/", async () => prerendered(Home())],
  ["/anuncio/reel_cuanto_peso", async () => prerendered(await Anuncio({ params: Promise.resolve({ variante: "reel_cuanto_peso" }) }))],
  ["/precios", async () => renderToStaticMarkup(<Precios />)],
  ["/en", async () => prerendered(English())],
  ["/en/pricing", async () => renderToStaticMarkup(<EnglishPricing />)],
];
const FAQ_ES = ["¿Me cobran hoy?", "¿Me avisan antes de cobrar?", "¿Cómo cancelo?", "¿Y si me arrepiento después de pagar?", "¿Es seguro poner mi tarjeta?", "¿Sirve si nunca he ido a un gym?", "¿Puedo entrenar en casa?"];
const ldFaq = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1])).find((d) => d["@type"] === "FAQPage");

afterEach(() => { vi.useRealTimers(); });

describe("cardTrust: textos según la fecha y con los precios reales", () => {
  it("antes de la fecha no hay bloque; desde la fecha sí, en los dos idiomas", () => {
    expect(cardTrust("es-419", before)).toBeNull();
    expect(cardTrust("en-US", before)).toBeNull();
    expect(cardTrust("es-419", after)).toEqual(trustCopy("es-419"));
    expect(cardTrust("en-US", after)).toEqual(trustCopy("en-US"));
  });
  it("día del aviso (6) y del cobro (8) salen de la prueba y del recordatorio", () => {
    expect([NOTICE_DAY, CHARGE_DAY]).toEqual([6, 8]);
  });
  it("la línea de tiempo y la pregunta del cobro usan los precios de plans.ts y trial.ts", () => {
    for (const locale of ["es-419", "en-US"] as const) {
      const t = trustCopy(locale);
      const all = nb([t.steps.flat(), t.faq[0]].flat().join(" "));
      for (const p of PLANS) expect(all).toContain(money(promoPrice(p.id)));
      for (const p of PLANS) expect(all).toContain(money(p.price.anual));
      expect(t.steps).toHaveLength(4);
    }
    expect(nb(trustCopy().steps[3][2])).toBe("Se cobra tu plan: mensual con el primer mes al 50 % ($4.99 Entreno o $7.49 Entreno + Nutrición), o anual ($59.99 o $89.99). USD, IVA incluido.");
    expect(trustCopy().faq.map(([q]) => q)).toEqual(FAQ_ES);
  });
  it("nada inventado: sin contadores, testimonios, garantías ni emojis; sin mencionar IA", () => {
    const all = JSON.stringify([trustCopy("es-419"), trustCopy("en-US")]);
    expect(all).not.toMatch(/\+\s?\d|usuarios|garant|guarantee|testimon|\bIA\b|\bAI\b|inteligencia artificial/i);
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(all).toContain("Ley 7472");
    expect(all).toContain("8 días hábiles");
  });
});

describe("páginas públicas antes y después de la fecha", () => {
  for (const [path, render] of PAGES) {
    const es = !path.startsWith("/en");
    it(`${path}: el bloque nuevo solo desde la fecha`, async () => {
      clock(before);
      const b = text(await render());
      expect(b).not.toContain(es ? "Así funciona tu prueba" : "How your trial works");
      expect(b).not.toContain(es ? "y dejas tu tarjeta" : "plan and add your card");
      expect(b).not.toContain(es ? "Los datos de tu tarjeta los guarda el procesador" : "stored by the payment processor");
      clock(after);
      const html = await render();
      const a = text(html);
      const t = trustCopy(es ? "es-419" : "en-US");
      expect(a).toContain(t.title);
      expect(a).toContain(nb(t.cancel));
      expect(a).toContain(nb(t.secure));
      expect(a).toContain(nb(t.underCta));
      for (const p of PLANS) expect(a).toContain(money(promoPrice(p.id)));
      expect(a).not.toMatch(es ? /sin tarjeta/i : /no card needed/i);
      // Las preguntas del cobro se ven en la página y van iguales en el JSON-LD FAQPage.
      const ld = ldFaq(html);
      expect(ld["@context"]).toBe("https://schema.org");
      const names = ld.mainEntity.map((q: { name: string }) => q.name);
      for (const [q, ans] of t.faq) {
        expect(names).toContain(q);
        expect(a).toContain(nb(q).replace(/'/g, "'"));
        expect(nb(ld.mainEntity.find((e: { name: string }) => e.name === q).acceptedAnswer.text)).toBe(nb(ans));
      }
      expect(new Set(names).size).toBe(names.length);
      expect(html.match(/<details/g)!.length).toBe(names.length);
    }, 30_000);
  }
  it("quién está detrás: completa en la portada, corta en el anuncio, solo desde la fecha", async () => {
    clock(before);
    expect(text(await PAGES[0][1]())).not.toContain("Atlas Resources SRL");
    clock(after);
    expect(text(await PAGES[0][1]())).toContain(trustCopy().company);
    const ad = text(await PAGES[1][1]());
    expect(ad).toContain(trustCopy().companyShort);
    expect(ad).not.toContain(trustCopy().company);
  }, 30_000);
});

describe("bienvenida: el paso de la tarjeta obligatoria", () => {
  const props = { name: "Ana", demo: true, initialGoal: null, glp1: false, country: "CR", intent: null, trialEndsAt: "2026-11-30T06:00:00.000Z", chargeAt: "2026-11-30T06:00:00.000Z", startOnCard: true };
  it("junto al formulario: la línea del cobro y el pago seguro; en el paso opcional de antes, no", () => {
    const t = text(renderToStaticMarkup(<Wizard {...props} cardOffer cardRequired />));
    expect(t).toContain(nb(trustCopy().oneLine));
    expect(t).toContain(trustCopy().secure);
    const optional = text(renderToStaticMarkup(<Wizard {...props} cardOffer />));
    expect(optional).not.toContain(trustCopy().secure);
  });
  it("en inglés, con los mismos datos", () => {
    const t = text(renderToStaticMarkup(<Wizard {...props} locale="en-US" cardOffer cardRequired />));
    expect(t).toContain(trustCopy("en-US").oneLine);
    expect(t).toContain(trustCopy("en-US").secure);
  });
});

// QA #323: comprobar cada ubicación, no solo que la frase aparece alguna vez en la página.
describe("microcopy junto a los registros secundarios después del cambio", () => {
  it("el registro del FAQ también explica que hoy no se cobra y que puedes cancelar", async () => {
    clock(after);
    const { FaqCta } = await import("@/app/(marketing)/content");
    const copy = text(renderToStaticMarkup(<FaqCta cta="faq" />));
    expect(copy).toContain(trustCopy().underCta);
  });
  for (const [path, render] of PAGES.slice(0, 2)) {
    it(`${path}: el registro fijo móvil incluye la misma tranquilidad del resto de botones`, async () => {
      clock(after);
      const html = await render();
      const sticky = html.match(/<div[^>]*class="[^"]*fixed inset-x-0 bottom-0[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      expect(sticky, "la página debe conservar el registro fijo móvil").not.toBeNull();
      expect(text(sticky![1])).toContain(trustCopy().underCta);
    }, 30_000);
  }
});
