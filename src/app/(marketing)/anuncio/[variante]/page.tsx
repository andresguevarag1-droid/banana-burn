import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HERO_VARIANT_KEYS, heroVariantFor } from "@/lib/landing-variants";
import { Landing, homeMetadata } from "../../home";

// Portada con el hero del anuncio (#285). Se llega por la reescritura de /?utm_content=<variante> (next.config.ts), así que
// la dirección sigue siendo /. Estática como la portada (ISR) y fuera de Google: canonical a / y noindex.
export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return HERO_VARIANT_KEYS.map((variante) => ({ variante }));
}

export function generateMetadata(): Metadata {
  return { ...homeMetadata(), robots: { index: false, follow: true } };
}

export default async function AnuncioPage({ params }: { params: Promise<{ variante: string }> }) {
  const variant = heroVariantFor((await params).variante);
  if (!variant) notFound();
  return <Landing variant={variant} />;
}
