import Link from "next/link";
import { requireSection } from "@/lib/admin-auth";
import { listReports } from "@/lib/admin";
import { ActionForm } from "@/components/admin/action-form";
import { Badge, DemoNotice, Empty, MetaList, MigrationNotice, PageHeader, SubTabs, btnDanger, btnGhost, fmtDateTime, inputSm, link, panel } from "@/components/admin/ui";
import { moderateReport } from "../actions";

export const metadata = { title: "Comunidad" };

const STATUSES = [["abierto", "Abiertos"], ["oculto", "Ocultos"], ["resuelto", "Resueltos"], ["descartado", "Descartados"], ["todos", "Todos"]] as const;
const REASON: Record<string, string> = { spam: "Spam", acoso: "Acoso", contenido_inapropiado: "Contenido inapropiado", desinformacion_salud: "Desinformación de salud", otro: "Otro" };
const TONE: Record<string, "warn" | "bad" | "good" | "muted"> = { abierto: "warn", oculto: "bad", resuelto: "good", descartado: "muted" };
const STATUS_LABEL: Record<string, string> = { abierto: "Abierto", oculto: "Oculto", resuelto: "Resuelto", descartado: "Descartado" };
const TYPE_LABEL: Record<string, string> = { post: "Publicación", comment: "Comentario", user: "Perfil" };

export default async function Comunidad({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const v = await requireSection("comunidad");
  const sp = await searchParams;
  const status = STATUSES.some(([k]) => k === sp.status) ? sp.status! : "abierto";
  const { rows, counts, needsMigration } = await listReports(v, status);

  return (
    <div className="space-y-5">
      <PageHeader title="Comunidad" desc="Cola de moderación: revisa reportes y oculta, resuelve o descarta." />
      {v.demo && <DemoNotice what="los reportes" />}
      {needsMigration && <MigrationNotice />}
      <SubTabs label="Estado de reportes" items={STATUSES.map(([k, l]) => ({ href: k === "abierto" ? "/admin/comunidad" : `/admin/comunidad?status=${k}`, label: l, current: k === status, badge: k === "abierto" ? counts.abierto : undefined }))} />

      <ul className="space-y-3" aria-label="Reportes">
        {rows.map((r) => (
          <li key={r.id} className={`${panel} space-y-3 p-4`}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <Badge tone={TONE[r.status]}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
              <Badge tone={r.reason === "desinformacion_salud" || r.reason === "acoso" ? "bad" : "info"}>{REASON[r.reason] ?? r.reason}</Badge>
              <MetaList className="sm:ml-1" items={[TYPE_LABEL[r.target_type] ?? "Contenido", `Reportado por ${r.reporter_name ?? "usuario"}`, fmtDateTime(r.created_at)]} />
            </div>
            {r.author_id && (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="text-muted">{r.target_type === "user" ? "Perfil de" : "Autor:"}</span>
                <Link href={`/admin/usuarios/${r.author_id}`} className={`font-semibold ${link}`}>{r.author_name ?? "Ver ficha"}</Link>
                {r.author_username && <Link href={`/app/comunidad/u/${r.author_username}`} className={link}>Ver @{r.author_username} en la app</Link>}
                {r.author_suspended && <Badge tone="bad">Suspendido</Badge>}
                {!r.author_suspended && <Link href={`/admin/usuarios/${r.author_id}#s-acciones`} className="text-xs font-semibold text-muted underline underline-offset-2 hover:text-ink">Suspender autor</Link>}
              </p>
            )}
            {r.excerpt && <blockquote className="max-w-prose rounded-r-xl border-l-4 border-banana bg-paper/70 px-4 py-2.5 text-sm text-ink break-words text-pretty">“{r.excerpt.trim()}”</blockquote>}
            {r.details && <p className="max-w-prose text-sm text-body text-pretty"><b>Detalle del reporte:</b> {r.details}</p>}
            {r.resolution_note && <p className="text-xs text-muted">Nota de moderación: {r.resolution_note}{r.resolved_at ? `, ${fmtDateTime(r.resolved_at)}` : ""}</p>}
            <ActionForm action={moderateReport} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <input type="hidden" name="id" value={r.id} />
              <div className="min-w-0 flex-1">
                <label htmlFor={`note-${r.id}`} className="mb-1 block text-xs font-bold text-ink">{r.status === "abierto" ? "Nota (obligatoria para ocultar)" : "Nota (opcional)"}</label>
                <input id={`note-${r.id}`} name="note" maxLength={300} className={inputSm} />
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Decisión">
                {r.status === "abierto" ? (
                  <>
                    {r.target_type !== "user" && <DecisionButton value="oculto" danger>Ocultar</DecisionButton>}
                    <DecisionButton value="resuelto">Resolver</DecisionButton>
                    <DecisionButton value="descartado">Descartar</DecisionButton>
                  </>
                ) : <DecisionButton value="abierto">Reabrir</DecisionButton>}
              </div>
            </ActionForm>
          </li>
        ))}
      </ul>
      {!rows.length && (status === "abierto" ? <Empty title="No hay reportes pendientes">Cuando alguien reporte una publicación, un comentario o un perfil, aparece aquí.</Empty> : <Empty title="Sin reportes en este estado" action={<Link href="/admin/comunidad" className={btnGhost}>Ver abiertos</Link>} />)}
    </div>
  );
}

function DecisionButton({ value, children, danger }: { value: string; children: React.ReactNode; danger?: boolean }) {
  return <button type="submit" name="decision" value={value} className={danger ? btnDanger : btnGhost}>{children}</button>;
}
