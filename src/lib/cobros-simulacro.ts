// Simulacro de cobros (dryRun): qué cobraría el cron, a quién (solo id), cuánto y con qué procesador, sin cobrar ni
// escribir. Tipos, duplicados, resumen y CSV. Puro y testeado (sin "server-only": lo usan el cron, el script y las pruebas).
// Nunca lleva correo, nombre ni datos de tarjeta: cada persona va por su id de cuenta.
import type { Billing, PlanId } from "./plans";
import type { PayProvider } from "./pay-provider";

/** Fecha del simulacro: el cron de cobros del 8 de noviembre de 2026 (00:20 en Costa Rica), fin de los 7 días de la beta. */
export const SIMULACRO_AT = "2026-11-08T06:20:00.000Z";

/**
 * De dónde sale el cobro:
 *   fin_beta           cuenta de la beta con tarjeta guardada (trial_charges kind "beta"): se cobra al terminar la gracia.
 *   prueba             cuenta nueva al terminar sus 7 días (kind "prueba").
 *   inmediato          tarjeta guardada después de terminar la prueba (kind "inmediato").
 *   reintento          segundo intento del primer cobro después de un rechazo (retry_scheduled).
 *   primer_mes_normal  ONVO: termina el primer mes con 50 % y se crea la suscripción normal a precio completo.
 *   cambio_tarjeta     ONVO: suscripción normal con la renovación rechazada y la tarjeta cambiada.
 *   renovacion         Tilopay: renovación mensual o anual con la tarjeta guardada.
 */
export type ChargeSource = "fin_beta" | "prueba" | "inmediato" | "reintento" | "primer_mes_normal" | "cambio_tarjeta" | "renovacion";
/** cobrar: llamaría al procesador. consultar: hay un cobro en vuelo y solo se consulta (nunca se cobra de nuevo). omitir: no se cobra. */
export type PlanAction = "cobrar" | "consultar" | "omitir";

export type PlannedCharge = {
  userId: string;
  /** Fila de origen (trial_charges.id o subscriptions.id), para cruzarla con el panel admin. */
  fila: number;
  origen: ChargeSource;
  procesador: PayProvider | null;
  plan: PlanId | null;
  billing: Billing | null;
  /** Centavos de USD que se mandarían al procesador. */
  montoMinor: number;
  /** Centavos de USD que calcula el servidor con plans.ts. Si no coincide con montoMinor, hay que revisar la fila. */
  montoEsperadoMinor: number;
  /** El primer mes lleva el 50 % ($4.99 Entreno, $7.49 Entreno + Nutrición). */
  promo50: boolean;
  /** Periodo de la llave única (0062): "primer_cobro" o el inicio del periodo en ISO UTC. */
  periodo: string;
  accion: PlanAction;
  motivo: string | null;
  /** Tiene una cortesía, regalo o recompensa vigente que NO frena el cobro (solo la de condominio lo frena). */
  cortesia: boolean;
  /** Plan anual: incluye una temporada deportiva para canjear (sin cobro aparte). */
  temporadaIncluida: boolean;
};

/**
 * Lee todas las filas de una consulta por páginas (PostgREST corta en 1,000 filas): el simulacro lista a TODAS las personas,
 * no solo las que alcanzaría una corrida del cron. `page` arma la consulta con .range(desde, hasta) y un orden estable.
 */
export async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>, size = 1000, max = 100_000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    const rows = (data as T[] | null) ?? [];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

/** Llave del cobro: usuario, periodo y procesador (la misma de 0062). */
export const chargeKeyOf = (p: Pick<PlannedCharge, "userId" | "periodo" | "procesador">) => `${p.userId}|${p.periodo}|${p.procesador ?? "-"}`;

/** Llaves que se cobrarían más de una vez en la misma corrida. Debe ser siempre una lista vacía. */
export function duplicateKeys(list: PlannedCharge[]): string[] {
  const seen = new Map<string, number>();
  for (const p of list) if (p.accion === "cobrar") seen.set(chargeKeyOf(p), (seen.get(chargeKeyOf(p)) ?? 0) + 1);
  return [...seen].filter(([, n]) => n > 1).map(([k]) => k);
}

type Bucket = { cobros: number; montoMinor: number };
const add = (b: Bucket, minor: number) => { b.cobros++; b.montoMinor += minor; };
const bucket = (): Bucket => ({ cobros: 0, montoMinor: 0 });

