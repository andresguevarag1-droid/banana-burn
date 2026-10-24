"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { META_PIXEL_ID, PIXEL_SKIP } from "@/lib/meta-pixel";

type Fbq = ((...args: unknown[]) => void) & { loaded?: boolean };
declare global { interface Window { fbq?: Fbq } }

/** Llama a fbq si el píxel cargó. Nunca rompe la página (bloqueadores de anuncios, red lenta). */
export function fbq(...args: unknown[]) {
  try { if (typeof window !== "undefined" && typeof window.fbq === "function") window.fbq(...args); } catch { /* sin píxel */ }
}

/**
 * Meta Pixel en todas las páginas públicas y de la app (no en /admin). Carga después de la interacción para no
 * afectar la velocidad, y registra PageView en cada cambio de ruta del App Router.
 */
export function MetaPixel() {
  const path = usePathname() || "/";
  const off = !META_PIXEL_ID || PIXEL_SKIP.test(path);
  // La primera vista la registra el propio script al iniciar; aquí solo las navegaciones siguientes.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!off) fbq("track", "PageView");
  }, [path, off]);
  // Si la primera página es /admin, el píxel no se carga en toda la visita.
  const [offAtLoad] = useState(off);
  if (!META_PIXEL_ID || offAtLoad) return null;
  return (
    <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`}</Script>
  );
}
