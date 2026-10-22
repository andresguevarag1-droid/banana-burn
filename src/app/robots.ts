import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

/** Solo las páginas públicas se indexan. /entrar no se bloquea aquí: lleva noindex y el rastreador tiene que poder leerlo. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/admin", "/api", "/auth", "/bienvenida", "/pago", "/registro"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
