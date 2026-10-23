"use client";
// Una versión de Novedades con sus items: lo usan el diálogo "Lo nuevo en Banana Burn" y la página /app/novedades.
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BrandIcon } from "@/components/icons";
import { openGuide } from "@/components/guide/guide-provider";
import { artFor, levelArt } from "@/lib/challenge-art";
import { releaseDay, type NewsArt, type NewsItem, type Release } from "@/lib/novedades";

function artSrc(a: NewsArt | undefined): string | null {
  if (!a) return null;
  if ("reto" in a) return artFor(a.reto);
  if ("nivel" in a) return levelArt(a.nivel);
  return a.src;
}

function Art({ item }: { item: NewsItem }) {
  const src = artSrc(item.image);
  // Si la portada no carga (sin conexión o CDN caído), queda el ícono: nunca una imagen rota.
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <span className="relative block size-16 shrink-0 overflow-hidden rounded-2xl bg-banana-soft ring-1 ring-ink/10 sm:size-20">
        <Image src={src} alt="" width={80} height={80} sizes="80px" className="size-full object-cover" onError={() => setFailed(true)} />
        <span className="absolute bottom-1 right-1 grid size-6 place-items-center rounded-lg bg-white/95 text-banana-ink shadow-soft"><BrandIcon name={item.icon} className="size-4" aria-hidden /></span>
      </span>
    );
  }
  return <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-banana-soft text-banana-ink sm:size-20"><BrandIcon name={item.icon} className="size-8 sm:size-9" aria-hidden /></span>;
}

const ctaClass = "tap mt-2 inline-flex min-h-11 items-center gap-1.5 font-bold text-ink underline decoration-banana decoration-2 underline-offset-[6px] hover:decoration-ink";

function Try({ item, onNavigate }: { item: NewsItem; onNavigate?: () => void }) {
  const label = item.cta ?? "Probar";
  if (item.opens === "guia") {
    // Si hay un diálogo encima, se cierra primero (200 ms) y luego se abre la guía: así no se pisan el foco ni el scroll.
    return (
      <button type="button" aria-haspopup="dialog" onClick={() => { onNavigate?.(); setTimeout(openGuide, onNavigate ? 220 : 0); }} className={ctaClass}>
        {label}<ArrowRight weight="bold" className="size-4" aria-hidden />
      </button>
    );
  }
  return (
    <Link href={item.href} onClick={onNavigate} className={ctaClass}>
      {label}<span className="sr-only">: {item.title}</span><ArrowRight weight="bold" className="size-4" aria-hidden />
    </Link>
  );
}

export function ReleaseBlock({ r, isNew = false, onNavigate, headingLevel = 3 }: { r: Release; isNew?: boolean; onNavigate?: () => void; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  const Hi = headingLevel === 2 ? "h3" : "h4";
  const hid = `nov-${r.id}`;
  return (
    <section aria-labelledby={hid}>
      <p className="flex flex-wrap items-center gap-2">
        <span className="eyebrow">{releaseDay(r.date)}</span>
        {isNew && <span className="rounded-full bg-banana px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-ink">Nuevo</span>}
      </p>
      <H id={hid} className="mt-1 text-xl font-extrabold leading-tight tracking-tight text-ink sm:text-2xl">{r.title}</H>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{r.intro}</p>
      <ul className="stagger mt-4 space-y-3">
        {r.items.map((it) => (
          <li key={it.title} className="card flex gap-3.5 p-4 sm:gap-4">
            <Art item={it} />
            <div className="min-w-0 flex-1">
              <Hi className="font-extrabold leading-snug text-ink">{it.title}</Hi>
              <p className="mt-1 text-[15px] leading-relaxed text-body">{it.benefit}</p>
              <Try item={it} onNavigate={onNavigate} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
