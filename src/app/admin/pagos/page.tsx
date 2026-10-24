import Link from "next/link";
import { CaretRight, DownloadSimple as Download, ArrowSquareOut as ExternalLink } from "@/components/icons";
import { requireSection } from "@/lib/admin-auth";
import { listSubscriptions, PAGE_SIZE } from "@/lib/admin";
import { SUB_BILLING_FILTERS, SUB_PLAN_FILTERS, SUB_STATUS_FILTERS, subFiltersFrom, type SubFilterInput } from "@/lib/admin-csv";
import { CopyButton } from "@/components/admin/copy-button";
import { DemoNotice, Empty, Field, FilterBar, Kpi, MetaList, Nil, Notice, PageHeader, Pagination, PlanText, SectionHeading, SubStatus, Table, Td, Th, btnGhost, fmtDate, fmtDateTime, fmtNum, fmtPct, fw, inputSm, link, money, panel, tr, trHover } from "@/components/admin/ui";

export const metadata = { title: "Pagos" };

const PLAN_KEY: Record<string, string> = { "entreno:mes": "Entreno mensual", "entreno:anual": "Entreno anual", "completo:mes": "Entreno + Nutrición mensual", "completo:anual": "Entreno + Nutrición anual", "desconocido:mes": "Sin plan identificado", "desconocido:anual": "Sin plan identificado (anual)" };
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
    <div className="space-y-7">
      <PageHeader title="Pagos" desc="Suscripciones cobradas con ONVO: ingresos, fallos de cobro y renovaciones. Los reembolsos se hacen en el panel de ONVO.">
        <a href={ONVO_DASHBOARD} target="_blank" rel="noopener noreferrer" className={btnGhost}>Panel de ONVO<ExternalLink className="size-4" aria-hidden /><span className="sr-only">(abre en otra pestaña)</span></a>
      </PageHeader>
      {v.demo && <DemoNotice what="las suscripciones" />}

      <section aria-labelledby="p-resumen" className="space-y-2.5">
        <SectionHeading id="p-resumen" title="Ingresos" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5 [&>:last-child]:col-span-2 lg:[&>:last-child]:col-span-1">
          <Kpi label="MRR estimado" value={money(s.mrr)} hint={`ARR ${money(s.arr)}`} />
          <Kpi label="Activas" value={fmtNum(s.active)} hint={`${fmtNum(s.trialing)} en prueba`} />
          <Kpi label="Pago pendiente" value={fmtNum(s.past_due)} tone={s.past_due ? "bad" : "muted"} hint={s.past_due ? "requieren seguimiento" : "todo al día"} />
          <Kpi label="Churn 30 d" value={fmtPct(s.churn.rate)} hint={`${fmtNum(s.churn.lost)} cancelaciones de ${fmtNum(s.churn.base)}`} />
          <Kpi label="Renuevan en 7 d" value={fmtNum(s.renewing7)} hint="activas sin cancelación programada" />
        </div>
        {Object.keys(s.byPlan).length > 0 ? (
          <Table caption="MRR por plan y periodicidad" minWidth={440}>
            <thead className="border-b border-line"><tr><Th>Plan</Th><Th className="text-right">Activas</Th><Th className="text-right">MRR</Th><Th className="text-right">% del MRR</Th></tr></thead>
            <tbody>{Object.entries(s.byPlan).sort((a, b) => b[1].mrr - a[1].mrr).map(([k, x]) => (
              <tr key={k} className={tr}><Td className="text-ink">{PLAN_KEY[k] ?? k}</Td><Td className="text-right">{fmtNum(x.n)}</Td><Td className="text-right">{money(x.mrr)}</Td><Td className="text-right text-muted">{fmtPct(s.mrr ? Math.round((x.mrr / s.mrr) * 100) : 0)}</Td></tr>
            ))}</tbody>
          </Table>
        ) : <Empty title="Sin ingresos recurrentes">Cuando haya suscripciones activas verás aquí el MRR por plan.</Empty>}
      </section>

      <section aria-labelledby="p-fallos" className="space-y-2.5">
        <SectionHeading id="p-fallos" title="Pagos fallidos" />
        {d.failed.length ? (
          <Table caption="Suscripciones con cobro fallido o pendiente" captionHidden minWidth={640}>
            <thead className="border-b border-line"><tr><Th>Usuario</Th><Th>Plan</Th><Th>Estado</Th><Th>Venció</Th><Th className="text-right">Monto del periodo</Th><Th><span className="sr-only">Acciones</span></Th></tr></thead>
            <tbody>{d.failed.map((x, i) => (
              <tr key={String(x.id ?? i)} className={tr}>
                <Td>{x.user_id ? <Link href={`/admin/usuarios/${x.user_id}`} className={link}>{x.name ?? "Usuario"}</Link> : <Nil />}{x.email && <p className="text-xs text-muted">{x.email}</p>}</Td>
                <Td><PlanText label={x.planLabel} /></Td><Td><SubStatus status={x.status} /></Td><Td className="text-muted whitespace-nowrap">{fmtDate(x.current_period_end)}</Td>
                <Td className="text-right">{money(x.period)}</Td>
                <Td className="text-right">{x.provider_subscription_id ? <CopyButton value={x.provider_subscription_id} label="ID de suscripción ONVO" /> : null}</Td>
              </tr>))}</tbody>
          </Table>
        ) : <Empty title="Sin pagos fallidos">Todas las renovaciones se cobraron.</Empty>}
        {d.payments && d.payments.length > 0 && (
          <Table caption="Últimos cobros rechazados" minWidth={600}>
            <thead className="border-b border-line"><tr><Th>Fecha</Th><Th>Usuario</Th><Th className="text-right">Monto</Th><Th>Motivo</Th></tr></thead>
            <tbody>{d.payments.map((p) => (
              <tr key={String(p.id)} className={tr}><Td className="whitespace-nowrap">{fmtDateTime(p.created_at)}</Td><Td>{p.user_id ? <Link href={`/admin/usuarios/${p.user_id}`} className={link}>{p.name ?? "Ver ficha"}</Link> : <Nil />}</Td><Td className="text-right">{typeof p.amount === "number" ? money(p.amount) : <Nil />}</Td><Td className="text-muted">{p.failure_reason ?? p.status ?? <Nil />}</Td></tr>
            ))}</tbody>
          </Table>
        )}
      </section>

      <section aria-labelledby="p-lista" className="space-y-2.5">
        <SectionHeading id="p-lista" title="Todas las suscripciones"
          action={d.total > 0 && <a href={`/admin/pagos/exportar${qs ? `?${qs}` : ""}`} className={btnGhost} download><Download className="size-4" aria-hidden />Exportar CSV <span className="tabular-nums text-muted">({fmtNum(d.total)})</span></a>} />
        <FilterBar label="Filtrar suscripciones" filtered={filtered} clearHref="/admin/pagos">
          <Field label="Buscar" htmlFor="p-q" className={fw.search}><input id="p-q" name="q" type="search" defaultValue={f.q} placeholder="Nombre, correo o ID de ONVO" className={inputSm} /></Field>
          <Field label="Estado" htmlFor="p-status" className={fw.select}><select id="p-status" name="status" defaultValue={f.status ?? ""} className={inputSm}>{SUB_STATUS_FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Plan" htmlFor="p-plan" className={fw.select}><select id="p-plan" name="plan" defaultValue={f.plan ?? ""} className={inputSm}>{SUB_PLAN_FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Periodicidad" htmlFor="p-billing" className={fw.select}><select id="p-billing" name="billing" defaultValue={f.billing ?? ""} className={inputSm}>{SUB_BILLING_FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        </FilterBar>
        {d.rows.length > 0 ? (<>
          <ul className={`${panel} divide-y divide-line md:hidden`} aria-label={`Suscripciones (${fmtNum(d.total)})`}>
            {d.rows.map((x, i) => {
              const inner = (<>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center justify-between gap-3"><span className="truncate font-semibold text-ink">{x.name ?? "Usuario"}</span><span className="shrink-0 text-sm font-semibold text-ink tabular-nums">{x.status === "active" ? money(x.monthly) : null}</span></p>
                  <p className="truncate text-xs text-muted">{x.planLabel}</p>
                  <MetaList className="mt-1.5" items={[<SubStatus key="s" status={x.status} />, x.status === "trialing" ? `Prueba hasta ${fmtDate(x.current_period_end)}` : x.status === "canceled" || x.status === "cancelled" ? `Acceso hasta ${fmtDate(x.current_period_end)}` : `Renueva ${fmtDate(x.current_period_end)}`]} />
                </div>
                {x.user_id && <CaretRight className="size-4 shrink-0 text-faint" aria-hidden />}
              </>);
              return (
                <li key={String(x.id ?? i)}>
                  {x.user_id
                    ? <Link href={`/admin/usuarios/${x.user_id}`} className="flex items-center gap-3 px-4 py-3 outline-none transition-colors duration-150 hover:bg-paper/50 focus-visible:bg-paper focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-banana/50">{inner}</Link>
                    : <div className="flex items-center gap-3 px-4 py-3">{inner}</div>}
                </li>
              );
            })}
          </ul>
          <Table caption={`Suscripciones (${fmtNum(d.total)})`} captionHidden minWidth={860} className="hidden md:block">
            <thead className="border-b border-line"><tr><Th>Usuario</Th><Th>Plan</Th><Th>Estado</Th><Th>Último cobro</Th><Th>Renueva o termina</Th><Th className="text-right">MRR</Th><Th>IDs de ONVO</Th></tr></thead>
            <tbody>{d.rows.map((x, i) => (
              <tr key={String(x.id ?? i)} className={`${trHover} align-top`}>
                <Td className="max-w-64">{x.user_id ? <Link href={`/admin/usuarios/${x.user_id}`} className="block truncate font-semibold text-ink underline-offset-2 hover:underline rounded outline-none focus-visible:ring-4 focus-visible:ring-banana/50">{x.name ?? "Usuario"}</Link> : <Nil />}{x.email && <p className="truncate text-xs text-muted">{x.email}</p>}</Td>
                <Td><PlanText label={x.planLabel} /></Td><Td><SubStatus status={x.status} /></Td>
                <Td className="text-muted whitespace-nowrap">{x.current_period_start ? fmtDate(x.current_period_start) : <Nil />}<span className="block text-xs">Cliente desde {fmtDate(x.created_at)}</span></Td>
                <Td className="min-w-32 text-muted">
                  {x.status === "trialing" ? `Prueba hasta ${fmtDate(x.current_period_end)}`
                    : x.status === "canceled" || x.status === "cancelled" ? <>Cancelada {fmtDate(x.canceled_at ?? x.updated_at)}<span className="block text-xs">Acceso hasta {fmtDate(x.current_period_end)}</span></>
                    : fmtDate(x.current_period_end)}
                </Td>
                <Td className="text-right">{x.status === "active" ? money(x.monthly) : <Nil />}</Td>
                <Td className="w-40 max-w-40">
                  <div className="-my-1 flex flex-col items-start gap-0.5 min-w-0">
                    {x.provider_customer_id ? <CopyButton value={x.provider_customer_id} label="ID de cliente ONVO" /> : null}
                    {x.provider_subscription_id ? <CopyButton value={x.provider_subscription_id} label="ID de suscripción ONVO" /> : null}
                    {!x.provider_customer_id && !x.provider_subscription_id && <Nil />}
                  </div>
                </Td>
              </tr>))}</tbody>
          </Table>
        </>) : (filtered
          ? <Empty title="Sin resultados" action={<Link href="/admin/pagos" className={btnGhost}>Limpiar filtros</Link>}>No hay suscripciones {f.status ? `con estado ${filterLabel} ` : ""}que coincidan con estos filtros.</Empty>
          : <Empty title="Todavía no hay suscripciones">Aparecen aquí cuando alguien paga un plan con ONVO.</Empty>)}
        <Pagination page={f.page} total={d.total} pageSize={PAGE_SIZE} basePath="/admin/pagos" params={params} />
      </section>
      <Notice title="Cómo se calcula">MRR: suscripciones activas con su precio mensual, o el anual dividido entre 12. Churn 30 d: cancelaciones en la ventana dividido entre los suscriptores pagos al inicio. Mensual renueva un mes después del último cobro; anual, un año después.</Notice>
    </div>
  );
}
