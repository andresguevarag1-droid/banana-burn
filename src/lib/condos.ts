// Condominios afiliados (0053): reglas puras y probadas (condos.test.ts) del enlace del condominio y del acceso de sus
// residentes. Las usan el servidor (condos-server.ts), el panel y las páginas /c/<código>. Nada aquí toca la base.
//   - Mes gratis: cada residente que entra con el enlace recibe 30 días del plan completo desde que lo activa.
//   - Activo: el condominio eligió un plan y lo paga fuera de la app; sus residentes tienen ese plan hasta paid_until.
//   - Terminado: el enlace deja de servir y no se extiende el acceso de nadie (lo que ya tenían corre hasta su fecha).
//   - Un mes gratis por cuenta y una cuenta en un solo condominio. Una cuenta con plan pagado no lo necesita.
//   - Con tarjeta hasta una fecha (0066, piloto Soho Paradisus): primero se prueba SIN tarjeta (CONDO_TRY_DAYS con todo
//     incluido, nunca más allá de free_until). Al dejar la tarjeta, el acceso sigue gratis hasta free_until y el primer
//     cobro pasa a esa fecha a precio normal.
import { SITE_URL } from "@/lib/env";
import type { PlanId } from "@/lib/plans";

export const CONDO_COOKIE = "bb_condo";
export const CONDO_COOKIE_MAX_AGE = 30 * 86400;
export const CONDO_FREE_DAYS = 30;
/** 0066: días para probar sin tarjeta en un condominio con tarjeta. */
export const CONDO_TRY_DAYS = 7;
/** Aviso a los residentes antes de que termine su mes gratis (si el condominio todavía no eligió plan). */
export const CONDO_NOTICE_DAYS = 3;

export const CONDO_STATUSES = [
  ["mes_gratis", "Mes gratis"],
  ["activo", "Activo"],
  ["terminado", "Terminado"],
] as const;
export type CondoStatus = (typeof CONDO_STATUSES)[number][0];
export const isCondoStatus = (s: unknown): s is CondoStatus => typeof s === "string" && CONDO_STATUSES.some(([k]) => k === s);
export const condoStatusLabel = (s: string) => CONDO_STATUSES.find(([k]) => k === s)?.[1] ?? s;

export type CondoRow = {
  id: number; code: string; name: string; status: CondoStatus;
  free_starts_at?: string | null; free_ends_at: string | null; paid_plan: PlanId | null; paid_until: string | null;
  /** 0066: el acceso se da solo con tarjeta, y termina en free_until (fecha fija) en vez de 30 días desde que se activa. */
  card_required?: boolean | null; free_until?: string | null;
};

/** Último día gratis para mostrar ("31 de diciembre"): free_until es la medianoche en que empieza el cobro. */
export const lastFreeDay = (freeUntil: string) => new Date(Date.parse(freeUntil) - 1000).toISOString();
export type CondoGrant = { id: number; plan: string; starts_at: string; expires_at: string; revoked_at: string | null };

const CODE_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

/** Código del enlace: minúsculas, números y guiones, de 3 a 30 caracteres. Igual que el CHECK de condos.code. */
export function normalizeCondoCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  let s = v.trim().toLowerCase();
  try { s = decodeURIComponent(s); } catch { return null; }
  return CODE_RE.test(s) ? s : null;
}

/** Propuesta de código a partir del nombre: "Condominio Las Palmas" → "las-palmas". */
export function condoCodeFromName(name: string): string {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\b(condominio|condominios|residencial|torre|torres|condo)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-").slice(0, 30).replace(/-+$/, "");
  if (base.length >= 3) return base;
  const all = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24).replace(/-+$/, "");
  return all.length >= 3 ? all : `condo-${all || "nuevo"}`.slice(0, 30).replace(/-+$/, "");
}

/** Enlace público del condominio (lo que va en el afiche, el QR y el mensaje de WhatsApp). */
export const condoLink = (code: string) => `${SITE_URL.replace(/\/$/, "")}/c/${code}`;

