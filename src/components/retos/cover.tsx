// Portada de un reto: ilustración de Coach Banana cuando el reto la tiene (challenge-art.ts) o la composición CSS
// (degradado, trama de puntos y el ícono de marca en grande). Sobre la ilustración, un velo del color del reto desde la
// izquierda mantiene legible el texto encima.
import type { ReactNode } from "react";
import Image from "next/image";
import { artFor } from "@/lib/challenge-art";
import { BrandIcon } from "@/components/icons";
import type { Challenge, CoverStyle } from "@/lib/challenges";

const STYLE: Record<CoverStyle, { bg: string; ink: string; dots: string; chip: string; scrim: string }> = {
  banana: { bg: "bg-[linear-gradient(135deg,#FFE45C_0%,#FFD60A_55%,#F5B800_100%)]", ink: "text-ink", dots: "rgb(27 21 5 / .10)", chip: "bg-ink text-banana", scrim: "#FFE45C" },
  ember: { bg: "bg-[linear-gradient(135deg,#FFE066_0%,#F2A100_60%,#C98200_100%)]", ink: "text-ink", dots: "rgb(27 21 5 / .10)", chip: "bg-ink text-banana", scrim: "#FFD24D" },
  sky: { bg: "bg-[linear-gradient(135deg,#B88A1E_0%,#7A5A00_65%,#4A3600_100%)]", ink: "text-white", dots: "rgb(255 255 255 / .14)", chip: "bg-white text-sky", scrim: "#4A3600" },
  peel: { bg: "bg-[linear-gradient(135deg,#7FA83A_0%,#3F6B0E_70%,#2C4D09_100%)]", ink: "text-white", dots: "rgb(255 255 255 / .14)", chip: "bg-banana text-ink", scrim: "#2C4D09" },
  noche: { bg: "bg-[linear-gradient(135deg,#3A3120_0%,#1B1505_70%,#0D0A02_100%)]", ink: "text-banana", dots: "rgb(255 214 10 / .12)", chip: "bg-banana text-ink", scrim: "#0D0A02" },
  selva: { bg: "bg-[linear-gradient(135deg,#FFD60A_0%,#B8C93A_45%,#3F6B0E_100%)]", ink: "text-ink", dots: "rgb(27 21 5 / .10)", chip: "bg-ink text-banana", scrim: "#FFD60A" },
  // Banana Girl: fresa con banana. Texto ink (contraste 11:1 sobre el rosa más oscuro).
  fresa: { bg: "bg-[linear-gradient(135deg,#FFE45C_0%,#FFC2D1_45%,#FF9DB5_100%)]", ink: "text-ink", dots: "rgb(27 21 5 / .09)", chip: "bg-ink text-[#FFC2D1]", scrim: "#FFE45C" },
};

export const coverInk = (s: CoverStyle) => STYLE[s].ink;
/** Color de acento de cada portada: con un programa activo tiñe la franja superior de la app, la cinta y las barras de sus hábitos. */
export const COVER_ACCENT: Record<CoverStyle, string> = { banana: "#FFD60A", ember: "#F2A100", sky: "#B88A1E", peel: "#5C8A1E", noche: "#FFD60A", selva: "#9BBF2E", fresa: "#FF8FAB" };

/** `art={false}` fuerza la composición CSS (cintas y miniaturas). `sizes`: ancho que ocupa la portada, para la imagen. */
export function ChallengeCover({ c, className = "h-28", children, chip = true, art = true, sizes = "(min-width: 768px) 480px, 100vw" }: { c: Pick<Challenge, "cover" | "icon"> & { id?: string }; className?: string; children?: ReactNode; chip?: boolean; art?: boolean; sizes?: string }) {
  const st = STYLE[c.cover] ?? STYLE.banana;
  const src = art ? artFor(c.id) : null;
  return (
    <div className={`relative isolate overflow-hidden ${st.bg} ${st.ink} ${className}`}>
      {src ? (
        <>
          <Image src={src} alt="" aria-hidden fill sizes={sizes} className="-z-20 object-cover object-right select-none" />
          <div aria-hidden className="absolute inset-0 -z-10" style={{ backgroundImage: `linear-gradient(90deg, ${st.scrim}f2 0%, ${st.scrim}cc 38%, ${st.scrim}00 72%)` }} />
        </>
      ) : (
        <>
          <div aria-hidden className="absolute inset-0 -z-10" style={{ backgroundImage: `radial-gradient(${st.dots} 1.5px, transparent 1.6px)`, backgroundSize: "14px 14px" }} />
          <BrandIcon name={c.icon} aria-hidden weight="fill" className="pointer-events-none absolute -right-5 -bottom-7 size-32 rotate-[-14deg] opacity-25 select-none" />
        </>
      )}
      {chip && <span aria-hidden className={`absolute left-4 top-4 grid place-items-center size-11 rounded-2xl shadow-soft ${st.chip}`}><BrandIcon name={c.icon} className="size-6" /></span>}
      {children}
    </div>
  );
}
