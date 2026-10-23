import Link from "next/link";
import { requireSection } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, DemoNotice, Empty, MetaList, MigrationNotice, Notice, PageHeader, SubTabs, btnGhost, fmtDateTime, link, panel } from "@/components/admin/ui";
import { DOC_LABEL, type DocType } from "@/lib/identity";
import { COUNTRY_NAME } from "@/lib/countries";
import { Review } from "./review";

export const metadata = { title: "Verificaciones" };

const STATUSES = [["pendiente", "Pendientes"], ["aprobada", "Aprobadas"], ["rechazada", "Rechazadas"]] as const;
type Status = (typeof STATUSES)[number][0];
const TONE = { pendiente: "warn", aprobada: "good", rechazada: "bad" } as const;
const LABEL = { pendiente: "Pendiente", aprobada: "Aprobada", rechazada: "Rechazada" } as const;

type Row = { user_id: string; name: string | null; email: string | null; username: string | null; status: Status; doc_type: DocType; country: string; last3: string | null; id_name: string | null;
  submitted_at: string; attempts: number; reviewed_at: string | null; reviewer_name: string | null; rejection_reason: string | null; has_files: boolean };

/** Ejemplos del demo: datos inventados y marcados como ejemplo (no hay personas reales en el demo). */
function demoRows(status: Status): Row[] {
  const ago = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();
  const all: Row[] = [
    { user_id: "00000000-0000-4000-8000-00000000d001", name: "Carla Mora", email: "carla@ejemplo.com", username: "carla.fit", status: "pendiente", doc_type: "cedula_cr", country: "CR", last3: "417", id_name: "Carla Patricia Mora Solís", submitted_at: ago(3), attempts: 1, reviewed_at: null, reviewer_name: null, rejection_reason: null, has_files: true },
    { user_id: "00000000-0000-4000-8000-00000000d002", name: "Diego Solís", email: "diego@ejemplo.com", username: "diego.sol", status: "pendiente", doc_type: "pasaporte", country: "MX", last3: "C4X", id_name: "Diego Armando Solís Vega", submitted_at: ago(26), attempts: 2, reviewed_at: null, reviewer_name: null, rejection_reason: null, has_files: true },
    { user_id: "00000000-0000-4000-8000-00000000d003", name: "Fabián Rojas", email: "fabian@ejemplo.com", username: "fabi.rojas", status: "aprobada", doc_type: "dimex", country: "CR", last3: "908", id_name: null, submitted_at: ago(80), attempts: 1, reviewed_at: ago(70), reviewer_name: "Soporte Banana", rejection_reason: null, has_files: false },
    { user_id: "00000000-0000-4000-8000-00000000d004", name: "Valeria Jiménez", email: "vale@ejemplo.com", username: "vale.run", status: "rechazada", doc_type: "documento_nacional", country: "CO", last3: "552", id_name: null, submitted_at: ago(120), attempts: 1, reviewed_at: ago(118), reviewer_name: "Soporte Banana", rejection_reason: "La foto del documento está borrosa", has_files: false },
  ];
  return all.filter((r) => r.status === status);
}

export default async function Verificaciones({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const v = await requireSection("verificaciones");
  const sp = await searchParams;
  const status: Status = STATUSES.some(([k]) => k === sp.estado) ? (sp.estado as Status) : "pendiente";
  let rows: Row[] = [], pending = 0, needsMigration = false;
  if (v.demo) { rows = demoRows(status); pending = demoRows("pendiente").length; }
  else {
    const sb = await createClient();
    const [{ data, error }, p] = await Promise.all([sb.rpc("admin_identity_queue", { p_status: status }), status === "pendiente" ? Promise.resolve(null) : sb.rpc("admin_identity_queue", { p_status: "pendiente" })]);
    if (error) needsMigration = ["PGRST202", "42883"].includes(error.code ?? "");
    rows = (data ?? []) as Row[];
    pending = status === "pendiente" ? rows.length : ((p?.data ?? []) as Row[]).length;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Verificaciones de identidad" desc="Compara el nombre y los últimos 3 caracteres con las fotos y decide. Al decidir, las fotos y el nombre del documento se borran." />
      {v.demo && <DemoNotice what="las verificaciones y sus fotos" />}
      {needsMigration && <MigrationNotice />}
      <Notice title="Privacidad (Ley 8968)">Abre las fotos solo para decidir: los enlaces vencen en 60 segundos y cada apertura queda en Auditoría. No copies, descargues ni compartas imágenes ni datos del documento.</Notice>
      <SubTabs label="Estado de las verificaciones" items={STATUSES.map(([k, l]) => ({ href: k === "pendiente" ? "/admin/verificaciones" : `/admin/verificaciones?estado=${k}`, label: l, current: k === status, badge: k === "pendiente" ? pending : undefined }))} />

      <ul className="space-y-3" aria-label="Verificaciones">
        {rows.map((r) => (
          <li key={r.user_id} className={`${panel} space-y-3 p-4`}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
              <Badge tone="info">{DOC_LABEL[r.doc_type] ?? r.doc_type}</Badge>
              <MetaList className="sm:ml-1" items={[COUNTRY_NAME[r.country] ?? r.country, `Enviada ${fmtDateTime(r.submitted_at)}`, r.attempts > 1 ? `Intento ${r.attempts} de hoy` : null].filter(Boolean) as string[]} />
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <Link href={`/admin/usuarios/${r.user_id}`} className={link}>{r.name ?? "Ver ficha"}</Link>
              {r.email && <span className="text-muted">{r.email}</span>}
              {r.username && <Link href={`/app/comunidad/u/${r.username}`} className="text-xs font-semibold text-muted underline underline-offset-2 hover:text-ink">@{r.username}</Link>}
            </p>
            {r.status === "pendiente" ? (
              <dl className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-paper/70 px-3 py-2"><dt className="text-xs font-semibold text-muted">Nombre como aparece en el documento</dt><dd className="font-bold text-ink break-words">{r.id_name ?? "Sin dato"}</dd></div>
                <div className="rounded-xl bg-paper/70 px-3 py-2"><dt className="text-xs font-semibold text-muted">Últimos 3 caracteres del documento</dt><dd className="font-mono text-lg font-bold tracking-[.3em] text-ink">{r.last3 ?? "Sin dato"}</dd></div>
              </dl>
            ) : (
              <p className="text-sm text-muted">{r.status === "aprobada" ? "Aprobada" : "Rechazada"} {r.reviewed_at ? fmtDateTime(r.reviewed_at) : ""}{r.reviewer_name ? ` por ${r.reviewer_name}` : r.status === "rechazada" ? " por vencimiento" : ""}.{r.rejection_reason ? ` Motivo: ${r.rejection_reason}.` : ""} {r.has_files ? "Fotos pendientes de borrar (el cron diario las borra)." : "Fotos y nombre del documento borrados."}</p>
            )}
            {r.status === "pendiente" && (r.user_id === v.id ? <p className="text-sm font-semibold text-bad">Es tu propia verificación: la tiene que revisar otra persona del equipo.</p> : <Review userId={r.user_id} name={r.name ?? "esta persona"} />)}
          </li>
        ))}
      </ul>
      {!rows.length && (status === "pendiente" ? <Empty title="No hay verificaciones pendientes">Cuando alguien envíe su documento desde Mi perfil, aparece aquí.</Empty> : <Empty title="Sin verificaciones en este estado" action={<Link href="/admin/verificaciones" className={btnGhost}>Ver pendientes</Link>} />)}
    </div>
  );
}
