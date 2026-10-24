import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { SITE_URL } from "@/lib/env";
import { ErrorReporter } from "@/components/error-reporter";
import { MetaPixel } from "@/components/meta-pixel";

export const metadata: Metadata = {
  // Base de los enlaces absolutos (Open Graph, canonical) en TODAS las páginas, no solo las de marketing.
  metadataBase: new URL(SITE_URL),
  // Verificación del dominio en Meta Business (anuncios). Va en el <head> de todas las páginas, incluida la de inicio.
  verification: { other: { "facebook-domain-verification": "hehrpmjmq0u8lm0ya9thx01egvv1d6" } },
  title: { default: "Banana Burn: tu entrenador personal en el celular", template: "%s | Banana Burn" },
  description: "Baja grasa y gana fuerza con un plan de gym que cambia cada día, se adapta a tu progreso y habla tu idioma. Hecho en Costa Rica para toda Latinoamérica.",
  applicationName: "Banana Burn",
};

export const viewport: Viewport = { themeColor: "#FFF8E3", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-419">
      <body className="min-h-dvh">{children}<ErrorReporter release={(process.env.BB_RELEASE || "").slice(0, 12)} /><MetaPixel /></body>
    </html>
  );
}
