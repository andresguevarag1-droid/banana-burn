// Arte de cada nivel: Coach Banana en una etapa de su vida (de bebé a King Kong) con el anillo del escalón. Sin emojis.
// Bloqueado: la misma ilustración en gris, como adelanto de lo que viene.
import { SafeImage } from "@/components/safe-image";
import { levelArt } from "@/lib/challenge-art";
import { levelAt } from "@/lib/gamify";

/** Fondo, anillo y color del ícono por nivel (1-based): de banana verde a King Kong. */
export const TIER = [
  { bg: "bg-[linear-gradient(140deg,#D8F0C8,#9ED98A)]", ring: "ring-peel/40", ink: "text-peel" },
  { bg: "bg-[linear-gradient(140deg,#E9F5A0,#C9E26A)]", ring: "ring-[#9DB83A]/50", ink: "text-[#4E6A10]" },
  { bg: "bg-[linear-gradient(140deg,#FFF1A8,#FFD60A)]", ring: "ring-banana/70", ink: "text-banana-ink" },
  { bg: "bg-[linear-gradient(140deg,#FFD978,#F5A300)]", ring: "ring-[#D98A00]/60", ink: "text-[#6B4300]" },
  { bg: "bg-[linear-gradient(140deg,#FFE58A,#F2A100)]", ring: "ring-ember/50", ink: "text-ember-ink" },
  { bg: "bg-[linear-gradient(140deg,#4A4232,#1B1505)]", ring: "ring-ink/40", ink: "text-banana" },
  { bg: "bg-[linear-gradient(140deg,#2A2210,#1B1505)]", ring: "ring-banana", ink: "text-banana" },
  { bg: "bg-[linear-gradient(140deg,#F2A100,#FFD60A)]", ring: "ring-ember", ink: "text-ink" },
] as const;

export const tierOf = (idx: number) => TIER[Math.max(0, Math.min(TIER.length - 1, idx - 1))];

export function LevelBadge({ idx, size = "md", locked = false, className = "", sex = null }: { idx: number; size?: "sm" | "md" | "lg" | "xl"; locked?: boolean; className?: string; sex?: string | null }) {
  const lv = levelAt(idx, sex);
  const t = tierOf(idx);
  const box = { sm: "size-9 rounded-xl", md: "size-12 rounded-2xl", lg: "size-16 rounded-[1.25rem]", xl: "size-24 rounded-[1.75rem]" }[size];
  const px = { sm: 72, md: 96, lg: 128, xl: 192 }[size];
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden ring-2 ${box} ${locked ? "bg-cream ring-line" : `${t.bg} ${t.ring}`} ${className}`}>
      <SafeImage src={levelArt(idx)} alt={locked ? `${lv.n} (bloqueado)` : lv.n} width={px} height={px} sizes={`${px}px`} className={`size-full object-cover ${locked ? "opacity-45 grayscale" : ""}`} />
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
