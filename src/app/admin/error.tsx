"use client";
// Error de cualquier sección del panel: mensaje claro, reintento y salida segura. El detalle técnico no se muestra.
import Link from "next/link";
import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Warning as TriangleAlert } from "@/components/icons";
import { btnGhost, btnPrimary } from "@/components/admin/ui";
import { logClientError } from "@/components/error-state";
import { errorKind } from "@/lib/error-kind";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const stale = errorKind(error) === "stale";
  useEffect(() => { logClientError("admin", error, errorKind(error)); }, [error]);
  const retry = () => (stale ? window.location.reload() : startTransition(() => { router.refresh(); reset(); }));
  return (
    <div role="alert" className="mx-auto max-w-lg space-y-3 rounded-2xl border border-line bg-white p-8 text-center">
      <TriangleAlert className="mx-auto size-8 text-bad" aria-hidden />
      <h1 className="text-xl font-extrabold text-ink">No pudimos cargar esta sección</h1>
      <p className="text-sm text-muted text-pretty">{stale ? "Hay una versión nueva del panel. Recarga para seguir. " : ""}Puede ser un problema de conexión con la base de datos. Intenta de nuevo; si sigue fallando, avisa al equipo técnico{error.digest ? ` con el código ${error.digest}` : ""}.</p>
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <button type="button" onClick={retry} className={btnPrimary}>{stale ? "Actualizar" : "Reintentar"}</button>
        <Link href="/admin" className={btnGhost}>Ir al resumen</Link>
      </div>
    </div>
  );
}
