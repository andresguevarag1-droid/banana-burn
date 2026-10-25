// Programa de referidores (afiliados, 0051). Reglas puras y testeadas (affiliates.test.ts); el servidor las aplica en
// affiliates-server.ts y la base repite lo esencial (atribución única, idempotencia por pago, RLS).
//
// Decisiones del dueño (oct 2026):
//   - Solo el dueño (superadmin) invita y asigna referidores. Revocar deja lo ganado y corta lo nuevo.
//   - Niveles por referidos PAGANDO hoy, por rangos: 1-10 → 10 %, 11-20 → 20 %, 21-30 → 30 %, 31+ → 40 %. El porcentaje
//     del nivel aplica a TODOS los pagos desde que lo alcanza (no escalonado). En el 40 % la app le sale gratis.
//   - Base: lo que pagó la persona, sin impuestos y sin la comisión del procesador. Un referido nunca cuesta dinero.
//   - Pagos manuales al mes (SINPE Móvil o transferencia), con 30 días de espera por reembolsos y mínimo de $20.
//
// Base de la comisión: el precio que paga la persona incluye el impuesto (IVA 13 % en Costa Rica, configurable).
//   impuesto = bruto − bruto / (1 + impuesto %)
//   procesador = bruto × % del procesador + fijo
//   base neta = bruto − impuesto − procesador (nunca menos de 0)
//   comisión = base neta × % del nivel (redondeada hacia abajo al centavo)

export type Provider = "onvo" | "tilopay";
export type Tier = { min: number; rate: number };
export type AffSettings = {
  onvo_fee_pct: number; onvo_fee_fixed_minor: number;
  tilopay_fee_pct: number; tilopay_fee_fixed_minor: number;
  tax_pct: number; hold_days: number; min_payout_minor: number; cookie_days: number;
  tiers: Tier[]; perk_min: number;
};

/**
 * Valores por defecto (iguales a 0051). Comisiones confirmadas por el dueño (oct 2026): ONVO tarjeta 3.9 % + $0.35 por cobro
 * exitoso; Tilopay (Visa, Mastercard, Amex) 4.25 % + $0.35; IVA 13 % incluido en el precio (lo que paga Atlas Resources SRL).
 * Todo se puede cambiar en el panel.
 */
export const DEFAULT_SETTINGS: AffSettings = {
  onvo_fee_pct: 3.9, onvo_fee_fixed_minor: 35,
  tilopay_fee_pct: 4.25, tilopay_fee_fixed_minor: 35,
  tax_pct: 13, hold_days: 30, min_payout_minor: 2000, cookie_days: 60,
  tiers: [{ min: 1, rate: 10 }, { min: 11, rate: 20 }, { min: 21, rate: 30 }, { min: 31, rate: 40 }],
  perk_min: 31,
};

export const AFF_COOKIE = "bb_aff";
export const AFF_CODE_RE = /^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/;
export const INVITE_DAYS = 14;

/** Normaliza un código de referidor (minúsculas, 3 a 20 caracteres: letras, números y guiones internos). */
export function normalizeAffCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim().toLowerCase();
  return AFF_CODE_RE.test(c) ? c : null;
}

/** Valor de la cookie: "código.marca-de-tiempo". El último clic gana: cada visita con ?ref= la reemplaza. */
export const affCookieValue = (code: string, at = Date.now()) => `${code}.${Math.floor(at / 1000)}`;
export function parseAffCookie(v: string | null | undefined, now = Date.now(), maxDays = DEFAULT_SETTINGS.cookie_days): { code: string; clickedAt: string } | null {
  if (!v) return null;
  const i = v.lastIndexOf(".");
  if (i <= 0) return null;
  const code = normalizeAffCode(v.slice(0, i));
  const ts = Number(v.slice(i + 1)) * 1000;
  if (!code || !Number.isFinite(ts) || ts <= 0 || ts > now + 60_000) return null;
  if (now - ts > maxDays * 864e5) return null;
  return { code, clickedAt: new Date(ts).toISOString() };
}

/** UTM permitidos (cortos, sin datos personales). */
export function cleanUtm(input: Record<string, unknown> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const v = input?.[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 80);
  }
  return out;
}

/** Tiers ordenados y válidos (si la configuración viene rota, se usan los del dueño). */
export function sanitizeTiers(t: unknown): Tier[] {
  const list = Array.isArray(t) ? t.filter((x): x is Tier => !!x && Number.isInteger((x as Tier).min) && (x as Tier).min >= 1 && typeof (x as Tier).rate === "number" && (x as Tier).rate > 0 && (x as Tier).rate <= 100) : [];
  const sorted = [...list].sort((a, b) => a.min - b.min);
  return sorted.length ? sorted : DEFAULT_SETTINGS.tiers;
}