/** Mensaje listo para pegar en el grupo de WhatsApp del condominio. Sin emojis (libro de marca). */
export function condoWhatsapp(c: { name: string; code: string; card_required?: boolean | null; free_until?: string | null }): string {
  if (c.card_required && c.free_until) {
    const d = (iso: string) => new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long", timeZone: "America/Costa_Rica" });
    return [
      `Hola, vecinos de ${c.name}.`,
      "",
      "Banana Burn es un entrenador personal en el celular: el plan de cada semana, la técnica de cada ejercicio y un coach que responde dudas a cualquier hora.",
      "",
      `Para los residentes se prueba gratis, sin tarjeta. Si te gusta, dejas tu tarjeta y sigues gratis hasta el ${d(lastFreeDay(c.free_until))}: no se cobra nada hasta el ${d(c.free_until)} y se cancela cuando quieras antes de esa fecha.`,
      "",
      `Actívalo aquí: ${condoLink(c.code)}`,
    ].join("\n");
  }
  return [
    `Hola, vecinos de ${c.name}.`,
    "",
    "El condominio se unió a Banana Burn: un entrenador personal en el celular para cada residente, con el plan de cada semana, la técnica de cada ejercicio y un coach que responde dudas a cualquier hora.",
    "",
    "El primer mes es gratis para todos los residentes, con todo incluido. No se necesita tarjeta.",
    "",
    `Actívalo aquí: ${condoLink(c.code)}`,
  ].join("\n");
}

/** Lo que da hoy el enlace del condominio a una cuenta nueva en él. null: el enlace no está activo. */
export type CondoOffer = { plan: PlanId; expiresAt: string; free: boolean; card: boolean };
/** Hasta cuándo prueba sin tarjeta: CONDO_TRY_DAYS desde ahora, nunca después del fin del acceso gratis. */
export const condoTryUntil = (offerEnd: string, now = new Date()) => new Date(Math.min(now.getTime() + CONDO_TRY_DAYS * 864e5, Date.parse(offerEnd))).toISOString();

/** Lo que da hoy el enlace del condominio a una cuenta nueva en él. null: el enlace no está activo. */
export function condoOffer(c: Pick<CondoRow, "status" | "paid_plan" | "paid_until"> & Partial<Pick<CondoRow, "card_required" | "free_until">>, now = new Date()): CondoOffer | null {
  if (c.status === "mes_gratis") {
    if (c.free_until) {
      // Fecha fija (0066): después de free_until el enlace ya no da nada.
      if (Date.parse(c.free_until) <= now.getTime()) return null;
      return { plan: "completo", expiresAt: new Date(c.free_until).toISOString(), free: true, card: !!c.card_required };
    }
    return { plan: "completo", expiresAt: new Date(now.getTime() + CONDO_FREE_DAYS * 864e5).toISOString(), free: true, card: !!c.card_required };
  }
  if (c.status === "activo" && c.paid_plan && c.paid_until && Date.parse(c.paid_until) > now.getTime()) return { plan: c.paid_plan, expiresAt: new Date(c.paid_until).toISOString(), free: false, card: false };
  return null;
}

export type JoinDecision =
  | ({ kind: "join"; pendingCard?: boolean } & CondoOffer) // pendingCard (0066): prueba sin tarjeta hasta expiresAt
  | { kind: "inactivo" } // no existe, terminado o el acuerdo venció
  | { kind: "ya_vinculado" } // ya es residente de este condominio
  | { kind: "otro_condominio" } // ya es residente de otro condominio
  | { kind: "ya_usado" } // ya recibió una vez el acceso de un condominio
  | { kind: "plan_pagado" }; // ya paga su plan: no lo necesita

/** ¿Qué pasa cuando una cuenta abre el enlace del condominio? Orden: enlace activo, vínculo, mes ya usado, plan pagado. */
export function decideJoin(i: { condo: (Pick<CondoRow, "id" | "status" | "paid_plan" | "paid_until"> & Partial<Pick<CondoRow, "card_required" | "free_until">>) | null; memberOf: number | null; hadCondoGrant: boolean; hasPaidPlan: boolean; cardReady?: boolean; now?: Date }): JoinDecision {
  const now = i.now ?? new Date();
  if (i.memberOf != null && i.condo && i.memberOf === i.condo.id) return { kind: "ya_vinculado" };
  const offer = i.condo ? condoOffer(i.condo, now) : null;
  if (!offer) return { kind: "inactivo" };
  if (i.memberOf != null) return { kind: "otro_condominio" };
  if (i.hadCondoGrant) return { kind: "ya_usado" };
  if (i.hasPaidPlan) return { kind: "plan_pagado" };
  // 0066: sin tarjeta lista entra igual a probar unos días; con la tarjeta, el acceso llega hasta el fin del gratis.
  if (offer.card && !i.cardReady) return { kind: "join", ...offer, expiresAt: condoTryUntil(offer.expiresAt, now), pendingCard: true };
  return { kind: "join", ...offer };
}

