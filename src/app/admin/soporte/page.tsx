import Link from "next/link";
import { CaretRight, Flask, Paperclip } from "@/components/icons";
import { requireSection } from "@/lib/admin-auth";
import { getSupportQueue } from "@/lib/support-server";
import { CATEGORY_LABEL, PRIORITIES, PRIORITY_LABEL, STATUS_LABEL, SUPPORT_CATEGORIES, SUPPORT_STATUSES, ticketNumber, waitLabel, type SupportCategory, type SupportPriority, type SupportStatus } from "@/lib/support";
import { Badge, DemoNotice, Empty, Field, FilterBar, MetaList, Notice, PageHeader, Table, Td, Th, btnGhost, fmtNum, fw, inputSm, panel, trHover } from "@/components/admin/ui";

export const metadata = { title: "Soporte" };

type SP = { status?: string; category?: string; priority?: string; tester?: string; assigned?: string };
const STATUS_TONE: Record<SupportStatus, "warn" | "info" | "bad" | "good" | "muted"> = { recibido: "warn", en_proceso: "info", necesita_info: "bad", resuelto: "good", cerrado: "muted" };
const PRIORITY_TONE: Record<SupportPriority, "muted" | "info" | "warn" | "bad"> = { baja: "muted", normal: "muted", alta: "warn", urgente: "bad" };

