import { existsSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RunningLanding, { metadata } from "@/app/(marketing)/running/page";
import { PLANS } from "@/lib/plans";
import { SEASONS_T1 } from "@/lib/seasons";
import { usd2 } from "@/lib/num";
import { SIGNUP } from "@/app/(marketing)/content";

const html = renderToStaticMarkup(<RunningLanding />);
const doc = readFileSync("docs/running-conversion-131.md", "utf8");
const running = SEASONS_T1.find((s) => s.sport === "running")!;

describe("/running: oferta y conversión (#131)", () => {
  it("ofrece GPS y fuerza antes del registro gratuito, con los tres CTA principales al registro", () => {
    const hero = html.slice(0, html.indexOf('id="como"'));
    expect(hero).toContain("GPS del celular");
    expect(hero).toContain("trabaja fuerza");
    expect(hero).toContain("Sin tarjeta");
    for (const cta of ["running-hero", "running-final", "running-sticky"]) {
      const tag = html.match(new RegExp(`<a[^>]*data-cta="${cta}"[^>]*>`))?.[0];
      expect(tag).toContain(`href="${SIGNUP.replaceAll("&", "&amp;")}"`);
    }
    expect(hero).toContain("Empieza 7 días gratis");
    expect(html).toContain("data-sticky-anchor");
    expect(html).toContain("data-sticky-hide");
  });

  it("muestra las fechas, el precio real y los dos anuales sin regalar la temporada en la prueba", () => {
    for (const date of [running.startsOn, running.endsOn, running.enrollUntil]) {
      expect(html).toContain(`dateTime="${date}"`);
    }
    expect(html).toContain(`US${usd2(running.priceMinor / 100)}`);
    for (const plan of PLANS) expect(html).toContain(`US${usd2(plan.price.anual)}`);
    expect(html).toContain("1 temporada deportiva gratis");
    expect(html).toContain("La prueba no incluye la compra de la temporada.");
  });

  it("conserva capturas existentes y FAQ estructuradas con los límites del GPS", () => {
    const images = [...html.matchAll(/<img[^>]*src="([^"]+)"/g)]
      .map(([, src]) => new URL(src.replaceAll("&amp;", "&"), "http://localhost").searchParams.get("url"))
      .filter((path): path is string => Boolean(path?.startsWith("/landing/running-")));
    expect(images.length).toBeGreaterThanOrEqual(6);
    for (const path of images) expect(existsSync(`public${path}`), path).toBe(true);
    expect(html).toContain("ejemplo de 21K y meta de 1:55:00");
    const faq = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1]);
    expect(faq.mainEntity.find((q: { name: string }) => q.name === "¿Necesito un reloj?").acceptedAnswer.text).toContain("pantalla encendida");
    expect(metadata.description).toContain("Plan de carrera");
  });

  it("documenta precios verificables, cobros reales y límites de atribución sin prever conversiones", () => {
    for (const plan of PLANS) {
      for (const price of Object.values(plan.price)) expect(doc).toContain(`US${usd2(price)}`);
    }
    for (const source of ["trial_charges.status = 'succeeded'", "challenge_purchases", "amount_minor / 100", "billing = 'anual'"]) expect(doc).toContain(source);
    for (const limit of ["no permiten reconstruir", "no conserva UTM", "?ref=", "no una previsión", "no es una venta adicional"]) expect(doc).toContain(limit);
  });
});
