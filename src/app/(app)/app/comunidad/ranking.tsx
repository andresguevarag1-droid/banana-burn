import Link from "next/link";
import { ArrowRight, BananaCoin, BananaMedal, BananaTrophy, Globe, Users } from "@/components/icons";
import { MapPin } from "@/components/community/icons";
import { Avatar, LevelBadge } from "@/components/community/avatar";
import { NameFlair } from "@/components/community/flair";
import { fmtNum, plural, podiumOrder, splitBoard, type BoardRow } from "@/lib/community-view";
import { BOARD_SCOPES, type BoardScope } from "@/lib/community";

const SCOPE_ICON = { siguiendo: Users, pais: MapPin, global: Globe } as const;
const SCOPE_TEXT: Record<BoardScope, string> = {
  siguiendo: "Tú y las personas que sigues.",
  pais: "Personas de tu país con perfil público.",
  global: "Toda la tropa con perfil público.",
};
const href = (r: BoardRow) => (r.username && !r.me ? `/app/comunidad/u/${r.username}` : null);

function Name({ r, className = "" }: { r: BoardRow; className?: string }) {
  const h = href(r);
  return <span className={`font-bold text-ink truncate ${className}`}>{h ? <Link href={h} className="hover:underline">{r.name}</Link> : r.name}{r.me && <span className="font-semibold text-muted"> (tú)</span>}</span>;
}

const MEDAL = ["bg-banana text-ink", "bg-[#E9E4D6] text-ink", "bg-[#F2D9A0] text-ink"];
const STEP = ["h-28 sm:h-32", "h-20 sm:h-24", "h-16 sm:h-20"];

