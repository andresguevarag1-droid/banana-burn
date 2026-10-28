// Avisos al dueño (0059): textos y reglas puras, sin base ni red (las prueba admin-avisos.test.ts).
// El despachador (admin-avisos-server.ts) lee la bandeja admin_events y usa esto para armar cada push, correo y aviso.
import { COUNTRY_NAME } from "@/lib/countries";
import { PLANS } from "@/lib/plans";
import { parseSeasonSlug, SPORTS } from "@/lib/seasons";

export const ALERT_KINDS = ["registro", "pago", "tarjeta", "cobro_fallido", "cancelacion", "temporada", "reto", "condominio", "referidor"] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];
/** "prueba" es el botón de Probar notificación: siempre sale, sin importar los tipos elegidos. */
export type EventKind = AlertKind | "prueba";

export const KIND_LABEL: Record<AlertKind, string> = {
  registro: "Usuarios nuevos",
  pago: "Pagos recibidos",
  tarjeta: "Tarjetas guardadas",
  cobro_fallido: "Cobros rechazados",
  cancelacion: "Cancelaciones",
  temporada: "Temporadas compradas",
  reto: "Retos comprados",
  condominio: "Condominios interesados",
  referidor: "Llegadas por referidores",
};

export const isAlertKind = (k: unknown): k is AlertKind => typeof k === "string" && (ALERT_KINDS as readonly string[]).includes(k);

export type AdminEvent = {
  id: number;
  event_key: string;
  kind: EventKind;
  user_id: string | null;
  amount_minor: number | null;
  currency: string | null;
  data: Record<string, unknown>;
  created_at: string;
};

/** Lo mínimo de la persona: nombre de pila y país. Nunca el correo ni datos de la tarjeta. */
export type Person = { firstName: string | null; country: string | null };

export type Prefs = {
  push: boolean;
  email: boolean;
  email_mode: "instante" | "resumen";
  in_app: boolean;
  daily_summary: boolean;
  kinds: AlertKind[];
};
export const DEFAULT_PREFS: Prefs = { push: true, email: false, email_mode: "resumen", in_app: true, daily_summary: true, kinds: [...ALERT_KINDS] };

/** Preferencias guardadas (o las de fábrica), sin confiar en lo que venga de la base. */
export function normalizePrefs(row: Partial<Prefs> | null | undefined): Prefs {
  if (!row) return { ...DEFAULT_PREFS, kinds: [...DEFAULT_PREFS.kinds] };
  return {
    push: row.push ?? DEFAULT_PREFS.push,
    email: row.email ?? DEFAULT_PREFS.email,
    email_mode: row.email_mode === "instante" ? "instante" : "resumen",
    in_app: row.in_app ?? DEFAULT_PREFS.in_app,
    daily_summary: row.daily_summary ?? DEFAULT_PREFS.daily_summary,
    kinds: Array.isArray(row.kinds) ? row.kinds.filter(isAlertKind) : [...DEFAULT_PREFS.kinds],
  };
}

/** Por dónde sale este aviso para este superadmin. El correo inmediato solo si lo eligió (cuida el límite diario). */
export function channelsFor(kind: EventKind, p: Prefs): { push: boolean; inApp: boolean; email: boolean } {
  if (kind === "prueba") return { push: p.push, inApp: p.in_app, email: p.email };
  const on = p.kinds.includes(kind);
  return { push: on && p.push, inApp: on && p.in_app, email: on && p.email && p.email_mode === "instante" };
}

