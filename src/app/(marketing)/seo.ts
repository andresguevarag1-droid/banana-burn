import type { Metadata } from "next";
import { PLANS, usd } from "@/lib/plans";
import { SITE_URL } from "@/lib/env";

/** Mercado: toda Latinoamérica (la empresa está en Costa Rica, pero la oferta es regional). */
const AREA = [{ "@type": "Place", name: "Latinoamérica" }, ...["MX", "GT", "SV", "HN", "NI", "CR", "PA", "DO", "CO", "VE", "EC", "PE", "BO", "CL", "AR", "UY", "PY"].map((c) => ({ "@type": "Country", identifier: c }))];

const OG_IMAGE = { url: "/landing/og.png", width: 1200, height: 630, alt: "Banana Burn, tu entrenador personal con IA" };

/** Metadatos sociales por página. Next reemplaza `openGraph` completo por página, así que se arma aquí entero. */
export function social({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  return {
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: "Banana Burn", locale: "es_LA", type: "website", images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE.url] },
  };
}

/** JSON-LD de la app con los precios reales de `plans.ts`. Sin calificaciones ni reseñas: aún no las hay. */
export function appJsonLd() {
  const offers = PLANS.flatMap((p) =>
    (["mes", "anual"] as const).map((b) => ({
      "@type": "Offer",
      name: `${p.name} (${b === "mes" ? "mensual" : "anual"})`,
      price: p.price[b].toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      areaServed: AREA,
      url: `${SITE_URL}/#precios`,
      priceSpecification: { "@type": "UnitPriceSpecification", price: p.price[b].toFixed(2), priceCurrency: "USD", billingDuration: b === "mes" ? "P1M" : "P1Y", unitText: b === "mes" ? "mes" : "año" },
      description: `${p.tagline}. ${usd(p.price[b])} por ${b === "mes" ? "mes" : "año"}.`,
    })),
  );
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Banana Burn",
    applicationCategory: "HealthApplication",
    applicationSubCategory: "Fitness",
    operatingSystem: "Web, iOS, Android",
    inLanguage: "es-419",
    url: SITE_URL,
    description: "Entrenador personal con IA en español: rutina de gym o casa ajustada a tu nivel, progresión automática de cargas, nutrición con comida latina y seguimiento de progreso. Para toda Latinoamérica.",
    areaServed: AREA,
    offers,
    publisher: { "@type": "Organization", name: "Banana Burn", email: "hola@bananaburn.app", address: { "@type": "PostalAddress", addressLocality: "San José", addressCountry: "CR" } },
  };
}
