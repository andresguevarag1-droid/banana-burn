import type { Metadata } from "next";
import { PLANS, usd } from "@/lib/plans";
import { SITE_URL } from "@/lib/env";

/** Mercado: toda Latinoamérica (la empresa está en Costa Rica, pero la oferta es regional). */
const AREA = [{ "@type": "Place", name: "Latinoamérica" }, ...["MX", "GT", "SV", "HN", "NI", "CR", "PA", "DO", "CO", "VE", "EC", "PE", "BO", "CL", "AR", "UY", "PY"].map((c) => ({ "@type": "Country", identifier: c }))];

export type OgScene = "gym" | "casa" | "cocina" | "edad" | "record";

/** Imagen para compartir generada en /og: marca nueva, titular corto y una escena UGC del mono. */
export function ogImage(t: string, s: string, v: OgScene = "gym") {
  const q = new URLSearchParams({ t, s, v });
  return { url: `/og?${q.toString()}`, width: 1200, height: 630, alt: `${t}. ${s}` };
}

/** Metadatos sociales por página. Next reemplaza `openGraph` completo por página, así que se arma aquí entero. */
export function social({ title, description, path, og }: { title: string; description: string; path: string; og?: { t: string; s: string; v?: OgScene } }): Metadata {
  const img = ogImage(og?.t ?? "Baja grasa sin perder músculo", og?.s ?? "Tu entrenador personal con IA, en español y para toda Latinoamérica.", og?.v);
  return {
    alternates: { canonical: path, languages: { "es-419": path, "x-default": path } },
    openGraph: { title, description, url: path, siteName: "Banana Burn", locale: "es_419", type: "website", images: [img] },
    twitter: { card: "summary_large_image", title, description, images: [img.url] },
  };
}

/** Organización y sitio: logo nuevo y datos de contacto para buscadores y asistentes de IA. */
export function orgJsonLd() {
  const org = {
    "@type": "Organization",
    "@id": `${SITE_URL}/#org`,
    name: "Banana Burn",
    legalName: "Atlas Resources SRL",
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/icons/icon-512.png`, width: 512, height: 512 },
    image: `${SITE_URL}/brand/mascota.jpg`,
    email: "hola@bananaburn.app",
    founder: { "@type": "Person", name: "Andrés Guevara" },
    address: { "@type": "PostalAddress", addressLocality: "San José", addressCountry: "CR" },
    areaServed: AREA,
    contactPoint: { "@type": "ContactPoint", email: "hola@bananaburn.app", contactType: "customer support", availableLanguage: ["es"] },
  };
  const site = { "@type": "WebSite", "@id": `${SITE_URL}/#web`, url: SITE_URL, name: "Banana Burn", inLanguage: "es-419", publisher: { "@id": `${SITE_URL}/#org` } };
  return { "@context": "https://schema.org", "@graph": [org, site] };
}

/** Preguntas frecuentes en schema.org (las mismas que se ven en la página). */
export function faqJsonLd(items: readonly (readonly [string, string])[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "es-419",
    mainEntity: items.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
}

/** Script JSON-LD seguro (escapa "<"). */
export const ldScript = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });

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
    image: `${SITE_URL}/brand/mascota.jpg`,
    publisher: { "@id": `${SITE_URL}/#org` },
    featureList: ["Rutina de gym, casa o sin equipo ajustada a tu nivel", "Peso sugerido para cada serie con progresión automática", "Técnica animada de cada ejercicio", "Coach con IA en español", "Nutrición con comida latina y metas de proteína", "Banana Shield: programa para quienes usan Ozempic, Wegovy o Mounjaro", "Retos, rachas y comunidad"],
    offers,
  };
}
