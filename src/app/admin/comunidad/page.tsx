import Link from "next/link";
import { requireSection } from "@/lib/admin-auth";
import { listReports } from "@/lib/admin";
import { ActionForm } from "@/components/admin/action-form";
import { Badge, DemoNotice, Empty, MigrationNotice, Notice, PageHeader, fmtDateTime, inputSm } from "@/components/admin/ui";
import { moderateReport } from "../actions";

export const metadata = { title: "Comunidad" };

const STATUSES = [["abierto", "Abiertos"], ["oculto", "Ocultos"], ["resuelto", "Resueltos"], ["descartado", "Descartados"], ["todos", "Todos"]] as const;
const REASON: Record<string, string> = { spam: "Spam", acoso: "Acoso", contenido_inapropiado: "Contenido inapropiado", desinformacion_salud: "Desinformación de salud", otro: "Otro" };
const TONE: Record<string, "warn" | "bad" | "good" | "muted"> = { abierto: "warn", oculto: "bad", resuelto: "good", descartado: "muted" };

export default async function Comunidad({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const v = await requireSection("comunidad");
  const sp = await searchParams;
  const status = STATUSES.some(([k]) => k === sp.status) ? sp.status! : "abierto";
  const { rows, counts, needsMigration } = await listReports(v, status);

  return (
    <div className="space-y-6">
      <PageHeader title="Comunidad" desc="Cola de moderación. Ocultar marca el contenido como oculto: la comunidad debe filtrarlo con public.is_hidden(tipo, id)." />
      {v.demo && <DemoNotice what="los reportes" />}
      {needsMigration && <MigrationNotice />}
      <nav aria-label="Estado de reportes">
        <ul className="flex flex-wrap gap-2">
          {STATUSES.map(([k, l]) => (
            <li key={k}><Link href={k === "abierto" ? "/admin/comunidad" : `/admin/comunidad?status=${k}`} aria-current={k === status ? "page" : undefined}
              className={`inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-semibold border outline-none focus-visible:ring-4 focus-visible:ring-banana/50 ${k === status ? "bg-ink text-white border-ink" : "bg-white text-ink border-line hover:bg-paper"}`}>
              {l}{k === "abierto" && counts.abierto ? <span className="rounded-full bg-ember px-1.5 text-[11px] text-white">{counts.abierto}</span> : null}</Link></li>
          ))}
        </ul>
      </nav>

      <ul className="space-y-3" aria-label="Reportes">
        {rows.map((r) => (
          <li key={r.id} className="card p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={TONE[r.status]}>{r.status}</Badge>
              <Badge tone={r.reason === "desinformacion_salud" || r.reason === "acoso" ? "bad" : "info"}>{REASON[r.reason] ?? r.reason}</Badge>
              <span className="text-xs text-muted">{r.target_type} · <code>{r.target_id}</code> · reportado por {r.reporter_name ?? "usuario"} · {fmtDateTime(r.created_at)}</span>
            </div>
            {r.excerpt && <blockquote className="rounded-2xl border-l-4 border-banana bg-paper/70 px-4 py-3 text-sm text-ink">“{r.excerpt}”</blockquote>}
            {r.details && <p className="text-sm text-body"><b>Detalle del reporte:</b> {r.details}</p>}
            {r.resolution_note && <p className="text-xs text-muted">Nota de moderación: {r.resolution_note}{r.resolved_at ? ` · ${fmtDateTime(r.resolved_at)}` : ""}</p>}
            <ActionForm action={moderateReport} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <input type="hidden" name="id" value={r.id} />
              <div className="flex-1">
                <label htmlFor={`note-${r.id}`} className="block text-xs font-bold text-ink mb-1">Nota (obligatoria para ocultar)</label>
                <input id={`note-${r.id}`} name="note" maxLength={300} className={inputSm} />
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Decisión">
                {r.status === "abierto" ? (
                  <>
                    <DecisionButton value="oculto" danger>Ocultar</DecisionButton>
                    <DecisionButton value="resuelto">Resolver</DecisionButton>
                    <DecisionButton value="descartado">Descartar</DecisionButton>
                  </>
                ) : <DecisionButton value="abierto">Reabrir</DecisionButton>}
              </div>
            </ActionForm>
          </li>
        ))}
      </ul>
      {!rows.length && <div className="card"><Empty>{status === "abierto" ? "No hay reportes pendientes. 🙌" : "Sin reportes en este estado."}</Empty></div>}
      <Notice title="Integración">La comunidad crea reportes con <code>insert into reports (target_type, target_id, reporter, reason, details, excerpt)</code> (RLS: reporter = auth.uid()) y esconde lo moderado con <code>is_hidden()</code>.</Notice>
    </div>
  );
}

function DecisionButton({ value, children, danger }: { value: string; children: React.ReactNode; danger?: boolean }) {
  return <button type="submit" name="decision" value={value} className={danger ? "btn h-10! px-4! text-sm! bg-bad text-white hover:brightness-95" : "btn-ghost h-10! px-4! text-sm!"}>{children}</button>;
}
