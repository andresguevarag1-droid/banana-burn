import { requireSection } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, Submit } from "@/components/admin/action-form";
import { Badge, DemoNotice, Empty, Notice, PageHeader, Table, Td, Th, btnGhost, fmtDate, tr } from "@/components/admin/ui";
import { firstName } from "@/lib/admin-avisos";
import { COUNTRY_NAME } from "@/lib/countries";
import { setTestimonialApproval } from "./actions";

export const metadata = { title: "Testimonios" };
export const dynamic = "force-dynamic";

type Row = { id: number; stars: number; text: string | null; publish_ok: boolean; created_at: string; approved_at: string | null; name: string | null; country: string | null };

const DEMO: Row[] = [
  { id: 2, stars: 5, text: "Texto de ejemplo del modo demo: aquí sale lo que escribió la persona.", publish_ok: true, created_at: "2026-11-02T22:10:00Z", approved_at: null, name: "Ejemplo", country: "CR" },
  { id: 1, stars: 4, text: null, publish_ok: false, created_at: "2026-11-01T21:00:00Z", approved_at: null, name: "Ejemplo", country: "CO" },
];

/** Todas las opiniones (RLS: el admin lee todas), con nombre de pila y país del perfil. */
async function load(demo: boolean): Promise<{ rows: Row[]; unavailable: boolean }> {
  if (demo) return { rows: DEMO, unavailable: false };
  const sb = await createClient();
  const { data, error } = await sb.from("testimonials").select("id,user_id,stars,text,publish_ok,created_at,approved_at").order("created_at", { ascending: false }).limit(300);
  if (error) return { rows: [], unavailable: true };
  const ids = [...new Set((data ?? []).map((r) => r.user_id as string))];
  const { data: people } = ids.length ? await sb.from("profiles").select("id,full_name,country").in("id", ids) : { data: [] };
  const byId = new Map((people ?? []).map((p) => [p.id as string, p]));
  return {
    unavailable: false,
    rows: (data ?? []).map((r) => {
      const p = byId.get(r.user_id as string);
      return { id: Number(r.id), stars: Number(r.stars), text: (r.text as string | null) ?? null, publish_ok: !!r.publish_ok, created_at: String(r.created_at), approved_at: (r.approved_at as string | null) ?? null, name: firstName(p?.full_name as string | null), country: (p?.country as string | null) ?? null };
    }),
  };
}

export default async function Testimonios() {
  const v = await requireSection("testimonios");
  const { rows, unavailable } = await load(v.demo);
  const approved = rows.filter((r) => r.approved_at).length;
  return (
    <div className="space-y-6">
      <PageHeader title="Testimonios" desc={`Opiniones que deja cada persona al guardar su tercer entreno. Solo se pueden aprobar las que dieron permiso para publicarse con nombre de pila y país. Todavía no se muestran en ninguna parte. ${rows.length} en total, ${approved} aprobadas.`} />
      {v.demo && <DemoNotice what="estas opiniones" />}
      {unavailable && <Notice tone="warn" title="Falta configurar">Aplica la migración 0065_testimonios.sql en Supabase.</Notice>}
      {rows.length === 0 ? <Empty title="Todavía no hay opiniones">La tarjeta sale en el resumen del tercer entreno guardado.</Empty> : (
        <Table caption="Opiniones" captionHidden minWidth={860}>
          <thead className="border-b border-line"><tr><Th>Fecha</Th><Th>Persona</Th><Th>Estrellas</Th><Th>Opinión</Th><Th>Permiso</Th><Th>Uso</Th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={tr}>
                <Td className="whitespace-nowrap">{fmtDate(r.created_at)}</Td>
                <Td>{r.name ?? <span className="text-muted">Sin nombre</span>}<div className="text-xs text-muted">{r.country ? COUNTRY_NAME[r.country] ?? r.country : "Sin país"}</div></Td>
                <Td className="tabular-nums">{r.stars} de 5</Td>
                <Td className="max-w-md text-pretty">{r.text ?? <span className="text-muted">Sin texto</span>}</Td>
                <Td>{r.publish_ok ? <Badge tone="good">Se puede publicar</Badge> : <Badge>Solo para nosotros</Badge>}</Td>
                <Td>
                  {r.approved_at && <div className="mb-1"><Badge tone="good">Aprobada {fmtDate(r.approved_at)}</Badge></div>}
                  {r.publish_ok && (
                    <ActionForm action={setTestimonialApproval}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="approve" value={r.approved_at ? "0" : "1"} />
                      <Submit className={btnGhost} pendingText="Guardando…">{r.approved_at ? "Quitar aprobación" : "Aprobar"}</Submit>
                    </ActionForm>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
