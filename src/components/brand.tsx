import Link from "next/link";
import Image from "next/image";
import { Banana } from "@/components/icons";

export function Logo({ href = "/", small = false }: { href?: string; small?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-extrabold tracking-tight text-ink" aria-label="Banana Burn, inicio">
      <Image src="/icons/logo.svg" alt="" width={36} height={36} unoptimized priority className={`rounded-[10px] ${small ? "size-8" : "size-9"}`} />
      <span className={small ? "text-[17px]" : "text-[19px]"}>Banana<span className="text-ember-ink">Burn</span></span>
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
