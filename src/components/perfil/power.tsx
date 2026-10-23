// Perfil con poder: portada por nivel de perfil, vitrina de programas, muro de insignias y "Cómo subir tu perfil".
// Componentes de servidor (sin hooks). Todo sale de Power (profile-power-server): nada inventado.
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Banana, BrandIcon, Lock, MonkeyBanana } from "@/components/icons";
import { ChallengeCover } from "@/components/retos/cover";
import { TIER_SKIN, VerifiedMark } from "@/components/community/flair";
import { howToGrow, nextTier, TIERS, tierByIdx, type Insignia } from "@/lib/profile-power";
import type { Power, ShowcaseItem } from "@/lib/profile-power-server";

const nf = (n: number) => n.toLocaleString("es-419");
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "short", year: "numeric" }) : null);

/** Marco de la tarjeta del perfil según el nivel de perfil: más nivel, más presencia. */
export const TIER_CARD: Record<number, string> = {
  1: "",
  2: "ring-1 ring-banana/60",
  3: "ring-2 ring-ember/50",
  4: "ring-2 ring-peel/45 shadow-[0_18px_40px_-24px_rgb(63_107_14/.55)]",
  5: "ring-2 ring-banana shadow-[0_22px_48px_-24px_rgb(138_98_0/.7)]",
};

/** Portada del perfil: tinta con bananas en Semilla; desde Racimo, la portada de marca del nivel. */
export function TierBanner({ tier, className = "h-32 sm:h-40", children }: { tier: number; className?: string; children?: ReactNode }) {
  const t = tierByIdx(tier);
  if (!t.cover) {
    return (
      <div className={`relative overflow-hidden bg-ink ${className}`}>
        <div aria-hidden className="absolute -right-10 -top-16 size-64 rounded-full bg-banana/30 blur-3xl" />
        <div aria-hidden className="absolute left-1/4 -bottom-20 size-48 rounded-full bg-ember/25 blur-3xl" />
        <Banana aria-hidden weight="fill" className="bb-sway absolute left-6 top-5 size-7 text-banana/40" style={{ ["--r" as string]: "-20deg" }} />
        <Banana aria-hidden weight="fill" className="bb-sway absolute left-[42%] top-10 size-5 text-banana/25 [animation-delay:1.4s]" style={{ ["--r" as string]: "30deg" }} />
        <MonkeyBanana aria-hidden weight="fill" className="absolute -right-4 -bottom-6 size-36 sm:size-44 text-banana rotate-[-8deg] [--bb-icon-bg:#1B1505]" />
        {children}
      </div>
    );
  }
  return (
    <ChallengeCover c={{ cover: t.cover, icon: t.icon }} className={className} chip={false}>
      {t.idx === 5 && <div aria-hidden className="absolute inset-x-0 bottom-0 h-1.5 bg-[linear-gradient(90deg,#FFE45C,#FFD60A,#F2A100,#FFD60A,#FFE45C)]" />}
      {children}
    </ChallengeCover>
  );
}

/** Píldora "Perfil Cosecha" sobre la portada. */
export function TierPill({ tier, className = "" }: { tier: number; className?: string }) {
  const t = tierByIdx(tier), s = TIER_SKIN[t.idx];
  return (
    <span className={`inline-flex h-8 items-center gap-1.5 rounded-full pl-1.5 pr-3 text-sm font-extrabold shadow-soft ${t.idx === 1 ? "bg-white text-ink" : s.chip} ${className}`}>
      <span className="grid size-6 place-items-center rounded-full bg-white/90 text-ink"><BrandIcon name={t.icon} weight="fill" aria-hidden className="size-4" /></span>
      Perfil {t.name}
    </span>
  );
}

/** Avance al próximo nivel de perfil (o el máximo). */
export function TierProgress({ points, compact = false }: { points: number; compact?: boolean }) {
  const nx = nextTier(points);
  const pct = nx ? Math.max(4, Math.round(nx.progress * 100)) : 100;
  return (
    <div className={compact ? "" : "rounded-2xl bg-cream p-3"}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-bold text-ink">{nx ? <>Te faltan {nf(nx.left)} puntos para <span className="whitespace-nowrap">{nx.tier.name}</span></> : "Nivel de perfil máximo"}</span>
        <span className="shrink-0 tabular-nums text-muted">{nf(points)} pts</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={nx ? `Avance a ${nx.tier.name}` : "Nivel máximo"}>
        <div className="bar-fill h-full w-full origin-left rounded-full bg-[linear-gradient(90deg,#FFD60A,#F2A100)]" style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
    </div>
  );
}

