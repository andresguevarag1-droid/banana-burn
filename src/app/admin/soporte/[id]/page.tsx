import Link from "next/link";
import { notFound } from "next/navigation";
import { Flask, Lock } from "@/components/icons";
import { requireSection } from "@/lib/admin-auth";
import { getSupportTicketAdmin } from "@/lib/support-server";
import { CATEGORY_LABEL, PRIORITIES, PRIORITY_LABEL, STATUS_LABEL, slaLate, staffMoves, ticketNumber, waitLabel, type SupportCategory, type SupportPriority } from "@/lib/support";
import { ActionForm, Submit } from "@/components/admin/action-form";
import { Badge, DemoNotice, MetaList, PageHeader, fmtDateTime, inputSm, link, panel, textareaSm } from "@/components/admin/ui";
import { staffReply, staffUpdate } from "../actions";
import { ShotViewer } from "../shot";

export const metadata = { title: "Reporte de soporte" };

const CONTEXT_LABEL: Record<string, string> = { page: "Pantalla", version: "Versión", device: "Dispositivo", plan: "Plan", origin: "Desde" };
const EVENT_LABEL = (k: string, s: string | null, byUser: boolean) =>
  k === "creado" ? "Creado" : k === "respuesta" ? (byUser ? "La persona respondió" : "Respuesta del equipo") : k === "asignado" ? "Asignación" : k === "prioridad" ? "Prioridad" : `${byUser ? "La persona: " : ""}${STATUS_LABEL[s as keyof typeof STATUS_LABEL] ?? s}`;

