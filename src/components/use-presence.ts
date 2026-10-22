"use client";
import { useEffect, useState } from "react";

/**
 * Mantiene montado un elemento mientras corre su animación de salida.
 * `closing` es true durante `exitMs` después de que `open` pasa a false (para poner data-closing).
 */
export function usePresence(open: boolean, exitMs = 200) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) { setMounted(true); return; }
    const t = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(t);
  }, [open, exitMs]);
  return { mounted: open || mounted, closing: !open && mounted };
}

/** Último valor no nulo: deja que el contenido siga visible mientras su contenedor sale. */
export function useSticky<T>(value: T | null | undefined): T | null {
  const [last, setLast] = useState<T | null>(value ?? null);
  useEffect(() => { if (value != null) setLast(value); }, [value]);
  return value ?? last;
}
