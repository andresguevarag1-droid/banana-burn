import Link from "next/link";
import { ArrowRight, Clock } from "@/components/icons";

/** Aviso discreto mientras dura la prueba gratis. */
export function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const last = daysLeft <= 1;
  return (
    <aside aria-label="Prueba gratis" className={`mb-5 flex items-center gap-3 rounded-2xl border px-3 py-2 text-sm ${last ? "border-ember/30 bg-ember/5" : "border-line bg-white"}`}>
      <Clock weight="duotone" className={`size-5 shrink-0 ${last ? "text-ember-ink" : "text-banana-ink"}`} aria-hidden />
      <p className="flex-1 min-w-0 font-semibold text-ink">{last ? "Hoy es tu último día de prueba" : `Te quedan ${daysLeft} días de prueba`}<span className="hidden sm:inline font-normal text-muted"> con todo incluido</span></p>
      <Link href="/app/suscripcion" className="tap pressable inline-flex shrink-0 items-center gap-1 rounded-full px-3 h-11 font-bold text-banana-ink hover:text-ink">Elegir plan<ArrowRight weight="bold" className="size-4" /></Link>
    </aside>
  );
}
