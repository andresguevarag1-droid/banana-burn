// Tarjeta de la tienda de retos (servidor). Datos reales: duración, dificultad, minutos al día, recompensa,
// personas en el reto (solo si hay al menos 3 de verdad) y precio (con el descuento por nivel si aplica).
import Link from "next/link";
import { BananaMedal, CalendarCheck, CheckCircle, Clock, Lock, Users } from "@/components/icons";
import { DIFFICULTY_LABEL, priceMinor, usd, type Challenge } from "@/lib/challenges";
import { ChallengeCover } from "./cover";

export const MIN_PARTICIPANTS_SHOWN = 3;
const fmtStart = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("es-419", { day: "numeric", month: "long" });

export function PriceTag({ c, owned, discountPct }: { c: Pick<Challenge, "priceUsd">; owned: boolean; discountPct: number }) {
  if (c.priceUsd <= 0) return <span className="text-sm font-extrabold text-peel">Gratis</span>;
  if (owned) return <span className="inline-flex items-center gap-1 text-sm font-extrabold text-peel"><CheckCircle weight="fill" className="size-4" />Ya es tuyo</span>;
  const full = priceMinor(c.priceUsd, 0), final = priceMinor(c.priceUsd, discountPct);
  return (
    <span className="inline-flex items-baseline gap-1.5 tabular-nums">
      {final < full && <s className="text-xs font-semibold text-faint">{usd(full)}</s>}
      <span className="text-sm font-extrabold text-ink">{usd(final)}</span>
      <span className="text-[11px] font-semibold text-muted">USD</span>
    </span>
  );
}

export function StoreCard({ c, owned, participants, discountPct, active, className = "" }: { c: Challenge; owned: boolean; participants?: number; discountPct: number; active?: boolean; className?: string }) {
  const paid = c.priceUsd > 0;
  return (
    <Link href={`/app/retos/${c.id}`} className={`card group flex flex-col overflow-hidden p-0! outline-none ${className}`} >
      <ChallengeCover c={c} className="h-28">
        <span className={`absolute right-3 top-3 inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-extrabold ${paid ? "bg-ink text-banana" : "bg-white/90 text-peel"}`}>
          {paid ? <>{owned ? <CheckCircle weight="fill" className="size-3.5" /> : <Lock weight="fill" className="size-3.5" />}Premium</> : "Gratis"}
        </span>
        {c.featured && <span className="absolute bottom-3 left-4 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-extrabold text-ink">Destacado</span>}
      </ChallengeCover>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-extrabold leading-tight text-ink text-balance">{c.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{c.desc}</p>
        <ul className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold text-ink/80">
          <li className="chip h-7 bg-cream"><CalendarCheck weight="duotone" className="size-3.5" />{c.days} días</li>
          <li className="chip h-7 bg-cream">{DIFFICULTY_LABEL[c.difficulty]}</li>
          <li className="chip h-7 bg-cream"><Clock weight="duotone" className="size-3.5" />{c.minutes} min al día</li>
        </ul>
        <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-ink/80"><BananaMedal className="size-4 shrink-0 text-banana-ink" /><span className="min-w-0 truncate">+{c.xp.toLocaleString("es-CO")} XP y medalla {c.badge}</span></p>
        {c.startMode === "fecha" && c.startDate && <p className="mt-1 text-xs font-semibold text-sky">Empieza el {fmtStart(c.startDate)}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          {participants !== undefined && participants >= MIN_PARTICIPANTS_SHOWN ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted"><Users weight="duotone" className="size-4" />{participants.toLocaleString("es-CO")} en el reto</span>
          ) : <span />}
          {active ? <span className="text-sm font-extrabold text-peel">En curso</span> : <PriceTag c={c} owned={owned} discountPct={discountPct} />}
        </div>
      </div>
    </Link>
  );
}
