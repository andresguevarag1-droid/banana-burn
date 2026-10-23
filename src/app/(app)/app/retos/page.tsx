import Link from "next/link";
import { getViewer } from "@/lib/supabase/server";
import { getCatalog, getMyChallenges, getOwned, getParticipants, levelPerks } from "@/lib/challenges-server";
import { todayMetrics } from "@/lib/metrics";
import { todayFor } from "@/lib/today";
import { MAX_ACTIVE, storeSection, type Challenge, type StoreSection } from "@/lib/challenges";
import { toEndedView, toView } from "@/lib/challenge-view";
import { ChallengeCard, EndedChallengeCard } from "@/components/challenge-card";
import { StoreCard } from "@/components/retos/store-card";
import { Certificates } from "@/components/retos/certificates";
import { LevelBadge } from "@/components/levels/level-badge";
import { ArrowRight, BananaTrophy, Lock, Sparkle } from "@/components/icons";

export const metadata = { title: "Tienda de retos" };

const SECTIONS: { key: StoreSection; title: string; desc: string }[] = [
  { key: "gratis", title: "Gratis", desc: "Incluidos con tu plan o tu prueba gratis." },
  { key: "premium", title: "Premium", desc: "Pago único en USD, aparte de tu plan. Son tuyos para siempre y puedes repetirlos." },
  { key: "proximamente", title: "Próximamente", desc: "Retos con fecha de inicio para hacerlos en grupo." },
];

export default async function Retos() {
  const v = (await getViewer())!;
  const today = todayFor(v).iso;
  const [{ active, done, ended }, catalog, owned, participants, perks] = await Promise.all([
    getMyChallenges(v, await todayMetrics(v)), getCatalog(v.demo), getOwned(v), getParticipants(v), levelPerks(v),
  ]);
  const activeIds = new Set(active.map((a) => a.c.id));
  const list = [...catalog.values()].sort((a, b) => Number(b.featured) - Number(a.featured) || a.sort - b.sort);
  const by = (k: StoreSection) => list.filter((c) => storeSection(c, today) === k);
  const ownedIdle = list.filter((c) => c.priceUsd > 0 && owned.has(c.id) && !activeIds.has(c.id));
  const card = (c: Challenge) => <StoreCard key={c.id} className="w-[80%] max-w-80 shrink-0 snap-start focus-visible:ring-4 focus-visible:ring-banana/60 sm:w-auto sm:max-w-none" c={c} owned={owned.has(c.id)} participants={participants.get(c.id)} discountPct={perks.discountPct} active={activeIds.has(c.id)} />;

  return (
    <div className="space-y-8 animate-enter">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Tienda de retos</p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink text-balance">Elige tu próximo reto</h1>
          <p className="mt-1 max-w-[60ch] text-muted">Un objetivo concreto cada día, hitos en los días 7 y 14, y medalla con XP al terminar.</p>
        </div>
        <Link href="/app/niveles" className="pressable inline-flex h-12 items-center gap-2 rounded-2xl border border-line bg-white pl-1.5 pr-3 text-sm font-bold text-ink hover:border-ink/25">
          <LevelBadge idx={perks.level.idx} size="sm" />
          <span className="min-w-0"><span className="block leading-tight">{perks.level.n}</span><span className="block text-[11px] font-semibold text-muted">{perks.discountPct > 0 ? `${perks.discountPct}% en Premium` : perks.extraGrace > 0 ? `+${perks.extraGrace} comodín por nivel` : "Sube de nivel para descuentos"}</span></span>
        </Link>
      </header>

      <section className="space-y-3" aria-labelledby="mis-retos">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="mis-retos" className="text-xl font-extrabold text-ink">Mis retos</h2>
          <span className="text-sm font-semibold text-muted tabular-nums">{active.length} de {MAX_ACTIVE} en curso</span>
        </div>
        {active.length ? (
          <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">{active.map((m) => <ChallengeCard key={m.ucId} v={toView(m)} />)}</div>
        ) : (
          <div className="card flex items-center gap-3 p-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-banana-soft text-banana-ink"><BananaTrophy className="size-7" /></span><p className="text-sm text-muted">Todavía no tienes retos en curso. Empieza con uno gratis de abajo: el día 1 es hoy.</p></div>
        )}
        {active.length >= MAX_ACTIVE && <p className="rounded-2xl bg-cream p-3 text-sm text-muted">Ya tienes {MAX_ACTIVE} retos en curso. Termina o abandona uno para empezar otro.</p>}
        {ownedIdle.length > 0 && (
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-extrabold text-ink"><Lock weight="duotone" className="size-4 text-peel" />Premium que ya son tuyos</p>
            <ul className="mt-2 flex flex-wrap gap-2">{ownedIdle.map((c) => <li key={c.id}><Link href={`/app/retos/${c.id}`} className="pressable inline-flex h-11 items-center gap-1.5 rounded-full bg-cream px-4 text-sm font-bold text-ink hover:bg-banana-soft">{c.title}<ArrowRight weight="bold" className="size-3.5" /></Link></li>)}</ul>
          </div>
        )}
        {ended.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-extrabold text-ink">Para volver a intentar</h3>
            <div className="grid gap-3 lg:grid-cols-2">{ended.map((e) => <EndedChallengeCard key={e.ucId} e={toEndedView(e)} />)}</div>
          </div>
        )}
      </section>

      {SECTIONS.map((s) => {
        const items = by(s.key);
        if (!items.length) return null;
        return (
          <section key={s.key} className="space-y-3" aria-labelledby={`sec-${s.key}`}>
            <div>
              <h2 id={`sec-${s.key}`} className="flex items-center gap-2 text-xl font-extrabold text-ink">{s.key === "premium" && <Sparkle weight="duotone" className="size-5 text-banana-ink" />}{s.title}</h2>
              <p className="text-sm text-muted">{s.desc}{s.key === "premium" && perks.discountPct > 0 ? ` Tu nivel ${perks.level.n} te da ${perks.discountPct}% de descuento.` : ""}</p>
            </div>
            {/* Móvil: carrusel deslizable dentro de la sección (la página no se desborda); desde sm, rejilla. */}
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">{items.map(card)}</div>
            {items.length > 1 && <p className="text-xs text-muted sm:hidden">Desliza para ver los {items.length} retos.</p>}
          </section>
        );
      })}

      <Certificates done={done} />
    </div>
  );
}
