// Tarjeta de un programa en la tienda (servidor): portada grande, para quién es, duración, días, minutos y precio.
import Link from "next/link";
import { ArrowRight, CalendarCheck, CheckCircle, Clock, Lock, Target } from "@/components/icons";
import { ChallengeCover, coverInk } from "@/components/retos/cover";
import { PriceTag } from "@/components/retos/store-card";
import { LEVEL_LABEL, durationLabel } from "@/lib/programs";
import type { ProgramChallenge } from "@/lib/programs-server";
import { coachOf } from "@/lib/coaches";
import { CoachPic } from "@/components/coach-pic";

export function ProgramCard({ c, owned, discountPct, status, days, big = false }: { c: ProgramChallenge; owned: boolean; discountPct: number; status?: "activo" | "pausado" | "completado" | null; days: string; big?: boolean }) {
  const ink = coverInk(c.cover);
  const coach = coachOf(c.program.experience);
  return (
    <Link href={`/app/retos/${c.id}`} className={`card group flex min-w-0 flex-col overflow-hidden p-0! outline-none ${big ? "md:col-span-2 md:flex-row" : ""}`}>
      <ChallengeCover c={c} chip={false} className={big ? "h-44 md:h-auto md:w-[46%] md:shrink-0" : "h-36"}>
        {/* El título no pasa del velo (72 %): no se monta sobre Coach Banana en la ilustración. */}
        <div className={`absolute bottom-0 left-0 max-w-[72%] p-4 ${ink}`}>
          <p className="text-[11px] font-extrabold uppercase tracking-[.14em] opacity-85">Programa de {durationLabel(c.program)}</p>
          <h3 className={`mt-0.5 font-extrabold leading-tight tracking-tight text-balance ${big ? "text-[26px]" : "text-xl"}`}>{c.title}</h3>
        </div>
        {coach.id !== "banana" && (
          <span className="absolute left-3 top-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-white/90 py-0.5 pl-0.5 pr-2.5 text-[11px] font-extrabold text-ink shadow-soft">
            <CoachPic src={coach.avatar} size={28} className="size-7 rounded-full object-cover" iconClassName="size-4" />Con {coach.name}
          </span>
        )}
        <span className="absolute right-3 top-3 inline-flex h-7 items-center gap-1 rounded-full bg-ink px-2.5 text-[11px] font-extrabold text-banana">
          {status === "activo" ? "Activo" : status === "pausado" ? "En pausa" : owned ? <><CheckCircle weight="fill" className="size-3.5" />Tuyo</> : <><Lock weight="fill" className="size-3.5" />Premium</>}
        </span>
      </ChallengeCover>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <p className={`text-sm text-body ${big ? "line-clamp-4" : "line-clamp-3"}`}>{c.program.who}</p>
        <ul className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold text-ink/80">
          <li className="chip h-7 bg-cream"><CalendarCheck weight="duotone" className="size-3.5" />{days}</li>
          <li className="chip h-7 bg-cream"><Clock weight="duotone" className="size-3.5" />{c.program.sessionMinutes} min</li>
          <li className="chip h-7 bg-cream"><Target weight="duotone" className="size-3.5" />{LEVEL_LABEL[c.program.level]}</li>
        </ul>
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          {status === "activo" ? <span className="text-sm font-extrabold text-peel">En curso</span> : <PriceTag c={c} owned={owned} discountPct={discountPct} />}
          <span className="inline-flex items-center gap-1 text-sm font-extrabold text-ink">{status === "activo" ? "Ver avance" : owned ? "Ver programa" : "Ver qué incluye"}<ArrowRight weight="bold" className="size-4 transition-transform duration-(--dur-fast) ease-out group-hover:translate-x-0.5" /></span>
        </div>
      </div>
    </Link>
  );
}
