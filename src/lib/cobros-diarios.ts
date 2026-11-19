// Cobros del día a día (#330): los próximos 7 días en /admin/pagos y el resumen por correo después del cron de las 00:20.
// Reglas puras, sin base ni red: cobros-diarios-server.ts lee las filas y esto las agrupa y arma el correo.
// Nunca lleva correo ni datos de tarjeta: cada persona va por su alias.
import { SITE_URL } from "@/lib/env";
import { esc } from "@/lib/email/templates";
import { FEES, IVA, type Processor } from "@/lib/embudo-plata";
import { PLANS } from "@/lib/plans";

const DAY = 86400_000;
/** Costa Rica: UTC-6 todo el año. */
const CR_OFFSET = 6 * 3600_000;
/** Días que muestra "Próximos cobros", contando hoy. */
export const UPCOMING_DAYS = 7;

/** Día de Costa Rica (YYYY-MM-DD) de un instante. */
export const crDayKey = (iso: string | Date) => new Date(new Date(iso).getTime() - CR_OFFSET).toISOString().slice(0, 10);

/** Ventana de "Próximos cobros": desde las 00:00 de hoy en Costa Rica, `days` días. start y end en UTC, [start, end). */
export function upcomingWindow(now = new Date(), days = UPCOMING_DAYS): { start: string; end: string } {
  const start = Date.parse(`${crDayKey(now)}T00:00:00Z`) + CR_OFFSET;
  return { start: new Date(start).toISOString(), end: new Date(start + days * DAY).toISOString() };
}

/** Alias para el panel: el usuario (@nombre) o el primer nombre. Nunca el correo. */
export function aliasOf(p: { username?: string | null; full_name?: string | null } | null | undefined): string {
  const u = p?.username?.trim();
  if (u) return `@${u}`;
  const first = p?.full_name?.trim().split(/\s+/)[0];
  return first && !first.includes("@") ? first : "Sin nombre";
}

/** Comisión (tarifa de FEES) y neto sin IVA ni comisión de un cobro, en centavos. */
export function splitMinor(amountMinor: number, processor: Processor): { comisionMinor: number; netoMinor: number } {
  if (amountMinor <= 0) return { comisionMinor: 0, netoMinor: 0 };
  const comisionMinor = Math.round(amountMinor * FEES[processor].pct + FEES[processor].fixed * 100);
  return { comisionMinor, netoMinor: Math.round(amountMinor / (1 + IVA)) - comisionMinor };
}

export const PLAN_LABEL = (plan: string | null, billing: string | null) => {
  const name = PLANS.find((p) => p.id === plan)?.name ?? "Plan sin identificar";
  return `${name} ${billing === "anual" ? "anual" : "mensual"}`;
};

// ───────────────────────── Próximos cobros ─────────────────────────

/** primer_cobro: fin de la prueba o de la beta. reintento: segundo intento tras un rechazo. renovacion: periodo que vence. */
export type UpcomingKind = "primer_cobro" | "reintento" | "renovacion";
export const KIND_LABEL: Record<UpcomingKind, string> = { primer_cobro: "Primer cobro", reintento: "Reintento", renovacion: "Renovación" };

export type UpcomingCharge = {
  at: string;
  userId: string;
  alias: string;
  plan: string | null;
  billing: string | null;
  amountMinor: number;
  processor: Processor;
  /** Número del intento que viene (1 = primero). */
  attempt: number;
  kind: UpcomingKind;
};

export type UpcomingDay = { day: string; rows: UpcomingCharge[]; brutoMinor: number; comisionMinor: number; netoMinor: number };

/**
 * Un grupo por día de Costa Rica desde hoy, `days` días, aunque no tenga cobros (así se ve que el día está vacío).
 * Lo que venció antes de hoy y sigue pendiente se cuenta en hoy: lo toma la próxima corrida.
 */
export function groupUpcoming(rows: UpcomingCharge[], now = new Date(), days = UPCOMING_DAYS): UpcomingDay[] {
  const { start } = upcomingWindow(now, days);
  const out: UpcomingDay[] = Array.from({ length: days }, (_, i) => ({ day: crDayKey(new Date(Date.parse(start) + i * DAY)), rows: [], brutoMinor: 0, comisionMinor: 0, netoMinor: 0 }));
  const today = out[0].day;
  for (const r of [...rows].sort((a, b) => a.at.localeCompare(b.at))) {
    const key = crDayKey(r.at) < today ? today : crDayKey(r.at);
    const d = out.find((x) => x.day === key);
    if (!d) continue;
    const s = splitMinor(r.amountMinor, r.processor);
    d.rows.push(r);
    d.brutoMinor += r.amountMinor;
    d.comisionMinor += s.comisionMinor;
    d.netoMinor += s.netoMinor;
  }
  return out;
}

// ───────────────────────── Resumen diario por correo ─────────────────────────

/** Un cobro intentado en el día (trial_charges con last_attempt_at ese día). */
export type DayCharge = { status: string; amountMinor: number; processor: Processor; lastError: string | null };

