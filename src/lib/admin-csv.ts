// Filtros de Pagos y exportación CSV (puro, probado en admin-csv.test.ts).
import { crDay, type SubRow } from "./admin-kpis";

export const SUB_STATUS_FILTERS = [["", "Todas"], ["active", "Activas"], ["trialing", "En prueba"], ["fallido", "Con fallo de pago"], ["canceled", "Canceladas"]] as const;
export const SUB_PLAN_FILTERS = [["", "Todos"], ["entreno", "Entreno"], ["completo", "Entreno + Nutrición"]] as const;
export const SUB_BILLING_FILTERS = [["", "Todas"], ["mes", "Mensual"], ["anual", "Anual"]] as const;

export type SubFilterInput = { status?: string; plan?: string; billing?: string; q?: string; page?: string };
const oneOf = (list: readonly (readonly [string, string])[], v?: string) => (v && list.some(([k]) => k === v) ? v : undefined);

/** Normaliza los filtros del querystring (lo inválido se ignora). */
export function subFiltersFrom(sp: SubFilterInput) {
  return {
    status: oneOf(SUB_STATUS_FILTERS, sp.status), plan: oneOf(SUB_PLAN_FILTERS, sp.plan), billing: oneOf(SUB_BILLING_FILTERS, sp.billing),
    q: sp.q?.trim().slice(0, 80) || undefined, page: Math.max(1, Number(sp.page) || 1),
  };
}

const STATUS_ES: Record<string, string> = { active: "Activa", trialing: "Prueba", past_due: "Pago pendiente", canceled: "Cancelada", cancelled: "Cancelada", incomplete: "Incompleta", expired: "Vencida", unpaid: "Impaga" };

/** Celda CSV segura: comillas escapadas y sin fórmulas (=, +, -, @) que Excel ejecutaría. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type CsvSub = SubRow & { name: string | null; email: string | null; planLabel: string; monthly: number };

export function subsCsv(rows: CsvSub[]): string {
  const head = ["Usuario", "Correo", "ID usuario", "Plan", "Estado", "Desde", "Último cobro", "Renueva o termina", "Cancelada el", "MRR (USD)", "Cliente ONVO", "Suscripción ONVO"];
  const day = (s?: string | null) => (s ? crDay(s) : "");
  const lines = rows.map((r) => [
    r.name, r.email, r.user_id, r.planLabel, STATUS_ES[r.status ?? ""] ?? r.status, day(r.created_at), day(r.current_period_start), day(r.current_period_end), day(r.canceled_at),
    r.status === "active" ? r.monthly.toFixed(2) : "", r.provider_customer_id, r.provider_subscription_id,
  ].map(csvCell).join(","));
  // BOM para que Excel abra el UTF-8 con tildes correctas.
  return "﻿" + [head.map(csvCell).join(","), ...lines].join("\r\n") + "\r\n";
}
