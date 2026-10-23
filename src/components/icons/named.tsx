// Íconos por nombre: para datos (recetas, retos, logros, plantillas) que guardan un string en vez de un componente.
import type { SVGProps } from "react";
import {
  Avocado, Barbell, Bed, BowlFood, BowlSteam, Bread, Carrot, ChartBar, Coffee, Cookie, Cow, Drop, Egg, Fish, Flag, Footprints, ForkKnife, Grains, Hamburger,
  HandsClapping, Leaf, Lightning, Moon, OrangeSlice, PersonSimpleRun, PersonSimpleWalk, Plant, Scales, Shield, Sneaker, Sun, SunHorizon, Target, Timer,
  TreePalm, TrendDown, Waves, ArrowsClockwise, Sparkle, Syringe, Hourglass,
} from "@phosphor-icons/react/dist/ssr";
import { BRAND_ICONS, type BrandWeight } from "./brand";
import { LEVELS } from "@/lib/gamify";
import Image from "next/image";
import { levelArt } from "@/lib/challenge-art";

const UTIL = {
  barbell: Barbell, bowl: BowlFood, soup: BowlSteam, bread: Bread, coffee: Coffee, cookie: Cookie, drop: Drop, egg: Egg, fish: Fish, meat: Cow, grains: Grains, fruit: OrangeSlice,
  avocado: Avocado, fastfood: Hamburger, steps: Footprints, walk: PersonSimpleWalk, sneaker: Sneaker, fork: ForkKnife, leaf: Leaf, plant: Plant, bolt: Lightning, run: PersonSimpleRun,
  scale: Scales, target: Target, timer: Timer, hourglass: Hourglass, trendDown: TrendDown, carrot: Carrot, moon: Moon, sun: Sun, sunrise: SunHorizon, palm: TreePalm, bed: Bed,
  clap: HandsClapping, flag: Flag, shield: Shield, waves: Waves, cycle: ArrowsClockwise, sparkle: Sparkle, syringe: Syringe, chart: ChartBar,
} as const;

export const ICON_NAMES = [...Object.keys(BRAND_ICONS), ...Object.keys(UTIL)] as (keyof typeof BRAND_ICONS | keyof typeof UTIL)[];
export type IconName = (typeof ICON_NAMES)[number];

type P = Omit<SVGProps<SVGSVGElement>, "children" | "ref"> & { name: IconName | string; size?: number | string; weight?: BrandWeight | "bold" | "regular" | "duotone" | "fill"; title?: string };

/** Ícono a partir de un nombre guardado en datos. Si el nombre no existe, cae a la banana. */
export function BrandIcon({ name, weight = "duotone", ...rest }: P) {
  if (name in BRAND_ICONS) {
    const C = BRAND_ICONS[name as keyof typeof BRAND_ICONS];
    return <C weight={weight === "bold" ? "regular" : (weight as BrandWeight)} {...rest} />;
  }
  if (name in UTIL) {
    const C = UTIL[name as keyof typeof UTIL];
    return <C weight={weight} {...(rest as object)} />;
  }
  const B = BRAND_ICONS.banana;
  return <B weight={weight === "bold" ? "regular" : (weight as BrandWeight)} {...rest} />;
}

/** Ícono del nivel: de banana verde a mono rey. Color incluido para que cada nivel se distinga. */
export function LevelIcon({ idx, className = "", title }: { idx: number; className?: string; size?: number | string; title?: string }) {
  const lv = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, idx - 1))];
  // Coach Banana en la etapa del nivel (de bebé a King Kong), recortado en círculo para que se lea en tamaños chicos.
  return <Image src={levelArt(idx)} alt={title ?? ""} aria-hidden={title ? undefined : true} title={title ?? lv.n} width={64} height={64} sizes="64px" className={`inline-block shrink-0 rounded-full object-cover ring-1 ring-ink/10 ${className}`} />;
}
