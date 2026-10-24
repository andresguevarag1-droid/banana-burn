"use client";
// Marca un paso al llegar a una pantalla (por ejemplo, abrir Entrenar o la técnica de un ejercicio). No pinta nada.
import { useEffect } from "react";
import { learn } from "./learn-store";

export function MarkLearn({ k }: { k: string }) {
  useEffect(() => { learn(k); }, [k]);
  return null;
}
