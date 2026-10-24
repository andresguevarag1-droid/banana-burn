"use client";
// Último recurso: falló el layout raíz, así que no hay estilos ni componentes de la app. Todo va en línea, con los colores de marca.
import { useEffect } from "react";
import { reportBoundaryError } from "@/lib/monitor/client";

const STALE = /ChunkLoadError|Loading chunk|dynamically imported module|Failed to find Server Action/i;

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = STALE.test(`${error.name} ${error.message}`);
  useEffect(() => {
    console.error(`[ui:global] ${stale ? "stale" : "generic"}`, { digest: error.digest ?? null, name: error.name });
    reportBoundaryError(error);
  }, [error, stale]);
  const btn: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", width: "100%", minHeight: 52, borderRadius: 999, fontSize: 16, fontWeight: 800, textDecoration: "none", border: 0, cursor: "pointer", fontFamily: "inherit" };
  return (
    <html lang="es-419">
      <body style={{ margin: 0, minHeight: "100dvh", background: "#FFF8E3", color: "#2E2818", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", display: "grid", placeItems: "center", padding: "24px 16px", boxSizing: "border-box" }}>
        <main role="alert" style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" width={80} height={80} alt="" style={{ display: "block", margin: "0 auto", borderRadius: 28 }} />
          <h1 style={{ margin: "20px 0 0", fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: "#1B1505" }}>{stale ? "Hay una versión nueva de Banana Burn." : "Algo falló al abrir Banana Burn."}</h1>
          <p style={{ margin: "8px 0 0", color: "#6A604B", lineHeight: 1.5 }}>{stale ? "Recarga para seguir con la versión nueva." : "Tus datos están a salvo. Prueba otra vez en un momento."}</p>
          <div style={{ marginTop: 24, display: "grid", gap: 10 }}>
            <button type="button" onClick={() => (stale ? window.location.reload() : reset())} style={{ ...btn, background: "#1B1505", color: "#FFFFFF" }}>{stale ? "Actualizar ahora" : "Intentar de nuevo"}</button>
            {/* <a> y no <Link>: el enrutador puede ser justo lo que falló. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ ...btn, background: "#FFFFFF", color: "#1B1505", border: "1px solid #EDE3C6" }}>Ir al inicio</a>
          </div>
          {error.digest && <p style={{ marginTop: 20, fontSize: 11, color: "#766A52" }}>Código de referencia: <span style={{ fontFamily: "ui-monospace, monospace", userSelect: "all" }}>{error.digest}</span></p>}
        </main>
      </body>
    </html>
  );
}
