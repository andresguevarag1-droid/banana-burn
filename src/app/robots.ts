import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

const PRIVATE = ["/app", "/admin", "/api", "/auth", "/bienvenida", "/pago", "/registro", "/r/"];
/** Buscadores y asistentes de IA (GEO): pueden leer las páginas públicas y /llms.txt, nunca la app. */
const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "Bingbot", "DuckAssistBot", "meta-externalagent"];

/** /entrar no se bloquea aquí: lleva noindex y el rastreador tiene que poder leerlo. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/og", "/llms.txt"], disallow: PRIVATE },
      { userAgent: AI_BOTS, allow: ["/", "/llms.txt"], disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
