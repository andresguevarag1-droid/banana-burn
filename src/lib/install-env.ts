// Dónde está abierta la app y cómo se instala en la pantalla de inicio (LinkApp). Puro y probado (install-env.test.ts).
//
// Por qué importa: el push solo llega con la app instalada en iPhone (iOS 16.4+), y la gente que viene de un anuncio
// abre la página DENTRO de Instagram o Facebook, donde no se puede instalar: hay que decirle que la abra en Safari o
// Chrome. Cada caso tiene su propia ayuda en components/install.
export type InstallEnv =
  /** Ya abierta como app (pantalla de inicio). No se muestra nada de instalar. */
  | "standalone"
  /** iPhone o iPad en Safari: Compartir, Agregar a inicio, Agregar. */
  | "ios-safari"
  /** iPhone en Chrome, Edge o Firefox: desde iOS 16.4 también tienen "Agregar a inicio" en Compartir. */
  | "ios-browser"
  /** iPhone dentro de Instagram, Facebook, TikTok u otra app: no se puede instalar, hay que abrirla en Safari. */
  | "ios-inapp"
  /** Android en Chrome, Edge, Samsung Internet u otro navegador: botón Instalar (beforeinstallprompt) o menú. */
  | "android"
  /** Android dentro de Instagram, Facebook o TikTok (WebView): hay que abrirla en Chrome. */
  | "android-inapp"
  /** Computadora: se ofrece instalarla en el celular con un código QR. */
  | "desktop";

import { nativeAgentFrom } from "./platform-ua";

const INAPP = /(FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|musical_ly|TikTok|BytedanceWebview|Line\/|Snapchat|Twitter|Pinterest|LinkedInApp|GSA\/)/i;

export type EnvHints = { standalone?: boolean; maxTouchPoints?: number };

/** Clasifica el navegador. `standalone`: matchMedia('(display-mode: standalone)') o navigator.standalone. */
export function detectInstallEnv(ua: string, hints: EnvHints = {}): InstallEnv {
  // La app de las tiendas (Capacitor) ya está instalada: nada de "instala la LinkApp" ni "ábrela en Safari".
  if (hints.standalone || nativeAgentFrom(ua)) return "standalone";
  const s = ua || "";
  // iPadOS se presenta como Mac: lo delata la pantalla táctil.
  const ios = /iPhone|iPad|iPod/i.test(s) || (/Macintosh/i.test(s) && (hints.maxTouchPoints ?? 0) > 1);
  const android = /Android/i.test(s);
  if (ios) {
    if (INAPP.test(s)) return "ios-inapp";
    if (/CriOS|FxiOS|EdgiOS|OPiOS/i.test(s)) return "ios-browser";
    // Safari real trae "Safari/" y "Version/". Sin ellos es una WebView de otra app.
    if (!/Safari\//i.test(s) || !/Version\//i.test(s)) return "ios-inapp";
    return "ios-safari";
  }
  if (android) {
    if (INAPP.test(s) || /; wv\)/i.test(s)) return "android-inapp";
    return "android";
  }
  return "desktop";
}

/** ¿Hay que mostrar algo para instalar? Solo no en la app ya instalada. */
export const canSuggestInstall = (env: InstallEnv) => env !== "standalone";

/** ¿Este celular puede recibir avisos sin instalar la app? iPhone no (Apple solo los permite con la app instalada). */
export const pushNeedsInstall = (env: InstallEnv) => env === "ios-safari" || env === "ios-browser" || env === "ios-inapp";

/** La tarjeta de Hoy vuelve a aparecer como máximo cada 3 días después de cerrarla. */
export const INSTALL_CARD_SNOOZE_MS = 3 * 864e5;
export const installCardDue = (dismissedAt: number | null, now = Date.now()) => !dismissedAt || now - dismissedAt >= INSTALL_CARD_SNOOZE_MS;

/**
 * ¿Es buen momento para pedir los avisos? Ya instalada (o en un navegador que los permite sin instalar) y después del
 * primer entreno o desde la segunda vez que abre la app. Pedirlos apenas entra baja mucho la aceptación.
 */
export function pushMomentReady(env: InstallEnv, a: { opens: number; trained: boolean }) {
  if (pushNeedsInstall(env)) return false;
  if (env === "android-inapp") return false;
  return a.trained || a.opens >= 2;
}
