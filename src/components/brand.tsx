import Link from "next/link";
import Image from "next/image";
import { Banana } from "@/components/icons";

/** Logo con nombre. `compact`: más chico bajo sm y solo el ícono bajo 360 px, para que el encabezado quepa en 320 px. */
export function Logo({ href = "/", small = false, compact = false }: { href?: string; small?: boolean; compact?: boolean }) {
  const icon = small ? "size-8" : compact ? "size-8 sm:size-9" : "size-9";
  const text = small ? "text-[17px]" : compact ? "text-[17px] sm:text-[19px] max-[399px]:sr-only" : "text-[19px]";
  return (
    <Link href={href} className="tap inline-flex min-h-11 min-w-11 shrink-0 items-center gap-2 rounded-xl font-extrabold tracking-tight text-ink outline-none focus-visible:ring-4 focus-visible:ring-banana/60" aria-label="Banana Burn, inicio">
      <Image src="/icons/logo.svg" alt="" width={36} height={36} unoptimized priority className={`rounded-[10px] ${icon}`} />
      <span className={`whitespace-nowrap ${text}`}>Banana<span className="text-[#8A5300]">Burn</span></span>
    </Link>
  );
}

export function DemoBanner() {
  return (
    <aside aria-label="Aviso de demo" className="flex items-center justify-center gap-1.5 bg-ink text-white/90 text-[11px] font-semibold py-1 px-4">
      <Banana weight="fill" className="size-3.5 shrink-0 text-banana" />
      <span className="truncate">Demo con datos de ejemplo</span>
    </aside>
  );
}
