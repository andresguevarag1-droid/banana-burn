import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/admin-auth";
import { loadAdminAffiliate } from "@/lib/admin-affiliates";
import { SITE_URL } from "@/lib/env";
import { ActionForm, ConfirmAction, Submit } from "@/components/admin/action-form";
import { CopyButton } from "@/components/admin/copy-button";
import { Badge, DemoNotice, Empty, Field, Kpi, PageHeader, SectionHeading, Table, Td, Th, fmtDate, fmtNum, inputSm, link, money, panel, tr } from "@/components/admin/ui";
import { adjustAction, reactivateAffiliate, revokeAffiliate, reverseLineAction, setAffiliateCode } from "../actions";

export const metadata = { title: "Referidor" };
export const dynamic = "force-dynamic";

const usd = (minor: number) => money(minor / 100);
const LINE_STATUS: Record<string, { label: string; tone: "good" | "warn" | "bad" | "muted" }> = {
  pending: { label: "En espera", tone: "muted" }, available: { label: "Disponible", tone: "warn" }, paid: { label: "Pagada", tone: "good" }, reversed: { label: "Revertida", tone: "bad" },
};
const REF_STATUS: Record<string, string> = { pagando: "Pagando", pago_fallido: "Pago fallido", cancelado: "Canceló", registrado: "Solo registro" };

