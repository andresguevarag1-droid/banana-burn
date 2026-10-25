"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { META_PIXEL_ID, PIXEL_SKIP } from "@/lib/meta-pixel";

type Fbq = ((...args: unknown[]) => void) & { loaded?: boolean };
declare global { interface Window { fbq?: Fbq } }

/** Llama a fbq si el píxel cargó. Nunca rompe la página (bloqueadores de anuncios, red lenta). */
export function fbq(...args: unknown[]) {
  try { if (typeof window !== "undefined" && typeof window.fbq === "function") window.fbq(...args); } catch { /* sin píxel */ }
}

/**
 * Carga el Meta Pixel: crea la cola de fbq y agrega fbevents.js al final de <head>. SOLO desde un efecto (después de
 * hidratar). El snippet oficial de Meta, puesto con next/script, insertaba su <script> antes del primer <script> del
 * documento y, si corría mientras React todavía hidrataba, React veía un nodo que no estaba en el HTML del servidor
 * (error #418 en ~5 % de las cargas de la landing, oct 2026). Aquí nunca se toca el DOM antes de hidratar.
 */
export function loadMetaPixel(id: string, w: Window & typeof globalThis = window) {
  if (w.fbq) return;
  type Queue = Fbq & { callMethod?: (...a: unknown[]) => void; queue: unknown[][]; push: unknown; version: string };
  const n = function (...args: unknown[]) { if (n.callMethod) n.callMethod(...args); else n.queue.push(args); } as unknown as Queue;
  n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
  w.fbq = n;
  (w as unknown as { _fbq?: Fbq })._fbq ??= n;
  const t = w.document.createElement("script");
  t.async = true;
  t.src = "https://connect.facebook.net/en_US/fbevents.js";
  w.document.head.appendChild(t);
  n("init", id);
  n("track", "PageView");
}

/**
 * Meta Pixel en todas las páginas públicas y de la app (no en /admin). Carga después de hidratar (y cuando el navegador
 * queda libre) para no afectar la velocidad, y registra PageView en cada cambio de ruta del App Router.
 */
export function MetaPixel() {
  const path = usePathname() || "/";
  const off = !META_PIXEL_ID || PIXEL_SKIP.test(path);
  // Si la primera página es /admin, el píxel no se carga en toda la visita.
  const [offAtLoad] = useState(off);
  useEffect(() => {
    if (!META_PIXEL_ID || offAtLoad) return;
    // Espera a que la página termine de cargar (los trozos de JS que hidratan las partes en Suspense) y a que el navegador
    // quede libre: así React ya terminó de hidratar todo cuando el píxel toca el <head>.
    let h = 0;
    let done = false;
    const go = () => { if (!done) { done = true; loadMetaPixel(META_PIXEL_ID); } };
    const idle = () => {
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      h = ric ? ric(go, { timeout: 3000 }) : window.setTimeout(go, 200);
    };
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
    return () => {
      window.removeEventListener("load", idle);
      (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(h);
      window.clearTimeout(h);
      done = true;
    };
  }, [offAtLoad]);
  // La primera vista la registra loadMetaPixel al iniciar; aquí solo las navegaciones siguientes.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!off) fbq("track", "PageView");
  }, [path, off]);
  return null;
}
