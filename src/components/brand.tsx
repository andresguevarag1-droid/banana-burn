import Link from "next/link";
import Image from "next/image";

export function Logo({ href = "/", small = false }: { href?: string; small?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-extrabold tracking-tight text-ink" aria-label="Banana Burn, inicio">
      <Image src="/icons/logo.svg" alt="" width={36} height={36} unoptimized priority className={`rounded-[10px] ${small ? "size-8" : "size-9"}`} />
      <span className={small ? "text-[17px]" : "text-[19px]"}>Banana<span className="text-ember">Burn</span></span>
    </Link>
  );
}

export function DemoBanner() {
  return (
    <div className="bg-ink text-white/90 text-center text-[11px] font-semibold py-1 px-4 truncate">
      🧪 Demo con datos de ejemplo
    </div>
  );
}
