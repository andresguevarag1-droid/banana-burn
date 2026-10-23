import Link from "next/link";
import { requireSection } from "@/lib/admin-auth";
import { ACTIVITY_LABEL, BILLING_LABEL, listUsers, PAGE_SIZE, PLAN_LABEL, statusOf, USER_STATUS } from "@/lib/admin";
import { can, ROLE_LABEL, ROLES } from "@/lib/admin-perms";
import { getReferralCounts } from "@/lib/admin-referrals";
import { giftMonthsBulk } from "../regalos-actions";
import { ConfirmAction } from "@/components/admin/action-form";
import { GiftFields } from "@/components/admin/gift-fields";
import { GIFT_BULK_MAX } from "@/lib/gifts";
import { crToday } from "@/lib/today";
import { CaretRight } from "@/components/icons";
import { Badge, DemoNotice, Empty, Field, FilterBar, MetaList, Nil, Notice, PageHeader, Pagination, RoleBadge, SubStatus, Table, Td, Th, ago, btnGhost, fmtDate, fmtNum, fw, inputSm, panel, textareaSm, trHover } from "@/components/admin/ui";

export const metadata = { title: "Usuarios" };

type SP = { q?: string; plan?: string; role?: string; status?: string; from?: string; to?: string; page?: string };
const PLAN_OPTS = (["free", "entreno", "completo", "pro"] as const).map((k) => [k, PLAN_LABEL[k]] as const);
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
  const refCounts = await getReferralCounts(v, rows.map((u) => u.id));
  const showRefs = can(v.role, "referrals.view");
  const today = crToday().iso;
  const filtered = !!(f.q || f.plan || f.role || f.status || f.from || f.to);

  return (
    <div className="space-y-5">
      <PageHeader title="Usuarios" desc="Busca por nombre, correo o ID y abre la ficha para ver detalle y acciones.">
        {can(v.role, "users.gift") && (
          <ConfirmAction action={giftMonthsBulk} trigger="Regalar meses en lote" title="Regalar meses a varias personas" hidden={{}} confirmLabel="Regalar"
            description={`Marca personas de esta página o pega sus ID (máximo ${GIFT_BULK_MAX}). Cada regalo se suma al final del acceso de cada persona, con aviso, correo y notificación.`}>
            {rows.length > 0 && (
              <fieldset className="min-w-0 max-h-48 overflow-y-auto rounded-xl border border-line p-2">
                <legend className="px-1 text-xs font-bold text-ink">Personas de esta página</legend>
                {rows.map((u) => (
                  <label key={u.id} className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-2 text-sm text-ink hover:bg-paper">
                    <input type="checkbox" name="ids" value={u.id} className="size-4 accent-[#1B1505]" />
                    <span className="min-w-0 truncate">{u.full_name || "Sin nombre"}{u.email ? <span className="text-muted"> ({u.email})</span> : null}</span>
                  </label>
                ))}
              </fieldset>
            )}
            <div><label htmlFor="bulk-ids" className="block text-xs font-bold text-ink mb-1">O pega los ID (uno por línea)</label>
              <textarea id="bulk-ids" name="pasted" rows={2} className={textareaSm} placeholder="00000000-0000-4000-8000-000000000000" /></div>
            <GiftFields />
          </ConfirmAction>
        )}
      </PageHeader>
      {v.demo && <DemoNotice what="los usuarios" />}
      {limited && <Notice tone="warn" title="Búsqueda limitada">Sin 0005_admin.sql no se puede buscar por correo ni filtrar por actividad.</Notice>}

      <FilterBar label="Filtros de usuarios" filtered={filtered} clearHref="/admin/usuarios">
        <Field label="Buscar" htmlFor="f-q" className={fw.search}>
          <input id="f-q" name="q" type="search" defaultValue={f.q} placeholder="Nombre, correo o ID" className={inputSm} />
        </Field>
        <Field label="Plan" htmlFor="f-plan" className={fw.select}>
          <select id="f-plan" name="plan" defaultValue={f.plan ?? ""} className={inputSm}><option value="">Todos</option>{PLAN_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </Field>
        <Field label="Rol" htmlFor="f-role" className={fw.select}>
          <select id="f-role" name="role" defaultValue={f.role ?? ""} className={inputSm}><option value="">Todos</option>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
        </Field>
        <Field label="Actividad" htmlFor="f-status" className={fw.select}>
          <select id="f-status" name="status" defaultValue={f.status ?? ""} className={inputSm}><option value="">Todos</option>{USER_STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </Field>
        <Field label="Alta desde" htmlFor="f-from" className={fw.date}><input id="f-from" name="from" type="date" defaultValue={f.from} className={inputSm} /></Field>
        <Field label="Alta hasta" htmlFor="f-to" className={fw.date}><input id="f-to" name="to" type="date" defaultValue={f.to} className={inputSm} /></Field>
      </FilterBar>

      {rows.length > 0 && (<>
      {/* Móvil: lista compacta con lo esencial; la tabla completa queda para pantallas medianas en adelante. */}
      <ul className={`${panel} divide-y divide-line md:hidden`} aria-label={`Usuarios${filtered ? " (filtrados)" : ""}: ${fmtNum(total)}`}>
        {rows.map((u) => {
          const st = statusOf(u, today) as keyof typeof STATUS_TONE;
          return (
            <li key={u.id}>
              <Link href={`/admin/usuarios/${u.id}`} className="flex items-center gap-3 px-4 py-3 outline-none transition-colors duration-150 hover:bg-paper/50 focus-visible:bg-paper focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-banana/50">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{u.full_name || "Sin nombre"}</p>
                  {u.email && <p className="truncate text-xs text-muted">{u.email}</p>}
                  <MetaList className="mt-1.5" items={[<Badge key="a" tone={STATUS_TONE[st]}>{ACTIVITY_LABEL[st]}</Badge>, PLAN_LABEL[u.plan] ?? u.plan, limited ? null : ago(u.last_active, today), refCounts.get(u.id) ? `${fmtNum(refCounts.get(u.id)!.total)} referidos` : null]} />
                </div>
                <CaretRight className="size-4 shrink-0 text-faint" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      <Table caption={`Usuarios${filtered ? " (filtrados)" : ""}: ${fmtNum(total)}`} captionHidden minWidth={860} className="hidden md:block">
        <thead className="border-b border-line">
          <tr><Th>Usuario</Th><Th>Rol</Th><Th>Plan</Th><Th>Suscripción</Th><Th>Actividad</Th><Th>Última actividad</Th>{showRefs && <Th className="text-right">Referidos</Th>}<Th className="text-right">Alta</Th></tr>
        </thead>
        <tbody>
          {rows.map((u) => {
            const st = statusOf(u, today) as keyof typeof STATUS_TONE;
            return (
              <tr key={u.id} className={trHover}>
                <Td className="max-w-72">
                  <Link href={`/admin/usuarios/${u.id}`} className="block truncate font-semibold text-ink underline-offset-2 hover:underline rounded outline-none focus-visible:ring-4 focus-visible:ring-banana/50">{u.full_name || "Sin nombre"}</Link>
                  {u.email && <p className="truncate text-xs text-muted">{u.email}</p>}
                </Td>
                <Td><RoleBadge role={u.role} /></Td>
                <Td>
                  <span className="text-ink whitespace-nowrap">{PLAN_LABEL[u.plan] ?? u.plan}</span>
                  {u.plan !== "free" && u.billing && !u.comp_until && <p className="text-xs text-muted">{BILLING_LABEL[u.billing] ?? u.billing}</p>}
                  {u.comp_until && <p className="text-xs text-[#6E4E00] font-semibold whitespace-nowrap">Cortesía hasta {fmtDate(u.comp_until)}</p>}
                </Td>
                <Td><SubStatus status={u.sub_status} /></Td>
                <Td><Badge tone={STATUS_TONE[st]}>{ACTIVITY_LABEL[st]}</Badge></Td>
                <Td className="text-muted whitespace-nowrap">{limited ? <Nil /> : ago(u.last_active, today)}</Td>
                {showRefs && <Td className="text-right tabular-nums whitespace-nowrap">{refCounts.get(u.id) ? <span title="Invitados, activos y recompensas"><b className="text-ink">{fmtNum(refCounts.get(u.id)!.total)}</b><span className="text-muted"> ({fmtNum(refCounts.get(u.id)!.qualified)} activos, {fmtNum(refCounts.get(u.id)!.rewards)} premios)</span></span> : <Nil />}</Td>}
                <Td className="text-right text-muted whitespace-nowrap">{fmtDate(u.created_at)}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      </>)}
      {!rows.length && (filtered
        ? <Empty title="Sin resultados" action={<Link href="/admin/usuarios" className={btnGhost}>Limpiar filtros</Link>}>Ningún usuario coincide con estos filtros.</Empty>
        : <Empty title="Todavía no hay usuarios">Las cuentas nuevas aparecen aquí apenas se registran.</Empty>)}
      <Pagination page={f.page} total={total} pageSize={PAGE_SIZE} basePath="/admin/usuarios" params={{ q: f.q, plan: f.plan, role: f.role, status: f.status, from: f.from, to: f.to }} />
    </div>
  );
}
