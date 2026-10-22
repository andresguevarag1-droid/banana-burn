// Arte de cada nivel: el ícono de marca sobre un fondo propio del escalón. Sin emojis.
import { BrandIcon } from "@/components/icons";
import { LEVELS } from "@/lib/gamify";

/** Fondo, anillo y color del ícono por nivel (1-based): de banana verde a King Kong. */
export const TIER = [
  { bg: "bg-[linear-gradient(140deg,#D8F0C8,#9ED98A)]", ring: "ring-peel/40", ink: "text-peel" },
  { bg: "bg-[linear-gradient(140deg,#E9F5A0,#C9E26A)]", ring: "ring-[#9DB83A]/50", ink: "text-[#4E6A10]" },
  { bg: "bg-[linear-gradient(140deg,#FFF1A8,#FFD60A)]", ring: "ring-banana/70", ink: "text-banana-ink" },
  { bg: "bg-[linear-gradient(140deg,#FFD978,#F5A300)]", ring: "ring-[#D98A00]/60", ink: "text-[#6B4300]" },
  { bg: "bg-[linear-gradient(140deg,#FFC2A3,#FF7A45)]", ring: "ring-ember/50", ink: "text-ember-ink" },
  { bg: "bg-[linear-gradient(140deg,#4A4232,#1B1505)]", ring: "ring-ink/40", ink: "text-banana" },
  { bg: "bg-[linear-gradient(140deg,#2A2210,#1B1505)]", ring: "ring-banana", ink: "text-banana" },
  { bg: "bg-[linear-gradient(140deg,#FF5A1F,#FFD60A)]", ring: "ring-ember", ink: "text-ink" },
] as const;

export const tierOf = (idx: number) => TIER[Math.max(0, Math.min(TIER.length - 1, idx - 1))];

export function LevelBadge({ idx, size = "md", locked = false, className = "" }: { idx: number; size?: "sm" | "md" | "lg" | "xl"; locked?: boolean; className?: string }) {
  const lv = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, idx - 1))];
  const t = tierOf(idx);
  const box = { sm: "size-9 rounded-xl", md: "size-12 rounded-2xl", lg: "size-16 rounded-[1.25rem]", xl: "size-24 rounded-[1.75rem]" }[size];
  const ic = { sm: "size-5", md: "size-7", lg: "size-9", xl: "size-14" }[size];
  return (
    <span className={`relative grid shrink-0 place-items-center ring-2 ${box} ${locked ? "bg-cream ring-line text-faint" : `${t.bg} ${t.ring} ${t.ink}`} ${className}`}>
      <BrandIcon name={lv.icon} weight={locked ? "regular" : "duotone"} className={ic} />
    </span>
  );
}

/** Anillo de perfil según el marco desbloqueado (Pintona, dorado, corona, King Kong). */
export const FRAME_RING: Record<string, string> = {
  pintona: "ring-4 ring-[#C9E26A]",
  dorado: "ring-4 ring-[#F5A300]",
  corona: "ring-4 ring-banana outline-2 outline-offset-2 outline-ink",
  kong: "ring-4 ring-ember outline-2 outline-offset-2 outline-banana",
};
