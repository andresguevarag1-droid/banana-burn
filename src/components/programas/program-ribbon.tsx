"use client";
// Cinta del programa activo en todas las secciones de la app (0027): recuerda en qué modo estás y cuánto llevas.
// En Hoy no se muestra: allí está el héroe del programa.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, BrandIcon } from "@/components/icons";
import { ChallengeCover } from "@/components/retos/cover";
import type { CoverStyle } from "@/lib/challenges";

export type RibbonProgram = { slug: string; title: string; mode: string; cover: CoverStyle; icon: string; week: number; weeks: number };

export function ProgramRibbon({ p }: { p: RibbonProgram }) {
  const path = usePathname();
  if (path === "/app" || path.startsWith(`/app/retos/${p.slug}`)) return null;
  return (
    <Link href={`/app/retos/${p.slug}/progreso`} className="pressable mb-5 block overflow-hidden rounded-2xl shadow-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-banana/60">
      <ChallengeCover c={{ cover: p.cover, icon: p.icon }} chip={false} className="flex min-h-12 items-center gap-3 px-4 py-2.5">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-xl bg-ink text-banana"><BrandIcon name={p.icon} className="size-4.5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold">{p.title}</span>
          <span className="block truncate text-xs font-bold opacity-85 tabular-nums">{p.mode}, semana {p.week} de {p.weeks}</span>
        </span>
        <ArrowRight weight="bold" aria-hidden className="size-4 shrink-0" />
      </ChallengeCover>
    </Link>
  );
}
