// Avatar e insignia de nivel de la comunidad. Sin hooks: sirven en componentes de servidor y de cliente.
// Puntos de extensión para títulos y marcos de nivel (los conecta el sistema de niveles):
//   - `levelName`: reemplaza el nombre del nivel calculado desde el XP.
//   - `frame`: clase(s) CSS del marco del avatar (p. ej. un anillo especial por nivel).
import { LevelIcon } from "@/components/icons";
import { initials, levelFor } from "@/lib/community-view";

const SIZES = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-lg", xl: "size-24 text-3xl" } as const;
export type AvatarSize = keyof typeof SIZES;

/** Anillo por nivel: verde al empezar, banana en los medios, tinta y brasa en los altos. */
function ringFor(idx: number | null) {
  if (!idx) return "ring-line";
  if (idx <= 1) return "ring-peel/50";
  if (idx <= 4) return "ring-banana";
  if (idx <= 6) return "ring-ink";
  return "ring-ember";
}

export function Avatar({ name, size = "md", xp, levelName, frame, className = "" }: { name: string; size?: AvatarSize; xp?: number | null; levelName?: string; frame?: string; className?: string }) {
  const lv = levelFor(xp);
  const ring = frame ?? `ring-2 ring-offset-2 ring-offset-white ${ringFor(lv?.idx ?? null)}`;
  return (
    <span aria-hidden title={levelName ?? lv?.name} className={`grid place-items-center shrink-0 rounded-full bg-banana font-extrabold text-ink ${SIZES[size]} ${ring} ${className}`}>
      {initials(name)}
    </span>
  );
}

/** Insignia de nivel junto al nombre. Sin XP visible (no comparte entrenos), no se muestra. */
export function LevelBadge({ xp, levelName, compact = false, tone = "light", className = "" }: { xp?: number | null; levelName?: string; compact?: boolean; tone?: "light" | "dark"; className?: string }) {
  const lv = levelFor(xp);
  if (!lv) return null;
  const name = levelName ?? lv.name;
  const skin = tone === "dark" ? "bg-white/10 text-white" : "bg-banana-soft text-ink";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full ${skin} ${compact ? "h-5 px-1.5 text-[11px]" : "h-6 px-2 text-xs"} font-bold whitespace-nowrap align-middle ${className}`} title={`Nivel ${lv.idx}: ${name}`}>
      <LevelIcon idx={lv.idx} className={`${compact ? "size-3.5" : "size-4"} ${tone === "dark" ? "!text-banana" : ""}`} />
      <span className="sr-only">Nivel {lv.idx}: {name}</span>
      <span aria-hidden>{compact ? `Nv. ${lv.idx}` : name}</span>
    </span>
  );
}
