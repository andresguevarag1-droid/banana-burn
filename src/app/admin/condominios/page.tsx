import { requireSection } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ActionForm, Submit } from "@/components/admin/action-form";
import { CopyText } from "@/components/admin/copy-text";
import { Badge, DemoNotice, Empty, Field, Notice, PageHeader, SectionHeading, btnGhost, fmtDate, fmtDateTime, inputSm, link, panel, textareaSm } from "@/components/admin/ui";
import { STATUSES, roleLabel, statusLabel, timeLabel, type LeadStatus } from "@/lib/condominios";
import { CONDO_STATUSES, condoLapsed, condoLink, condoStatusLabel, condoWhatsapp, type CondoStatus } from "@/lib/condos";
import { condoStats } from "@/lib/condos-server";
import { adminClient } from "@/lib/supabase/admin";
import { PLANS } from "@/lib/plans";
import { createCondo, updateCondo, updateCondoLead } from "./actions";

export const metadata = { title: "Condominios" };
export const dynamic = "force-dynamic";

type Lead = {
  id: number; name: string; role: string; org_name: string; units: string | null; location: string | null; email: string; phone: string | null;
  times: string[]; days: string | null; portfolio?: string | null; comment: string | null; source: string | null; status: LeadStatus; notes: string | null; created_at: string;
};

type Condo = {
  id: number; code: string; name: string; admin_company: string | null; units: number | null; status: CondoStatus; free_starts_at: string; free_ends_at: string;
  paid_plan: "entreno" | "completo" | null; paid_until: string | null; notes: string | null; created_at: string;
};
const CONDO_TONE: Record<CondoStatus, "warn" | "info" | "good" | "muted"> = { mes_gratis: "info", activo: "good", terminado: "muted" };
const planName = (p: string | null) => PLANS.find((x) => x.id === p)?.name ?? "Sin plan";
const dayInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - 6 * 3600_000).toISOString().slice(0, 10) : "");

const DEMO_CONDOS: Condo[] = [
  { id: 1, code: "las-palmas", name: "Condominio Las Palmas", admin_company: "Administradora de ejemplo", units: 120, status: "mes_gratis", free_starts_at: new Date(Date.now() - 6 * 864e5).toISOString(), free_ends_at: new Date(Date.now() + 24 * 864e5).toISOString(), paid_plan: null, paid_until: null, notes: null, created_at: new Date(Date.now() - 6 * 864e5).toISOString() },
];

const TONE: Record<LeadStatus, "warn" | "info" | "good" | "muted"> = { nuevo: "warn", contactado: "info", reunion: "good", cerrado: "muted" };

const DEMO: Lead[] = [
  { id: 2, name: "Laura Mora", role: "administrador", org_name: "Condominio de ejemplo", units: "120 unidades", location: "San José, Escazú", email: "laura@ejemplo.com", phone: "8888 0000", times: ["manana"], days: "martes o jueves", portfolio: "Sí, 4 condominios", comment: "Tenemos gimnasio con máquinas y piscina.", source: "condominios", status: "nuevo", notes: null, created_at: new Date().toISOString() },
  { id: 1, name: "Carlos Rojas", role: "junta", org_name: "Residencial de ejemplo", units: null, location: "Heredia", email: "carlos@ejemplo.com", phone: null, times: ["noche"], days: null, comment: null, source: "condominios", status: "contactado", notes: "Reunión por videollamada.", created_at: new Date(Date.now() - 86400_000).toISOString() },
];

