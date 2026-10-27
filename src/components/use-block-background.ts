"use client";
import { useEffect, type RefObject } from "react";

/**
 * Mientras un recorrido o una guía está abierta, lo de atrás no se puede tocar, enfocar ni desplazar:
 * todo lo que no es el recorrido queda `inert` y el cuerpo de la página no hace scroll con el dedo ni la rueda.
 * Lo único que responde es lo que está dentro de `el` (en `allowScroll`, si se da, el dedo sí puede desplazar).
 * Se pasa el elemento, no un ref: el portal monta un render después y el efecto debe volver a correr.
 */
export function useBlockBackground(el: HTMLElement | null, { active = true, lockScroll = true, allowScroll }: { active?: boolean; lockScroll?: boolean; allowScroll?: RefObject<HTMLElement | null> } = {}) {
  useEffect(() => {
    if (!active || !el) return;
    // El recorrido vive en un portal directo en <body>: se marcan inertes los hermanos que no lo contienen.
    const touched: HTMLElement[] = [];
    for (const child of Array.from(document.body.children)) {
      if (!(child instanceof HTMLElement) || child.contains(el) || child.hasAttribute("inert")) continue;
      if (child.tagName === "SCRIPT" || child.tagName === "STYLE") continue;
      child.setAttribute("inert", "");
      touched.push(child);
    }
    const body = document.body;
    const prev = { overflow: body.style.overflow, overscroll: body.style.overscrollBehavior };
    if (lockScroll) { body.style.overflow = "hidden"; body.style.overscrollBehavior = "none"; }
    // El dedo o la rueda sobre el fondo oscuro no mueven la página; dentro de la zona permitida, sí.
    const stop = (e: Event) => {
      const area = allowScroll?.current;
      if (area && e.target instanceof Node && area.contains(e.target)) return;
      if (e.cancelable) e.preventDefault();
    };
    el.addEventListener("touchmove", stop, { passive: false });
    el.addEventListener("wheel", stop, { passive: false });
    return () => {
      for (const c of touched) c.removeAttribute("inert");
      if (lockScroll) { body.style.overflow = prev.overflow; body.style.overscrollBehavior = prev.overscroll; }
      el.removeEventListener("touchmove", stop);
      el.removeEventListener("wheel", stop);
    };
  }, [el, active, lockScroll, allowScroll]);
}
