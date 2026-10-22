"use client";
import { useEffect, useState } from "react";

/**
 * Barra fija con el CTA principal, solo en móvil.
 * Aparece cuando el CTA del hero (`[data-sticky-anchor]`, o `#hero`) sale por arriba y se esconde cuando hay en pantalla
 * cualquier elemento marcado con `data-sticky-hide` (los planes, el CTA final, el pie).
 * El botón llega como `children` desde el servidor: así este componente no arrastra íconos al bundle.
 */
export function StickyCta({ note, children }: { note: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = document.querySelector("[data-sticky-anchor]") ?? document.getElementById("hero");
    const blockers = Array.from(document.querySelectorAll("[data-sticky-hide], footer"));
    if (!hero || typeof IntersectionObserver === "undefined") return;
    let heroOut = false;
    const visible = new Set<Element>();
    const update = () => setShow(heroOut && visible.size === 0);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) heroOut = !e.isIntersecting && e.boundingClientRect.top < 0;
        else if (e.isIntersecting) visible.add(e.target);
        else visible.delete(e.target);
      }
      update();
    });
    io.observe(hero);
    blockers.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div
      aria-hidden={!show}
      inert={!show}
      className={`md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur-xl px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] motion-safe:transition-[transform,opacity] motion-safe:duration-200 motion-safe:ease-out ${show ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"}`}
    >
      <div className="flex items-center gap-3">
        <p className="flex-1 min-w-0 text-[13px] leading-snug font-semibold text-muted text-pretty">{note}</p>
        {children}
      </div>
    </div>
  );
}
