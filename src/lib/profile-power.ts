// Poder del perfil e insignias: lógica pura (sin servidor), probada en profile-power.test.ts.
// La misma regla vive en la base (0030: _power_points, _power_tier, _insignias). Si cambias una, cambia la otra.
import { levelOf, LEVELS } from "@/lib/gamify";

export type CoverName = "banana" | "ember" | "sky" | "peel" | "noche" | "selva" | "fresa" | "lila";

/** Lo que mueve el poder del perfil. Todo sale de la base: compras, programas, retos, XP, racha y verificación. */
export type PowerStats = {
  /** Programas o retos Premium que tienes (compra o cortesía). */
  premiumOwned: number;
  /** Programas completados más retos Premium completados (certificados). */
  certs: number;
  /** Retos gratis completados (medallas). */
  retosDone: number;
  levelIdx: number;
  /** Mejor racha; null cuando miras el perfil de otra persona (la racha solo la ves tú). */
  bestStreak: number | null;
  verified: boolean;
};

/** Puntos por cada cosa real. Igual que public._power_points (0030). */
export const POINTS = { owned: 20, cert: 25, reto: 5, retoCap: 10, level: 5, streak7: 5, streak30: 15, verified: 10 } as const;

const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0);

export function pointsFor(s: PowerStats): number {
  const lv = Math.min(LEVELS.length, Math.max(1, n(s.levelIdx) || 1));
  const streak = n(s.bestStreak);
  return n(s.premiumOwned) * POINTS.owned + n(s.certs) * POINTS.cert + Math.min(POINTS.retoCap, n(s.retosDone)) * POINTS.reto
    + (lv - 1) * POINTS.level + (streak >= 30 ? POINTS.streak30 : streak >= 7 ? POINTS.streak7 : 0) + (s.verified ? POINTS.verified : 0);
}

export type Tier = {
  idx: 1 | 2 | 3 | 4 | 5; name: string; min: number; icon: string;
  /** Portada de marca para el encabezado del perfil (los mismos estilos de las portadas de programas). */
  cover: CoverName | null;
  /** Qué cambia en tu perfil al llegar. */
  unlock: string;
};

/** Niveles de perfil. Igual que public._power_tier (0030). */
export const TIERS: Tier[] = [
  { idx: 1, name: "Semilla", min: 0, icon: "plant", cover: null, unlock: "Tu perfil en la tropa, con tu nivel y tus logros." },
  { idx: 2, name: "Racimo", min: 30, icon: "bunch", cover: "banana", unlock: "Portada banana, marco Racimo y tu insignia junto a tu nombre." },
  { idx: 3, name: "Cosecha", min: 80, icon: "peeled", cover: "ember", unlock: "Portada de fuego, marco Cosecha y vitrina de programas destacada." },
  { idx: 4, name: "Platanal", min: 150, icon: "palm", cover: "selva", unlock: "Portada selva y marco Platanal: tu perfil resalta en el ranking." },
  { idx: 5, name: "Banana de oro", min: 250, icon: "trophy", cover: "noche", unlock: "Portada noche con oro y el marco más alto de Banana Burn." },
];

export function tierFor(points: number): Tier {
  const p = n(points);
  let t = TIERS[0];
  for (const x of TIERS) if (p >= x.min) t = x;
  return t;
}
export const tierByIdx = (idx: number | null | undefined): Tier => TIERS[Math.max(0, Math.min(TIERS.length - 1, (n(idx) || 1) - 1))];

/** Avance hacia el próximo nivel de perfil (null en el máximo). */
export function nextTier(points: number) {
  const p = n(points), cur = tierFor(p);
  const next = TIERS[cur.idx] ?? null;
  if (!next) return null;
  return { tier: next, left: next.min - p, progress: (p - cur.min) / (next.min - cur.min) };
}

