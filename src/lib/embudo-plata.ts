// Embudo de plata por semana de registro (#279): registro > Hoy > entreno > primera serie > primer entreno > segundo entreno > 3 entrenos > tarjeta > pago
// > ingreso neto. Reglas puras, sin base ni red: embudo-plata-server.ts lee las filas y esto las cuenta.
// Si una fuente no se pudo leer llega como null y sus celdas salen "sin dato": nunca se cuenta como cero.
import { CARD_ASK_WHERE, type CardAskWhere } from "@/app/api/track/event";
import { STAFF_ROLES } from "@/lib/admin-perms";
import { CARD_REQUIRED_FROM, cardRequiredFor } from "@/lib/card-required";
import { PLANS } from "@/lib/plans";
import { finishedInTrial } from "@/lib/segundo-entreno";
import type { Role } from "@/lib/supabase/server";

/** Semanas que muestra la tabla (y el tope de lo que se lee). */
export const WEEKS = 8;
/** IVA de Costa Rica, incluido en el precio. */
export const IVA = 0.13;
/** Comisiones confirmadas por Andrés el 31 oct 2026 (las mismas de docs/metas/rentabilidad-semanal.sql). */
export const FEES = { onvo: { pct: 0.039, fixed: 0.35 }, tilopay: { pct: 0.0425, fixed: 0.35 } } as const;
export type Processor = keyof typeof FEES;