/** Podio 2-1-3 con escalones; el primero, más alto y en banana. */
function Podium({ rows }: { rows: BoardRow[] }) {
  return (
    <ol className="grid grid-cols-3 items-end gap-2 px-3 pt-4 sm:px-6" aria-label="Podio">
      {podiumOrder(rows).map((r, i) => {
        if (!r) return <li key={`v${i}`} aria-hidden="true" />;
        const place = r.pos;
        const idx = Math.min(2, Math.max(0, place - 1));
        return (
          <li key={r.userId} className={`flex min-w-0 flex-col items-center text-center`}>
            <div className="relative">
              <Avatar name={r.name} xp={r.totalXp} size={place === 1 ? "lg" : "md"} />
              <span className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 grid place-items-center size-6 rounded-full text-[11px] font-extrabold ring-2 ring-white shadow-soft ${MEDAL[idx]}`}><span className="sr-only">Lugar </span>{place}</span>
            </div>
            <Name r={r} className="mt-3.5 block max-w-full text-sm" />
            <NameFlair flair={r.flair} size="sm" className="mt-0.5" />
            <span className="text-xs font-extrabold tabular-nums text-ink">{fmtNum(r.xp)} XP</span>
            <div className={`mt-2 w-full rounded-t-2xl ${STEP[idx]} ${place === 1 ? "bg-gradient-to-b from-banana to-banana/60" : "bg-cream border border-b-0 border-line"} grid place-items-start justify-center pt-2`}>
              {place === 1 ? <BananaTrophy className="size-7 text-ink" /> : <BananaMedal weight="duotone" className="size-6 text-banana-ink" />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Row({ r }: { r: BoardRow }) {
  return (
    <li className={`flex items-center gap-3 px-4 py-3 border-t border-line ${r.me ? "bg-banana-soft/60" : ""}`}>
      <span className="w-7 shrink-0 text-center text-sm font-extrabold text-muted tabular-nums">{r.pos}</span>
      <Avatar name={r.name} xp={r.totalXp} size="sm" />
      <span className="flex-1 min-w-0 flex items-center gap-1.5"><Name r={r} /><NameFlair flair={r.flair} size="sm" className="shrink-0" /><span className="hidden sm:inline-flex shrink-0"><LevelBadge xp={r.totalXp} compact /></span></span>
      <span className="hidden sm:inline text-sm text-muted tabular-nums">{plural(r.workouts, "entreno", "entrenos")}</span>
      <span className="shrink-0 text-right font-extrabold text-ink tabular-nums">{fmtNum(r.xp)} XP</span>
    </li>
  );
}

export function Ranking({ rows, scope, country }: { rows: BoardRow[]; scope: BoardScope; country: string | null }) {
  const b = splitBoard(rows);
  return (
    <section className="space-y-4" aria-labelledby="ranking-t">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ranking-t" className="flex items-center gap-2 text-xl font-extrabold text-ink"><BananaTrophy className="size-6 text-banana-ink" />Ranking de la semana</h2>
        <nav aria-label="Alcance del ranking" className="flex rounded-full bg-white border border-line p-1">
          {BOARD_SCOPES.map(([k, l]) => {
            const Icon = SCOPE_ICON[k];
            const on = k === scope;
            return (
              <Link key={k} href={`/app/comunidad?vista=ranking&alcance=${k}`} aria-current={on ? "page" : undefined} scroll={false}
                className={`tap pressable flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] font-bold whitespace-nowrap ${on ? "bg-ink text-white" : "text-muted hover:bg-cream hover:text-ink"}`}>
                <Icon weight={on ? "fill" : "duotone"} className="size-4" />{l}
              </Link>
            );
          })}
        </nav>
      </div>
      <p className="-mt-2 text-sm text-muted">{SCOPE_TEXT[scope]}{scope === "pais" && country ? ` (${country})` : ""} XP ganado desde el lunes.</p>

      {!b.honest ? (
        <div className="card p-6 text-center">
          <span className="mx-auto grid place-items-center size-16 rounded-3xl bg-banana-soft text-banana-ink" aria-hidden><BananaCoin className="size-9" /></span>
          <p className="mt-3 text-lg font-extrabold text-ink">{b.active === 0 ? "Nadie suma XP todavía esta semana" : "Todavía no hay con quién competir"}</p>
          <p className="mt-1 text-muted text-pretty">
            {scope === "siguiendo" ? "El ranking compara tu semana con la de las personas que sigues." : scope === "pais" && !country ? "Elige tu país en tu perfil para ver este ranking." : "Cuando más personas entrenen esta semana, aparecen aquí."}
            {b.me && b.me.xp > 0 ? ` Llevas ${fmtNum(b.me.xp)} XP.` : ""}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/app/entrenar" className="btn-banana h-11 px-5 text-sm">Entrenar ahora<ArrowRight weight="bold" className="size-4" /></Link>
            {scope === "siguiendo" && <Link href="/app/comunidad?vista=descubrir" className="btn-ghost h-11 px-5 text-sm">Descubrir personas</Link>}
            {scope !== "global" && <Link href="/app/comunidad?vista=ranking&alcance=global" className="btn-ghost h-11 px-5 text-sm">Ver global</Link>}
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <Podium rows={b.podium} />
          {b.rest.length > 0 && <ol aria-label="Resto del ranking" className="border-t border-line">{b.rest.map((r) => <Row key={r.userId} r={r} />)}</ol>}
        </div>
      )}

      {b.me && (
        <div className="sticky bottom-24 lg:bottom-4 z-10">
          <div className="flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-lift" role="status" aria-label="Tu posición">
            <span className="grid place-items-center min-w-10 h-10 px-2 rounded-xl bg-banana text-ink font-extrabold tabular-nums">{b.me.xp > 0 ? `#${b.me.pos}` : <BananaCoin className="size-5" />}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-white/60">Tu posición</span>
              <span className="block font-bold truncate">{b.me.xp > 0 ? `${fmtNum(b.me.xp)} XP y ${plural(b.me.workouts, "entreno", "entrenos")}` : "Entrena hoy para entrar al ranking"}</span>
            </span>
            {b.me.xp > 0 && b.podium[0] && !b.podium[0].me && <span className="hidden sm:block text-xs text-white/60 text-right">A {fmtNum(Math.max(0, b.podium[0].xp - b.me.xp))} XP del primer lugar</span>}
          </div>
        </div>
      )}
    </section>
  );
}