export default async function Condominios() {
  const v = await requireSection("condominios");
  let rows: Lead[] = [];
  let unavailable = false;
  let condos: Condo[] = [];
  let condosMissing = false;
  let stats = new Map<number, { members: number; activeWeek: number }>();
  if (v.demo) { rows = DEMO; condos = DEMO_CONDOS; stats = new Map([[1, { members: 38, activeWeek: 21 }]]); }
  else {
    const sb = await createClient();
    const COLS = "id,name,role,org_name,units,location,email,phone,times,days,comment,source,status,notes,created_at";
    let { data, error } = (await sb.from("b2b_leads").select(`${COLS},portfolio`).order("created_at", { ascending: false }).limit(200)) as { data: unknown[] | null; error: { code?: string } | null };
    // Sin 0053 (falta la columna portfolio): la lista de antes.
    if (error && (error.code === "42703" || error.code === "PGRST204")) ({ data, error } = await sb.from("b2b_leads").select(COLS).order("created_at", { ascending: false }).limit(200));
    if (error) unavailable = true;
    rows = (data ?? []) as Lead[];
    // Condominios afiliados: con service_role después de autorizar la sección (las notas no se leen por la API).
    const db = adminClient();
    if (db) {
      const { data: cs, error: cErr } = await db.from("condos").select("id,code,name,admin_company,units,status,free_starts_at,free_ends_at,paid_plan,paid_until,notes,created_at").order("created_at", { ascending: false }).limit(300);
      if (cErr) condosMissing = true;
      condos = (cs ?? []) as Condo[];
      stats = await condoStats(db, condos.map((c) => c.id)).catch(() => stats);
    }
  }
  const counts = STATUSES.map(([k, l]) => [l, rows.filter((r) => r.status === k).length] as const);

  return (
    <div className="space-y-5">
      <PageHeader title="Condominios" desc="Condominios afiliados con su enlace y su afiche, y las solicitudes de reunión virtual que llegan desde la página oculta /condominios." />
      {v.demo && <DemoNotice what="estos condominios y solicitudes" />}

      <section aria-labelledby="afiliados" className="space-y-3">
        <SectionHeading id="afiliados" title="Condominios afiliados" desc="Cada condominio tiene su enlace, su afiche con QR y un mensaje para WhatsApp. Quien se registra con el enlace tiene 30 días del plan completo. Al activarlo, sus residentes pasan al plan que paga el condominio hasta la fecha pagada (el cobro se hace fuera de la app). Aquí solo se ven conteos: nunca datos personales de los residentes." />
        {condosMissing && <Notice tone="warn" title="Falta la migración 0053_condominios_afiliados.sql">Ejecútala en el SQL Editor de Supabase para crear condominios.</Notice>}
        <details className={`${panel} group p-4 sm:p-5`} open={condos.length === 0}>
          <summary className="tap cursor-pointer list-none font-bold text-ink [&::-webkit-details-marker]:hidden">Crear un condominio</summary>
          <ActionForm action={createCondo} resetOnSuccess className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <Field label="Nombre del condominio" htmlFor="nc-name"><input id="nc-name" name="name" required minLength={2} maxLength={80} className={inputSm} /></Field>
            <Field label="Administradora (opcional)" htmlFor="nc-company"><input id="nc-company" name="admin_company" maxLength={100} className={inputSm} /></Field>
            <Field label="Unidades aprox. (opcional)" htmlFor="nc-units"><input id="nc-units" name="units" inputMode="numeric" pattern="[0-9]*" maxLength={5} className={inputSm} /></Field>
            <Field label="Código del enlace (opcional)" htmlFor="nc-code" hint="Si lo dejas vacío, sale del nombre."><input id="nc-code" name="code" maxLength={30} placeholder="las-palmas" className={inputSm} /></Field>
            {rows.length > 0 && (
              <Field label="Solicitud de origen (opcional)" htmlFor="nc-lead" className="sm:col-span-2">
                <select id="nc-lead" name="lead_id" defaultValue="" className={inputSm}><option value="">Ninguna</option>{rows.map((r) => <option key={r.id} value={r.id}>{r.org_name} ({r.name})</option>)}</select>
              </Field>
            )}
            <p className="text-sm text-muted sm:col-span-2">Mes gratis: plan completo por 30 días desde que cada residente lo activa.</p>
            <div className="lg:col-start-4"><Submit>Crear condominio</Submit></div>
          </ActionForm>
        </details>
        {condos.length === 0 ? (
          !condosMissing && <Empty title="Todavía no hay condominios afiliados">Crea el primero después de la reunión virtual.</Empty>
        ) : (
          <ul className="space-y-3">
            {condos.map((c) => {
              const st = stats.get(c.id) ?? { members: 0, activeWeek: 0 };
              const url = condoLink(c.code);
              const lapsed = condoLapsed(c);
              return (
                <li key={c.id} className={`${panel} p-4 sm:p-5`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-lg font-extrabold text-ink">{c.name}</p>
                      <p className="text-sm text-muted">{[c.admin_company, c.units ? `${c.units} unidades` : null].filter(Boolean).join(". ") || "Sin administradora"}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2"><Badge tone={lapsed ? "warn" : CONDO_TONE[c.status]}>{lapsed ? "Activo, vencido" : condoStatusLabel(c.status)}</Badge></div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl bg-paper px-3 py-2"><dt className="text-xs text-muted">Residentes vinculados</dt><dd className="text-xl font-extrabold tabular-nums text-ink">{st.members}</dd></div>
                    <div className="rounded-xl bg-paper px-3 py-2"><dt className="text-xs text-muted">Entrenaron esta semana</dt><dd className="text-xl font-extrabold tabular-nums text-ink">{st.activeWeek}</dd></div>
                    <div className="rounded-xl bg-paper px-3 py-2"><dt className="text-xs text-muted">Mes gratis</dt><dd className="text-sm font-semibold text-ink">{fmtDate(c.free_starts_at)} al {fmtDate(c.free_ends_at)}</dd></div>
                    <div className="rounded-xl bg-paper px-3 py-2"><dt className="text-xs text-muted">Plan del condominio</dt><dd className="text-sm font-semibold text-ink">{c.paid_plan ? `${planName(c.paid_plan)}${c.paid_until ? `, hasta ${fmtDate(c.paid_until)}` : ""}` : "Sin elegir"}</dd></div>
                  </dl>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a href={url} target="_blank" rel="noreferrer" className={`${link} break-all text-sm`}>{url}</a>
                    <CopyText value={url} label="Copiar enlace" />
                    <CopyText value={condoWhatsapp(c)} label="Copiar mensaje de WhatsApp" />
                    <Link href={`/admin/condominios/${c.id}/afiche`} className={btnGhost}>Afiche con QR</Link>
                  </div>
                  <details className="mt-3">
                    <summary className="tap cursor-pointer text-sm font-bold text-ink">Editar estado y datos</summary>
                    <ActionForm action={updateCondo} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
                      <input type="hidden" name="id" value={c.id} />
                      <Field label="Estado" htmlFor={`cs-${c.id}`}><select id={`cs-${c.id}`} name="status" defaultValue={c.status} className={inputSm}>{CONDO_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
                      <Field label="Plan que paga el condominio" htmlFor={`cp-${c.id}`}><select id={`cp-${c.id}`} name="paid_plan" defaultValue={c.paid_plan ?? ""} className={inputSm}><option value="">Sin elegir</option>{PLANS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
                      <Field label="Pagado hasta" htmlFor={`cu-${c.id}`}><input id={`cu-${c.id}`} name="paid_until" type="date" defaultValue={dayInput(c.paid_until)} className={inputSm} /></Field>
                      <Field label="Fin del mes gratis" htmlFor={`cf-${c.id}`}><input id={`cf-${c.id}`} name="free_ends_at" type="date" defaultValue={dayInput(c.free_ends_at)} className={inputSm} /></Field>
                      <Field label="Nombre" htmlFor={`cn-${c.id}`}><input id={`cn-${c.id}`} name="name" required minLength={2} maxLength={80} defaultValue={c.name} className={inputSm} /></Field>
                      <Field label="Administradora" htmlFor={`ca-${c.id}`}><input id={`ca-${c.id}`} name="admin_company" maxLength={100} defaultValue={c.admin_company ?? ""} className={inputSm} /></Field>
                      <Field label="Unidades" htmlFor={`cun-${c.id}`}><input id={`cun-${c.id}`} name="units" inputMode="numeric" pattern="[0-9]*" maxLength={5} defaultValue={c.units ?? ""} className={inputSm} /></Field>
                      <Field label="Notas internas" htmlFor={`cno-${c.id}`}><textarea id={`cno-${c.id}`} name="notes" rows={1} maxLength={2000} defaultValue={c.notes ?? ""} className={textareaSm} /></Field>
                      <p className="text-sm text-muted sm:col-span-2 lg:col-span-3">Activo: los residentes pasan al plan elegido hasta la fecha pagada. Terminado: el enlace deja de servir y nadie pierde lo que ya tenía, pero no se extiende.</p>
                      <Submit>Guardar</Submit>
                    </ActionForm>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="solicitudes" className="space-y-3 pt-4">
      <SectionHeading id="solicitudes" title="Solicitudes de reunión virtual" desc="Llegan desde /condominios y también por correo. Las más nuevas primero." />
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
                {(r.times.length > 0 || r.days) && <div><dt className="inline text-muted">Reunión virtual: </dt><dd className="inline">{[r.times.map(timeLabel).join(", "), r.days].filter(Boolean).join(". ")}</dd></div>}
                {r.portfolio && <div><dt className="inline text-muted">Varios condominios: </dt><dd className="inline">{r.portfolio}</dd></div>}
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
      </section>
    </div>
  );
}
