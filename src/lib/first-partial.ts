// Primer entreno guardado a medias al salir (#246). El reproductor deja aquí el resumen de lo que hizo; si la persona no
// alcanzó a ver el cierre (salió con Atrás o cerró la app), Hoy lo muestra al volver con la oferta y el coach.
// Puro (recibe el almacenamiento) para poder probarlo. Nunca lanza: sin almacenamiento, no hay tarjeta.
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const FIRST_PARTIAL_KEY = "bb.first-partial.v1";
/** Pasados estos días, Hoy ya no lo muestra. */
const MAX_AGE_MS = 3 * 86_400_000;

export type FirstPartial = { title: string; done: number; total: number; mins: number; at: number };

export function markFirstPartial(s: Store, p: FirstPartial) {
  try { s.setItem(FIRST_PARTIAL_KEY, JSON.stringify(p)); } catch { /* sin almacenamiento */ }
}

export function readFirstPartial(s: Store, now: number): FirstPartial | null {
  try {
    const p = JSON.parse(s.getItem(FIRST_PARTIAL_KEY) ?? "null");
    if (!p || typeof p.title !== "string" || ![p.done, p.total, p.mins, p.at].every(Number.isFinite)) return null;
    return now - p.at >= 0 && now - p.at < MAX_AGE_MS && p.done > 0 ? p : null;
  } catch { return null; }
}

/** Ya lo vio (el cierre del entreno o la tarjeta de Hoy): no se repite. */
export function clearFirstPartial(s: Store) {
  try { s.removeItem(FIRST_PARTIAL_KEY); } catch { /* */ }
}