export default async function TicketAdmin({ params }: { params: Promise<{ id: string }> }) {
  const v = await requireSection("soporte");
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) notFound();
  const d = await getSupportTicketAdmin(v, n);
  if (!d) notFound();
  const { t } = d;
  const moves = staffMoves(t.status);
  const late = slaLate(t);

  return (
    <div className="space-y-5">
      <PageHeader back={{ href: "/admin/soporte", label: "Soporte" }} title={t.title} desc={`${ticketNumber(t.id)}, ${CATEGORY_LABEL[t.category as SupportCategory] ?? t.category}, hace ${waitLabel(t.created_at)}`}
        meta={<>
          <Badge tone={t.status === "resuelto" ? "good" : t.status === "cerrado" ? "muted" : t.status === "necesita_info" ? "bad" : t.status === "en_proceso" ? "info" : "warn"}>{STATUS_LABEL[t.status]}</Badge>
          <Badge tone={t.priority === "urgente" ? "bad" : t.priority === "alta" ? "warn" : "muted"}>Prioridad {PRIORITY_LABEL[t.priority as SupportPriority]?.toLowerCase()}</Badge>
          {late && <Badge tone="bad">Más de 24 h sin respuesta</Badge>}
          {t.from_tester && <Badge tone="warn"><Flask weight="duotone" className="size-3.5" aria-hidden />Tester</Badge>}
        </>} />
      {v.demo && <DemoNotice what="los datos de este reporte" />}

      <div className="grid items-start gap-3 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <section aria-labelledby="t-conv" className={`${panel} space-y-4 p-4`}>
            <h2 id="t-conv" className="text-base font-bold text-ink">Conversación</h2>
            <article className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm">
              <p className="text-xs font-bold text-muted">{d.user.name}, {fmtDateTime(t.created_at)}</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-body">{t.body}</p>
            </article>
            {t.attachment_path && <ShotViewer ticketId={t.id} />}
            <ol className="space-y-2">
              {d.messages.map((m) => (
                <li key={m.id} className={`rounded-xl px-3 py-2.5 text-sm ${m.internal ? "border border-dashed border-[#F2C94C] bg-banana-soft/50" : m.author_kind === "equipo" ? "bg-ink text-white" : "border border-line bg-white"}`}>
                  <p className={`flex flex-wrap items-center gap-1.5 text-xs font-bold ${m.author_kind === "equipo" && !m.internal ? "text-banana" : "text-muted"}`}>
                    {m.internal && <><Lock className="size-3.5" aria-hidden />Nota interna, </>}{m.author_kind === "equipo" ? m.author_name ?? "Equipo" : d.user.name}, {fmtDateTime(m.created_at)}
                  </p>
                  <p className={`mt-1 whitespace-pre-wrap break-words ${m.author_kind === "equipo" && !m.internal ? "text-[#F4EEDC]" : "text-body"}`}>{m.body}</p>
                </li>
              ))}
            </ol>
            <ActionForm action={staffReply} className="space-y-2" resetOnSuccess>
              <input type="hidden" name="ticket" value={t.id} />
              <div><label htmlFor="r-body" className="mb-1 block text-xs font-bold text-ink">Responder</label>
                <textarea id="r-body" name="body" required maxLength={4000} rows={4} className={textareaSm} placeholder="Lo que lee la persona (o una nota interna, si marcas la casilla)" /></div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex min-h-10 items-center gap-2 text-sm text-ink"><input type="checkbox" name="internal" className="size-4 accent-[#1B1505]" />Nota interna (la persona no la ve)</label>
                <div className="min-w-44"><label htmlFor="r-status" className="mb-1 block text-xs font-bold text-ink">Y cambiar el estado a</label>
                  <select id="r-status" name="status" defaultValue="" className={inputSm}><option value="">{t.status === "recibido" ? "En proceso (automático)" : "Sin cambio"}</option>{moves.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></div>
                <Submit pendingText="Enviando…">Enviar</Submit>
              </div>
              <p className="text-xs text-muted">Para resolver, escribe el resumen de lo que se hizo y elige Resuelto: la persona lo recibe por correo.</p>
            </ActionForm>
          </section>
        </div>

        <div className="space-y-3">
          <section aria-labelledby="t-manage" className={`${panel} space-y-3 p-4`}>
            <h2 id="t-manage" className="text-base font-bold text-ink">Gestionar</h2>
            <ActionForm action={staffUpdate} className="space-y-3">
              <input type="hidden" name="ticket" value={t.id} />
              <div><label htmlFor="m-status" className="mb-1 block text-xs font-bold text-ink">Estado</label>
                <select id="m-status" name="status" defaultValue="" className={inputSm}><option value="">{STATUS_LABEL[t.status]} (actual)</option>{moves.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></div>
              <div><label htmlFor="m-pri" className="mb-1 block text-xs font-bold text-ink">Prioridad</label>
                <select id="m-pri" name="priority" defaultValue={t.priority} className={inputSm}>{PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select></div>
              <div><label htmlFor="m-asg" className="mb-1 block text-xs font-bold text-ink">Asignado a</label>
                <select id="m-asg" name="assignee" defaultValue={t.assigned_to ?? ""} className={inputSm}><option value="">{t.assigned_to ? "Sin cambio" : "Sin asignar"}</option>{t.assigned_to && <option value="nadie">Quitar asignación</option>}{d.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <Submit pendingText="Guardando…">Guardar cambios</Submit>
            </ActionForm>
          </section>

          <section aria-labelledby="t-person" className={`${panel} space-y-2 p-4 text-sm`}>
            <h2 id="t-person" className="text-base font-bold text-ink">Persona</h2>
            <p><Link href={`/admin/usuarios/${t.user_id}`} className={link}>{d.user.name}</Link>{d.user.email && <span className="block text-xs text-muted">{d.user.email}</span>}</p>
            <dl className="divide-y divide-line">
              {Object.entries(t.context ?? {}).map(([k, val]) => <div key={k} className="flex justify-between gap-3 py-1.5"><dt className="text-muted">{CONTEXT_LABEL[k] ?? k}</dt><dd className="min-w-0 break-words text-right font-semibold text-ink">{val}</dd></div>)}
            </dl>
          </section>

          <section aria-labelledby="t-hist" className={`${panel} space-y-2 p-4`}>
            <h2 id="t-hist" className="text-base font-bold text-ink">Historial</h2>
            <ol className="space-y-2">{d.events.map((e) => <li key={e.id} className="text-sm"><p className="font-semibold text-ink">{EVENT_LABEL(e.kind, e.status, e.by_user)}</p><MetaList items={[fmtDateTime(e.created_at)]} /></li>)}</ol>
          </section>
        </div>
      </div>
    </div>
  );
}
