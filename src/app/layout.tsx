import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Banana Burn: Tu entrenador con IA", template: "%s | Banana Burn" },
  description: "Baja grasa y gana fuerza con un plan de gym que cambia cada día, se adapta a tu progreso y habla tu idioma. Hecho en Costa Rica para toda Latinoamérica.",
  applicationName: "Banana Burn",
};

export const viewport: Viewport = { themeColor: "#FFF8E3", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-419">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
