// Sentry en el navegador: Next corre este archivo antes que la app, pero el SDK se descarga cuando la página ya cargó
// (lib/monitor/sentry-client.ts), así no pesa en el JavaScript inicial. Sin NEXT_PUBLIC_SENTRY_DSN no hace nada.
// Sin trazas de navegación (solo errores), así que no se exporta onRouterTransitionStart: el aviso del build sobre ese
// gancho se puede ignorar.
import { loadSentry } from "@/lib/monitor/sentry-client";

if (typeof window !== "undefined") {
  const start = () => setTimeout(() => void loadSentry(), 0);
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}
