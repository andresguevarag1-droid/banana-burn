"use client";
// Abrir /app/novedades cuenta como visto: apaga el punto "Nuevo" del menú y el diálogo no vuelve a saltar.
import { useEffect } from "react";
import { NOVEDADES } from "@/lib/novedades";
import { rememberSeen } from "./news-store";

export function MarkNewsSeen({ persisted }: { persisted: boolean }) {
  useEffect(() => { if (NOVEDADES.length) rememberSeen(NOVEDADES[0].id, persisted); }, [persisted]);
  return null;
}
