// Íconos de marca Banana Burn: bananas y monos dibujados en la misma retícula que Phosphor
// (256×256, trazo 16, puntas redondeadas) para que convivan sin notarse la diferencia.
// "duotone" agrega un relleno suave del color actual; "fill" lo rellena entero.
import type { SVGProps } from "react";

export type BrandWeight = "regular" | "duotone" | "fill";
type P = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number | string; weight?: BrandWeight; title?: string };

function Svg({ size = "1em", weight = "duotone", title, children, ...rest }: P & { children: (w: BrandWeight) => React.ReactNode }) {
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round"
      role={title ? "img" : undefined} aria-hidden={title ? undefined : true} focusable="false" {...rest}>
      {title && <title>{title}</title>}
      {children(weight)}
    </svg>
  );
}
/** Relleno de fondo según el peso. */
const tone = (w: BrandWeight) => (w === "fill" ? { fill: "currentColor", opacity: 1 } : w === "duotone" ? { fill: "currentColor", opacity: 0.2 } : { fill: "none" });

/* Formas reutilizables */
const BANANA = "M196 64c24 62 6 128-48 156-34 18-78 18-112 0 40-4 78-20 102-50 24-30 32-68 26-104z";
const BANANA_STEM = "M166 66l10-30h18l2 28";
const MONKEY_HEAD = "M128 46c-46 0-80 34-80 80 0 48 36 84 80 84s80-36 80-84c0-46-34-80-80-80z";
const MONKEY_FACE = "M128 98c-10-14-48-14-48 18 0 12 6 20 10 26-6 30 16 50 38 50s44-20 38-50c4-6 10-14 10-26 0-32-38-32-48-18z";
const EAR_L = "M50 104a26 26 0 1 0 2 52";
const EAR_R = "M206 104a26 26 0 1 1-2 52";

function MonkeyFace({ w }: { w: BrandWeight }) {
  return (
    <>
      <path d={MONKEY_HEAD} {...tone(w)} stroke="none" />
      <path d={MONKEY_HEAD} />
      <path d={EAR_L} /><path d={EAR_R} />
      <path d="M112 48c4-14 20-20 30-10" />
      <path d={MONKEY_FACE} fill={w === "fill" ? "var(--bb-icon-bg, #fff)" : "none"} />
      <circle cx="108" cy="122" r="9" fill="currentColor" stroke="none" />
      <circle cx="148" cy="122" r="9" fill="currentColor" stroke="none" />
      <circle cx="120" cy="150" r="5" fill="currentColor" stroke="none" /><circle cx="136" cy="150" r="5" fill="currentColor" stroke="none" />
      <path d="M112 172c10 8 22 8 32 0" />
    </>
  );
}

export const Banana = (p: P) => <Svg {...p}>{(w) => <><path d={BANANA} {...tone(w)} stroke="none" /><path d={BANANA} /><path d={BANANA_STEM} /></>}</Svg>;

/** Banana pelada: logro / meta cumplida. */
export const BananaPeeled = (p: P) => (
  <Svg {...p}>{(w) => <>
    <path d="M128 40c-20 0-30 30-30 70s10 66 30 66 30-26 30-66-10-70-30-70z" {...tone(w)} stroke="none" />
    <path d="M128 40c-20 0-30 30-30 70s10 66 30 66 30-26 30-66-10-70-30-70z" />
    <path d="M100 146c-26 4-44 22-50 46 26-2 44-12 56-28" /><path d="M156 146c26 4 44 22 50 46-26-2-44-12-56-28" />
    <path d="M110 170l-6 50h48l-6-50" />
  </>}</Svg>
);

/** Racimo: comidas / nutrición / plan completo. Tres bananas en abanico desde un mismo tallo. */
const MINI = "M150 52c18 50 6 102-36 126-26 14-58 14-84 0 30-4 58-16 76-40 18-24 24-54 20-86z";
export const BananaBunch = (p: P) => (
  <Svg {...p}>{(w) => <>
    <g transform="translate(14 20) scale(.88)">
    {[-30, 0, 30].map((r) => (
      <g key={r} transform={`rotate(${r} 150 46)`}><path d={MINI} {...tone(w)} stroke="none" /><path d={MINI} /></g>
    ))}
    <path d="M138 50l8-26h16l2 26" />
    </g>
  </>}</Svg>
);

/** Racha: llama con una banana adentro. */
export const BananaFlame = (p: P) => (
  <Svg {...p}>{(w) => <>
    <path d="M128 232c-48 0-80-32-80-76 0-56 56-80 56-136 32 18 64 54 64 92 10-8 18-22 20-36 18 20 20 44 20 80 0 44-32 76-80 76z" {...tone(w)} stroke="none" />
    <path d="M128 232c-48 0-80-32-80-76 0-56 56-80 56-136 32 18 64 54 64 92 10-8 18-22 20-36 18 20 20 44 20 80 0 44-32 76-80 76z" />
    <path d="M156 132c10 34-4 62-40 72 10 8 30 8 42 0 18-14 22-44-2-72z" fill="currentColor" stroke="none" />
  </>}</Svg>
);

