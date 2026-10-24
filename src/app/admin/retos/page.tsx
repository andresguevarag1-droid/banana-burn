import Link from "next/link";
import { Plus } from "@/components/icons";
import { requireSection } from "@/lib/admin-auth";
import { can } from "@/lib/admin-perms";
import { listAdminChallenges } from "@/lib/admin-retos";
import { STATUS_LABEL, usd, type ChallengeStatus } from "@/lib/challenges";
import { durationLabel } from "@/lib/programs";
import { Badge, DemoNotice, Empty, MigrationNotice, Nil, PageHeader, SubTabs, Table, Td, Th, btnGhost, btnPrimary, fmtNum, trHover } from "@/components/admin/ui";
import { ChallengeCover } from "@/components/retos/cover";
import { MoveButtons, QuickActions } from "./row-actions";

export const metadata = { title: "Retos" };

const TONE: Record<ChallengeStatus, "good" | "muted" | "warn" | "bad"> = { publicado: "good", borrador: "muted", oculto: "warn", archivado: "bad" };
const FILTERS: { key: ChallengeStatus | ""; label: string }[] = [{ key: "", label: "Todos" }, { key: "publicado", label: "Publicados" }, { key: "borrador", label: "Borradores" }, { key: "oculto", label: "Ocultos" }, { key: "archivado", label: "Archivados" }];

export default async function AdminRetos({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const v = await requireSection("retos");
  const sp = await searchParams;
  const estado = (FILTERS.find((f) => f.key === sp.estado)?.key || null) as ChallengeStatus | null;
  const { rows, needsMigration } = await listAdminChallenges(v, estado);
  const sales = can(v.role, "challenges.sales");
  const totals = rows.reduce((a, r) => ({ active: a.active + (r.stats?.active ?? 0), buys: a.buys + (r.stats?.purchases ?? 0), rev: a.rev + (r.stats?.revenueMinor ?? 0) }), { active: 0, buys: 0, rev: 0 });

  return (
    <div className="space-y-5">
      <PageHeader title="Retos" desc="La tienda de retos: crea, edita, ordena, oculta y vende retos. Lo publicado aparece en la app al instante." >
        <Link href="/admin/retos/nuevo?tipo=programa" className={btnGhost}><Plus weight="bold" className="size-4" />Nuevo programa</Link>
        <Link href="/admin/retos/nuevo" className={btnPrimary}><Plus weight="bold" className="size-4" />Nuevo reto</Link>
      </PageHeader>
      {v.demo && <DemoNotice what="los retos (sin personas ni ventas reales)" />}
      {needsMigration && <MigrationNotice />}
      <SubTabs label="Filtrar por estado" items={FILTERS.map((f) => ({ href: f.key ? `/admin/retos?estado=${f.key}` : "/admin/retos", label: f.label, current: (estado ?? "") === f.key }))} />
      {!v.demo && rows.length > 0 && (
        <p className="text-sm text-muted">{fmtNum(totals.active)} personas con retos en curso{sales ? <>, {fmtNum(totals.buys)} compras y {usd(totals.rev)} USD en ventas confirmadas</> : null}.</p>
      )}
      {rows.length ? (
        <Table caption="Retos de la tienda" captionHidden minWidth={sales ? 960 : 860}>
          <thead><tr><Th className="w-24">Orden</Th><Th>Reto</Th><Th>Estado</Th><Th>Precio</Th><Th className="text-right">En curso</Th><Th className="text-right">Completados</Th>{sales && <><Th className="text-right">Compras</Th><Th className="text-right">Ingresos</Th></>}<Th className="text-right">Acciones</Th></tr></thead>
          <tbody>
            {rows.map(({ c, stats }, i) => (
              <tr key={c.uuid} className={trHover}>
                <Td>{estado ? <span className="text-xs text-muted tabular-nums">{c.sort}</span> : <MoveButtons id={c.uuid} first={i === 0} last={i === rows.length - 1} />}</Td>
                <Td>
                  <Link href={`/admin/retos/${c.uuid}`} className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-4 focus-visible:ring-banana/50">
                    <span className="w-14 shrink-0 overflow-hidden rounded-xl"><ChallengeCover c={c} className="h-10 w-14" chip={false} /></span>
                    <span className="min-w-32"><span className="block font-semibold text-ink hover:underline">{c.title}</span><span className="block text-xs text-muted">{c.id}, {c.kind === "programa" && c.program ? `programa de ${durationLabel(c.program)}` : `${c.days} días`}{c.featured ? ", destacado" : ""}</span></span>
                  </Link>
                </Td>
                <Td><Badge tone={TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge></Td>
                <Td className="tabular-nums">{c.priceUsd > 0 ? usd(Math.round(c.priceUsd * 100)) : <span className="text-[#17703A] font-semibold">Gratis</span>}</Td>
                <Td className="text-right tabular-nums">{stats ? fmtNum(stats.program ? stats.program.active : stats.active) : <Nil />}</Td>
                <Td className="text-right tabular-nums">{stats ? fmtNum(stats.program ? stats.program.completed : stats.completed) : <Nil />}</Td>
                {sales && <><Td className="text-right tabular-nums">{stats?.purchases != null ? fmtNum(stats.purchases) : <Nil />}{stats?.comps ? <span className="block text-[11px] text-muted">{stats.comps} de cortesía</span> : null}</Td><Td className="text-right tabular-nums">{stats?.revenueMinor != null ? usd(stats.revenueMinor) : <Nil />}</Td></>}
                <Td className="whitespace-nowrap text-right"><span className="inline-flex items-center gap-1"><Link href={`/admin/retos/${c.uuid}`} className="inline-flex h-10 items-center rounded-lg px-2 text-sm font-semibold text-ink hover:bg-paper">Editar</Link><QuickActions id={c.uuid} status={c.status} /></span></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : <Empty title="Sin retos">{estado ? "No hay retos con ese estado." : "Crea el primero con Nuevo reto."}</Empty>}
    </div>
  );
}