export default async function ReferidorDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await requireSection("referidores");
  const d = await loadAdminAffiliate(id, v.demo);
  const a = d.aff;
  if (!a) notFound();
  const url = `${SITE_URL}/?ref=${a.code}`;
  return (
    <div className="space-y-8">
      <p className="text-sm"><Link href="/admin/referidores" className={link}>Referidores</Link></p>
      <PageHeader title={a.name} desc={a.email} />
      {v.demo && <DemoNotice what="este referidor" />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Pagando hoy" value={fmtNum(a.active_count)} hint={a.rate ? `Nivel ${a.level}: ${a.rate} %` : "Sin nivel todavía"} />
        <Kpi label="En espera" value={usd(a.pending)} />
        <Kpi label="Disponible" value={usd(a.available)} />
        <Kpi label="Pagado" value={usd(a.paid)} />
      </div>

      <section className={`${panel} space-y-4 p-5`}>
        <div className="flex flex-wrap items-center gap-2">
          {a.active ? <Badge tone="good">Activo</Badge> : <Badge tone="bad">Revocado {a.revokedAt ? fmtDate(a.revokedAt) : ""}</Badge>}
          {a.perk && <Badge tone="good">App gratis por nivel máximo</Badge>}
          <span className="text-xs text-muted">Referidor desde {fmtDate(a.createdAt)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-muted">Enlace:</span><CopyButton value={url} label="enlace" /></div>
        <p className="text-sm text-muted">Método de pago: {a.method ?? "sin guardar todavía"}</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <ActionForm action={setAffiliateCode} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <input type="hidden" name="target" value={a.userId} />
            <Field label="Código" htmlFor="code" hint="3 a 20: minúsculas, números y guiones. Los enlaces con el código anterior dejan de funcionar."><input id="code" name="code" defaultValue={a.code} required maxLength={20} className={inputSm} /></Field>
            <Submit>Cambiar código</Submit>
          </ActionForm>
          <div className="flex flex-wrap items-end gap-2">
            {a.active ? (
              <ConfirmAction action={revokeAffiliate} trigger="Revocar rol" title="Revocar este referidor" danger confirmLabel="Revocar" hidden={{ target: a.userId }}
                description="Lo ya ganado se mantiene y se paga. Desde ahora no suma referidos ni comisiones nuevas, y pierde la app gratis si la tenía.">
                <Field label="Motivo" htmlFor="rv-reason"><input id="rv-reason" name="reason" required minLength={4} maxLength={300} className={inputSm} /></Field>
              </ConfirmAction>
            ) : (
              <ActionForm action={reactivateAffiliate}><input type="hidden" name="target" value={a.userId} /><Submit>Reactivar</Submit></ActionForm>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading id="referidos" title={`Referidos (${d.referrals.length})`} desc="Solo tú ves los correos. El referidor ve nombre e inicial." />
        {d.referrals.length === 0 ? <Empty title="Todavía no hay referidos">Cuando alguien cree su cuenta desde su enlace, aparece aquí.</Empty> : (
          <Table caption="Referidos" captionHidden minWidth={760}>
            <thead className="border-b border-line"><tr><Th>Persona</Th><Th>Registro</Th><Th>Plan</Th><Th>Estado</Th><Th>Origen</Th></tr></thead>
            <tbody>{d.referrals.map((r) => (
              <tr key={r.userId} className={tr}>
                <Td><Link href={`/admin/usuarios/${r.userId}`} className={link}>{r.name}</Link><div className="text-xs text-muted">{r.email}</div></Td>
                <Td>{fmtDate(r.createdAt)}</Td>
                <Td>{r.plan ?? ""}</Td>
                <Td><Badge tone={r.status === "pagando" ? "good" : r.status === "pago_fallido" ? "warn" : "muted"}>{REF_STATUS[r.status] ?? r.status}</Badge></Td>
                <Td className="text-xs text-muted">{[r.utm.utm_source, r.utm.utm_campaign].filter(Boolean).join(" / ")}</Td>
              </tr>
            ))}</tbody>
          </Table>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeading id="libro" title="Comisiones" desc="Una línea por pago verificado. Base = pagado menos impuesto y comisión del procesador. Si hubo reembolso, revierte la línea; si ya estaba pagada, se descuenta del próximo pago." />
        {d.lines.length === 0 ? <Empty title="Sin comisiones">Aparecen cuando un referido paga.</Empty> : (
          <Table caption="Comisiones" captionHidden minWidth={1040}>
            <thead className="border-b border-line"><tr><Th>Fecha</Th><Th>Persona</Th><Th className="text-right">Pagó</Th><Th className="text-right">Impuesto</Th><Th className="text-right">Procesador</Th><Th className="text-right">Base</Th><Th className="text-right">%</Th><Th className="text-right">Comisión</Th><Th>Estado</Th><Th /></tr></thead>
            <tbody>{d.lines.map((l) => {
              const st = LINE_STATUS[l.status] ?? { label: l.status, tone: "muted" as const };
              return (
                <tr key={l.id} className={tr}>
                  <Td>{fmtDate(l.createdAt)}</Td>
                  <Td>{l.kind === "ajuste" ? <span>Ajuste<div className="text-xs text-muted">{l.note}</div></span> : <span>{l.referred}<div className="text-xs text-muted">{l.provider === "tilopay" ? "Tilopay" : "ONVO"}{l.activeCount ? `, ${l.activeCount} pagando` : ""}</div></span>}</Td>
                  <Td className="text-right tabular-nums">{l.kind === "ajuste" ? "" : usd(l.gross)}</Td>
                  <Td className="text-right tabular-nums">{l.kind === "ajuste" ? "" : usd(l.tax)}</Td>
                  <Td className="text-right tabular-nums">{l.kind === "ajuste" ? "" : usd(l.fee)}</Td>
                  <Td className="text-right tabular-nums">{l.kind === "ajuste" ? "" : usd(l.net)}</Td>
                  <Td className="text-right tabular-nums">{l.kind === "ajuste" ? "" : `${l.rate}`}</Td>
                  <Td className="text-right font-bold tabular-nums">{usd(l.commission)}</Td>
                  <Td><Badge tone={st.tone}>{st.label}</Badge>{l.status === "pending" && <div className="text-xs text-muted">Disponible {fmtDate(l.availableAt)}</div>}</Td>
                  <Td>{l.kind === "pago" && l.status !== "reversed" && (
                    <ConfirmAction action={reverseLineAction} trigger="Revertir" title="Revertir esta comisión" danger confirmLabel="Revertir" hidden={{ line: l.id, target: a.userId }}
                      description={l.status === "paid" ? "Ya se pagó: se crea un ajuste negativo que se descuenta del próximo pago." : "Usa esto si el pago se reembolsó o hubo un contracargo."}>
                      <Field label="Motivo" htmlFor={`rl-${l.id}`}><input id={`rl-${l.id}`} name="reason" required minLength={4} maxLength={300} className={inputSm} placeholder="Reembolso del 12 de noviembre" /></Field>
                    </ConfirmAction>
                  )}</Td>
                </tr>
              );
            })}</tbody>
          </Table>
        )}
        <div className={`${panel} p-5`}>
          <h3 className="font-extrabold text-ink">Ajuste manual</h3>
          <p className="mt-1 text-sm text-muted">Positivo para sumar (un bono acordado) o negativo para descontar. Queda en auditoría.</p>
          <ActionForm action={adjustAction} className="mt-3 grid gap-3 sm:grid-cols-[9rem_1fr_auto] sm:items-end" resetOnSuccess>
            <input type="hidden" name="target" value={a.userId} />
            <Field label="Monto ($)" htmlFor="adj-amount"><input id="adj-amount" name="amount" type="number" step="0.01" required className={inputSm} /></Field>
            <Field label="Motivo" htmlFor="adj-reason"><input id="adj-reason" name="reason" required minLength={4} maxLength={300} className={inputSm} /></Field>
            <Submit>Guardar ajuste</Submit>
          </ActionForm>
        </div>
      </section>
    </div>
  );
}