export type SimulacroSummary = {
  at: string;
  cobros: number;
  montoMinor: number;
  porProcesador: Record<PayProvider, Bucket>;
  porOrigen: Partial<Record<ChargeSource, Bucket>>;
  /** Primer mes con 50 % por monto: { "499": n, "749": n }. */
  primerMes50: Record<string, number>;
  mensual: Bucket;
  anual: Bucket;
  temporadasIncluidas: number;
  conCortesia: number;
  montoDistinto: number;
  consultar: number;
  omitidos: Record<string, number>;
  duplicados: number;
};

export function summarize(list: PlannedCharge[], at: string): SimulacroSummary {
  const s: SimulacroSummary = {
    at, cobros: 0, montoMinor: 0, porProcesador: { onvo: bucket(), tilopay: bucket() }, porOrigen: {}, primerMes50: {},
    mensual: bucket(), anual: bucket(), temporadasIncluidas: 0, conCortesia: 0, montoDistinto: 0, consultar: 0, omitidos: {}, duplicados: duplicateKeys(list).length,
  };
  for (const p of list) {
    if (p.accion === "consultar") { s.consultar++; continue; }
    if (p.accion === "omitir") { const m = p.motivo ?? "otro"; s.omitidos[m] = (s.omitidos[m] ?? 0) + 1; continue; }
    s.cobros++;
    s.montoMinor += p.montoMinor;
    if (p.procesador) add(s.porProcesador[p.procesador], p.montoMinor);
    add((s.porOrigen[p.origen] ??= bucket()), p.montoMinor);
    if (p.promo50) s.primerMes50[String(p.montoMinor)] = (s.primerMes50[String(p.montoMinor)] ?? 0) + 1;
    if (p.billing === "anual") add(s.anual, p.montoMinor);
    else add(s.mensual, p.montoMinor);
    if (p.temporadaIncluida) s.temporadasIncluidas++;
    if (p.cortesia) s.conCortesia++;
    if (p.montoMinor !== p.montoEsperadoMinor) s.montoDistinto++;
  }
  return s;
}

/** Dinero en formato es-419 ($1,040.00). */
export const money = (minor: number) => `$${(minor / 100).toLocaleString("es-419", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CSV_COLS = ["userId", "fila", "origen", "procesador", "plan", "billing", "montoMinor", "montoEsperadoMinor", "promo50", "periodo", "accion", "motivo", "cortesia", "temporadaIncluida"] as const;
const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV del reporte (una fila por cobro planeado, sin datos personales). */
export const toCsv = (list: PlannedCharge[]) => [CSV_COLS.join(","), ...list.map((p) => CSV_COLS.map((c) => cell(p[c])).join(","))].join("\n") + "\n";

/** Resumen para la consola. */
export function summaryLines(s: SimulacroSummary): string[] {
  const b = (x: Bucket) => `${x.cobros} cobros, ${money(x.montoMinor)}`;
  const lines = [
    `Simulacro de cobros al ${s.at} (no se cobró ni se escribió nada)`,
    `Total a cobrar: ${b({ cobros: s.cobros, montoMinor: s.montoMinor })}`,
    `  ONVO: ${b(s.porProcesador.onvo)}`,
    `  Tilopay: ${b(s.porProcesador.tilopay)}`,
    `  Mensual: ${b(s.mensual)}`,
    `  Anual: ${b(s.anual)} (${s.temporadasIncluidas} con temporada incluida para canjear, sin cobro aparte)`,
    ...Object.entries(s.porOrigen).map(([k, v]) => `  Origen ${k}: ${b(v!)}`),
    ...Object.entries(s.primerMes50).map(([k, n]) => `  Primer mes con 50 % de ${money(Number(k))}: ${n}`),
    `Solo consulta (cobro en vuelo, no se cobra de nuevo): ${s.consultar}`,
    ...Object.entries(s.omitidos).map(([k, n]) => `Omitidos por ${k}: ${n}`),
    `Con cortesía vigente que no frena el cobro: ${s.conCortesia}`,
    `Monto distinto al del servidor: ${s.montoDistinto}`,
    `Cobros duplicados (usuario, periodo, procesador): ${s.duplicados}`,
  ];
  return lines;
}
