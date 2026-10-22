// Íconos por nombre: para datos (recetas, retos, logros, plantillas) que guardan un string en vez de un componente.
import type { SVGProps } from "react";
import {
  Barbell, BowlFood, Coffee, Cookie, Drop, Egg, Fish, Footprints, ForkKnife, Leaf, Lightning, PersonSimpleRun, Scales, Target, Timer, TrendDown, Carrot, Moon, Sun,
} from "@phosphor-icons/react/dist/ssr";
import { BRAND_ICONS, type BrandWeight } from "./brand";
import { LEVELS } from "@/lib/gamify";

const UTIL = { barbell: Barbell, bowl: BowlFood, coffee: Coffee, cookie: Cookie, drop: Drop, egg: Egg, fish: Fish, steps: Footprints, fork: ForkKnife, leaf: Leaf, bolt: Lightning, run: PersonSimpleRun, scale: Scales, target: Target, timer: Timer, trendDown: TrendDown, carrot: Carrot, moon: Moon, sun: Sun } as const;

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
export function LevelIcon({ idx, className = "", ...rest }: { idx: number; className?: string; size?: number | string; title?: string }) {
  const lv = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, idx - 1))];
  const color = idx <= 1 ? "text-peel" : idx <= 4 ? "text-banana-ink" : idx <= 6 ? "text-ink" : "text-ember-ink";
  return <BrandIcon name={lv.icon} className={`${color} ${className}`} {...rest} />;
}
