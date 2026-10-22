"use client";
// Error de cualquier sección del panel: mensaje claro, reintento y salida segura. El detalle técnico no se muestra.
import Link from "next/link";
import { useEffect } from "react";
import { Warning as TriangleAlert } from "@/components/icons";
import { btnGhost, btnPrimary } from "@/components/admin/ui";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div role="alert" className="mx-auto max-w-lg space-y-3 rounded-2xl border border-line bg-white p-8 text-center">
      <TriangleAlert className="mx-auto size-8 text-bad" aria-hidden />
      <h1 className="text-xl font-extrabold text-ink">No pudimos cargar esta sección</h1>
      <p className="text-sm text-muted text-pretty">Puede ser un problema de conexión con la base de datos. Intenta de nuevo; si sigue fallando, avisa al equipo técnico{error.digest ? ` con el código ${error.digest}` : ""}.</p>
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <button type="button" onClick={reset} className={btnPrimary}>Reintentar</button>
        <Link href="/admin" className={btnGhost}>Ir al resumen</Link>
      </div>
    </div>
  );
}
