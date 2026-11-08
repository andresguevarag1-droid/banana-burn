// Portada según el anuncio (#285): si la visita trae un utm_content conocido, el hero repite el mensaje de ese anuncio.
// next.config.ts reescribe /?utm_content=<variante> a /anuncio/<variante>, una página estática (ISR) con canonical a / y
// noindex: la CDN la sirve igual que la portada, sin leer la URL en el render ni cambiar el hero en el navegador.

export type HeroVariant = { title: string; sub: string; shot: string; alt: string };

const GYM = { shot: "/landing/campana-9nov/c6-guiado-gym.png", alt: "Pantalla de entreno de Banana Burn: Sentadilla goblet, ejercicio 1 de 3, con 6 kg sugeridos" };
const CASA = { shot: "/landing/campana-9nov/c2-guiado-casa.png", alt: "Pantalla de entreno en casa de Banana Burn: Sentadilla con peso corporal, serie 1 de 2, 8 repeticiones" };

/** Variantes del hero por anuncio de Meta (utm_content). Solo capturas reales de public/landing/campana-9nov. */
export const HERO_VARIANTS = {
  reel_cuanto_peso: { title: "¿No sabes cuánto peso usar?", sub: "Banana Burn te dice el peso, las series y las repeticiones de cada ejercicio, y cuándo subir.", ...GYM },
  reel_condominio: { title: "Tu gym del condominio, con entrenador", sub: "Coach Banana te dice qué hacer con las máquinas que tienes.", ...GYM },
  reel_casa_gym_parque: { title: "Entrena donde estés", sub: "En casa, en el gym o en el parque: 12 minutos para empezar.", ...CASA },
  reel_nadie_te_mira: { title: "Nadie te mira, nadie te juzga", sub: "Tu primer entreno es corto y Coach Banana te dice cada paso.", ...CASA },
} as const satisfies Record<string, HeroVariant>;

export type HeroVariantKey = keyof typeof HERO_VARIANTS;
export const HERO_VARIANT_KEYS = Object.keys(HERO_VARIANTS) as HeroVariantKey[];
/** Valor de `variant` en landing_variant_view para la portada de siempre. */
export const GENERAL_VARIANT = "general";
export const LANDING_VARIANTS = [GENERAL_VARIANT, ...HERO_VARIANT_KEYS] as const;

/** Variante para un utm_content. Desconocido o vacío: null (la portada de siempre). */
export function heroVariantFor(utm: string | string[] | null | undefined): HeroVariantKey | null {
  const v = Array.isArray(utm) ? utm[0] : utm;
  return v && Object.hasOwn(HERO_VARIANTS, v) ? (v as HeroVariantKey) : null;
}

/** Ruta interna de cada variante (también la regenera el cron el día del cambio de la tarjeta). */
export const variantPath = (v: HeroVariantKey) => `/anuncio/${v}`;

/** Reescritura de next.config.ts: solo los utm_content conocidos; Next compara `value` como ^…$. */
export const variantRewrite = () => ({
  source: "/",
  has: [{ type: "query" as const, key: "utm_content", value: `(?<variante>${HERO_VARIANT_KEYS.join("|")})` }],
  destination: "/anuncio/:variante",
});
