// Frases traducidas con partes de React (#299): "Te quedan {n} días gratis." con {n} en <b>. La frase entera va al
// diccionario (el orden de las palabras cambia entre idiomas) y cada {marca} se reemplaza por su nodo.
import { Fragment, type ReactNode } from "react";

export function rich(s: string, parts: Record<string, ReactNode>): ReactNode[] {
  return s.split(/(\{\w+\})/g).filter(Boolean).map((p, i) => {
    const k = /^\{(\w+)\}$/.exec(p)?.[1];
    return <Fragment key={i}>{k && k in parts ? parts[k] : p}</Fragment>;
  });
}