/** Motivo genérico de un rechazo: nunca el texto crudo del procesador (puede traer datos de la tarjeta). */
export function genericReason(err: string | null | undefined): string {
  const e = (err ?? "").toLowerCase();
  if (!e) return "Sin motivo";
  if (e.includes("sin tarjeta")) return "Sin tarjeta guardada";
  if (/3ds|requires_action|autentica|verifica/.test(e)) return "El banco pidió verificación";
  if (/sin respuesta|timeout|\bred\b/.test(e)) return "Sin respuesta del procesador";
  if (/rechaz|declin|fondos|insufficient|do_not_honor|expir|venc/.test(e)) return "Tarjeta rechazada";
  return "Otro motivo";
}

export type CobrosResumen = {
  day: string;
  pasaron: number;
  fallaron: number;
  /** Cobros sin respuesta final todavía (los confirma el webhook o la próxima corrida). */
  enProceso: number;
  brutoMinor: number;
  netoMinor: number;
  motivos: Record<string, number>;
  /** El primer pago real de la historia: no había ninguno antes de este día y hoy pasó al menos uno. */
  primerPago: boolean;
};

/** Resumen del día, o null si no hubo cobros (entonces no se manda nada). */
export function buildResumen(rows: DayCharge[], day: string, paidBefore: boolean): CobrosResumen | null {
  if (!rows.length) return null;
  const r: CobrosResumen = { day, pasaron: 0, fallaron: 0, enProceso: 0, brutoMinor: 0, netoMinor: 0, motivos: {}, primerPago: false };
  for (const c of rows) {
    if (c.status === "succeeded") {
      r.pasaron++;
      r.brutoMinor += c.amountMinor;
      r.netoMinor += splitMinor(c.amountMinor, c.processor).netoMinor;
    } else if (c.status === "failed" || c.status === "retry_scheduled") {
      r.fallaron++;
      const m = genericReason(c.lastError);
      r.motivos[m] = (r.motivos[m] ?? 0) + 1;
    } else r.enProceso++;
  }
  r.primerPago = !paidBefore && r.pasaron > 0;
  return r;
}

/** Llave de idempotencia del correo: una por día de Costa Rica. */
export const resumenKey = (day: string) => `cobros-resumen:${day}`;

const usd2 = (minor: number) => `$${(minor / 100).toLocaleString("es-419", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const dayLabel = (day: string) => { const [y, m, d] = day.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Correo interno a hola@bananaburn.app con el resultado de los cobros del día. Solo conteos y montos. */
export function resumenEmail(r: CobrosResumen) {
  const head = `${plural(r.pasaron, "pasó", "pasaron")}, ${plural(r.fallaron, "falló", "fallaron")}`;
  const subject = `${r.primerPago ? "Primer pago real. " : ""}Cobros del ${dayLabel(r.day)}: ${head}`;
  const url = `${SITE_URL}/admin/pagos`;
  const lines = [
    `Pasaron: ${r.pasaron} (${usd2(r.brutoMinor)} cobrado, ${usd2(r.netoMinor)} neto sin IVA ni comisiones)`,
    `Fallaron: ${r.fallaron}`,
    ...Object.entries(r.motivos).sort((a, b) => b[1] - a[1]).map(([m, n]) => `  ${m}: ${n}`),
    ...(r.enProceso ? [`En proceso: ${r.enProceso} (los confirma el procesador o la corrida de las 7:00)`] : []),
  ];
  const cell = "padding:6px 10px;border-bottom:1px solid #EDE3C6;";
  const row = (k: string, v: string) => `<tr><td style="${cell}">${esc(k)}</td><td style="${cell}text-align:right;font-weight:700;">${esc(v)}</td></tr>`;
  const motivos = Object.entries(r.motivos).sort((a, b) => b[1] - a[1]).map(([m, n]) => row(`Falló: ${m}`, String(n))).join("");
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#FFF8E3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#2E2818;">
<div style="max-width:520px;margin:0 auto;padding:24px 16px;"><div style="background:#fff;border:1px solid #EDE3C6;border-radius:18px;padding:20px;">
<h1 style="margin:0 0 8px;font-size:20px;">${r.primerPago ? "Entró el primer pago real" : `Cobros del ${esc(dayLabel(r.day))}`}</h1>
<p style="margin:0 0 14px;line-height:1.5;">Resultado del cron de cobros de las 00:20 (hora de Costa Rica).</p>
<table style="width:100%;border-collapse:collapse;">${row("Pasaron", String(r.pasaron))}${row("Fallaron", String(r.fallaron))}${motivos}${r.enProceso ? row("En proceso", String(r.enProceso)) : ""}${row("Cobrado", usd2(r.brutoMinor))}${row("Neto sin IVA ni comisiones", usd2(r.netoMinor))}</table>
<p style="margin:16px 0 0;"><a href="${esc(url)}" style="display:inline-block;background:#1B1505;color:#fff;text-decoration:none;border-radius:999px;padding:10px 18px;font-weight:700;">Abrir Pagos en el panel</a></p>
<p style="margin:14px 0 0;font-size:12px;color:#6A604B;line-height:1.5;">Llega una vez por día, solo si hubo cobros. El neto usa la tarifa de cada procesador.</p>
</div></div></body></html>`;
  const text = `${subject}\n\n${lines.join("\n")}\n\nPanel: ${url}`;
  return { subject, html, text };
}
