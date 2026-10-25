import { requireSection } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, Submit } from "@/components/admin/action-form";
import { Badge, DemoNotice, Empty, Field, Notice, PageHeader, fmtDateTime, inputSm, link, panel, textareaSm } from "@/components/admin/ui";
import { STATUSES, roleLabel, statusLabel, timeLabel, type LeadStatus } from "@/lib/condominios";
import { updateCondoLead } from "./actions";

export const metadata = { title: "Condominios" };
export const dynamic = "force-dynamic";

type Lead = {
  id: number; name: string; role: string; org_name: string; units: string | null; location: string | null; email: string; phone: string | null;
  times: string[]; days: string | null; comment: string | null; source: string | null; status: LeadStatus; notes: string | null; created_at: string;
};

const TONE: Record<LeadStatus, "warn" | "info" | "good" | "muted"> = { nuevo: "warn", contactado: "info", reunion: "good", cerrado: "muted" };

const DEMO: Lead[] = [
  { id: 2, name: "Laura Mora", role: "administrador", org_name: "Condominio de ejemplo", units: "120 unidades", location: "San José, Escazú", email: "laura@ejemplo.com", phone: "8888 0000", times: ["manana"], days: "martes o jueves", comment: "Tenemos gimnasio con máquinas y piscina.", source: "condominios", status: "nuevo", notes: null, created_at: new Date().toISOString() },
  { id: 1, name: "Carlos Rojas", role: "junta", org_name: "Residencial de ejemplo", units: null, location: "Heredia", email: "carlos@ejemplo.com", phone: null, times: ["noche"], days: null, comment: null, source: "condominios", status: "contactado", notes: "Reunión por videollamada.", created_at: new Date(Date.now() - 86400_000).toISOString() },
];

export default async function Condominios() {
  const v = await requireSection("condominios");
  let rows: Lead[] = [];
  let unavailable = false;
  if (v.demo) rows = DEMO;
  else {
    const sb = await createClient();
    const { data, error } = await sb.from("b2b_leads").select("id,name,role,org_name,units,location,email,phone,times,days,comment,source,status,notes,created_at").order("created_at", { ascending: false }).limit(200);
    if (error) unavailable = true;
    rows = (data ?? []) as Lead[];
  }
  const counts = STATUSES.map(([k, l]) => [l, rows.filter((r) => r.status === k).length] as const);

  return (
    <div className="space-y-5">
      <PageHeader title="Condominios" desc="Solicitudes de reunión que llegan desde la página oculta /condominios. Cada una también llega por correo. Las más nuevas primero." />
      {v.demo && <DemoNotice what="estas solicitudes" />}
      {unavailable && <Notice tone="warn" title="Falta la migración 0052_condominios.sql">Ejecútala en el SQL Editor de Supabase para ver las solicitudes.</Notice>}

      <dl className={`${panel} grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x`}>
        {counts.map(([l, n]) => (
          <div key={l} className="flex flex-col-reverse justify-end gap-1 px-4 py-3"><dt className="text-xs text-muted">{l}</dt><dd className="text-2xl font-extrabold leading-none tabular-nums text-ink">{n}</dd></div>
        ))}
      </dl>

      {rows.length === 0 ? (
        <Empty title="Todavía no hay solicitudes">Cuando una administración llene el formulario de /condominios, aparece aquí.</Empty>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className={`${panel} p-4 sm:p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-extrabold text-ink">{r.org_name}</p>
                  <p className="text-sm text-muted">{r.name}, {roleLabel(r.role)}{r.location ? `. ${r.location}` : ""}{r.units ? `. ${r.units}` : ""}</p>
                </div>
                <div className="flex items-center gap-2"><Badge tone={TONE[r.status]}>{statusLabel(r.status)}</Badge><span className="text-xs text-muted">{fmtDateTime(r.created_at)}</span></div>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div><dt className="inline text-muted">Correo: </dt><dd className="inline"><a href={`mailto:${r.email}`} className={link}>{r.email}</a></dd></div>
                {r.phone && <div><dt className="inline text-muted">Teléfono: </dt><dd className="inline"><a href={`https://wa.me/${r.phone.replace(/\D/g, "").replace(/^(\d{8})$/, "506$1")}`} target="_blank" rel="noreferrer" className={link}>{r.phone}</a></dd></div>}
                {(r.times.length > 0 || r.days) && <div><dt className="inline text-muted">Horario: </dt><dd className="inline">{[r.times.map(timeLabel).join(", "), r.days].filter(Boolean).join(". ")}</dd></div>}
                {r.source && r.source !== "condominios" && <div><dt className="inline text-muted">Enlace: </dt><dd className="inline">{r.source}</dd></div>}
              </dl>
              {r.comment && <p className="mt-2 whitespace-pre-line rounded-xl bg-paper px-3 py-2 text-sm">{r.comment}</p>}
              <ActionForm action={updateCondoLead} className="mt-3 grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
                <input type="hidden" name="id" value={r.id} />
                <Field label="Estado" htmlFor={`st-${r.id}`}>
                  <select id={`st-${r.id}`} name="status" defaultValue={r.status} className={inputSm}>{STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                </Field>
                <Field label="Notas internas" htmlFor={`nt-${r.id}`}>
                  <textarea id={`nt-${r.id}`} name="notes" rows={1} maxLength={2000} defaultValue={r.notes ?? ""} className={textareaSm} />
                </Field>
                <Submit>Guardar</Submit>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