export type Origin = "anuncio" | "condominio" | "organico";
export const ORIGIN_LABEL: Record<Origin, string> = { anuncio: "Anuncio", condominio: "Condominio", organico: "Orgánico" };
/** Cuentas antes o desde CARD_REQUIRED_FROM (tarjeta obligatoria, cardRequiredFor). */
export type CardEra = "antes" | "desde";
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** "1 dic 2026": el día de Costa Rica (UTC-6) de un instante. */
const crDay = (iso: string) => { const d = new Date(Date.parse(iso) - 6 * 3600_000); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
export const CARD_ERA_LABEL: Record<CardEra, string> = { antes: `Antes del ${crDay(CARD_REQUIRED_FROM)}`, desde: `Desde el ${crDay(CARD_REQUIRED_FROM)}` };
/** Valor del filtro de país para cuentas sin país. */
export const NO_COUNTRY = "sin";

/** Pasos del embudo después del registro, en orden. Los cuatro primeros son eventos de funnel_events. */
export const STEPS = [
  { key: "hoy", label: "Vieron Hoy", event: "hoy_view" },
  { key: "open", label: "Abrieron el entreno", event: "workout_open" },
  { key: "firstView", label: "Vieron el primer ejercicio", event: "workout_first_set_view" },
  { key: "firstSet", label: "Hicieron la primera serie", event: "workout_first_set" },
  { key: "finished", label: "Terminaron su primer entreno" },
  { key: "second", label: "Segundo entreno" },
  { key: "third", label: "3 entrenos en la prueba" },
  { key: "card", label: "Dejaron tarjeta" },
  { key: "paid", label: "Pagaron" },
] as const;
export type StepKey = (typeof STEPS)[number]["key"];
export const STEP_EVENTS = STEPS.flatMap((s) => ("event" in s ? [s.event] : []));

/** Pedido de tarjeta (#308): lo vio, se le mostró el formulario, la guardó. Todos con el `where` del pedido. */
export const CARD_ASK_EVENTS = { view: "card_ask_view", form: "card_form_view", saved: "card_saved" } as const;
export type CardAskStep = keyof typeof CARD_ASK_EVENTS;
export const CARD_ASK_LABEL: Record<CardAskWhere, string> = {
  bienvenida: "Bienvenida",
  "hoy-banner": "Banner de Hoy",
  "primera-serie": "Tras la primera serie",
  "primer-entreno": "Al terminar el primer entreno",
  salida: "Oferta de salida",
  "mi-plan": "Mi plan",
  muro: "Muro de planes",
  dia6: "Correo del día 6",
};

export type Week = { key: string; start: string; end: string };

const DAY = 86400_000;
/** Costa Rica: UTC-6 todo el año. */
const CR_OFFSET = 6 * 3600_000;

/** Lunes (YYYY-MM-DD) de la semana de Costa Rica en que cae `iso`. */
export function weekKey(iso: string | Date): string {
  const cr = new Date(new Date(iso).getTime() - CR_OFFSET);
  const back = (cr.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(cr.getUTCFullYear(), cr.getUTCMonth(), cr.getUTCDate() - back)).toISOString().slice(0, 10);
}

/** Las últimas `n` semanas de lunes a domingo en Costa Rica, la actual primero. start y end en UTC, [start, end). */
export function crWeeks(now = new Date(), n = WEEKS): Week[] {
  const monday = Date.parse(`${weekKey(now)}T00:00:00Z`) + CR_OFFSET;
  return Array.from({ length: n }, (_, i) => {
    const start = monday - i * 7 * DAY;
    return { key: new Date(start - CR_OFFSET).toISOString().slice(0, 10), start: new Date(start).toISOString(), end: new Date(start + 7 * DAY).toISOString() };
  });
}

/** Neto de un cobro en USD: el cobro sin IVA menos la comisión. Sin comisión guardada se calcula con la tarifa (estimada). */
export function netUsd(amountMinor: number, processor: Processor, feeMinor?: number | null): { gross: number; net: number; estimated: boolean } {
  const gross = amountMinor / 100;
  const estimated = feeMinor == null;
  const fee = estimated ? gross * FEES[processor].pct + FEES[processor].fixed : feeMinor / 100;
  return { gross, net: Math.round((gross / (1 + IVA) - fee) * 100) / 100, estimated };
}

/** % sobre los registrados con un decimal. Sin registrados o sin dato: null. */
export const pctOf = (n: number | null, total: number | null) => (n == null || !total ? null : Math.round((n / total) * 1000) / 10);

/** ¿El registro trae marca de anuncio? (utm de campaña o fbclid guardados). */
export function isAdUtm(utm: unknown): boolean {
  if (!utm || typeof utm !== "object" || Array.isArray(utm)) return false;
  const u = utm as Record<string, unknown>;
  return ["utm_source", "utm_medium", "utm_campaign", "fbclid"].some((k) => typeof u[k] === "string" && (u[k] as string).trim() !== "");
}

export type SignupRow = { user_id: string; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_content: string | null; fbclid: string | null };

export type FunnelRows = {
  /** Cuentas creadas en las semanas que se miden (cualquier rol: aquí se quita al staff). */
  profiles: { id: string; created_at: string; role: Role | string | null; country: string | null }[];
  /** Cuentas que fueron tester alguna vez (tester_grants). Se quitan del embudo. */
  testers: string[];
  /** Residentes de un condominio (condo_members). */
  condo: string[] | null;
  /** utm guardado al registrarse por un enlace de referidor (affiliate_referrals.utm). */
  utm: { user_id: string; utm: unknown }[] | null;
  /** Primer contacto guardado al registrarse (signup_attribution, 0069): utm o fbclid de cualquier página. */
  signup: SignupRow[] | null;
  /** Eventos de STEP_EVENTS de esas cuentas. */
  events: { user_id: string | null; name: string }[] | null;
  /** Eventos de CARD_ASK_EVENTS de esas cuentas, con props.where (#308). Sin la fuente: undefined o null. */
  cardAsks?: { user_id: string | null; name: string; where: string | null }[] | null;
  /** Cuentas con un entreno terminado (workouts.finished_at). */
  finished: string[] | null;
  /** Cuentas con 2 o más entrenos terminados en sus primeros 7 días (#286, secondWorkoutUsers). */
  second: string[] | null;
  /** Cuentas con 3 o más entrenos terminados en sus primeros 7 días (#288, el hábito semanal). */
  third: string[] | null;
  charges: { user_id: string; status: string; amount_minor: number; fee_minor?: number | null }[] | null;
  methods: { user_id: string; provider: string; status: string }[] | null;
  subs: { user_id: string; provider: string; status: string; plan: string | null; billing: string | null; current_period_end: string | null; cancel_at_period_end: boolean | null }[] | null;
};

/** Cuentas con `min` o más workouts con finished_at dentro de sus primeros 7 días desde el registro (#286: 2; #288: 3). */
export function secondWorkoutUsers(profiles: { id: string; created_at: string }[], workouts: { user_id: string; finished_at: string | null }[], min = 2): string[] {
  const by = new Map<string, (string | null)[]>();
  for (const w of workouts) by.set(w.user_id, [...(by.get(w.user_id) ?? []), w.finished_at]);
  return profiles.filter((p) => finishedInTrial(p.created_at, by.get(p.id) ?? []) >= min).map((p) => p.id);
}

export type Account = {
  week: string;
  country: string | null;
  origin: Origin | null;
  /** utm_campaign y utm_content del primer contacto (null si no hay). */
  campaign: string | null;
  ad: string | null;
  era: CardEra;
  steps: Record<StepKey, boolean | null>;
  /** Pedidos de tarjeta de la cuenta (#308): en qué `where` llegó a cada paso. null: sin dato. */
  asks: Record<CardAskStep, Set<string>> | null;
  /** Neto del primer pago (0 si no pagó). null: sin dato. */
  net: number | null;
  estimated: boolean;
};

const PROCESSORS = Object.keys(FEES) as Processor[];
const isProcessor = (p: string): p is Processor => (PROCESSORS as string[]).includes(p);
const listPrice = (plan: string | null, billing: string | null) => {
  const p = PLANS.find((x) => x.id === plan);
  return p && (billing === "mes" || billing === "anual") ? Math.round(p.price[billing] * 100) : null;
};

/**
 * Una fila por cuenta, sin datos personales. Pago como en rentabilidad-semanal.sql: el cobro de la prueba con status
 * 'succeeded' (procesador de la tarjeta guardada, ONVO si no hay); si no, una suscripción ONVO/Tilopay vigente y pagada,
 * al precio de lista.
 */
export function buildAccounts(r: FunnelRows, now = new Date()): Account[] {
  const testers = new Set(r.testers);
  const staff = new Set<string>(STAFF_ROLES);
  const condo = r.condo && new Set(r.condo);
  const ads = r.utm && r.signup && new Set([...r.utm.filter((u) => isAdUtm(u.utm)), ...r.signup.filter(isAdUtm)].map((u) => u.user_id));
  const signup = new Map((r.signup ?? []).map((s) => [s.user_id, s]));
  const byEvent = new Map<string, Set<string>>(STEP_EVENTS.map((e) => [e, new Set<string>()]));
  for (const e of r.events ?? []) if (e.user_id) byEvent.get(e.name)?.add(e.user_id);
  const asks = new Map<string, Record<CardAskStep, Set<string>>>();
  const askStep = Object.fromEntries(Object.entries(CARD_ASK_EVENTS).map(([k, v]) => [v, k])) as Record<string, CardAskStep>;
  for (const e of r.cardAsks ?? []) {
    const k = askStep[e.name];
    if (!e.user_id || !k || !e.where) continue;
    if (!asks.has(e.user_id)) asks.set(e.user_id, { view: new Set(), form: new Set(), saved: new Set() });
    asks.get(e.user_id)![k].add(e.where);
  }
  const finished = r.finished && new Set(r.finished);
  const second = r.second && new Set(r.second);
  const third = r.third && new Set(r.third);
  // Una cuenta puede tener varios métodos (ONVO y Tilopay, o una tarjeta vieja inactiva): cuenta el activo.
  const method = r.methods && new Map<string, NonNullable<FunnelRows["methods"]>[number]>();
  for (const m of r.methods ?? []) if (m.status === "active" && !method!.has(m.user_id)) method!.set(m.user_id, m);
  // Varios cobros por cuenta: basta con tener alguno; el pago es el primer 'succeeded' (las filas llegan por id).
  const charged = r.charges && new Set(r.charges.map((c) => c.user_id));
  const charge = r.charges && new Map<string, NonNullable<FunnelRows["charges"]>[number]>();
  for (const c of r.charges ?? []) if (c.status === "succeeded" && !charge!.has(c.user_id)) charge!.set(c.user_id, c);
  const seen = now.getTime();
  const liveSub = r.subs && new Map(
    r.subs
      .filter((s) => isProcessor(s.provider) && (s.status === "active" || (s.status === "canceled" && s.cancel_at_period_end)) && s.current_period_end != null && Date.parse(s.current_period_end) > seen)
      .map((s) => [s.user_id, s]),
  );

  return r.profiles
    .filter((p) => !testers.has(p.id) && !(p.role && staff.has(p.role)))
    .map((p): Account => {
      const ev = (name: string) => (r.events ? byEvent.get(name)!.has(p.id) : null);
      const c = charge?.get(p.id);
      const m = method?.get(p.id);
      const a = signup.get(p.id);
      const card = charged && method ? charged.has(p.id) || !!m : null;

      let paid: boolean | null = null, net: number | null = null, estimated = false;
      if (charge && method && liveSub) {
        paid = false; net = 0;
        if (c) {
          const n = netUsd(c.amount_minor, m && isProcessor(m.provider) ? m.provider : "onvo", c.fee_minor);
          paid = true; net = n.net; estimated = n.estimated;
        } else {
          const s = liveSub.get(p.id);
          const price = s ? listPrice(s.plan, s.billing) : null;
          if (s) paid = true;
          if (s && price != null) { const n = netUsd(price, s.provider as Processor); net = n.net; estimated = n.estimated; }
          else if (s) net = null; // pagó, pero sin plan conocido no hay monto: sin dato.
        }
      }
      return {
        week: weekKey(p.created_at),
        country: p.country?.trim() ? p.country.trim().toUpperCase() : null,
        origin: condo && ads ? (condo.has(p.id) ? "condominio" : ads.has(p.id) ? "anuncio" : "organico") : null,
        campaign: a?.utm_campaign?.trim() || null,
        ad: a?.utm_content?.trim() || null,
        era: cardRequiredFor(p.created_at) ? "desde" : "antes",
        asks: r.cardAsks ? asks.get(p.id) ?? { view: new Set(), form: new Set(), saved: new Set() } : null,
        steps: { hoy: ev("hoy_view"), open: ev("workout_open"), firstView: ev("workout_first_set_view"), firstSet: ev("workout_first_set"), finished: finished ? finished.has(p.id) : null, second: second ? second.has(p.id) : null, third: third ? third.has(p.id) : null, card, paid },
        net,
        estimated,
      };
    });
}

export type Filters = { country?: string; origin?: Origin; era?: CardEra; campaign?: string; ad?: string };

/** Cuentas que pasan los filtros. null si un filtro no se puede aplicar porque falta su fuente (el origen y la campaña). */
export function applyFilters(accounts: Account[], f: Filters): Account[] | null {
  if ((f.origin || f.campaign || f.ad) && accounts.some((a) => a.origin === null)) return null;
  return accounts.filter((a) =>
    (!f.country || (f.country === NO_COUNTRY ? a.country === null : a.country === f.country)) &&
    (!f.origin || a.origin === f.origin) &&
    (!f.campaign || a.campaign === f.campaign) &&
    (!f.ad || a.ad === f.ad) &&
    (!f.era || a.era === f.era));
}

export type CohortRow = {
  week: string;
  registrados: number;
  steps: Record<StepKey, number | null>;
  net: number | null;
  /** Algún neto de la fila usa la comisión calculada con la tarifa. */
  estimated: boolean;
};

const sumOrNull = (xs: (boolean | null)[]) => (xs.some((x) => x === null) ? null : xs.filter(Boolean).length);

/** Una fila por semana (en el orden de `weeks`). Un paso con alguna cuenta sin dato sale null. */
export function cohortTable(accounts: Account[], weeks: Week[]): CohortRow[] {
  return weeks.map((w) => {
    const rows = accounts.filter((a) => a.week === w.key);
    const steps = Object.fromEntries(STEPS.map((s) => [s.key, sumOrNull(rows.map((a) => a.steps[s.key]))])) as Record<StepKey, number | null>;
    const net = rows.some((a) => a.net === null) ? null : Math.round(rows.reduce((t, a) => t + (a.net ?? 0), 0) * 100) / 100;
    return { week: w.key, registrados: rows.length, steps, net, estimated: rows.some((a) => a.estimated) };
  });
}

export type CardAskRow = { where: CardAskWhere; label: string } & Record<CardAskStep, number>;

/**
 * Pedido de tarjeta por lugar (#308): cuentas de `accounts` (ya filtradas por semana y filtros) que vieron cada pedido,
 * a las que se les mostró el formulario y que la guardaron, con el `where` de cada evento. null si falta la fuente.
 */
export function cardAskTable(accounts: Account[]): CardAskRow[] | null {
  if (accounts.some((a) => a.asks === null)) return null;
  return CARD_ASK_WHERE.map((where) => {
    const n = (k: CardAskStep) => accounts.filter((a) => a.asks![k].has(where)).length;
    return { where, label: CARD_ASK_LABEL[where], view: n("view"), form: n("form"), saved: n("saved") };
  });
}

/** Ingreso neto menos anuncios. Sin alguno de los dos: null. */
export const netAfterAds = (net: number | null, adsUsd: number | null) => (net == null || adsUsd == null ? null : Math.round((net - adsUsd) * 100) / 100);

/** Países presentes en las cuentas (para el filtro), ordenados. */
export const countriesOf = (accounts: Account[]) => [...new Set(accounts.map((a) => a.country).filter((c): c is string => !!c))].sort();

/** Campañas presentes en las cuentas (para el filtro), ordenadas. */
export const campaignsOf = (accounts: Account[]) => [...new Set(accounts.map((a) => a.campaign).filter((c): c is string => !!c))].sort();

/** Anuncios (utm_content) presentes, solo los de `campaign` si se eligió una, ordenados. */
export const adsOf = (accounts: Account[], campaign?: string) =>
  [...new Set(accounts.filter((a) => !campaign || a.campaign === campaign).map((a) => a.ad).filter((c): c is string => !!c))].sort();

/** Monto en USD escrito a mano ("120", "120.50", "1,200.5") a centavos. null si no es un monto válido. */
export function parseUsd(raw: string): number | null {
  const s = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}
