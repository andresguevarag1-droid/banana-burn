import Link from "next/link";
import { requireSection } from "@/lib/admin-auth";
import { listUsers, PAGE_SIZE, statusOf, USER_STATUS } from "@/lib/admin";
import { ROLE_LABEL, ROLES } from "@/lib/admin-perms";
import { crToday } from "@/lib/today";
import { Badge, DemoNotice, Empty, Field, Notice, PageHeader, Pagination, RoleBadge, Table, Td, Th, ago, fmtDate, inputSm } from "@/components/admin/ui";

export const metadata = { title: "Usuarios" };

type SP = { q?: string; plan?: string; role?: string; status?: string; from?: string; to?: string; page?: string };
const PLAN_OPTS = [["free", "Gratis"], ["entreno", "Entreno"], ["completo", "Entreno + Nutrición"], ["pro", "Pro (legado)"]] as const;
const STATUS_TONE = { activo: "good", inactivo: "muted", pendiente: "warn" } as const;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function Usuarios({ searchParams }: { searchParams: Promise<SP> }) {
  const v = await requireSection("usuarios");
  const sp = await searchParams;
  const f = {
    q: sp.q?.slice(0, 80), plan: sp.plan, role: ROLES.includes(sp.role as never) ? sp.role : undefined,
    status: USER_STATUS.some(([k]) => k === sp.status) ? sp.status : undefined,
    from: sp.from && ISO.test(sp.from) ? sp.from : undefined, to: sp.to && ISO.test(sp.to) ? sp.to : undefined,
    page: Math.max(1, Number(sp.page) || 1),
  };
  const { rows, total, limited } = await listUsers(v, f);
  const today = crToday().iso;
  const filtered = !!(f.q || f.plan || f.role || f.status || f.from || f.to);

  return (
    <div className="space-y-6">
      <PageHeader title="Usuarios" desc="Busca por nombre, correo o ID. Abre una ficha para ver detalle y acciones." />
      {v.demo && <DemoNotice what="los usuarios" />}
      {limited && <Notice tone="warn" title="Búsqueda limitada">Sin 0005_admin.sql no se puede buscar por correo ni filtrar por actividad.</Notice>}

      <form className="card p-4 grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-7 items-end" aria-label="Filtros de usuarios">
        <Field label="Buscar" htmlFor="f-q" className="col-span-2 md:col-span-3 xl:col-span-2">
          <input id="f-q" name="q" type="search" defaultValue={f.q} placeholder="Nombre, correo o ID" className={inputSm} />
        </Field>
        <Field label="Plan" htmlFor="f-plan">
          <select id="f-plan" name="plan" defaultValue={f.plan ?? ""} className={inputSm}><option value="">Todos</option>{PLAN_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </Field>
        <Field label="Rol" htmlFor="f-role">
          <select id="f-role" name="role" defaultValue={f.role ?? ""} className={inputSm}><option value="">Todos</option>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
        </Field>
        <Field label="Estado" htmlFor="f-status">
          <select id="f-status" name="status" defaultValue={f.status ?? ""} className={inputSm}><option value="">Todos</option>{USER_STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </Field>
        <Field label="Alta desde" htmlFor="f-from"><input id="f-from" name="from" type="date" defaultValue={f.from} className={inputSm} /></Field>
        <Field label="Alta hasta" htmlFor="f-to"><input id="f-to" name="to" type="date" defaultValue={f.to} className={inputSm} /></Field>
        <div className="col-span-2 md:col-span-3 xl:col-span-7 flex gap-2 justify-end">
          {filtered && <Link href="/admin/usuarios" className="btn-ghost h-10! px-4! text-sm!">Limpiar</Link>}
          <button className="btn-primary h-10! px-5! text-sm!">Filtrar</button>
        </div>
      </form>

      <Table caption={`Usuarios${filtered ? " (filtrados)" : ""}: ${total}`} captionHidden minWidth={860}>
        <thead className="border-b border-line">
          <tr><Th>Usuario</Th><Th>Rol</Th><Th>Plan</Th><Th>Estado</Th><Th>Última actividad</Th><Th>Alta</Th><Th><span className="sr-only">Acciones</span></Th></tr>
        </thead>
        <tbody>
          {rows.map((u) => {
            const st = statusOf(u, today) as keyof typeof STATUS_TONE;
            return (
              <tr key={u.id} className="border-b border-line last:border-0 hover:bg-paper/60">
                <Td>
                  <Link href={`/admin/usuarios/${u.id}`} className="font-semibold text-ink hover:underline underline-offset-2 rounded focus:outline-none focus-visible:ring-4 focus-visible:ring-banana/50">{u.full_name || "Sin nombre"}</Link>
                  {u.email && <p className="text-xs text-muted">{u.email}</p>}
                </Td>
                <Td><RoleBadge role={u.role} /></Td>
                <Td><span className="text-ink">{PLAN_OPTS.find(([k]) => k === u.plan)?.[1] ?? u.plan}</span>{u.comp_until && <p className="text-[11px] text-[#6E4E00] font-semibold">Cortesía hasta {fmtDate(u.comp_until)}</p>}</Td>
                <Td><Badge tone={STATUS_TONE[st]}>{USER_STATUS.find(([k]) => k === st)?.[1].replace(" (7 d)", "")}</Badge></Td>
                <Td className="text-muted tabular-nums">{limited ? "—" : ago(u.last_active, today)}</Td>
                <Td className="text-muted tabular-nums whitespace-nowrap">{fmtDate(u.created_at)}</Td>
                <Td className="text-right"><Link href={`/admin/usuarios/${u.id}`} className="text-sm font-semibold text-ink underline underline-offset-2" aria-label={`Ver ficha de ${u.full_name || "usuario"}`}>Ver</Link></Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {!rows.length && <div className="card"><Empty>Sin resultados para estos filtros.</Empty></div>}
      <Pagination page={f.page} total={total} pageSize={PAGE_SIZE} basePath="/admin/usuarios" params={{ q: f.q, plan: f.plan, role: f.role, status: f.status, from: f.from, to: f.to }} />
    </div>
  );
}
