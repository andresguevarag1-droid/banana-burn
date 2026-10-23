import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSection } from "@/lib/admin-auth";
import { can } from "@/lib/admin-perms";
import { getAdminChallenge } from "@/lib/admin-retos";
import { STATUS_LABEL, usd } from "@/lib/challenges";
import { ActionForm, ConfirmAction, Submit } from "@/components/admin/action-form";
import { Badge, DemoNotice, Field, Kpi, Notice, PageHeader, SectionHeading, Table, Td, Th, btnGhost, fmtDate, fmtNum, inputSm, link, panel, tr } from "@/components/admin/ui";
import { ChallengeEditor } from "../editor";
import { exInfo } from "@/lib/programs-server";
import { grantChallenge, setChallengeStatus } from "../actions";

export const metadata = { title: "Editar reto" };

export default async function EditarReto({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nuevo?: string }> }) {
  const v = await requireSection("retos");
  const { id } = await params;
  const sp = await searchParams;
  const d = await getAdminChallenge(v, id);
  if (!d) notFound();
  const { c, plan, sessions, stats, buyers } = d;
  const ids = [...new Set(sessions.flatMap((x) => x.exercises.flatMap((e) => [e.id, ...(e.home ? [e.home] : [])])))];
  const names = Object.fromEntries(ids.map((id) => [id, exInfo(id)?.name ?? id]));
  const sales = can(v.role, "challenges.sales");
  const grant = can(v.role, "challenges.grant");

  return (
    <div className="space-y-6">
      <PageHeader title={c.title} back={{ href: "/admin/retos", label: "Retos" }} desc={<>Identificador <code className="rounded bg-cream px-1">{c.id}</code>. {c.status === "publicado" ? <>Visible en la tienda: <Link href={`/app/retos/${c.id}`} className={link}>ver en la app</Link>.</> : "No aparece en la tienda."}</>}
        meta={<><Badge tone={c.status === "publicado" ? "good" : c.status === "oculto" ? "warn" : c.status === "archivado" ? "bad" : "muted"}>{STATUS_LABEL[c.status]}</Badge>{c.priceUsd > 0 ? <Badge tone="info">Premium {usd(Math.round(c.priceUsd * 100))}</Badge> : <Badge tone="good">Gratis</Badge>}{c.kind === "programa" && <Badge tone="info">Programa</Badge>}</>}>
        <Link href={`/app/retos/${c.id}?previa=1`} target="_blank" className={btnGhost}>Ver como usuario</Link>
        {c.status !== "archivado" && <ConfirmAction action={setChallengeStatus} hidden={{ id: c.uuid, status: "archivado" }} trigger="Archivar" title="Archivar este reto" description="Deja de verse en la tienda y en los listados normales. Quien ya está inscrito puede terminarlo. Puedes volver a publicarlo después." danger confirmLabel="Archivar" />}
      </PageHeader>
      {v.demo && <DemoNotice what="este reto (sin personas ni ventas reales)" />}
      {sp.nuevo && <Notice title="Reto creado como borrador">Completa el plan de todos los días y cambia el estado a Publicado para que aparezca en la tienda.</Notice>}

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="En curso hoy" value={fmtNum(stats.active)} />
          <Kpi label="Completados" value={fmtNum(stats.completed)} hint={`${fmtNum(stats.joined)} inscripciones en total`} />
          {sales && <Kpi label="Compras" value={fmtNum(stats.purchases ?? 0)} hint={stats.comps ? `${stats.comps} de cortesía` : undefined} />}
          {sales && <Kpi label="Ingresos" value={usd(stats.revenueMinor ?? 0)} hint="Pagos confirmados por ONVO" />}
          {stats.program && <Kpi label="Programa activo" value={fmtNum(stats.program.active)} hint={`${fmtNum(stats.program.paused)} en pausa, ${fmtNum(stats.program.completed)} completados`} />}
        </div>
      )}

      <ChallengeEditor canSell={sales} init={{
        uuid: c.uuid, slug: c.id, title: c.title, desc: c.desc, days: c.days, verify: c.verify, stepsGoal: c.stepsGoal, icon: c.icon, cover: c.cover,
        difficulty: c.difficulty, minutes: c.minutes, grace: c.grace, xp: c.xp, badge: c.badge, rewardTitle: c.rewardTitle, priceUsd: c.priceUsd, onvoPriceId: c.onvoPriceId,
        startMode: c.startMode, startDate: c.startDate, featured: c.featured, comingSoon: c.comingSoon, safetyNote: c.safetyNote, status: c.status, sort: c.sort, plan,
        kind: c.kind, program: c.program, sessions, names,
      }} />

      {(grant || sales) && (
        <section className="space-y-3" aria-labelledby="compradores">
          <SectionHeading id="compradores" title="Compradores y cortesías" desc="Quién tiene acceso a este reto por compra confirmada o por cortesía del equipo." />
          {grant && (
            <div className={`${panel} p-4`}>
              <ActionForm action={grantChallenge} resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <input type="hidden" name="slug" value={c.id} />
                <Field label="Correo o ID del usuario" htmlFor="g-who"><input id="g-who" name="who" required maxLength={120} autoComplete="off" className={inputSm} /></Field>
                <Field label="Motivo (queda en auditoría)" htmlFor="g-reason"><input id="g-reason" name="reason" required minLength={4} maxLength={300} className={inputSm} /></Field>
                <Submit pendingText="Regalando…">Regalar reto</Submit>
              </ActionForm>
            </div>
          )}
          {buyers && (buyers.length ? (
            <Table caption="Compradores" captionHidden minWidth={560}>
              <thead><tr><Th>Usuario</Th><Th>Origen</Th><Th>Fecha</Th><Th className="text-right">Monto</Th></tr></thead>
              <tbody>
                {buyers.map((b) => (
                  <tr key={b.userId} className={tr}>
                    <Td><Link href={`/admin/usuarios/${b.userId}`} className={link}>{b.name}</Link></Td>
                    <Td>{b.source === "compra" ? <Badge tone="good">Compra</Badge> : <span title={b.reason ?? undefined}><Badge tone="info">Cortesía</Badge></span>}</Td>
                    <Td>{fmtDate(b.at)}</Td>
                    <Td className="text-right tabular-nums">{b.amountMinor != null ? usd(b.amountMinor) : "Sin cobro"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : <p className="text-sm text-muted">Nadie tiene este reto por compra o cortesía todavía.</p>)}
        </section>
      )}
    </div>
  );
}
