// Portada de un reto: composición CSS (degradado, trama de puntos y el ícono de marca en grande). Sin imágenes externas.
import type { ReactNode } from "react";
import { BrandIcon } from "@/components/icons";
import type { Challenge, CoverStyle } from "@/lib/challenges";

const STYLE: Record<CoverStyle, { bg: string; ink: string; dots: string; chip: string }> = {
  banana: { bg: "bg-[linear-gradient(135deg,#FFE45C_0%,#FFD60A_55%,#F5B800_100%)]", ink: "text-ink", dots: "rgb(27 21 5 / .10)", chip: "bg-ink text-banana" },
  ember: { bg: "bg-[linear-gradient(135deg,#FF8A4C_0%,#FF5A1F_60%,#D9430E_100%)]", ink: "text-white", dots: "rgb(255 255 255 / .16)", chip: "bg-white text-ember-ink" },
  sky: { bg: "bg-[linear-gradient(135deg,#5B8DEF_0%,#2258C4_65%,#173F95_100%)]", ink: "text-white", dots: "rgb(255 255 255 / .14)", chip: "bg-white text-sky" },
  peel: { bg: "bg-[linear-gradient(135deg,#3FA86A_0%,#15703A_70%,#0E5229_100%)]", ink: "text-white", dots: "rgb(255 255 255 / .14)", chip: "bg-banana text-ink" },
  noche: { bg: "bg-[linear-gradient(135deg,#3A3120_0%,#1B1505_70%,#0D0A02_100%)]", ink: "text-banana", dots: "rgb(255 214 10 / .12)", chip: "bg-banana text-ink" },
  selva: { bg: "bg-[linear-gradient(135deg,#FFD60A_0%,#8BC34A_45%,#15703A_100%)]", ink: "text-ink", dots: "rgb(27 21 5 / .10)", chip: "bg-ink text-banana" },
};

export const coverInk = (s: CoverStyle) => STYLE[s].ink;

export function ChallengeCover({ c, className = "h-28", children, chip = true }: { c: Pick<Challenge, "cover" | "icon">; className?: string; children?: ReactNode; chip?: boolean }) {
  const st = STYLE[c.cover] ?? STYLE.banana;
  return (
    <div className={`relative isolate overflow-hidden ${st.bg} ${st.ink} ${className}`}>
      <div aria-hidden className="absolute inset-0 -z-10" style={{ backgroundImage: `radial-gradient(${st.dots} 1.5px, transparent 1.6px)`, backgroundSize: "14px 14px" }} />
      <BrandIcon name={c.icon} aria-hidden weight="fill" className="pointer-events-none absolute -right-5 -bottom-7 size-32 rotate-[-14deg] opacity-25 select-none" />
      {chip && <span aria-hidden className={`absolute left-4 top-4 grid place-items-center size-11 rounded-2xl shadow-soft ${st.chip}`}><BrandIcon name={c.icon} className="size-6" /></span>}
      {children}
    </div>
  );
}
