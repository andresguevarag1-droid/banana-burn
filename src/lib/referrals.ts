// Referidos: reglas puras (sin acceso a datos). La base de datos aplica las mismas reglas y es la fuente de verdad
// (0025_regalos_referidos.sql: referral_attribute, _referral_try_qualify, _referral_settle, referral_annual_paid).
//
// Reglas (decididas con el dueño):
//   1. Cada persona tiene un enlace /r/<código> (8 caracteres sin 0, 1, i, l ni o). El enlace guarda una cookie y abre el registro.
//   2. La cuenta nueva se atribuye en el servidor al crearse: una sola vez, nunca a sí misma, solo en sus primeras 72 horas
//      y una sola vez por correo (aunque la cuenta se borre y se vuelva a crear).
//   3. "Calificado" = terminó la bienvenida y, dentro de sus primeros 7 días, terminó un entreno (no descanso) o registró
//      agua, pasos o sueño; y no parece la misma persona que invita:
//        - mismo correo normalizado (sin +etiqueta; en Gmail sin puntos): no cuenta;
//        - mismo prefijo de red que quien invita y mismo dominio de correo: en revisión (un admin aprueba o descarta);
//        - 2 o más referidos previos desde el mismo prefijo de red en 30 días: en revisión.
//      Una compra anual confirmada por el webhook saca a la persona de "en revisión".
//   4. Recompensa: los calificados se ordenan por fecha de calificación y se agrupan de a 3. Cada grupo completo da 1 mes
//      gratis; si al menos una persona del grupo compró un plan ANUAL (solo lo confirma el webhook de ONVO), ese grupo
//      da 3 meses (un trimestre). Si la compra anual llega después, el grupo sube de 1 a 3 meses una sola vez.
//      Un grupo nunca se recalcula ni se paga dos veces. Tope: 12 recompensas por persona en 365 días.
//   5. Las recompensas son regalos (comp_grants source 'referido'): aviso, ventana de celebración y correo como cualquier regalo.

export const REF_COOKIE = "bb_ref";
export const REF_COOKIE_MAX_AGE = 30 * 86400;
export const REF_CODE_RE = /^[a-hjkmnp-z2-9]{8}$/;
export const REF_GROUP_SIZE = 3;
export const REF_BASE_MONTHS = 1;
export const REF_ANNUAL_MONTHS = 3;
export const REF_WINDOW_DAYS = 7;
export const REF_ATTRIBUTION_HOURS = 72;
export const REF_MAX_REWARDS_YEAR = 12;

/** Código del enlace (sin distinguir mayúsculas). null si no tiene el formato. */
export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim().toLowerCase();
  return REF_CODE_RE.test(c) ? c : null;
}

/** Correo normalizado para detectar la misma bandeja (igual que public._norm_email). */
export function normEmail(e: string | null | undefined): string {
  const v = (e ?? "").trim().toLowerCase();
  const [l0 = "", d0 = ""] = v.split("@");
  const d = d0 === "googlemail.com" ? "gmail.com" : d0;
  const l = l0.split("+")[0];
  return `${d === "gmail.com" ? l.replace(/\./g, "") : l}@${d}`;
}

/**
 * Prefijo de red para comparar sin guardar la IP: IPv4 /24 y IPv6 /48. Se guarda solo su HMAC (referrals-server.ts).
 * null para direcciones locales o inválidas (no sirven como señal).
 */
export function ipPrefix(ip: string | null | undefined): string | null {
  const s = (ip ?? "").trim().replace(/^\[|\]$/g, "");
  const v4 = s.replace(/^::ffff:/i, "");
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v4);
  if (m) {
    const o = m.slice(1).map(Number);
    if (o.some((x) => x > 255)) return null;
    if (o[0] === 10 || o[0] === 127 || (o[0] === 192 && o[1] === 168) || (o[0] === 172 && o[1] >= 16 && o[1] <= 31)) return null;
    return `${o[0]}.${o[1]}.${o[2]}.0/24`;
  }
  if (/^[0-9a-f:]+$/i.test(s) && s.includes(":")) {
    if (s === "::1") return null;
    const [head] = s.split("::");
    const parts = head.split(":").filter(Boolean);
    if (!parts.length) return null;
    while (parts.length < 3) parts.push("0");
    return `${parts.slice(0, 3).map((p) => p.toLowerCase().replace(/^0+(?=.)/, "")).join(":")}::/48`;
  }
  return null;
}

export type RefStatus = "registrado" | "calificado" | "sospechoso" | "descartado";

/** Lo que la persona ve de cada referido (my_referrals()): inicial y estado. */
export type MyReferral = { initial: string; status: RefStatus; created_at: string; qualified_at: string | null; annual: boolean; group_no: number | null; expired: boolean };
export type MyReward = { id: number; group_no: number; months: number; plan: string; created_at: string; upgraded_at: string | null; revoked_at: string | null };

