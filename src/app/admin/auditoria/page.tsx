import Link from "next/link";
import { requireSection } from "@/lib/admin-auth";
import { listAudit, PAGE_SIZE, type AuditRow } from "@/lib/admin";
import { actionGroupLabel, actionLabel, metaKey, metaValue } from "@/lib/admin-format";
import { DemoNotice, Empty, Field, FilterBar, MetaList, Nil, PageHeader, Pagination, Table, Td, Th, btnGhost, fmtDateTime, fmtNum, fw, inputSm, panel, tr } from "@/components/admin/ui";

export const metadata = { title: "Auditoría" };

type SP = { action?: string; actor?: string; target?: string; from?: string; to?: string; page?: string };
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

function Meta({ meta }: { meta: Record<string, unknown> | null }) {
  const entries = Object.entries(meta ?? {}).slice(0, 8);
  if (!entries.length) return <Nil />;
  return (
    <dl className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
      {entries.map(([k, v]) => {
        const val = metaValue(v);
        return <div key={k} className="flex gap-1"><dt className="text-muted">{metaKey(k)}:</dt><dd className="text-ink font-medium max-w-56 truncate" title={val}>{val}</dd></div>;
      })}
    </dl>
  );
}

/** Objetivo enlazado: usuarios a su ficha (con nombre), reportes a la cola de moderación; lo demás, texto. */
function Target({ r }: { r: AuditRow }) {
  if (!r.target) return <Nil />;
  if (UUID.test(r.target)) {
    const label = r.target_name ?? `Usuario ${r.target.slice(0, 8)}`;
    return r.action === "user.delete" ? <span className="font-semibold text-ink">{label}</span> : <Link href={`/admin/usuarios/${r.target}`} className="font-semibold text-ink underline underline-offset-2">{label}</Link>;
  }
  if (r.target.startsWith("report:")) return <Link href="/admin/comunidad?status=todos" className="underline underline-offset-2">Reporte {r.target.slice(7)}</Link>;
  const [kind, id] = r.target.split(":");
  const KIND: Record<string, string> = { food: "Alimento", exercise: "Ejercicio", challenge: "Reto", announcement: "Anuncio" };
  return <span className="break-all">{KIND[kind] ? `${KIND[kind]} ${id}` : r.target}</span>;
}

export default async function Auditoria({ searchParams }: { searchParams: Promise<SP> }) {
  const v = await requireSection("auditoria");
  const sp = await searchParams;
  const f = {
    action: sp.action?.slice(0, 60), actor: sp.actor?.slice(0, 60), target: sp.target?.slice(0, 80),
    from: sp.from && ISO.test(sp.from) ? sp.from : undefined, to: sp.to && ISO.test(sp.to) ? sp.to : undefined,
    page: Math.max(1, Number(sp.page) || 1),
  };
  const { rows, total, actions } = await listAudit(v, f);
  const prefixes = [...new Set(actions.map((a) => a.split(".")[0]))];
  const filtered = !!(f.action || f.actor || f.target || f.from || f.to);

  return (
    <div className="space-y-5">
      <PageHeader title="Auditoría" desc="Registro inmutable de lo que hace el staff: quién, qué, sobre qué y cuándo." />
      {v.demo && <DemoNotice what="los eventos" />}
      <FilterBar label="Filtros de auditoría" filtered={filtered} clearHref="/admin/auditoria">
        <Field label="Acción" htmlFor="a-action" className={fw.select}>
          <select id="a-action" name="action" defaultValue={f.action ?? ""} className={inputSm}>
            <option value="">Todas</option>
            {prefixes.map((p) => <optgroup key={p} label={actionGroupLabel(p)}><option value={`${p}.`}>{actionGroupLabel(p)}: todas</option>{actions.filter((a) => a.startsWith(p + ".")).map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}</optgroup>)}
          </select>
        </Field>
        <Field label={v.demo ? "Quién (ID o nombre)" : "Quién (ID del staff)"} htmlFor="a-actor" className={fw.select}><input id="a-actor" name="actor" defaultValue={f.actor} className={inputSm} /></Field>
        <Field label="Sobre qué" htmlFor="a-target" className={fw.select}><input id="a-target" name="target" defaultValue={f.target} placeholder="ID de usuario o food:12" className={inputSm} /></Field>
        <Field label="Desde" htmlFor="a-from" className={fw.date}><input id="a-from" name="from" type="date" defaultValue={f.from} className={inputSm} /></Field>
        <Field label="Hasta" htmlFor="a-to" className={fw.date}><input id="a-to" name="to" type="date" defaultValue={f.to} className={inputSm} /></Field>
      </FilterBar>
      {rows.length > 0 && <>
      <ol className={`${panel} divide-y divide-line md:hidden`} aria-label={`Eventos de auditoría (${fmtNum(total)})`}>
        {rows.map((r) => (
          <li key={r.id} className="space-y-1.5 px-4 py-3">
            <p className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-ink">{actionLabel(r.action)}</span><span className="text-xs text-muted tabular-nums">{fmtDateTime(r.created_at)}</span></p>
            <MetaList className="text-sm!" items={[
              r.actor ? <Link key="a" href={`/admin/usuarios/${r.actor}`} className="font-semibold text-ink underline-offset-2 hover:underline">{r.actor_name ?? "Staff"}</Link> : "Sistema",
              r.target && <Target key="t" r={r} />,
            ]} />
            <Meta meta={r.meta} />
          </li>
        ))}
      </ol>
      <Table caption={`Eventos de auditoría (${fmtNum(total)})`} captionHidden minWidth={820} className="hidden md:block">
        <thead className="border-b border-line"><tr><Th>Fecha</Th><Th>Quién</Th><Th>Acción</Th><Th>Sobre</Th><Th>Detalle</Th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id} className={`${tr} align-top`}>
            <Td className="whitespace-nowrap text-muted">{fmtDateTime(r.created_at)}</Td>
            <Td className="whitespace-nowrap">{r.actor ? <><Link href={`/admin/usuarios/${r.actor}`} className="font-semibold text-ink underline-offset-2 hover:underline rounded outline-none focus-visible:ring-4 focus-visible:ring-banana/50">{r.actor_name ?? "Staff"}</Link><Link href={`/admin/auditoria?actor=${r.actor}`} className="block text-xs text-muted underline-offset-2 hover:underline">Ver sus acciones</Link></> : <span className="text-muted">Sistema</span>}</Td>
            <Td className="whitespace-nowrap font-semibold text-ink">{actionLabel(r.action)}</Td>
            <Td className="text-sm"><Target r={r} /></Td>
            <Td><Meta meta={r.meta} /></Td>
          </tr>))}</tbody>
      </Table>
      </>}
      {!rows.length && (filtered ? <Empty title="Sin eventos" action={<Link href="/admin/auditoria" className={btnGhost}>Limpiar filtros</Link>}>Ningún evento coincide con estos filtros.</Empty> : <Empty title="Sin eventos todavía">Cada acción del staff queda registrada aquí.</Empty>)}
      <Pagination page={f.page} total={total} pageSize={PAGE_SIZE} basePath="/admin/auditoria" params={{ action: f.action, actor: f.actor, target: f.target, from: f.from, to: f.to }} />
    </div>
  );
}