export function money(amountMinor: number | null | undefined, currency: string | null | undefined): string | null {
  if (amountMinor == null || !Number.isFinite(amountMinor)) return null;
  const cur = (currency || "USD").toUpperCase();
  const n = amountMinor / 100;
  const txt = n.toLocaleString("es-419", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return cur === "USD" ? `$${txt}` : `${txt} ${cur}`;
}

export const firstName = (full: string | null | undefined): string | null => {
  const f = (full ?? "").trim().split(/\s+/)[0];
  return f ? f.slice(0, 24) : null;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const planLabel = (plan: unknown, billing: unknown) => {
  const name = PLANS.find((p) => p.id === plan)?.name ?? null;
  if (!name) return null;
  return billing === "anual" ? `${name} anual` : billing === "mes" ? `${name} mensual` : name;
};
const providerLabel = (p: unknown) => (p === "tilopay" ? "Tilopay" : p === "onvo" ? "ONVO" : null);
function seasonLabel(slug: unknown): string | null {
  const s = typeof slug === "string" ? parseSeasonSlug(slug) : null;
  return s ? `Temporada ${SPORTS[s.sport].name}` : null;
}
function retoLabel(slug: unknown): string | null {
  if (typeof slug !== "string" || !slug) return null;
  const t = slug.replace(/-/g, " ").trim();
  return `Reto ${t.charAt(0).toUpperCase()}${t.slice(1)}`;
}

/** Quién: "María, Costa Rica" (o lo que haya). */
function who(p: Person | null): string {
  const parts = [p?.firstName || null, p?.country ? COUNTRY_NAME[p.country] ?? p.country : null].filter(Boolean);
  return parts.length ? parts.join(", ") : "Sin nombre";
}

/** Une piezas con coma, sin vacíos. */
const join = (...xs: (string | null | undefined | false)[]) => xs.filter(Boolean).join(", ");

export type AlertText = { title: string; body: string; url: string };

/** Texto corto en español para el push, el aviso en la app y el asunto del correo. */
export function alertText(e: AdminEvent, person: Person | null): AlertText {
  const d = e.data ?? {};
  const url = e.user_id ? `/admin/usuarios/${e.user_id}` : e.kind === "condominio" ? "/admin/condominios" : "/admin/notificaciones";
  const amount = money(e.amount_minor, e.currency);
  switch (e.kind) {
    case "registro":
      return { title: "Nuevo usuario", body: join(who(person), str(d.source) ? `desde ${str(d.source)}` : null), url };
    case "pago":
      return { title: `Pago recibido${amount ? `: ${amount}` : ""}`, body: join(planLabel(d.plan, d.billing), d.renewal === true ? "renovación" : null, who(person), providerLabel(d.provider)), url };
    case "tarjeta":
      return { title: "Tarjeta guardada", body: join(who(person), planLabel(d.plan, d.billing), amount ? `primer cobro de ${amount}` : null), url };
    case "cobro_fallido": {
      const what = d.origen === "temporada" ? seasonLabel(d.slug) : d.origen === "reto" ? retoLabel(d.slug) : planLabel(d.plan, d.billing);
      const final = d.final === true ? "sin más intentos" : d.final === false ? "se reintenta" : null;
      return { title: `Cobro rechazado${amount ? `: ${amount}` : ""}`, body: join(what, who(person), providerLabel(d.provider), final), url };
    }
    case "cancelacion":
      return { title: "Cancelación", body: join(planLabel(d.plan, d.billing), who(person), "sigue activo hasta fin de periodo"), url };
    case "temporada":
      return { title: `Temporada comprada${amount ? `: ${amount}` : ""}`, body: join(seasonLabel(d.slug) ?? "Temporada", who(person), providerLabel(d.provider)), url };
    case "reto":
      return { title: `Reto comprado${amount ? `: ${amount}` : ""}`, body: join(retoLabel(d.slug), who(person), providerLabel(d.provider)), url };
    case "condominio":
      return { title: "Condominio interesado", body: join(str(d.org) ?? "Sin nombre", str(d.units) ? `${str(d.units)} unidades` : null, str(d.location)), url };
    case "referidor":
      return { title: "Llegó alguien por un referidor", body: who(person), url };
    case "prueba":
    default:
      return { title: "Prueba de avisos", body: "Así te llegan los avisos de Banana Burn.", url: "/admin/notificaciones" };
  }
}

/** Ingreso de dinero que cuenta para el resumen (en centavos de USD; otras monedas no se suman). */
export const isRevenue = (e: Pick<AdminEvent, "kind" | "amount_minor" | "currency">) =>
  (e.kind === "pago" || e.kind === "temporada" || e.kind === "reto") && e.amount_minor != null && (e.currency ?? "USD").toUpperCase() === "USD";

export type DaySummary = { registros: number; primerosEntrenos: number; pagos: number; ingresoMinor: number; tarjetas: number; rechazos: number; cancelaciones: number };

export function summarize(events: Pick<AdminEvent, "kind" | "amount_minor" | "currency">[], primerosEntrenos: number): DaySummary {
  const s: DaySummary = { registros: 0, primerosEntrenos, pagos: 0, ingresoMinor: 0, tarjetas: 0, rechazos: 0, cancelaciones: 0 };
  for (const e of events) {
    if (e.kind === "registro") s.registros++;
    else if (e.kind === "tarjeta") s.tarjetas++;
    else if (e.kind === "cobro_fallido") s.rechazos++;
    else if (e.kind === "cancelacion") s.cancelaciones++;
    if (e.kind === "pago" || e.kind === "temporada" || e.kind === "reto") s.pagos++;
    if (isRevenue(e)) s.ingresoMinor += e.amount_minor!;
  }
  return s;
}

export function summaryText(s: DaySummary): { title: string; body: string } {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return {
    title: `Tu día en Banana Burn: ${money(s.ingresoMinor, "USD")}`,
    body: join(
      plural(s.registros, "usuario nuevo", "usuarios nuevos"),
      plural(s.primerosEntrenos, "primer entreno", "primeros entrenos"),
      plural(s.pagos, "pago", "pagos"),
      s.tarjetas ? plural(s.tarjetas, "tarjeta guardada", "tarjetas guardadas") : null,
      s.rechazos ? plural(s.rechazos, "cobro rechazado", "cobros rechazados") : null,
      s.cancelaciones ? plural(s.cancelaciones, "cancelación", "cancelaciones") : null,
    ),
  };
}

/** Clave única del aviso de un pago: el mismo cobro verificado nunca avisa dos veces. */
export const paymentKey = (provider: string, reference: string) => `pago:${provider}:${reference}`.slice(0, 160);