export type RefTone = "muted" | "good" | "banana" | "warn";
export function referralLabel(r: Pick<MyReferral, "status" | "annual" | "expired">): { label: string; tone: RefTone } {
  if (r.status === "descartado") return { label: "No cuenta", tone: "muted" };
  if (r.status === "sospechoso") return { label: "En revisión", tone: "warn" };
  if (r.annual && r.status === "calificado") return { label: "Compró anual", tone: "banana" };
  if (r.status === "calificado") return { label: "Activo", tone: "good" };
  if (r.expired) return { label: "No se activó a tiempo", tone: "muted" };
  return { label: r.annual ? "Compró anual" : "Registrado", tone: r.annual ? "banana" : "muted" };
}

/** Progreso hacia la próxima recompensa: calificados que todavía no forman grupo. */
export function referralProgress(list: Pick<MyReferral, "status" | "group_no">[]) {
  const waiting = list.filter((r) => r.status === "calificado" && r.group_no == null).length;
  const have = waiting % REF_GROUP_SIZE;
  return { have, need: REF_GROUP_SIZE, text: `${have} de ${REF_GROUP_SIZE} para tu próximo mes gratis` };
}

export function monthsEarned(rewards: Pick<MyReward, "months" | "revoked_at">[]) {
  return rewards.filter((r) => !r.revoked_at).reduce((a, r) => a + r.months, 0);
}

export const referralLink = (site: string, code: string) => `${site.replace(/\/$/, "")}/r/${code}`;
export const shareMessage = (link: string) => `Entreno con Banana Burn: rutina hecha para mí, con el peso de cada serie. Pruébala gratis 7 días con mi enlace: ${link}`;

// ─────────── Simulación de recompensas (misma lógica que la base, para definir y probar las reglas) ───────────

export type SimRef = { id: number; status: RefStatus; qualifiedAt: number | null; annual: boolean; group: number | null };
export type SimReward = { group: number; months: 1 | 3; grants: number[]; revoked: boolean; upgraded: boolean; at: number };
export type SimState = { refs: SimRef[]; rewards: SimReward[] };

/** Agrupa calificados de a 3 y paga cada grupo nuevo (idempotente: correrlo dos veces no paga de nuevo). */
export function settle(s: SimState, now: number): SimState {
  const refs = s.refs.map((r) => ({ ...r }));
  const rewards = s.rewards.map((w) => ({ ...w, grants: [...w.grants] }));
  for (;;) {
    const ready = refs.filter((r) => r.status === "calificado" && r.group == null).sort((a, b) => (a.qualifiedAt ?? 0) - (b.qualifiedAt ?? 0) || a.id - b.id).slice(0, REF_GROUP_SIZE);
    if (ready.length < REF_GROUP_SIZE) break;
    if (rewards.filter((w) => !w.revoked && w.at > now - 365 * 864e5).length >= REF_MAX_REWARDS_YEAR) break;
    const group = Math.max(0, ...rewards.map((w) => w.group)) + 1;
    const months = ready.some((r) => r.annual) ? REF_ANNUAL_MONTHS : REF_BASE_MONTHS;
    ready.forEach((r) => { r.group = group; });
    rewards.push({ group, months: months as 1 | 3, grants: [months], revoked: false, upgraded: false, at: now });
  }
  return { refs, rewards };
}

/** Compra anual confirmada de un referido: marca y, si su grupo ya cobró 1 mes, suma 2 (una sola vez). */
export function annualPaid(s: SimState, id: number, now: number): { state: SimState; result: "trimestre" | "anotado" | "sin_cambio" } {
  const ref = s.refs.find((r) => r.id === id);
  if (!ref || ref.annual || ref.status === "descartado") return { state: s, result: "sin_cambio" };
  const refs = s.refs.map((r) => (r.id === id ? { ...r, annual: true, status: r.status === "sospechoso" ? ("registrado" as const) : r.status } : r));
  const me = refs.find((r) => r.id === id)!;
  if (me.group == null) return { state: settle({ refs, rewards: s.rewards }, now), result: "anotado" };
  const w = s.rewards.find((x) => x.group === me.group);
  if (!w || w.revoked || w.months !== 1) return { state: { refs, rewards: s.rewards }, result: "sin_cambio" };
  const rewards = s.rewards.map((x) => (x.group === me.group ? { ...x, months: 3 as const, upgraded: true, grants: [...x.grants, 2] } : x));
  return { state: { refs, rewards }, result: "trimestre" };
}

/** Revocación por fraude: quita los meses del grupo y descarta a sus referidos (no se vuelven a agrupar). */
export function revokeReward(s: SimState, group: number): SimState {
  return {
    refs: s.refs.map((r) => (r.group === group ? { ...r, status: "descartado" as const } : r)),
    rewards: s.rewards.map((w) => (w.group === group ? { ...w, revoked: true } : w)),
  };
}

/** Meses entregados (no revocados) en una simulación. */
export const simMonths = (s: SimState) => s.rewards.filter((w) => !w.revoked).reduce((a, w) => a + w.grants.reduce((x, y) => x + y, 0), 0);
