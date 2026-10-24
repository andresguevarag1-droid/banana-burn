import Image from "next/image";
import { CoachPic } from "@/components/coach-pic";
import Link from "next/link";
import { Lightning } from "@/components/icons";

/** Atajo a entrenos exprés sin equipo de 10/20/30 min. */
export function ExpressChips({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <div>
      <p className={`flex items-center gap-1 text-xs font-bold ${tone === "dark" ? "text-white/70" : "text-ink/75"}`}><Lightning weight="fill" className={`size-3.5 ${tone === "dark" ? "text-banana" : "text-banana-ink"}`} />¿Poco tiempo? Exprés sin equipo</p>
      <div className="mt-2 flex gap-2">
        {[10, 20, 30].map((m) => (
          <Link key={m} href={`/app/entreno?expres=${m}`} className={`chip h-9 px-3.5 text-[13px] tabular-nums ${tone === "dark" ? "bg-white/10 text-white" : "bg-white/80 text-ink border border-line"}`}>{m} min</Link>
        ))}
      </div>
    </div>
  );
}

const EXPRESS: [number, string, string][] = [
  [10, "Activa", "Despierta el cuerpo"],
  [20, "Quema", "Sube pulsaciones"],
  [30, "Completo", "Cuerpo completo"],
];

/**
 * Tarjeta grande de entrenos exprés sin equipo (10/20/30 min) con Coach Banana. Va arriba en Entrenar y en Hoy debajo
 * del entreno del día: es la salida para los días ocupados y cuenta para la racha.
 */
/** `coach`: con un programa de Coach Platanita, ella presenta el exprés (su saludo en lugar de la mascota). */
export function ExpressCard({ program = false, compact = false, coach = null }: { program?: boolean; compact?: boolean; coach?: { name: string; hello: string } | null }) {
  return (
    <section aria-labelledby="expres-t" className="relative overflow-hidden rounded-[1.75rem] bg-ink p-5 text-white shadow-soft sm:p-6">
      {/* La mascota va en el flujo (no absoluta): nunca la corta el borde de la tarjeta y el texto no se le monta encima. */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[.14em] text-banana">{coach?.name ?? "Coach Banana"} exprés</p>
          <h2 id="expres-t" className={`mt-1 flex items-start gap-2 font-extrabold tracking-tight text-balance ${compact ? "text-xl" : "text-2xl sm:text-[28px]"}`}>
            <Lightning weight="fill" className="mt-1 size-6 shrink-0 text-banana" aria-hidden />¿Te estás quedando sin tiempo? Termina con estos exprés
          </h2>
          <p className="mt-1 max-w-[52ch] text-sm text-white/75 text-pretty">Sin equipo, con tu peso, en un espacio de 2&nbsp;×&nbsp;2&nbsp;m. Cuenta para tu racha{program ? ", aunque no reemplaza la sesión del programa" : ""}.</p>
        </div>
        {coach ? <span aria-hidden className="pointer-events-none -mr-1 w-24 shrink-0 select-none sm:w-32"><CoachPic src={coach.hello} size={220} sizes="128px" className="aspect-square w-full rounded-3xl object-contain !bg-transparent" iconClassName="size-12" /></span>
          : <Image src="/brand/mascota-sola.webp" alt="" aria-hidden width={220} height={220} sizes="128px" className="pointer-events-none -mr-3 w-24 shrink-0 select-none sm:w-32" />}
      </div>
      <div className="relative mt-4 grid grid-cols-3 gap-2">
        {EXPRESS.map(([m, l, d]) => (
          <Link key={m} href={`/app/entreno?expres=${m}`} aria-label={`Entreno exprés de ${m} minutos: ${l}`} className="pressable rounded-2xl bg-white/10 px-2 py-4 text-center ring-1 ring-white/10 hover:bg-white/15 hover:ring-banana/50">
            <p className="text-3xl font-extrabold leading-none tabular-nums text-banana sm:text-4xl">{m}<span className="ml-0.5 text-sm font-bold">min</span></p>
            <p className="mt-1.5 text-sm font-extrabold text-white">{l}</p>
            <p className="mt-0.5 hidden text-xs text-white/70 sm:block">{d}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
