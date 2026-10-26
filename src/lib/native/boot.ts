// Arranque de la app nativa (iOS y Android). Solo corre dentro de la app: NativeShell lo carga con import() dinámico,
// así que la web nunca descarga este archivo ni los plugins.
//
// Hace que la app se sienta nativa: sin zoom con pellizco, sin rebote, sin selección accidental (CSS de globals.css
// bajo html[data-native]), splash con la marca, botón Atrás de Android, deep links (Universal Links y App Links) y
// enlaces externos en el navegador dentro de la app.
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { SplashScreen } from "@capacitor/splash-screen";
import { nativePlatform } from "@/lib/platform";
import { deepLinkPath, linkAction, needsFullLoad } from "./links";

const VIEWPORT = "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no";

export type Navigate = (path: string) => void;

let started = false;

/** `navigate`: navegación del router de Next (router.push), para no recargar la app entera. */
export async function bootNative(navigate: Navigate) {
  const platform = nativePlatform();
  if (started || !platform) return;
  started = true;

  const root = document.documentElement;
  root.dataset.native = platform;
  lockViewport();
  watchLinks();

  const go = (path: string) => (needsFullLoad(path) ? window.location.assign(path) : navigate(path));

  await App.addListener("appUrlOpen", ({ url }) => {
    const path = deepLinkPath(url, window.location.origin);
    if (path) go(path);
  });

  // Android: Atrás cierra lo que esté abierto encima (hojas y diálogos escuchan Escape), si no vuelve una pantalla, y
  // en la primera pantalla manda la app al fondo como cualquier app (no la cierra).
  await App.addListener("backButton", ({ canGoBack }) => {
    if (document.querySelector('[role="dialog"][aria-modal="true"]')) {
      (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return;
    }
    if (canGoBack) window.history.back();
    else void App.minimizeApp();
  });

  // La web ya pintó: fuera el splash (si la red tarda, se va solo a los 3 s; capacitor.config.ts).
  requestAnimationFrame(() => { void SplashScreen.hide({ fadeOutDuration: 200 }); });
}

/**
 * La app nunca hace zoom (el diseño ya es grande y táctil) y usa toda la pantalla: el CSS respeta el notch y la barra
 * de abajo con env(safe-area-inset-*). Next puede volver a escribir la etiqueta al navegar: se reaplica.
 */
function lockViewport() {
  const apply = () => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      document.head.appendChild(meta);
    }
    if (meta.content !== VIEWPORT) meta.content = VIEWPORT;
  };
  apply();
  new MutationObserver(apply).observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["content"] });
}

/** Enlaces y window.open: lo nuestro se queda, otra web va al navegador dentro de la app, WhatsApp y correo al sistema. */
function watchLinks() {
  const open = (href: string): boolean => {
    const action = linkAction(href, window.location.origin);
    if (action === "browser") {
      void Browser.open({ url: new URL(href, window.location.href).toString() });
      return true;
    }
    if (action === "system") {
      // Capacitor manda al sistema toda navegación fuera de allowNavigation (la app de WhatsApp, el correo).
      window.location.href = new URL(href, window.location.href).toString();
      return true;
    }
    return false;
  };

  document.addEventListener(
    "click",
    (e) => {
      if (e.defaultPrevented || e.button !== 0) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.hasAttribute("download")) return;
      const action = linkAction(a.getAttribute("href") ?? "", window.location.origin);
      // Correo y teléfono sin target: el WebView ya se los pasa al sistema.
      if (action === "browser" || (action === "system" && a.target === "_blank")) {
        e.preventDefault();
        open(a.href);
      }
    },
    true,
  );

  const original = window.open.bind(window);
  window.open = (url?: string | URL, target?: string, features?: string) => {
    const href = url ? url.toString() : "";
    if (href && open(href)) return null;
    if (href && linkAction(href, window.location.origin) === "app") {
      window.location.assign(href);
      return null;
    }
    return original(url, target, features);
  };
}