/** Cifras del poder: lo que compró, terminó y ganó. */
export function PowerStats({ p }: { p: Power }) {
  const items: [string, number][] = [
    [p.stats.premiumOwned === 1 ? "Programa Premium" : "Programas Premium", p.stats.premiumOwned],
    [p.stats.certs === 1 ? "Certificado" : "Certificados", p.stats.certs],
    [p.stats.retosDone === 1 ? "Medalla" : "Medallas", p.stats.retosDone],
    ["Insignias", p.insignias.length],
  ];
  return (
    <dl className="grid grid-cols-4 gap-2">
      {items.map(([k, v]) => (
        <div key={k} className="flex flex-col-reverse rounded-2xl bg-cream px-1.5 py-2.5 text-center">
          <dt className="mt-1 text-[11px] font-semibold leading-tight text-muted">{k}</dt>
          <dd className="text-lg font-extrabold leading-none tabular-nums text-ink">{nf(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ShowcaseCard({ s, mine }: { s: ShowcaseItem; mine: boolean }) {
  const done = !!s.doneAt;
  return (
    <li className="min-w-0">
      <Link href={`/app/retos/${s.slug}`} className="card pressable block overflow-hidden hover:border-ink/20">
        <ChallengeCover c={{ cover: s.cover, icon: s.icon }} className="h-20 sm:h-24">
          <span className={`absolute right-2.5 top-2.5 inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-extrabold ${done ? "bg-ink text-banana" : "bg-white/90 text-ink"}`}>
            {done ? <><BrandIcon name="medal" weight="fill" aria-hidden className="size-3.5" />Completado</> : mine ? "En tu colección" : "En su colección"}
          </span>
        </ChallengeCover>
        <span className="block p-3">
          <span className="block text-[11px] font-bold uppercase tracking-[.1em] text-banana-ink">{s.kind === "programa" ? "Programa" : "Reto Premium"}</span>
          <span className="block font-extrabold leading-tight text-ink line-clamp-2">{s.title}</span>
          {done && (s.rewardTitle || s.badge) && <span className="mt-0.5 block truncate text-xs text-muted">{s.rewardTitle || s.badge}, {fmtDate(s.doneAt)}</span>}
        </span>
      </Link>
    </li>
  );
}

/** Vitrina: programas Premium que tiene o completó, con su portada. */
export function Showcase({ items, mine, name }: { items: ShowcaseItem[]; mine: boolean; name?: string }) {
  if (!items.length) {
    if (!mine) return null;
    return (
      <section className="card p-5" aria-labelledby="vitrina-t">
        <h2 id="vitrina-t" className="font-extrabold text-ink">Mi colección</h2>
        <p className="mt-1 text-sm text-muted">Los programas Premium que tengas aparecen aquí con su portada, y los que termines llevan su sello de completado.</p>
        <Link href="/app/retos" className="btn-banana mt-3 h-11 px-5 text-sm">Ver programas<ArrowRight weight="bold" className="size-4" /></Link>
      </section>
    );
  }
  const done = items.filter((s) => s.doneAt).length;
  return (
    <section className="space-y-3" aria-labelledby="vitrina-t">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="vitrina-t" className="text-xl font-extrabold text-ink">{mine ? "Mi colección" : `Colección de ${name ?? "este perfil"}`}</h2>
          <p className="text-sm text-muted">{nf(items.length)} {items.length === 1 ? "programa" : "programas"}{done ? `, ${nf(done)} ${done === 1 ? "completado" : "completados"}` : ""}</p>
        </div>
        {mine && <Link href="/app/retos" className="tap inline-flex h-11 shrink-0 items-center gap-1 text-sm font-bold text-banana-ink hover:text-ink">Sumar<ArrowRight weight="bold" className="size-4" /></Link>}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">{items.map((s) => <ShowcaseCard key={s.slug} s={s} mine={mine} />)}</ul>
    </section>
  );
}

const KIND_LABEL: Record<Insignia["kind"], string> = { certificado: "Certificado", medalla: "Medalla", nivel: "Nivel", racha: "Racha", verificado: "Identidad", coleccion: "Colección", logro: "Logro" };

/** Ícono de la insignia sobre su mini portada. */
export function InsigniaArt({ i, size = "md" }: { i: Pick<Insignia, "icon" | "cover" | "kind">; size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-10 rounded-xl" : "size-12 rounded-2xl";
  if (i.kind === "verificado") return <span className={`grid shrink-0 place-items-center bg-peel/10 ${box}`}><VerifiedMark className="size-7" label={false} /></span>;
  if (i.cover) return <ChallengeCover c={{ cover: i.cover, icon: i.icon }} className={`shrink-0 ${box}`} chip={false}><span className="absolute inset-0 grid place-items-center"><span className="grid size-8 place-items-center rounded-xl bg-white text-ink shadow-soft"><BrandIcon name={i.icon} aria-hidden className="size-5" /></span></span></ChallengeCover>;
  return <span className={`grid shrink-0 place-items-center ${i.kind === "racha" ? "bg-ember/15 text-ember-ink" : i.kind === "coleccion" ? "bg-ink text-banana" : "bg-banana text-ink"} ${box}`}><BrandIcon name={i.icon} aria-hidden className="size-6" /></span>;
}

/** Muro de insignias (solo lectura: el perfil de otra persona). */
export function InsigniasWall({ items, featured }: { items: Insignia[]; featured: string | null }) {
  if (!items.length) return null;
  return (
    <section className="card p-4 sm:p-5" aria-labelledby="insignias-t">
      <h2 id="insignias-t" className="font-extrabold text-ink">Insignias</h2>
      <ul className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:grid-cols-3">
        {items.map((i) => (
          <li key={i.id} className={`flex items-center gap-2.5 rounded-2xl p-2.5 ${i.id === featured ? "bg-banana-soft ring-2 ring-banana" : "bg-cream"}`}>
            <InsigniaArt i={i} size="sm" />
            <span className="min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-[.08em] text-banana-ink">{i.id === featured ? "Destacada" : KIND_LABEL[i.kind]}</span>
              <span className="block truncate text-sm font-bold leading-tight text-ink">{i.label}</span>
              {i.detail && <span className="block truncate text-[11px] leading-tight text-muted">{i.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
export { KIND_LABEL };

/** Escalera de niveles de perfil y qué suma puntos. `stats.bestStreak` null en perfiles ajenos (no se muestra). */
export function TierGuide({ p, mine }: { p: Power; mine: boolean }) {
  const cur = tierByIdx(p.tier);
  const nx = nextTier(p.points);
  return (
    <section className="card p-5" aria-labelledby="subir-t">
      <h2 id="subir-t" className="font-extrabold text-ink">{mine ? "Cómo subir tu perfil" : "Niveles de perfil"}</h2>
      <p className="mt-1 text-sm text-muted">{mine ? "Tu perfil cambia con lo que haces de verdad en Banana Burn: más programas, certificados y constancia, más se nota en la tropa." : "Cada perfil sube con programas, certificados, nivel y verificación reales."}</p>
      <ol className="mt-4 grid grid-cols-5 gap-1.5" aria-label="Niveles de perfil">
        {TIERS.map((t) => {
          const on = t.idx <= cur.idx, here = t.idx === cur.idx, s = TIER_SKIN[t.idx];
          return (
            <li key={t.idx} aria-current={here ? "step" : undefined} className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-center ${here ? "bg-banana-soft ring-2 ring-banana" : ""}`}>
              <span className={`grid size-9 place-items-center rounded-full ${on ? (t.idx === 1 ? "bg-peel/10 text-peel" : s.chip) : "bg-cream text-faint"}`}>
                {on ? <BrandIcon name={t.icon} weight="fill" aria-hidden className="size-5" /> : <Lock weight="duotone" aria-hidden className="size-4" />}
              </span>
              <span className={`text-[11px] font-bold leading-tight ${on ? "text-ink" : "text-muted"}`}>{t.name}</span>
              <span className="text-[10px] tabular-nums leading-none text-muted">{t.min} pts</span>
            </li>
          );
        })}
      </ol>
      {mine && nx && <p className="mt-3 rounded-2xl bg-cream p-3 text-sm text-body"><b className="text-ink">Al llegar a {nx.tier.name}:</b> {nx.tier.unlock}</p>}
      {mine && (
        <ul className="mt-4 divide-y divide-line">
          {howToGrow(p.stats).map((r) => (
            <li key={r.id}>
              <Link href={r.href} className="tap flex min-h-14 items-center gap-3 py-2.5 hover:bg-cream/60 -mx-2 px-2 rounded-xl">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-banana-soft text-banana-ink"><BrandIcon name={r.icon} aria-hidden className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold leading-tight text-ink">{r.title}</span>
                  <span className="block text-xs text-muted">{r.detail}. {r.have}.</span>
                </span>
                <ArrowRight weight="bold" aria-hidden className="size-4 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
