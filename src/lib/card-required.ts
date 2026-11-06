// Tarjeta obligatoria en el registro (#269, decisión del dueño del 6 nov 2026). Desde CARD_REQUIRED_FROM, la medianoche del
// 1 de enero de 2027 en Costa Rica, cada cuenta nueva deja su tarjeta para empezar: 7 días gratis con todo incluido y el día 8
// se cobra el plan elegido, con el primer mes al 50 %. Los condominios también la piden (el cobro llega al fin de su mes gratis).
// Las cuentas creadas antes conservan sus reglas: beta, prueba sin tarjeta y condominios ya vinculados.
//   - cardRequiredFor(createdAt): reglas de una cuenta (acceso, bienvenida, condominios). La base repite la regla en
//     public._trial_live() (0067).
//   - cardRequiredNow(now): textos de las pantallas públicas. Nunca guardes estos textos en constantes de módulo: se calculan
//     en cada render, y las páginas públicas se regeneran cada hora (revalidate = 3600).
// Solo demo: ?tarjeta=obligatoria lo activa para revisarlo (cardRequiredDemo).

/** Medianoche de Costa Rica (UTC-6) del 1 de enero de 2027. Misma fecha que public._card_required_from() (0067). */
export const CARD_REQUIRED_FROM = "2027-01-01T06:00:00.000Z";

const at = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);

/** ¿La cuenta se creó desde CARD_REQUIRED_FROM? Sin fecha de alta: no (reglas de antes). */
export const cardRequiredFor = (createdAt: string | null | undefined, from = CARD_REQUIRED_FROM) => at(createdAt) >= Date.parse(from);

/** ¿Una cuenta que se crea ahora necesita tarjeta? Para los textos públicos ("sin tarjeta" o no). */
export const cardRequiredNow = (now = new Date(), from = CARD_REQUIRED_FROM) => now.getTime() >= Date.parse(from);

/**
 * Páginas públicas en caché (ISR, 1 h) con textos que cambian ese día. El cron de cobros de las 00:20 de Costa Rica las
 * regenera el día del cambio (cardSwitchDay), para que nadie vea "sin tarjeta" una hora más.
 */
export const CARD_COPY_PATHS = ["/", "/precios", "/glp1", "/running", "/temporadas", "/terminos", "/llms.txt"] as const;

/** ¿Es el primer día de la tarjeta obligatoria? (las 24 h desde CARD_REQUIRED_FROM). */
export const cardSwitchDay = (now = new Date(), from = CARD_REQUIRED_FROM) => now.getTime() >= Date.parse(from) && now.getTime() < Date.parse(from) + 864e5;

/** Solo demo: ?tarjeta=obligatoria muestra las pantallas como desde el 1 de enero. */
export const cardRequiredDemo = (demo: boolean, param: string | string[] | null | undefined) => demo && param === "obligatoria";
