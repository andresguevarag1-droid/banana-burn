"use client";
import { useState } from "react";

/**
 * Errores de prueba para Sentry (/admin/salud): uno en el navegador (sin atrapar, como uno real) y otro en el servidor
 * (/api/salud?probar=error, solo staff). En Sentry el stack debe verse con el nombre de este archivo o de la ruta.
 */
export function SentryTest({ className }: { className: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  function browserError() {
    setMsg("Listo: error del navegador enviado.");
    setTimeout(() => { throw new Error("Prueba de Sentry en el navegador"); }, 0);
  }
  async function serverError() {
    const r = await fetch("/api/salud?probar=error", { cache: "no-store" }).catch(() => null);
    setMsg(r?.status === 500 ? "Listo: error del servidor enviado." : `No se pudo mandar (estado ${r?.status ?? "sin red"}).`);
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={className} onClick={browserError}>Error en el navegador</button>
      <button type="button" className={className} onClick={serverError}>Error en el servidor</button>
      {msg && <p role="status" className="text-xs text-muted">{msg}</p>}
    </div>
  );
}
