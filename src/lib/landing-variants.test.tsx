// #285: la portada repite el mensaje del anuncio (utm_content). Elección de la variante, reescritura, canonical, evento y textos.
import { readFileSync } from "node:fs";
import { prerender } from "react-dom/static.edge";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }), usePathname: () => "/", useSearchParams: () => new URLSearchParams(), notFound: () => { throw new Error("404"); } }));

const { GENERAL_VARIANT, HERO_VARIANTS, HERO_VARIANT_KEYS, heroVariantFor, variantRewrite } = await import("./landing-variants");
const { cleanEvent } = await import("@/app/api/track/event");
const Home = await import("@/app/(marketing)/page");
const Anuncio = await import("@/app/(marketing)/anuncio/[variante]/page");

const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");
const render = async (el: React.ReactElement) => { const { prelude } = await prerender(el); return new Response(prelude).text(); };
const GENERAL_H1 = "Bajaste de peso. Ahora no pierdas tu músculo.";

afterEach(() => { vi.useRealTimers(); });

describe("elección de la variante", () => {
  it("un utm_content conocido elige su variante", () => {
    for (const k of HERO_VARIANT_KEYS) expect(heroVariantFor(k)).toBe(k);
    expect(heroVariantFor(["reel_cuanto_peso", "otro"])).toBe("reel_cuanto_peso");
  });
  it("desconocido o sin utm_content: la portada de siempre", () => {
    for (const v of [undefined, null, "", "Reel_cuanto_peso", "reel_cuanto_peso ", "toString", "__proto__", "Video 12 min casa"]) expect(heroVariantFor(v)).toBeNull();
  });
  it("las cuatro del anuncio, con la captura de la tabla", () => {
    expect(HERO_VARIANT_KEYS).toEqual(["reel_cuanto_peso", "reel_gym_condominio", "reel_casa_gym_parque", "reel_nadie_te_mira"]);
    const shot = (k: keyof typeof HERO_VARIANTS) => HERO_VARIANTS[k].shot.split("/").pop();
    expect([shot("reel_cuanto_peso"), shot("reel_gym_condominio")]).toEqual(["c6-guiado-gym.png", "c6-guiado-gym.png"]);
    expect([shot("reel_casa_gym_parque"), shot("reel_nadie_te_mira")]).toEqual(["c2-guiado-casa.png", "c2-guiado-casa.png"]);
    // Solo capturas reales de la campaña, que existen en public/.
    for (const v of Object.values(HERO_VARIANTS)) {
      expect(v.shot).toMatch(/^\/landing\/campana-9nov\//);
      expect(() => readFileSync(`public${v.shot}`)).not.toThrow();
    }
  });
});

describe("reescritura (next.config.ts)", () => {
  const rule = variantRewrite();
  // Next compara el valor de `has` como ^valor$ y pasa los grupos con nombre a la ruta de destino.
  const match = (v: string) => new RegExp(`^${rule.has[0].value}$`).exec(v)?.groups?.variante ?? null;
  it("solo / con un utm_content conocido va a /anuncio/<variante>", () => {
    expect(rule.source).toBe("/");
    expect(rule.has[0]).toMatchObject({ type: "query", key: "utm_content" });
    expect(rule.destination).toBe("/anuncio/:variante");
    for (const k of HERO_VARIANT_KEYS) expect(match(k)).toBe(k);
    for (const v of ["", "reel_cuanto_peso_2", "xreel_nadie_te_mira", "Video 12 min casa"]) expect(match(v)).toBeNull();
  });
  it("next.config.ts la usa antes de las páginas", () => {
    expect(readFileSync("next.config.ts", "utf8")).toContain("beforeFiles: [variantRewrite()]");
  });
});

describe("caché y SEO", () => {
  it("las variantes son estáticas, una por anuncio, sin otras direcciones", () => {
    expect(Anuncio.revalidate).toBe(3600);
    expect(Anuncio.dynamicParams).toBe(false);
    expect(Anuncio.generateStaticParams()).toEqual(HERO_VARIANT_KEYS.map((variante) => ({ variante })));
  });
  it("la variante no se indexa y su canonical es /", () => {
    const m = Anuncio.generateMetadata();
    expect(m.robots).toMatchObject({ index: false });
    expect(m.alternates?.canonical).toBe("/");
    expect(m.title).toEqual(Home.generateMetadata().title);
  });
  it("la portada de siempre se indexa con canonical /", () => {
    const m = Home.generateMetadata();
    expect(m.robots).toBeUndefined();
    expect(m.alternates?.canonical).toBe("/");
  });
});

describe("evento landing_variant_view", () => {
  it("acepta solo general o una variante conocida", () => {
    expect(cleanEvent({ name: "landing_variant_view", props: { variant: GENERAL_VARIANT, path: "/" } })).toEqual({ name: "landing_variant_view", props: { variant: "general", path: "/" } });
    expect(cleanEvent({ name: "landing_variant_view", props: { variant: "reel_nadie_te_mira", otro: "x" } })?.props).toEqual({ variant: "reel_nadie_te_mira" });
    expect(cleanEvent({ name: "landing_variant_view", props: { variant: "cualquier cosa" } })).toBeNull();
    expect(cleanEvent({ name: "landing_variant_view", props: {} })).toBeNull();
  });
  it("lo manda la portada con su variante", () => {
    expect(readFileSync("src/app/(marketing)/home.tsx", "utf8")).toContain("<VariantView variant={variant ?? GENERAL_VARIANT} />");
    expect(readFileSync("src/app/(marketing)/variant-view.tsx", "utf8")).toContain('track("landing_variant_view", { variant })');
  });
});

describe("textos del hero", () => {
  const before = new Date("2026-11-09T12:00:00Z");
  const after = new Date("2027-01-02T12:00:00Z");
  const at = (d: Date) => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(d); };
  const anuncio = async (variante: string) => render(await Anuncio.default({ params: Promise.resolve({ variante }) }));

  it("sin variante: el hero de siempre", async () => {
    at(before);
    const t = text(await render(Home.default()));
    expect(t).toContain(GENERAL_H1);
    expect(t).toContain("Para quien bajó de peso rápido");
  }, 20_000);

  for (const k of HERO_VARIANT_KEYS) {
    it(`${k}: titular, subtítulo y captura del anuncio; el resto igual`, async () => {
      at(before);
      const v = HERO_VARIANTS[k];
      const html = await anuncio(k);
      const t = text(html);
      expect(html).toMatch(new RegExp(`<h1[^>]*>${v.title.replace(/[?¿]/g, (c) => `\\${c}`)}</h1>`));
      expect(t).toContain(v.sub);
      expect(html).toContain(encodeURIComponent(v.shot));
      expect(t).not.toContain(GENERAL_H1);
      expect(t).not.toContain("Para quien bajó de peso rápido");
      // El botón principal y el resto de la página no cambian.
      expect(html).toMatch(/data-cta="hero"[^>]*>Crear mi plan gratis/);
      expect(t).toContain("Así de fácil funciona.");
      expect(t).toContain("Sin tarjeta");
    }, 20_000);
  }

  it("desde el 1 de enero la variante usa cardRequiredNow, como el resto de la landing", async () => {
    at(after);
    const t = text(await anuncio("reel_nadie_te_mira"));
    expect(t).toContain("Hoy no se cobra nada");
    expect(t).not.toMatch(/sin tarjeta/i);
  }, 20_000);

  it("una variante desconocida en la ruta interna no existe", async () => {
    await expect(anuncio("otro")).rejects.toThrow("404");
  });

  it("libro de marca: sin emojis, sin IA, sin urgencia", () => {
    for (const v of Object.values(HERO_VARIANTS)) {
      const s = `${v.title} ${v.sub} ${v.alt}`;
      expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(s).not.toMatch(/\bIA\b|inteligencia artificial|últim|solo hoy|ya mismo|!/i);
      expect(s).not.toMatch(/[—–]/);
    }
  });
});