/** Nivel según referidos pagando hoy. Con 0 activos no hay nivel (0 %). */
export function tierFor(active: number, tiers: Tier[] = DEFAULT_SETTINGS.tiers): { level: number; rate: number; next: Tier | null; toNext: number } {
  const t = sanitizeTiers(tiers);
  let level = 0, rate = 0;
  t.forEach((x, i) => { if (active >= x.min) { level = i + 1; rate = x.rate; } });
  const next = t[level] ?? null;
  return { level, rate, next, toNext: next ? Math.max(0, next.min - active) : 0 };
}

/** Comisión del procesador y del impuesto, base neta. Todo en centavos (enteros). */
export function netBase(grossMinor: number, provider: Provider, s: AffSettings = DEFAULT_SETTINGS): { fee: number; tax: number; net: number } {
  const gross = Math.max(0, Math.round(grossMinor));
  const tax = s.tax_pct > 0 ? gross - Math.round(gross / (1 + s.tax_pct / 100)) : 0;
  const pct = provider === "tilopay" ? s.tilopay_fee_pct : s.onvo_fee_pct;
  const fixed = provider === "tilopay" ? s.tilopay_fee_fixed_minor : s.onvo_fee_fixed_minor;
  const fee = gross > 0 ? Math.round((gross * pct) / 100) + fixed : 0;
  return { fee, tax, net: Math.max(0, gross - tax - fee) };
}

/** Comisión en centavos (hacia abajo: nunca pagamos de más por redondeo). */
export const commissionOf = (netMinor: number, ratePct: number) => Math.max(0, Math.floor((netMinor * ratePct) / 100));

/** Cálculo completo de una línea del libro para un pago verificado. */
export function commissionLine(a: { grossMinor: number; provider: Provider; activeCount: number; settings?: AffSettings }) {
  const s = a.settings ?? DEFAULT_SETTINGS;
  const { fee, tax, net } = netBase(a.grossMinor, a.provider, s);
  const { level, rate } = tierFor(a.activeCount, s.tiers);
  return { fee, tax, net, level, rate, commission: commissionOf(net, rate) };
}

/** Cuándo una línea pasa de "en espera" a "disponible". */
export const availableAt = (paidAt: Date, holdDays: number) => new Date(paidAt.getTime() + Math.max(0, holdDays) * 864e5);

/** ¿Se genera pago este mes? Solo con saldo disponible mayor o igual al mínimo y un método de pago guardado. */
export const payoutDue = (availableMinor: number, minMinor: number, hasMethod: boolean) => hasMethod && availableMinor > 0 && availableMinor >= minMinor;

const TZ_OFFSET_MS = 6 * 3600_000; // Costa Rica: UTC−6 todo el año (sin horario de verano).
/** Fin de mes en Costa Rica (medianoche del día 1 del mes siguiente), en UTC. `add` meses adelante. */
export function endOfMonthCR(now: Date, add = 0): Date {
  const local = new Date(now.getTime() - TZ_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1 + add, 1) + TZ_OFFSET_MS);
}

/**
 * Acceso gratis del nivel máximo: mientras califica, vence al final del mes en curso; en los últimos 7 días del mes se
 * extiende al final del mes siguiente. Si deja de calificar no se extiende: vence al final del mes (con aviso 7 días antes).
 */
export function perkTarget(now: Date): Date {
  const end = endOfMonthCR(now);
  return end.getTime() - now.getTime() <= 7 * 864e5 ? endOfMonthCR(now, 1) : end;
}

/** Periodo del pago mensual ("2026-11"), en hora de Costa Rica. */
export function periodOf(now: Date): string {
  const l = new Date(now.getTime() - TZ_OFFSET_MS);
  return `${l.getUTCFullYear()}-${String(l.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Enmascara el método de pago para mostrarlo después de guardarlo. */
export function maskMethod(m: { kind: "sinpe" | "iban"; sinpe_phone?: string | null; iban?: string | null }): string {
  if (m.kind === "sinpe" && m.sinpe_phone) return `SINPE Móvil ****${m.sinpe_phone.slice(-4)}`;
  if (m.kind === "iban" && m.iban) return `IBAN ${m.iban.slice(0, 4)} **** ${m.iban.slice(-4)}`;
  return "Sin método de pago";
}

/** Normaliza un correo para comparar invitaciones (minúsculas, sin espacios). */
export const normInviteEmail = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();

/** Saldo por estado a partir de las líneas del libro. Los ajustes negativos restan de lo disponible. */
export function balances(lines: { status: string; commission_minor: number; available_at: string }[], now = Date.now()) {
  let pending = 0, available = 0, paid = 0;
  for (const l of lines) {
    if (l.status === "reversed") continue;
    if (l.status === "paid") paid += l.commission_minor;
    else if (l.status === "available" || Date.parse(l.available_at) <= now) available += l.commission_minor;
    else pending += l.commission_minor;
  }
  return { pending, available, paid };
}
