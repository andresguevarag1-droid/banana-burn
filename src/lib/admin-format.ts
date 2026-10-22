// Formato del panel en español de Costa Rica. Fuente única para páginas, acciones y exportaciones.
import { usd } from "./plans";

const TZ = "America/Costa_Rica";

/** Marcador de celda vacía (sin raya larga). */
export const EMPTY = "-";

const toDate = (s: string) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00-06:00` : s);

/** "21 oct 2026" */
export const fmtDate = (s?: string | null) =>
  s ? toDate(s).toLocaleDateString("es-419", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }) : EMPTY;

/** "21 oct" (para ejes y series cortas). */
export const fmtDay = (s?: string | null) => (s ? toDate(s).toLocaleDateString("es-419", { day: "numeric", month: "short", timeZone: TZ }) : EMPTY);

/** "21 oct 2026, 08:12 a. m." */
export const fmtDateTime = (s?: string | null) =>
  s ? toDate(s).toLocaleString("es-419", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ }) : EMPTY;

const NUM = new Intl.NumberFormat("es-419", { maximumFractionDigits: 1 });
/** Número con separadores de es-CR ("1 324", "33,3"). */
export const fmtNum = (n: number) => NUM.format(n);
/** Porcentaje ya calculado (0 a 100): "33,3 %". */
export const fmtPct = (n: number) => `${NUM.format(n)} %`;

/** Montos en USD con el mismo formato que el resto de la app (usd() de plans.ts). */
export const money = (n: number) => usd(Math.round(n * 100) / 100);
