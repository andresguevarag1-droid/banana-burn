"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { List, X } from "@/components/icons";

/** Menú del encabezado en pantallas chicas: se cierra al elegir, al tocar fuera o con Escape. */
export function MobileMenu({ items }: { items: readonly (readonly [string, string])[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={box} className="relative lg:hidden">
      <button type="button" aria-expanded={open} aria-controls="menu-movil" aria-label={open ? "Cerrar menú" : "Abrir menú"} onClick={() => setOpen((v) => !v)}
        className="tap grid place-items-center size-10 rounded-full text-ink hover:bg-white/70">
        {open ? <X weight="bold" className="size-5" /> : <List weight="bold" className="size-5" />}
      </button>
      {open ? (
        <nav id="menu-movil" aria-label="Menú" className="absolute right-0 top-12 w-60 origin-top-right rounded-2xl border border-line bg-white p-2 shadow-lift animate-[menu-in_180ms_cubic-bezier(.23,1,.32,1)]">
          {items.map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className="flex h-11 items-center rounded-xl px-3 font-semibold text-ink hover:bg-cream">{label}</Link>
          ))}
          <Link href="/entrar" onClick={() => setOpen(false)} className="mt-1 flex h-11 items-center rounded-xl border-t border-line px-3 font-semibold text-ink hover:bg-cream">Entrar a mi cuenta</Link>
        </nav>
      ) : null}
    </div>
  );
}