/** "Cómo subir tu perfil": cada fuente real de puntos, cuánto da y cuánto llevas. */
export function howToGrow(s: PowerStats) {
  const streak = n(s.bestStreak);
  return [
    { id: "owned", icon: "medal", title: "Suma programas Premium a tu colección", detail: `+${POINTS.owned} por cada uno`, have: `${n(s.premiumOwned)} en tu colección`, href: "/app/retos" },
    { id: "cert", icon: "trophy", title: "Completa programas y retos Premium", detail: `+${POINTS.cert} por cada certificado`, have: `${n(s.certs)} ${n(s.certs) === 1 ? "certificado" : "certificados"}`, href: "/app/retos" },
    { id: "reto", icon: "banana", title: "Termina retos gratis", detail: `+${POINTS.reto} por medalla, hasta ${POINTS.retoCap}`, have: `${Math.min(POINTS.retoCap, n(s.retosDone))} de ${POINTS.retoCap}`, href: "/app/retos" },
    { id: "level", icon: "xp", title: "Sube de nivel con XP", detail: `+${POINTS.level} por cada nivel`, have: `Nivel ${Math.max(1, n(s.levelIdx))}`, href: "/app/niveles" },
    ...(s.bestStreak === null ? [] : [{ id: "streak", icon: "streak", title: "Haz rachas largas", detail: `+${POINTS.streak7} con 7 días, +${POINTS.streak30} con 30`, have: `Mejor racha: ${streak} ${streak === 1 ? "día" : "días"}`, href: "/app" }]),
    { id: "verified", icon: "shield", title: "Verifica tu identidad", detail: `+${POINTS.verified} y el sello Verificado`, have: s.verified ? "Verificado" : "Sin verificar", href: "/app/perfil/verificar" },
  ];
}

// ───────────── Insignias ─────────────
export type InsigniaKind = "certificado" | "medalla" | "nivel" | "racha" | "verificado" | "coleccion" | "logro";
export type Insignia = { id: string; label: string; detail: string | null; icon: string; cover: CoverName | null; kind: InsigniaKind; at: string | null };

/** Formato de id de insignia (igual que el CHECK de profile_flair.featured). */
const BADGE_ID = /^[a-z0-9][a-z0-9:._-]{0,79}$/;
export const isBadgeId = (x: unknown): x is string => typeof x === "string" && BADGE_ID.test(x);

/** Insignias que no vienen del catálogo: nombre, detalle e ícono fijos. */
const STATIC: Record<string, { label: string; detail: string; icon: string; kind: InsigniaKind }> = {
  racha7: { label: "Racha de 7", detail: "7 días seguidos activo", icon: "streak", kind: "racha" },
  racha30: { label: "Racha de 30", detail: "Un mes sin fallar", icon: "streak", kind: "racha" },
  verificado: { label: "Verificado", detail: "Identidad confirmada por Banana Burn", icon: "shield", kind: "verificado" },
  coleccion: { label: "Coleccionista", detail: "3 o más programas Premium", icon: "bunch", kind: "coleccion" },
  tester: { label: "Tester de la beta", detail: "Ayudó a probar Banana Burn", icon: "flask", kind: "logro" },
  pr: { label: "Récord personal", detail: "Superó su mejor marca", icon: "trophy", kind: "logro" },
  w10: { label: "10 entrenos", detail: "La constancia gana", icon: "barbell", kind: "logro" },
  w50: { label: "50 entrenos", detail: "Medio centenar de sesiones", icon: "barbell", kind: "logro" },
};
const COVERS: CoverName[] = ["banana", "ember", "sky", "peel", "noche", "selva", "fresa", "lila"];
const asCover = (x: unknown): CoverName | null => (COVERS.includes(x as CoverName) ? (x as CoverName) : null);
const KINDS: InsigniaKind[] = ["certificado", "medalla", "nivel", "racha", "verificado", "coleccion", "logro"];

/** Nombre e ícono de una insignia por su id (para la destacada de otra persona). Null si el id no es válido. */
export function insigniaMeta(id: string, opts: { label?: string | null; icon?: string | null; cover?: string | null; xp?: number | null } = {}) {
  if (!isBadgeId(id)) return null;
  if (id === "nivel") {
    if (opts.xp === null || opts.xp === undefined) return null;
    const lv = levelOf(Math.max(0, opts.xp));
    return { id, label: lv.n, icon: lv.icon, cover: null, kind: "nivel" as const };
  }
  const st = STATIC[id];
  if (st) return { id, label: st.label, icon: st.icon, cover: null, kind: st.kind };
  if ((id.startsWith("prog:") || id.startsWith("reto:")) && opts.label) {
    return { id, label: opts.label.slice(0, 40), icon: opts.icon || "medal", cover: asCover(opts.cover), kind: id.startsWith("prog:") ? ("certificado" as const) : ("medalla" as const) };
  }
  return null;
}

