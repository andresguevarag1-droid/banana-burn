import Link from "next/link";

export function Logo({ href = "/", small = false }: { href?: string; small?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-extrabold tracking-tight text-ink" aria-label="Banana Burn, inicio">
      <span className={`grid place-items-center rounded-xl bg-banana shadow-[inset_0_-2px_0_rgb(0_0_0/.08)] ${small ? "size-8 text-base" : "size-9 text-lg"}`}>🍌</span>
      <span className={small ? "text-[17px]" : "text-[19px]"}>Banana<span className="text-ember">Burn</span></span>
    </Link>
  );
}

export function DemoBanner() {
  return (
    <div className="bg-ink text-white text-center text-[13px] py-2 px-4">
      🧪 Modo demo con datos de ejemplo · conecta Supabase para activar cuentas reales
    </div>
  );
}