export default async function Soporte({ searchParams }: { searchParams: Promise<SP> }) {
  const v = await requireSection("soporte");
  const sp = await searchParams;
  const f = {
    status: sp.status === "todos" || SUPPORT_STATUSES.includes(sp.status as SupportStatus) ? sp.status : "abiertos",
    category: SUPPORT_CATEGORIES.some(([k]) => k === sp.category) ? sp.category : undefined,
    priority: PRIORITIES.includes(sp.priority as SupportPriority) ? sp.priority : undefined,
    tester: sp.tester === "si" || sp.tester === "no" ? sp.tester : undefined,
    assigned: sp.assigned === "mio" || sp.assigned === "nadie" ? sp.assigned : undefined,
  };
  const { rows, counts, late, unavailable } = await getSupportQueue(v, f);
  const open = counts.recibido + counts.en_proceso + counts.necesita_info;
  const filtered = f.status !== "abiertos" || !!(f.category || f.priority || f.tester || f.assigned);
  const tab = (s: string, label: string, n: number) => {
    const on = f.status === s;
    return <Link key={s} href={s === "abiertos" ? "/admin/soporte" : `/admin/soporte?status=${s}`} aria-current={on ? "page" : undefined}
      className={`inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold outline-none transition-colors duration-150 focus-visible:ring-4 focus-visible:ring-banana/50 ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink/25"}`}>{label}<span className={`tabular-nums ${on ? "text-banana" : "text-muted"}`}>{fmtNum(n)}</span></Link>;
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Soporte" desc="Reportes de las personas, los más antiguos primero. Cada respuesta y cambio de estado les llega en la app, por correo y con una notificación." />
      {v.demo && <DemoNotice what="los reportes" />}
      {unavailable && <Notice tone="warn" title="Falta la migración 0034_soporte.sql">Ejecútala en el SQL Editor de Supabase para habilitar los reportes.</Notice>}

      <dl className={`${panel} grid grid-cols-3 divide-x divide-line`}>
        {([["Abiertos", open], ["Sin respuesta en 24 h", late], ["Esperan a la persona", counts.necesita_info]] as const).map(([l, n]) => (
          <div key={l} className="flex flex-col-reverse gap-1 px-3 py-3 sm:px-4"><dt className="text-xs text-muted">{l}</dt><dd className={`text-2xl font-extrabold leading-none tabular-nums ${l.startsWith("Sin") && n > 0 ? "text-[#B4232A]" : "text-ink"}`}>{fmtNum(n)}</dd></div>
        ))}
      </dl>

      <nav aria-label="Estados" className="-mx-1 flex flex-wrap gap-2 px-1">
        {tab("abiertos", "Abiertos", open)}
        {SUPPORT_STATUSES.map((s) => tab(s, STATUS_LABEL[s], counts[s]))}
        {tab("todos", "Todos", Object.values(counts).reduce((a, b) => a + b, 0))}
      </nav>

      <FilterBar label="Filtros de soporte" filtered={filtered} clearHref="/admin/soporte">
        <input type="hidden" name="status" value={f.status} />
        <Field label="Categoría" htmlFor="s-cat" className={fw.select}><select id="s-cat" name="category" defaultValue={f.category ?? ""} className={inputSm}><option value="">Todas</option>{SUPPORT_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Prioridad" htmlFor="s-pri" className={fw.select}><select id="s-pri" name="priority" defaultValue={f.priority ?? ""} className={inputSm}><option value="">Todas</option>{PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select></Field>
        <Field label="Tester" htmlFor="s-tes" className={fw.select}><select id="s-tes" name="tester" defaultValue={f.tester ?? ""} className={inputSm}><option value="">Todos</option><option value="si">Solo testers</option><option value="no">Sin testers</option></select></Field>
        <Field label="Asignado" htmlFor="s-asg" className={fw.select}><select id="s-asg" name="assigned" defaultValue={f.assigned ?? ""} className={inputSm}><option value="">Cualquiera</option><option value="mio">A mí</option><option value="nadie">Sin asignar</option></select></Field>
      </FilterBar>

      {rows.length > 0 && (<>
        <ul className={`${panel} divide-y divide-line md:hidden`} aria-label={`Reportes: ${fmtNum(rows.length)}`}>
          {rows.map((t) => (
            <li key={t.id}>
              <Link href={`/admin/soporte/${t.id}`} className="flex items-center gap-3 px-4 py-3 outline-none transition-colors duration-150 hover:bg-paper/50 focus-visible:bg-paper focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-banana/50">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5"><span className="text-xs font-bold tabular-nums text-muted">{ticketNumber(t.id)}</span><Badge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge>{t.late && <Badge tone="bad">+24 h sin respuesta</Badge>}</p>
                  <p className="mt-1 truncate font-semibold text-ink">{t.title}</p>
                  <MetaList className="mt-1" items={[t.name, CATEGORY_LABEL[t.category as SupportCategory], t.priority !== "normal" && PRIORITY_LABEL[t.priority as SupportPriority], `hace ${waitLabel(t.created_at)}`, t.from_tester && "Tester"]} />
                </div>
                <CaretRight className="size-4 shrink-0 text-faint" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
        <Table caption={`Reportes: ${fmtNum(rows.length)}`} captionHidden minWidth={900} className="hidden md:block">
          <thead className="border-b border-line"><tr><Th>Reporte</Th><Th>Persona</Th><Th>Categoría</Th><Th>Estado</Th><Th>Prioridad</Th><Th>Asignado</Th><Th className="text-right">Espera</Th></tr></thead>
          <tbody>{rows.map((t) => (
            <tr key={t.id} className={trHover}>
              <Td className="max-w-80">
                <Link href={`/admin/soporte/${t.id}`} className="block truncate font-semibold text-ink underline-offset-2 hover:underline rounded outline-none focus-visible:ring-4 focus-visible:ring-banana/50">{t.title}</Link>
                <p className="flex items-center gap-1.5 text-xs text-muted tabular-nums">{ticketNumber(t.id)}{t.attachment_path && <Paperclip className="size-3.5" aria-label="Con captura" />}</p>
              </Td>
              <Td><span className="flex items-center gap-1.5 whitespace-nowrap">{t.name}{t.from_tester && <Badge tone="warn"><Flask weight="duotone" className="size-3.5" aria-hidden />Tester</Badge>}</span></Td>
              <Td className="whitespace-nowrap text-muted">{CATEGORY_LABEL[t.category as SupportCategory] ?? t.category}</Td>
              <Td><span className="flex flex-wrap items-center gap-1"><Badge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge>{t.late && <Badge tone="bad">+24 h</Badge>}</span></Td>
              <Td><Badge tone={PRIORITY_TONE[t.priority as SupportPriority] ?? "muted"}>{PRIORITY_LABEL[t.priority as SupportPriority] ?? t.priority}</Badge></Td>
              <Td className="whitespace-nowrap text-muted">{t.assignee_name ?? "Sin asignar"}</Td>
              <Td className="text-right whitespace-nowrap tabular-nums text-muted">{waitLabel(t.created_at)}</Td>
            </tr>
          ))}</tbody>
        </Table>
      </>)}
      {!rows.length && !unavailable && (filtered
        ? <Empty title="Sin reportes con estos filtros" action={<Link href="/admin/soporte" className={btnGhost}>Ver abiertos</Link>}>Prueba con otro estado o quita los filtros.</Empty>
        : <Empty title="Todo al día">No hay reportes abiertos. Llegan desde Reportar un problema en la app.</Empty>)}
    </div>
  );
}
