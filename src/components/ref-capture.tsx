"use client";
// Enlace de referidor (?ref=CÓDIGO) en cualquier página: avisa al servidor (cookie de primera parte y conteo del clic) y
// quita el parámetro de la barra de direcciones. Sin dependencias ni datos personales.
// Además, el primer contacto (#283): si la URL trae utm_* o fbclid y no hay uno guardado, deja la cookie de 30 días que el
// servidor guarda al crear la cuenta (first-touch.ts). No toca la URL: el píxel de Meta también lee fbclid.
import { useEffect } from "react";
import { firstTouchCookie } from "@/lib/first-touch";

const RE = /^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/;
const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

export function RefCapture() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      try { const ft = firstTouchCookie(url, document.cookie); if (ft) document.cookie = ft; } catch { /* sin efecto */ }
      const code = (url.searchParams.get("ref") ?? "").trim().toLowerCase();
      if (!RE.test(code)) return;
      const utm: Record<string, string> = {};
      for (const k of UTM) { const v = url.searchParams.get(k); if (v) utm[k] = v.slice(0, 80); }
      void fetch("/api/ref", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, path: url.pathname, utm }), keepalive: true, credentials: "same-origin" }).catch(() => {});
      url.searchParams.delete("ref");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    } catch { /* sin efecto */ }
  }, []);
  return null;
}