/** Fila cruda de la base (my_profile_power / community_profile_power) a insignia lista para mostrar. */
export function toInsignia(r: { id?: unknown; label?: unknown; detail?: unknown; icon?: unknown; cover?: unknown; kind?: unknown; at?: unknown }, levelIdx: number): Insignia | null {
  if (!isBadgeId(r.id)) return null;
  const id = r.id;
  const at = typeof r.at === "string" ? r.at : null;
  if (id === "nivel") {
    const lv = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, (n(levelIdx) || 1) - 1))];
    return { id, label: lv.n, detail: `Nivel ${Math.max(1, n(levelIdx))}`, icon: lv.icon, cover: null, kind: "nivel", at };
  }
  const st = STATIC[id];
  if (st) return { id, label: st.label, detail: st.detail, icon: st.icon, cover: null, kind: st.kind, at };
  if (typeof r.label !== "string" || !r.label) return null;
  const kind = KINDS.includes(r.kind as InsigniaKind) ? (r.kind as InsigniaKind) : "medalla";
  return { id, label: r.label.slice(0, 60), detail: typeof r.detail === "string" && r.detail !== r.label ? r.detail.slice(0, 80) : null, icon: typeof r.icon === "string" ? r.icon : "medal", cover: asCover(r.cover), kind, at };
}

const ORDER: Record<InsigniaKind, number> = { certificado: 0, verificado: 1, coleccion: 2, medalla: 3, nivel: 4, racha: 5, logro: 6 };
/** Orden del muro: certificados primero (lo que más pesa), luego verificado, colección, medallas, nivel, racha y logros. */
export const sortInsignias = (xs: Insignia[]) => [...xs].sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || String(b.at ?? "").localeCompare(String(a.at ?? "")) || a.label.localeCompare(b.label, "es"));

/**
 * ¿Se puede destacar? Solo una insignia ganada (o ninguna). La base lo vuelve a validar (set_featured_badge):
 * esta función solo evita mandar al servidor algo que de seguro va a rechazar.
 */
export function canFeature(earned: { id: string; kind?: InsigniaKind }[], id: string | null): boolean {
  if (id === null) return true;
  // La racha solo la ves tú: no se muestra junto a tu nombre (la base también lo rechaza).
  return isBadgeId(id) && !id.startsWith("racha") && earned.some((x) => x.id === id && x.kind !== "racha");
}

/** La insignia destacada a mostrar: la elegida si sigue ganada; si no, la mejor por orden (o ninguna). */
export function featuredOf(insignias: Insignia[], chosen: string | null): Insignia | null {
  if (chosen) { const x = insignias.find((i) => i.id === chosen); if (x) return x; }
  return null;
}

// ───────────── Comunidad: insignias junto al nombre ─────────────
export type Flair = { verified: boolean; tier: number | null; featured: { id: string; label: string; icon: string; cover: CoverName | null } | null };

/** Fila de community_flair a Flair (sin datos inventados: lo que no viene, no se muestra). */
export function toFlair(r: { verified?: unknown; tier?: unknown; total_xp?: unknown; featured?: unknown; featured_label?: unknown; featured_icon?: unknown; featured_cover?: unknown }): Flair {
  const xp = r.total_xp === null || r.total_xp === undefined ? null : Number(r.total_xp);
  const tier = r.tier === null || r.tier === undefined ? null : Math.max(1, Math.min(5, Math.floor(Number(r.tier)) || 1));
  const meta = typeof r.featured === "string" ? insigniaMeta(r.featured, { label: r.featured_label as string | null, icon: r.featured_icon as string | null, cover: r.featured_cover as string | null, xp }) : null;
  return { verified: r.verified === true, tier, featured: meta ? { id: meta.id, label: meta.label, icon: meta.icon, cover: meta.cover } : null };
}

/** Texto para lectores de pantalla: "Verificado. Perfil Cosecha. Insignia: Core de acero". */
export function flairLabel(f: Flair | null | undefined): string {
  if (!f) return "";
  return [f.verified ? "Verificado" : null, f.tier && f.tier > 1 ? `Perfil ${tierByIdx(f.tier).name}` : null, f.featured ? `Insignia: ${f.featured.label}` : null].filter(Boolean).join(". ");
}
