import Link from "next/link";
import { Banana, BananaFlame, BananaTrophy, Barbell, MonkeyBanana } from "@/components/icons";
import { LevelBadge } from "@/components/community/avatar";
import { fmtNum } from "@/lib/community-view";
import type { WeekStats } from "@/lib/community";

/** Encabezado de La tropa: arte de marca (mono coach y bananas) y tu semana con datos reales. */
export function TropaHero({ stats }: { stats: WeekStats }) {
  const tiles = [
    { k: "Entrenos", sub: "esta semana", v: stats.workouts, Icon: Barbell },
    { k: "Bananas", sub: "recibidas", v: stats.kudos, Icon: Banana },
    { k: "Racha", sub: stats.streak === 1 ? "día" : "días", v: stats.streak, Icon: BananaFlame },
  ];
  return (
    <header className="relative overflow-hidden rounded-[1.75rem] bg-ink text-white shadow-lift">
      {/* Arte de marca: decorativo */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -right-16 -top-20 size-72 rounded-full bg-banana/25 blur-3xl" />
        <div className="absolute -left-10 bottom-0 size-40 rounded-full bg-ember/20 blur-3xl" />
        <Banana weight="fill" className="bb-sway absolute right-[34%] top-5 size-6 text-banana/40" style={{ ["--r" as string]: "-24deg" }} />
        <Banana weight="fill" className="bb-sway absolute right-4 bottom-[46%] size-5 text-banana/30 [animation-delay:1.2s]" style={{ ["--r" as string]: "38deg" }} />
        <Banana weight="duotone" className="bb-sway absolute left-[52%] top-[38%] size-4 text-white/20 [animation-delay:2.4s]" style={{ ["--r" as string]: "12deg" }} />
      </div>

      <div className="relative flex items-start gap-4 p-5 sm:p-7">
        <div className="flex-1 min-w-0">
          <h1 className="text-[2.1rem] sm:text-5xl font-extrabold tracking-tight leading-none">La tropa</h1>
          <p className="mt-2 max-w-sm text-[15px] text-white/75 text-pretty">Entrena acompañado. Celebra lo de los demás y deja que celebren lo tuyo.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <LevelBadge xp={stats.xp} tone="dark" />
            <Link href="/app/retos" className="chip pressable h-9 px-3.5 bg-banana text-ink text-[13px] font-extrabold hover:brightness-95"><BananaTrophy className="size-4" />Retos</Link>
          </div>
        </div>
        <div aria-hidden className="relative shrink-0">
          <span className="grid place-items-center size-24 sm:size-32 rounded-[2rem] bg-banana text-ink rotate-[-6deg] shadow-[0_18px_40px_-12px_rgb(255_214_10/.55)]">
            <MonkeyBanana weight="fill" className="size-16 sm:size-24 [--bb-icon-bg:#FFD60A]" />
          </span>
          <span className="absolute -bottom-2 -left-3 grid place-items-center size-10 rounded-2xl bg-white text-banana-ink rotate-[10deg] shadow-soft"><BananaTrophy className="size-6" /></span>
        </div>
      </div>

      <div className="relative grid grid-cols-3 gap-2 px-3 pb-3 sm:px-5 sm:pb-5">
        {tiles.map(({ k, sub, v, Icon }) => (
          <div key={k} className="rounded-2xl bg-white/[.08] border border-white/10 px-3 py-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-white/70"><Icon weight="duotone" className="size-4 text-banana" />{k}</p>
            <p className="mt-1 text-2xl sm:text-3xl font-extrabold tabular-nums leading-none">{fmtNum(v)}</p>
            <p className="mt-1 text-[11px] text-white/55">{sub}</p>
          </div>
        ))}
      </div>
    </header>
  );
}