/** Moneda banana: XP. */
export const BananaCoin = (p: P) => (
  <Svg {...p}>{(w) => <>
    <circle cx="128" cy="128" r="96" {...tone(w)} stroke="none" /><circle cx="128" cy="128" r="96" />
    <path d="M166 82c14 38 2 76-30 92-20 10-44 10-64 0 24-4 46-12 60-30s18-38 16-62z" fill={w === "fill" ? "var(--bb-icon-bg, #fff)" : "currentColor"} stroke="none" />
  </>}</Svg>
);

/** Medalla con banana: logros. */
export const BananaMedal = (p: P) => (
  <Svg {...p}>{(w) => <>
    <path d="M84 24h88l-28 64h-32z" {...tone(w)} />
    <circle cx="128" cy="156" r="76" {...tone(w)} stroke="none" /><circle cx="128" cy="156" r="76" />
    <path d="M160 116c12 32 2 64-26 78-16 8-36 8-52 0 20-4 38-10 50-26s16-32 14-52z" fill={w === "fill" ? "var(--bb-icon-bg, #fff)" : "currentColor"} stroke="none" />
  </>}</Svg>
);

/** Trofeo con banana: récord personal. */
export const BananaTrophy = (p: P) => (
  <Svg {...p}>{(w) => <>
    <path d="M64 40h128v56c0 36-28 68-64 68s-64-32-64-68z" {...tone(w)} stroke="none" />
    <path d="M64 40h128v56c0 36-28 68-64 68s-64-32-64-68z" />
    <path d="M64 64H32v16c0 22 16 40 36 42M192 64h32v16c0 22-16 40-36 42" />
    <path d="M128 164v36M88 216h80" />
    <path d="M150 66c6 22-2 42-22 52-10 4-22 4-32 0 14-4 24-10 32-20 8-10 10-20 8-32z" fill="currentColor" stroke="none" />
  </>}</Svg>
);

/** Mono: coach / mascota. */
export const Monkey = (p: P) => <Svg {...p}>{(w) => <MonkeyFace w={w} />}</Svg>;

/** Mono con corona: niveles altos. */
export const MonkeyCrown = (p: P) => (
  <Svg {...p}>{(w) => <>
    <g transform="translate(0 18) scale(1 .92)"><MonkeyFace w={w} /></g>
    <path d="M84 52l14-36 30 24 30-24 14 36z" fill="currentColor" strokeWidth={10} />
  </>}</Svg>
);

/** Gorila: cabeza en domo, ceja marcada y hocico ancho. */
const GORILLA = "M128 40c-46 0-72 34-72 84 0 54 30 92 72 92s72-38 72-92c0-50-26-84-72-84z";
export const Gorilla = (p: P) => (
  <Svg {...p}>{(w) => <>
    <path d={GORILLA} {...tone(w)} stroke="none" /><path d={GORILLA} />
    <path d="M78 116c24-22 76-22 100 0" strokeWidth={22} />
    <circle cx="106" cy="134" r="8" fill="currentColor" stroke="none" /><circle cx="150" cy="134" r="8" fill="currentColor" stroke="none" />
    <ellipse cx="128" cy="178" rx="40" ry="26" fill={w === "fill" ? "var(--bb-icon-bg, #fff)" : "none"} />
    <path d="M114 170h4M138 170h4" strokeWidth={12} />
    <path d="M112 190c10 6 22 6 32 0" />
  </>}</Svg>
);

/** Monito sosteniendo una banana: estados vacíos y bienvenida. */
export const MonkeyBanana = (p: P) => (
  <Svg {...p}>{(w) => <>
    <g transform="translate(-8 28) scale(.8)"><MonkeyFace w={w} /></g>
    <path d="M222 96c14 36 4 74-26 92-10 6-22 8-34 6 22-12 40-32 48-56 4-14 6-28 4-42z" fill="currentColor" stroke="none" />
    <path d="M214 96l4-20" />
  </>}</Svg>
);

export const BRAND_ICONS = { banana: Banana, peeled: BananaPeeled, bunch: BananaBunch, streak: BananaFlame, xp: BananaCoin, medal: BananaMedal, trophy: BananaTrophy, monkey: Monkey, monkeyCrown: MonkeyCrown, gorilla: Gorilla, monkeyBanana: MonkeyBanana } as const;
export type BrandIconName = keyof typeof BRAND_ICONS;
