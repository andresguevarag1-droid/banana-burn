import Link from "next/link";
import { Download, ExternalLink, Undo2 } from "lucide-react";
import { requireSection } from "@/lib/admin-auth";
import { listSubscriptions, PAGE_SIZE } from "@/lib/admin";
import { SUB_BILLING_FILTERS, SUB_PLAN_FILTERS, SUB_STATUS_FILTERS, subFiltersFrom, type SubFilterInput } from "@/lib/admin-csv";
import { CopyButton } from "@/components/admin/copy-button";
import { DemoNotice, Empty, Field, Kpi, Nil, Notice, PageHeader, Pagination, SubStatus, Table, Td, Th, fmtDate, fmtDateTime, fmtNum, fmtPct, inputSm, money } from "@/components/admin/ui";

export const metadata = { title: "Pagos" };

const PLAN_KEY: Record<string, string> = { "entreno·mes": "Entreno mensual", "entreno·anual": "Entreno anual", "completo·mes": "Entreno + Nutrición mensual", "completo·anual": "Entreno + Nutrición anual", "desconocido·mes": "Sin plan identificado", "desconocido·anual": "Sin plan identificado (anual)" };
const ONVO_DASHBOARD = "https://dashboard.onvopay.com";

export default async function Pagos({ searchParams }: { searchParams: Promise<SubFilterInput> }) {
  const v = await requireSection("pagos");
  const f = subFiltersFrom(await searchParams);
  const d = await listSubscriptions(v, f);
  const s = d.summary;
  const params = { status: f.status, plan: f.plan, billing: f.billing, q: f.q };
  const filtered = !!(f.status || f.plan || f.billing || f.q);
  const qs = new URLSearchParams(Object.entries(params).filter((x): x is [string, string] => !!x[1])).toString();
  const filterLabel = SUB_STATUS_FILTERS.find(([k]) => k === (f.status ?? ""))?.[1].toLowerCase();

  return (
    <div className="space-y-8">
      <PageHeader title="Pagos" desc="Suscripciones cobradas con ONVO: ingresos, fallos de cobro y renovaciones.">
        <a href={ONVO_DASHBOARD} target="_blank" rel="noopener noreferrer" className="btn-ghost h-10! px-4! text-sm! inline-flex items-center gap-2">Panel de ONVO<ExternalLink className="size-4" aria-hidden /><span className="sr-only">(abre en otra pestaña)</span></a>
      </PageHeader>
      {v.demo && <DemoNotice what="las suscripciones" />}

      <section aria-labelledby="p-resumen" className="space-y-3">
        <h2 id="p-resumen" className="eyebrow">Resumen de ingresos</h2>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <Kpi label="MRR estimado" value={money(s.mrr)} hint={`ARR ${money(s.arr)}`} />
          <Kpi label="Activas" value={fmtNum(s.active)} hint={`${fmtNum(s.trialing)} en prueba`} />
          <Kpi label="Pago pendiente" value={fmtNum(s.past_due)} tone={s.past_due ? "bad" : "muted"} hint={s.past_due ? "requieren seguimiento" : "todo al día"} />
          <Kpi label="Churn 30 d" value={fmtPct(s.churn.rate)} hint={`${fmtNum(s.churn.lost)} cancelaciones de ${fmtNum(s.churn.base)}`} />
          <Kpi label="Renuevan en 7 d" value={fmtNum(s.renewing7)} hint="activas sin cancelación programada" />
        </div>
        {Object.keys(s.byPlan).length > 0 ? (
          <Table caption="MRR por plan y periodicidad" minWidth={480}>
            <thead className="border-b border-line"><tr><Th>Plan</Th><Th className="text-right">Activas</Th><Th className="text-right">MRR</Th><Th className="text-right">% del MRR</Th></tr></thead>
            <tbody>{Object.entries(s.byPlan).sort((a, b) => b[1].mrr - a[1].mrr).map(([k, x]) => (
              <tr key={k} className="border-b border-line last:border-0"><Td className="text-ink font-semibold">{PLAN_KEY[k] ?? k}</Td><Td className="text-right tabular-nums">{fmtNum(x.n)}</Td><Td className="text-right tabular-nums">{money(x.mrr)}</Td><Td className="text-right tabular-nums text-muted">{fmtPct(s.mrr ? Math.round((x.mrr / s.mrr) * 100) : 0)}</Td></tr>
            ))}</tbody>
          </Table>
        ) : <div className="card"><Empty title="Sin ingresos recurrentes">Cuando haya suscripciones activas verás aquí el MRR por plan.</Empty></div>}
      </section>

      <section aria-labelledby="p-fallos" className="space-y-3">
        <h2 id="p-fallos" className="eyebrow">Pagos fallidos</h2>
        {d.failed.length ? (
          <Table caption="Suscripciones con cobro fallido o pendiente" captionHidden minWidth={680}>
            <thead className="border-b border-line"><tr><Th>Usuario</Th><Th>Plan</Th><Th>Estado</Th><Th>Venció</Th><Th className="text-right">Monto del periodo</Th><Th><span className="sr-only">Acciones</span></Th></tr></thead>
            <tbody>{d.failed.map((x, i) => (
              <tr key={String(x.id ?? i)} className="border-b border-line last:border-0">
                <Td>{x.user_id ? <Link href={`/admin/usuarios/${x.user_id}`} className="font-semibold text-ink underline underline-offset-2">{x.name ?? "Usuario"}</Link> : <Nil />}{x.email && <p className="text-xs text-muted">{x.email}</p>}</Td>
                <Td>{x.planLabel}</Td><Td><SubStatus status={x.status} /></Td><Td className="tabular-nums text-muted whitespace-nowrap">{fmtDate(x.current_period_end)}</Td>
                <Td className="text-right tabular-nums">{money(x.period)}</Td>
                <Td className="text-right">{x.provider_subscription_id ? <CopyButton value={x.provider_subscription_id} label="ID de suscripción ONVO" /> : null}</Td>
              </tr>))}</tbody>
          </Table>
        ) : <div className="card"><Empty title="Sin pagos fallidos">Todas las renovaciones se cobraron. 🎉</Empty></div>}
        {d.payments && d.payments.length > 0 && (
          <Table caption="Últimos cobros rechazados" minWidth={600}>
            <thead className="border-b border-line"><tr><Th>Fecha</Th><Th>Usuario</Th><Th className="text-right">Monto</Th><Th>Motivo</Th></tr></thead>
            <tbody>{d.payments.map((p) => (
              <tr key={String(p.id)} className="border-b border-line last:border-0"><Td className="tabular-nums whitespace-nowrap">{fmtDateTime(p.created_at)}</Td><Td>{p.user_id ? <Link href={`/admin/usuarios/${p.user_id}`} className="font-semibold text-ink underline underline-offset-2">{p.name ?? "Ver ficha"}</Link> : <Nil />}</Td><Td className="text-right tabular-nums">{typeof p.amount === "number" ? money(p.amount) : <Nil />}</Td><Td className="text-muted">{p.failure_reason ?? p.status ?? <Nil />}</Td></tr>
            ))}</tbody>
          </Table>
        )}
      </section>

      <section aria-labelledby="p-lista" className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="p-lista" className="eyebrow">Todas las suscripciones</h2>
          <div className="flex flex-wrap items-center gap-2">
            {d.total > 0 && <a href={`/admin/pagos/exportar${qs ? `?${qs}` : ""}`} className="btn-ghost h-10! px-4! text-sm! inline-flex items-center gap-2" download><Download className="size-4" aria-hidden />Exportar CSV ({fmtNum(d.total)})</a>}
            <span className="inline-flex flex-wrap items-center gap-2">
              <button type="button" disabled aria-describedby="refund-note" className="btn-ghost h-10! px-4! text-sm! inline-flex items-center gap-2 opacity-50 cursor-not-allowed"><Undo2 className="size-4" aria-hidden />Reembolsar</button>
              <span id="refund-note" className="text-xs text-muted">Reembolsos desde el <a href={ONVO_DASHBOARD} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline underline-offset-2">panel de ONVO</a></span>
            </span>
          </div>
        </div>
        <form className="card p-4 grid gap-3 grid-cols-2 md:grid-cols-5 items-end" aria-label="Filtrar suscripciones">
          <Field label="Buscar" htmlFor="p-q" className="col-span-2"><input id="p-q" name="q" type="search" defaultValue={f.q} placeholder="Nombre, correo o ID de ONVO" className={inputSm} /></Field>
          <Field label="Estado" htmlFor="p-status"><select id="p-status" name="status" defaultValue={f.status ?? ""} className={inputSm}>{SUB_STATUS_FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Plan" htmlFor="p-plan"><select id="p-plan" name="plan" defaultValue={f.plan ?? ""} className={inputSm}>{SUB_PLAN_FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Periodicidad" htmlFor="p-billing"><select id="p-billing" name="billing" defaultValue={f.billing ?? ""} className={inputSm}>{SUB_BILLING_FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <div className="col-span-2 md:col-span-5 flex justify-end gap-2">
            {filtered && <Link href="/admin/pagos" className="btn-ghost h-10! px-4! text-sm!">Limpiar</Link>}
            <button className="btn-primary h-10! px-5! text-sm!">Filtrar</button>
          </div>
        </form>
        {d.rows.length > 0 ? (
          <Table caption={`Suscripciones (${fmtNum(d.total)})`} captionHidden minWidth={1080}>
            <thead className="border-b border-line"><tr><Th>Usuario</Th><Th>Plan</Th><Th>Estado</Th><Th>Desde</Th><Th>Último cobro</Th><Th>Renueva o termina</Th><Th className="text-right">MRR</Th><Th>ONVO</Th><Th><span className="sr-only">Acciones</span></Th></tr></thead>
            <tbody>{d.rows.map((x, i) => (
              <tr key={String(x.id ?? i)} className="border-b border-line last:border-0 hover:bg-paper/60 align-top">
                <Td>{x.user_id ? <Link href={`/admin/usuarios/${x.user_id}`} className="font-semibold text-ink hover:underline underline-offset-2">{x.name ?? "Usuario"}</Link> : <Nil />}{x.email && <p className="text-xs text-muted">{x.email}</p>}</Td>
                <Td className="whitespace-nowrap">{x.planLabel}</Td><Td><SubStatus status={x.status} /></Td>
                <Td className="tabular-nums text-muted whitespace-nowrap">{fmtDate(x.created_at)}</Td>
                <Td className="tabular-nums text-muted whitespace-nowrap">{x.current_period_start ? fmtDate(x.current_period_start) : <Nil />}</Td>
                <Td className="tabular-nums text-muted whitespace-nowrap">
                  {x.status === "trialing" ? `Prueba hasta ${fmtDate(x.current_period_end)}`
                    : x.status === "canceled" || x.status === "cancelled" ? <>Cancelada {fmtDate(x.canceled_at ?? x.updated_at)}<span className="block text-xs">acceso hasta {fmtDate(x.current_period_end)}</span></>
                    : fmtDate(x.current_period_end)}
                </Td>
                <Td className="text-right tabular-nums">{x.status === "active" ? money(x.monthly) : <Nil />}</Td>
                <Td>
                  <div className="space-y-1">
                    {x.provider_customer_id ? <CopyButton value={x.provider_customer_id} label="ID de cliente ONVO" /> : null}
                    {x.provider_subscription_id ? <CopyButton value={x.provider_subscription_id} label="ID de suscripción ONVO" /> : null}
                    {!x.provider_customer_id && !x.provider_subscription_id && <Nil />}
                  </div>
                </Td>
                <Td className="text-right">{x.user_id && <Link href={`/admin/usuarios/${x.user_id}`} className="text-sm font-semibold text-ink underline underline-offset-2 whitespace-nowrap" aria-label={`Ver ficha de ${x.name ?? "usuario"}`}>Ver ficha</Link>}</Td>
              </tr>))}</tbody>
          </Table>
        ) : (
          <div className="card">
            {filtered
              ? <Empty title="Sin resultados" action={<Link href="/admin/pagos" className="btn-ghost h-10! px-4! text-sm!">Limpiar filtros</Link>}>No hay suscripciones {f.status ? `con estado ${filterLabel}` : ""} que coincidan con estos filtros.</Empty>
              : <Empty title="Todavía no hay suscripciones">Aparecen aquí cuando alguien paga un plan con ONVO.</Empty>}
          </div>
        )}
        <Pagination page={f.page} total={d.total} pageSize={PAGE_SIZE} basePath="/admin/pagos" params={params} />
      </section>
      <Notice title="Cómo se calcula">MRR: suscripciones activas con su precio mensual, o el anual dividido entre 12. Churn 30 d: cancelaciones en la ventana dividido entre los suscriptores pagos al inicio. Mensual renueva un mes después del último cobro; anual, un año después.</Notice>
    </div>
  );
}