/**
 * Barrido diario de un residente de un condominio activo: su cortesía pasa al plan del condominio y vence en paid_until
 * (se extiende, se reactiva si había vencido o se acorta si el condominio pagó menos). null: no hay nada que cambiar.
 * Un condominio en mes gratis o terminado no cambia nada (la cortesía de cada residente corre hasta su fecha).
 */
export function syncGrant(c: Pick<CondoRow, "status" | "paid_plan" | "paid_until">, g: CondoGrant): { plan: PlanId; expires_at: string } | null {
  if (g.revoked_at) return null;
  if (c.status !== "activo" || !c.paid_plan || !c.paid_until) return null;
  const until = new Date(c.paid_until).toISOString();
  if (Date.parse(until) <= Date.parse(g.starts_at)) return null; // CHECK (expires_at > starts_at)
  if (g.plan === c.paid_plan && Date.parse(g.expires_at) === Date.parse(until)) return null;
  return { plan: c.paid_plan, expires_at: until };
}

/** ¿Toca avisar que el mes gratis termina? 3 días antes, una vez, si el condominio no tiene un acuerdo que lo extienda. */
export function endingNoticeDue(c: Pick<CondoRow, "status" | "paid_until">, g: CondoGrant, notifiedAt: string | null, now = new Date()): boolean {
  if (notifiedAt || g.revoked_at) return false;
  const end = Date.parse(g.expires_at), t = now.getTime();
  if (end <= t || end - t > CONDO_NOTICE_DAYS * 864e5) return false;
  if (c.status === "activo" && c.paid_until && Date.parse(c.paid_until) > end) return false;
  return true;
}

/** ¿El acceso que el condominio paga ya venció? (para el panel: "Activo, vencido"). */
export const condoLapsed = (c: Pick<CondoRow, "status" | "paid_until">, now = new Date()) => c.status === "activo" && !!c.paid_until && Date.parse(c.paid_until) <= now.getTime();

/** Texto para el residente según la decisión. */
export function joinMessage(d: JoinDecision["kind"], name: string, freeUntil?: string | null, tryUntil?: string | null): { title: string; body: string } {
  const day = (iso: string) => new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long", timeZone: "America/Costa_Rica" });
  if (freeUntil && tryUntil && d === "join") return { title: `Listo: pruébalo gratis hasta el ${day(lastFreeDay(tryUntil))}`, body: `Tienes todo incluido, sin tarjeta. Si te gusta, deja tu tarjeta y sigues gratis hasta el ${day(lastFreeDay(freeUntil))}.` };
  if (freeUntil && d === "join") return { title: `Listo: Banana Burn gratis hasta el ${day(lastFreeDay(freeUntil))}`, body: `Tienes todo incluido, con entreno y nutrición. El ${day(freeUntil)} se cobra el plan que elegiste y te avisamos 2 días antes.` };
  switch (d) {
    case "join": return { title: `Tu condominio ${name} te regala el primer mes`, body: "Ya tienes Banana Burn completo, con entreno y nutrición. Arma tu plan en 2 minutos." };
    case "ya_vinculado": return { title: `Ya eres parte de ${name}`, body: "Tu cuenta ya está vinculada a tu condominio. Sigue entrenando." };
    case "otro_condominio": return { title: "Tu cuenta ya está vinculada a otro condominio", body: "Cada cuenta puede pertenecer a un solo condominio. Si te mudaste, escríbenos a hola@bananaburn.app y lo revisamos." };
    case "ya_usado": return { title: "Ya usaste el mes gratis de un condominio", body: "El mes gratis del condominio se da una vez por cuenta. Puedes seguir con un plan individual cuando quieras." };
    case "plan_pagado": return { title: "Ya tienes un plan activo", body: "Tu cuenta ya tiene un plan pagado, así que no necesitas el mes gratis del condominio. Tu plan sigue igual." };
    default: return { title: "Este enlace no está activo", body: "El enlace de este condominio ya no está disponible. Pregunta en la administración o prueba Banana Burn 7 días gratis." };
  }
}
