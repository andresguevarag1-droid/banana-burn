"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Renderiza fuera del árbol (evita que transforms de ancestros rompan `position: fixed`). */
export function Portal({ children }: { children: React.ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => setEl(document.body), []);
  return el ? createPortal(children, el) : null;
}
