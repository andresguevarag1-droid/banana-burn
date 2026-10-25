import Link from "next/link";
import { requireSection } from "@/lib/admin-auth";
import { loadAdminAffiliates } from "@/lib/admin-affiliates";
import { ActionForm, ConfirmAction, Submit } from "@/components/admin/action-form";
import { CopyButton } from "@/components/admin/copy-button";
import { Badge, DemoNotice, Empty, Field, Kpi, Notice, PageHeader, SectionHeading, Table, Td, Th, btnGhost, fmtDate, fmtNum, inputSm, link, money, panel, tr } from "@/components/admin/ui";
import { commissionLine, type AffSettings } from "@/lib/affiliates";
import { assignAffiliate, cancelPayoutAction, inviteAffiliate, markPaidAction, runPayoutsAction, saveAffiliateSettings } from "./actions";

export const metadata = { title: "Referidores" };
export const dynamic = "force-dynamic";

const usd = (minor: number) => money(minor / 100);
const today = () => new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 10);

export default async function Referidores() {
  const v = await requireSection("referidores");
  const d = await loadAdminAffiliates(v.demo);
  const s = d.settings;
  const open = d.payouts.filter((p) => p.status === "pendiente");
  const tot = d.affiliates.reduce((a, x) => ({ pending: a.pending + x.pending, available: a.available + x.available, paid: a.paid + x.paid, active: a.active + x.active_count }), { pending: 0, available: 0, paid: 0, active: 0 });
  return (
    <div className="space-y-8">
      <PageHeader title="Referidores" desc="Personas que invitaste a recomendar Banana Burn. Ganan un porcentaje de lo que pagan sus referidos (sin impuestos ni comisión del procesador). Solo tú puedes invitar, asignar y pagar." />
      {d.demo && <DemoNotice what="estos referidores y pagos" />}
      {d.unavailable && <Notice tone="warn" title="Falta configurar">Aplica la migración 0051_referidores.sql en Supabase y revisa SUPABASE_SERVICE_ROLE_KEY.</Notice>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Referidos pagando" value={fmtNum(tot.active)} />
        <Kpi label="En espera" value={usd(tot.pending)} hint={`${s.hold_days} días por reembolsos`} />
        <Kpi label="Disponible para pagar" value={usd(tot.available)} />
        <Kpi label="Pagado" value={usd(tot.paid)} />
      </div>

      <section className="space-y-3">
        <SectionHeading id="lista" title="Referidores" />
        {d.affiliates.length === 0 ? <Empty title="Todavía no hay referidores">Invita al primero con su correo, o asigna el rol a una cuenta que ya existe.</Empty> : (
          <Table caption="Referidores" captionHidden minWidth={980}>
            <thead className="border-b border-line"><tr><Th>Referidor</Th><Th>Código</Th><Th className="text-right">Pagando</Th><Th>Nivel</Th><Th className="text-right">Registros</Th><Th className="text-right">Clics (180 d)</Th><Th className="text-right">En espera</Th><Th className="text-right">Disponible</Th><Th className="text-right">Pagado</Th><Th>Pago</Th></tr></thead>
            <tbody>
              {d.affiliates.map((a) => (
                <tr key={a.userId} className={tr}>
                  <Td><Link href={`/admin/referidores/${a.userId}`} className={link}>{a.name}</Link><div className="text-xs text-muted">{a.email}</div>{!a.active && <Badge tone="bad">Revocado</Badge>}</Td>
                  <Td><code className="text-xs">{a.code}</code></Td>
                  <Td className="text-right tabular-nums">{fmtNum(a.active_count)}</Td>
                  <Td>{a.rate ? <Badge tone={a.rate >= 40 ? "good" : "muted"}>{a.rate} %{a.perk ? ", app gratis" : ""}</Badge> : <span className="text-xs text-muted">Sin nivel</span>}</Td>
                  <Td className="text-right tabular-nums">{fmtNum(a.signups)}</Td>
                  <Td className="text-right tabular-nums">{fmtNum(a.clicks)}</Td>
                  <Td className="text-right tabular-nums">{usd(a.pending)}</Td>
                  <Td className="text-right tabular-nums">{usd(a.available)}</Td>
                  <Td className="text-right tabular-nums">{usd(a.paid)}</Td>
                  <Td className="text-xs">{a.method ?? <span className="text-muted">Sin método</span>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className={`${panel} p-5`}>
          <h2 className="font-extrabold text-ink">Invitar por correo</h2>
          <p className="mt-1 text-sm text-muted">Enlace de un solo uso que vence en 14 días. Al abrirlo con ese correo (registrándose o entrando), la cuenta queda como referidor.</p>
          <ActionForm action={inviteAffiliate} className="mt-3 grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end" resetOnSuccess>
            <Field label="Correo" htmlFor="inv-email"><input id="inv-email" name="email" type="email" required className={inputSm} autoComplete="off" /></Field>
            <Field label="Código (opcional)" htmlFor="inv-code"><input id="inv-code" name="code" className={inputSm} placeholder="carla-fit" maxLength={20} /></Field>
            <Submit>Crear enlace</Submit>
          </ActionForm>
          {d.invites.length > 0 && (
            <ul className="mt-4 divide-y divide-line text-sm">
              {d.invites.slice(0, 8).map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate">{i.email}{i.code ? <span className="text-muted"> ({i.code})</span> : null}</span>
                  {i.usedAt ? <Badge tone="good">Aceptada {fmtDate(i.usedAt)}</Badge> : i.canceledAt ? <Badge>Anulada</Badge> : Date.parse(i.expiresAt) < Date.now() ? <Badge tone="warn">Vencida</Badge> : <Badge>Vence {fmtDate(i.expiresAt)}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={`${panel} p-5`}>
          <h2 className="font-extrabold text-ink">Asignar a una cuenta existente</h2>
          <p className="mt-1 text-sm text-muted">Para alguien que ya tiene cuenta en Banana Burn. Le llega un correo de bienvenida al programa.</p>
          <ActionForm action={assignAffiliate} className="mt-3 grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end" resetOnSuccess>
            <Field label="Correo de la cuenta" htmlFor="as-email"><input id="as-email" name="email" type="email" required className={inputSm} autoComplete="off" /></Field>
            <Field label="Código (opcional)" htmlFor="as-code"><input id="as-code" name="code" className={inputSm} placeholder="diego-run" maxLength={20} /></Field>
            <Submit>Asignar</Submit>
          </ActionForm>
          <p className="mt-3 text-xs text-muted">También puedes asignarlo desde la ficha del usuario, en Usuarios.</p>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading id="pagos" title="Pagos del mes" desc={`Se genera un pago por referidor con saldo disponible de ${usd(s.min_payout_minor)} o más y un método de pago guardado. Pagas por SINPE Móvil o transferencia y lo marcas con la referencia.`}
          action={<div className="flex flex-wrap gap-2"><ConfirmAction action={runPayoutsAction} trigger="Generar pagos del mes" title="Generar los pagos del mes" description="Agrupa el saldo disponible de cada referidor en un pago pendiente. No mueve dinero: solo prepara la lista para que pagues." hidden={{}} confirmLabel="Generar" /><a href="/admin/referidores/pagos.csv" className={btnGhost}>Exportar CSV</a></div>} />
        {open.length === 0 ? <Empty title="No hay pagos pendientes">Cuando generes los pagos del mes, aparecen aquí con el método de pago para copiar.</Empty> : (
          <div className="grid gap-3 lg:grid-cols-2">
            {open.map((p) => (
              <div key={p.id} className={`${panel} p-4`}>
                <div className="flex items-baseline justify-between gap-2"><p className="font-extrabold text-ink">{p.name}</p><p className="text-lg font-extrabold tabular-nums text-ink">{usd(p.amount)}</p></div>
                <p className="text-xs text-muted">Periodo {p.period}</p>
                <dl className="mt-2 space-y-1 text-sm">
                  {p.method.kind === "sinpe" ? <div className="flex items-center justify-between gap-2"><dt className="text-muted">SINPE Móvil</dt><dd><CopyButton value={p.method.sinpe_phone ?? ""} label="número de SINPE" /></dd></div>
                    : <div className="flex items-center justify-between gap-2"><dt className="text-muted">IBAN</dt><dd><CopyButton value={p.method.iban ?? ""} label="IBAN" /></dd></div>}
                  <div className="flex items-center justify-between gap-2"><dt className="text-muted">Titular</dt><dd><CopyButton value={p.method.holder_name ?? ""} label="titular" /></dd></div>
                  {p.method.id_number ? <div className="flex items-center justify-between gap-2"><dt className="text-muted">Identificación</dt><dd><CopyButton value={p.method.id_number} label="identificación" /></dd></div> : null}
                </dl>
                <ActionForm action={markPaidAction} className="mt-3 grid gap-2 sm:grid-cols-[1fr_9.5rem_auto] sm:items-end">
                  <input type="hidden" name="payout" value={p.id} />
                  <Field label="Referencia" htmlFor={`ref-${p.id}`}><input id={`ref-${p.id}`} name="reference" required className={inputSm} placeholder="Número de SINPE o transferencia" /></Field>
                  <Field label="Fecha" htmlFor={`date-${p.id}`}><input id={`date-${p.id}`} name="paid_on" type="date" required defaultValue={today()} className={inputSm} /></Field>
                  <Submit>Marcar pagado</Submit>
                </ActionForm>
                <div className="mt-2"><ConfirmAction action={cancelPayoutAction} trigger="Anular" title="Anular este pago" description="El saldo vuelve a quedar disponible para el próximo mes." hidden={{ payout: p.id }} confirmLabel="Anular" danger /></div>
              </div>
            ))}
          </div>
        )}
        {d.payouts.some((p) => p.status === "pagado") && (
          <Table caption="Pagos hechos" minWidth={640}>
            <thead className="border-b border-line"><tr><Th>Referidor</Th><Th>Periodo</Th><Th className="text-right">Monto</Th><Th>Referencia</Th><Th>Pagado el</Th></tr></thead>
            <tbody>{d.payouts.filter((p) => p.status === "pagado").slice(0, 30).map((p) => <tr key={p.id} className={tr}><Td>{p.name}</Td><Td>{p.period}</Td><Td className="text-right tabular-nums">{usd(p.amount)}</Td><Td className="text-xs">{p.reference}</Td><Td>{p.paidAt ? fmtDate(p.paidAt) : ""}</Td></tr>)}</tbody>
          </Table>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeading id="ajustes" title="Ajustes del programa" desc="Aplican a los pagos nuevos. Comisiones de ONVO y Tilopay e IVA 13 % incluido en el precio: confirmados (oct 2026)." />
        <Example s={s} />
        <div className={`${panel} p-5`}>
          <ActionForm action={saveAffiliateSettings} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="ONVO: comisión (%)" htmlFor="onvo_fee_pct"><input id="onvo_fee_pct" name="onvo_fee_pct" type="number" step="0.01" min="0" max="20" defaultValue={s.onvo_fee_pct} className={inputSm} /></Field>
            <Field label="ONVO: fijo por cobro ($)" htmlFor="onvo_fee_fixed"><input id="onvo_fee_fixed" name="onvo_fee_fixed" type="number" step="0.01" min="0" max="5" defaultValue={(s.onvo_fee_fixed_minor / 100).toFixed(2)} className={inputSm} /></Field>
            <Field label="Tilopay: comisión (%)" htmlFor="tilopay_fee_pct"><input id="tilopay_fee_pct" name="tilopay_fee_pct" type="number" step="0.01" min="0" max="20" defaultValue={s.tilopay_fee_pct} className={inputSm} /></Field>
            <Field label="Tilopay: fijo por cobro ($)" htmlFor="tilopay_fee_fixed"><input id="tilopay_fee_fixed" name="tilopay_fee_fixed" type="number" step="0.01" min="0" max="5" defaultValue={(s.tilopay_fee_fixed_minor / 100).toFixed(2)} className={inputSm} /></Field>
            <Field label="Impuesto incluido en el precio (%)" htmlFor="tax_pct" hint="IVA de Costa Rica: 13 %"><input id="tax_pct" name="tax_pct" type="number" step="0.01" min="0" max="40" defaultValue={s.tax_pct} className={inputSm} /></Field>
            <Field label="Días de espera" htmlFor="hold_days" hint="Por reembolsos"><input id="hold_days" name="hold_days" type="number" min="0" max="120" defaultValue={s.hold_days} className={inputSm} /></Field>
            <Field label="Pago mínimo ($)" htmlFor="min_payout"><input id="min_payout" name="min_payout" type="number" step="0.01" min="0" max="1000" defaultValue={(s.min_payout_minor / 100).toFixed(2)} className={inputSm} /></Field>
            <Field label="Días que dura el enlace" htmlFor="cookie_days"><input id="cookie_days" name="cookie_days" type="number" min="1" max="365" defaultValue={s.cookie_days} className={inputSm} /></Field>
            {s.tiers.slice(0, 4).map((t, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <Field label={`Nivel ${i + 1}: desde`} htmlFor={`tier${i + 1}_min`}><input id={`tier${i + 1}_min`} name={`tier${i + 1}_min`} type="number" min="1" defaultValue={t.min} className={inputSm} /></Field>
                <Field label="%" htmlFor={`tier${i + 1}_rate`}><input id={`tier${i + 1}_rate`} name={`tier${i + 1}_rate`} type="number" min="1" max="100" step="0.5" defaultValue={t.rate} className={inputSm} /></Field>
              </div>
            ))}
            <div className="sm:col-span-2 lg:col-span-4"><p className="mb-2 text-xs text-muted">El último nivel también da el acceso gratis a la app mientras el referidor se mantenga ahí.</p><Submit>Guardar ajustes</Submit></div>
          </ActionForm>
        </div>
      </section>
    </div>
  );
}

/** Ejemplo con los ajustes actuales: Entreno mensual de $9.99 pagado con ONVO, en cada nivel. */
function Example({ s }: { s: AffSettings }) {
  const gross = 999;
  const base = commissionLine({ grossMinor: gross, provider: "onvo", activeCount: 0, settings: s });
  return (
    <div className={`${panel} p-5 text-sm`}>
      <h3 className="font-extrabold text-ink">Ejemplo: Entreno mensual de {usd(gross)} pagado con ONVO</h3>
      <dl className="mt-2 grid gap-1 sm:max-w-md">
        <div className="flex justify-between gap-2"><dt className="text-muted">Pagó</dt><dd className="tabular-nums">{usd(gross)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted">Sin IVA ({usd(gross)} / {1 + s.tax_pct / 100})</dt><dd className="tabular-nums">{usd(gross - base.tax)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted">Menos ONVO ({s.onvo_fee_pct} % de {usd(gross)} + {usd(s.onvo_fee_fixed_minor)})</dt><dd className="tabular-nums">−{usd(base.fee)}</dd></div>
        <div className="flex justify-between gap-2 border-t border-line pt-1 font-bold text-ink"><dt>Base de la comisión</dt><dd className="tabular-nums">{usd(base.net)}</dd></div>
      </dl>
      <p className="mt-3 text-muted">Comisión por ese pago: {s.tiers.slice(0, 4).map((t) => { const c = commissionLine({ grossMinor: gross, provider: "onvo", activeCount: t.min, settings: s }); return `${c.rate} % = ${usd(c.commission)}`; }).join(", ")}. Se redondea hacia abajo al centavo.</p>
    </div>
  );
}
