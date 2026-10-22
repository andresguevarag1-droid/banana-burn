import Link from "next/link";
import { requireSection } from "@/lib/admin-auth";
import { listSubscriptions, PAGE_SIZE } from "@/lib/admin";
import { money } from "@/lib/admin-kpis";
import { DemoNotice, Empty, Field, Kpi, Notice, PageHeader, Pagination, SUB_STATUS, SubStatus, Table, Td, Th, fmtDate, fmtDateTime, inputSm } from "@/components/admin/ui";

export const metadata = { title: "Pagos" };

const FILTERS = [["", "Todas"], ["active", "Activas"], ["trialing", "En prueba"], ["fallido", "Con fallo de pago"], ["canceled", "Canceladas"]] as const;
const PLAN_KEY: Record<string, string> = { "entreno·mes": "Entreno mensual", "entreno·anual": "Entreno anual", "completo·mes": "Completo mensual", "completo·anual": "Completo anual", "desconocido·mes": "Sin plan identificado", "desconocido·anual": "Sin plan identificado (anual)" };

export default async function Pagos({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const v = await requireSection("pagos");
  const sp = await searchParams;
  const status = FILTERS.some(([k]) => k === sp.status) ? sp.status : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const d = await listSubscriptions(v, { status, page });
  const s = d.summary;

  return (
    <div className="space-y-8">
      <PageHeader title="Pagos" desc="Suscripciones desde public.subscriptions. Los cobros y webhooks los maneja la integración de pagos (ONVO); aquí solo se consulta." />
      {v.demo && <DemoNotice what="las suscripciones" />}

      <section aria-labelledby="p-resumen" className="space-y-3">
        <h2 id="p-resumen" className="eyebrow">Resumen de ingresos</h2>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <Kpi label="MRR estimado" value={money(s.mrr)} hint={`ARR ${money(s.arr)}`} />
          <Kpi label="Activas" value={s.active} hint={`${s.trialing} en prueba`} />
          <Kpi label="Pago pendiente" value={s.past_due} tone={s.past_due ? "bad" : "muted"} hint={s.past_due ? "requieren seguimiento" : "todo al día"} />
          <Kpi label="Churn 30 d" value={`${s.churn.rate} %`} hint={`${s.churn.lost} cancelaciones / ${s.churn.base} base`} />
          <Kpi label="Renuevan en 7 d" value={s.renewing7} />
        </div>
        {Object.keys(s.byPlan).length > 0 && (
          <Table caption="MRR por plan y periodicidad" minWidth={420}>
            <thead className="border-b border-line"><tr><Th>Plan</Th><Th className="text-right">Suscripciones activas</Th><Th className="text-right">MRR</Th><Th className="text-right">% del MRR</Th></tr></thead>
            <tbody>{Object.entries(s.byPlan).sort((a, b) => b[1].mrr - a[1].mrr).map(([k, x]) => (
              <tr key={k} className="border-b border-line last:border-0"><Td className="text-ink font-semibold">{PLAN_KEY[k] ?? k}</Td><Td className="text-right tabular-nums">{x.n}</Td><Td className="text-right tabular-nums">{money(x.mrr)}</Td><Td className="text-right tabular-nums text-muted">{s.mrr ? Math.round((x.mrr / s.mrr) * 100) : 0} %</Td></tr>
            ))}</tbody>
          </Table>
        )}
      </section>

      <section aria-labelledby="p-fallos" className="space-y-3">
        <h2 id="p-fallos" className="eyebrow">Pagos fallidos</h2>
        {d.failed.length ? (
          <Table caption="Suscripciones con cobro fallido o pendiente" captionHidden minWidth={620}>
            <thead className="border-b border-line"><tr><Th>Usuario</Th><Th>Plan</Th><Th>Estado</Th><Th>Vence</Th><Th className="text-right">Valor mensual</Th></tr></thead>
            <tbody>{d.failed.map((x, i) => (
              <tr key={String(x.id ?? i)} className="border-b border-line last:border-0">
                <Td>{x.user_id ? <Link href={`/admin/usuarios/${x.user_id}`} className="font-semibold text-ink underline underline-offset-2">{x.name ?? "Usuario"}</Link> : "—"}</Td>
                <Td>{x.planLabel}</Td><Td><SubStatus status={x.status} /></Td><Td className="tabular-nums text-muted">{fmtDate(x.current_period_end)}</Td><Td className="text-right tabular-nums">{money(x.monthly)}</Td>
              </tr>))}</tbody>
          </Table>
        ) : <div className="card"><Empty>Sin pagos fallidos. 🎉</Empty></div>}
        {d.payments && d.payments.length > 0 && (
          <Table caption="Últimos cobros rechazados (public.payments)" minWidth={560}>
            <thead className="border-b border-line"><tr><Th>Fecha</Th><Th>Usuario</Th><Th className="text-right">Monto</Th><Th>Motivo</Th></tr></thead>
            <tbody>{d.payments.map((p) => (
              <tr key={String(p.id)} className="border-b border-line last:border-0"><Td className="tabular-nums">{fmtDateTime(p.created_at)}</Td><Td>{p.user_id ? <Link href={`/admin/usuarios/${p.user_id}`} className="underline underline-offset-2">Ver</Link> : "—"}</Td><Td className="text-right tabular-nums">{typeof p.amount === "number" ? money(p.amount) : "—"}</Td><Td className="text-muted">{p.failure_reason ?? p.status ?? "—"}</Td></tr>
            ))}</tbody>
          </Table>
        )}
      </section>

      <section aria-labelledby="p-lista" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <h2 id="p-lista" className="eyebrow">Todas las suscripciones</h2>
          <form className="flex items-end gap-2" aria-label="Filtrar suscripciones">
            <Field label="Estado" htmlFor="p-status"><select id="p-status" name="status" defaultValue={status ?? ""} className={`${inputSm} w-48`}>{FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            <button className="btn-primary h-10! px-4! text-sm!">Aplicar</button>
          </form>
        </div>
        <Table caption={`Suscripciones (${d.total})`} captionHidden minWidth={760}>
          <thead className="border-b border-line"><tr><Th>Usuario</Th><Th>Plan · periodicidad</Th><Th>Estado</Th><Th>Proveedor</Th><Th>Desde</Th><Th>Renueva / termina</Th><Th className="text-right">MRR</Th></tr></thead>
          <tbody>{d.rows.map((x, i) => (
            <tr key={String(x.id ?? i)} className="border-b border-line last:border-0 hover:bg-paper/60">
              <Td>{x.user_id ? <Link href={`/admin/usuarios/${x.user_id}`} className="font-semibold text-ink hover:underline underline-offset-2">{x.name ?? "Usuario"}</Link> : "—"}</Td>
              <Td>{x.planLabel}</Td><Td><SubStatus status={x.status} /></Td><Td className="text-muted">{x.provider ?? "—"}</Td>
              <Td className="tabular-nums text-muted whitespace-nowrap">{fmtDate(x.created_at)}</Td>
              <Td className="tabular-nums text-muted whitespace-nowrap">{x.status === "canceled" ? `Cancelada ${fmtDate(x.canceled_at ?? x.updated_at)}` : fmtDate(x.current_period_end)}</Td>
              <Td className="text-right tabular-nums">{x.status === "active" ? money(x.monthly) : "—"}</Td>
            </tr>))}</tbody>
        </Table>
        {!d.rows.length && <div className="card"><Empty>No hay suscripciones {status ? `con estado “${SUB_STATUS[status]?.[0] ?? FILTERS.find(([k]) => k === status)?.[1]}”` : "todavía"}.</Empty></div>}
        <Pagination page={page} total={d.total} pageSize={PAGE_SIZE} basePath="/admin/pagos" params={{ status }} />
      </section>
      <Notice title="Cómo se calcula">MRR = suscripciones con estado <i>active</i>: precio mensual, o anual ÷ 12 (precios de src/lib/plans.ts, o la columna <code>amount</code> si existe). Churn 30 d = canceladas en la ventana ÷ suscriptores pagos al inicio de la ventana.</Notice>
    </div>
  );
}
