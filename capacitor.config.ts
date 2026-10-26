import type { CapacitorConfig } from "@capacitor/cli";

/**
 * App nativa (iOS y Android) con Capacitor. La app carga la web de producción (server.url) y empaqueta solo lo que debe
 * funcionar sin internet: la pantalla "sin conexión" (native/www). Ver docs/app-nativa.md.
 *
 * - Dominio canónico con www: bananaburn.app (sin www) redirige con 308 y la app cambiaría de host en cada arranque.
 * - CAP_SERVER_URL apunta una build de prueba a otro servidor (un preview de Vercel); se lee al correr `cap sync`.
 * - El user agent lleva "BananaBurnApp/<cascarón> (<plataforma>)": así el servidor sabe que es la app y arma el HTML
 *   sin pagos web (src/lib/platform-ua.ts). El número de cascarón sube solo cuando cambia lo nativo que la web necesita
 *   saber (por ejemplo, un plugin nuevo): una app vieja puede cargar una web nueva.
 */
const PROD_URL = "https://www.bananaburn.app";
const NATIVE_SHELL = 1;

function origin(u: string | undefined): string | null {
  const raw = (u ?? "").trim().replace(/^(["'])(.*)\1$/, "$2");
  if (!raw) return null;
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).origin;
  } catch {
    return null;
  }
}

const serverUrl = origin(process.env.CAP_SERVER_URL) ?? PROD_URL;
const host = new URL(serverUrl).host;
const supabaseHost = (() => { const o = origin(process.env.NEXT_PUBLIC_SUPABASE_URL); return o ? new URL(o).host : null; })();
const ua = (platform: "ios" | "android") => `BananaBurnApp/${NATIVE_SHELL} (${platform})`;

const config: CapacitorConfig = {
  appId: "app.bananaburn",
  appName: "Banana Burn",
  webDir: "native/www",
  backgroundColor: "#FFF8E3",
  zoomEnabled: false,
  server: {
    url: serverUrl,
    appStartPath: "/app",
    errorPath: "offline.html",
    // Lo demás (pagos externos, redes, mapas) no se abre dentro de la app: src/lib/native/boot.ts lo abre con @capacitor/browser.
    allowNavigation: [...new Set([host, "www.bananaburn.app", "bananaburn.app", supabaseHost].filter((h): h is string => Boolean(h)))],
    cleartext: serverUrl.startsWith("http://"),
  },
  ios: {
    appendUserAgent: ua("ios"),
    backgroundColor: "#FFF8E3",
    contentInset: "never",
  },
  android: {
    appendUserAgent: ua("android"),
    backgroundColor: "#FFF8E3",
  },
  plugins: {
    // Login nativo: solo Google y Apple (sin el SDK de Facebook ni otros dentro de la app). src/lib/native/auth.ts
    SocialLogin: { providers: { google: true, apple: true, facebook: false, twitter: false } },
    SystemBars: { insetsHandling: "native", initialViewportFitValueHint: "cover", style: "LIGHT" },
    SplashScreen: {
      // La web la esconde apenas pinta (src/lib/native/boot.ts). El tope de 3 s cubre la pantalla sin conexión de Android,
      // que no tiene acceso a los plugins.
      launchAutoHide: true,
      launchShowDuration: 3000,
      launchFadeOutDuration: 200,
      backgroundColor: "#1B1505",
      showSpinner: false,
      androidScaleType: "CENTER_INSIDE",
      splashFullScreen: false,
      splashImmersive: false,
    },
  },
};

export default config;
