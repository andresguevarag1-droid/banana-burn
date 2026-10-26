"use client";
// Puente con la app nativa (Capacitor). En la web no hace nada y no descarga nada: el arranque nativo
// (src/lib/native/boot.ts) se carga con import() dinámico solo dentro de la app.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNativeApp } from "@/lib/platform";

export function NativeShell() {
  const router = useRouter();
  useEffect(() => {
    if (!isNativeApp()) return;
    import("@/lib/native/boot").then((m) => m.bootNative((path) => router.push(path))).catch(() => {});
  }, [router]);
  return null;
}
