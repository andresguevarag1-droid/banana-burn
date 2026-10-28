import Link from "next/link";
import { requireSection } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { ActionForm, Submit } from "@/components/admin/action-form";
import { Badge, DemoNotice, Empty, Notice, PageHeader, SectionHeading, btnGhost, fmtDateTime, link, panel } from "@/components/admin/ui";
import { EnablePush } from "@/components/notifications/enable-push";
import { ALERT_KINDS, DEFAULT_PREFS, KIND_LABEL, alertText, firstName, isAlertKind, normalizePrefs, type AdminEvent, type Person, type Prefs } from "@/lib/admin-avisos";
import { dispatchAdminEvents } from "@/lib/admin-avisos-server";
import { saveAlertPrefs, testAlert } from "./actions";

export const metadata = { title: "Avisos" };
export const dynamic = "force-dynamic";

type Row = AdminEvent & { dispatched_at: string | null; push_sent: number; email_sent: boolean };

const TONE: Record<string, "good" | "warn" | "info" | "muted"> = { pago: "good", temporada: "good", reto: "good", tarjeta: "info", registro: "info", referidor: "info", condominio: "info", cobro_fallido: "warn", cancelacion: "warn", prueba: "muted" };
const KIND_SHORT: Record<string, string> = { registro: "Registro", pago: "Pago", tarjeta: "Tarjeta", cobro_fallido: "Rechazo", cancelacion: "Cancelación", temporada: "Temporada", reto: "Reto", condominio: "Condominio", referidor: "Referidor", prueba: "Prueba" };

const DEMO_ROWS: Row[] = [
  { id: 3, event_key: "pago:onvo:demo", kind: "pago", user_id: null, amount_minor: 749, currency: "USD", data: { plan: "completo", billing: "mes", provider: "onvo" }, created_at: new Date(Date.now() - 20 * 60_000).toISOString(), dispatched_at: new Date().toISOString(), push_sent: 1, email_sent: false },
  { id: 2, event_key: "tarjeta:demo", kind: "tarjeta", user_id: null, amount_minor: 499, currency: "USD", data: { plan: "entreno", billing: "mes" }, created_at: new Date(Date.now() - 3 * 3600_000).toISOString(), dispatched_at: new Date().toISOString(), push_sent: 1, email_sent: false },
  { id: 1, event_key: "registro:demo", kind: "registro", user_id: null, amount_minor: null, currency: null, data: {}, created_at: new Date(Date.now() - 5 * 3600_000).toISOString(), dispatched_at: new Date().toISOString(), push_sent: 1, email_sent: false },
];

const check = "size-5 shrink-0 accent-[#1B1505]";
const option = "flex min-h-11 items-center gap-3 rounded-xl px-2 text-sm font-semibold text-ink hover:bg-paper";

export default async function Avisos() {
  const v = await requireSection("avisos");
  let prefs: Prefs = { ...DEFAULT_PREFS };
  let rows: Row[] = [];
  let people = new Map<string, Person>();
  let missing = false;
  if (v.demo) rows = DEMO_ROWS;
  else {
    // Lo que haya quedado sin mandar sale ahora (por si la base no pudo despertar al despachador).
    await dispatchAdminEvents().catch(() => null);
    const sb = await createClient();
    const [p, ev] = await Promise.all([
      sb.from("admin_notify_prefs").select("push,email,email_mode,in_app,daily_summary,kinds").eq("user_id", v.id).maybeSingle(),
      sb.from("admin_events").select("id,event_key,kind,user_id,amount_minor,currency,data,created_at,dispatched_at,push_sent,email_sent").order("created_at", { ascending: false }).limit(60),
    ]);
    if (ev.error) missing = true;
    prefs = normalizePrefs(p.data as Partial<Prefs> | null);
    rows = (ev.data ?? []) as Row[];
    const ids = [...new Set(rows.map((r) => r.user_id).filter((x): x is string => !!x))];
    const db = adminClient();
    if (db && ids.length) {
      const { data } = await db.from("profiles").select("id,full_name,country").in("id", ids);
      people = new Map((data ?? []).map((r) => [r.id as string, { firstName: firstName(r.full_name as string | null), country: (r.country as string | null) ?? null }]));
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Avisos" desc="Te avisamos cuando se registra alguien, cuando entra dinero y cuando algo falla con un cobro. Solo tú ves esta sección." />
      {v.demo && <DemoNotice what="estos avisos" />}
      {missing && <Notice tone="warn" title="Falta la migración 0059_avisos_admin.sql">Ejecútala en el SQL Editor de Supabase para recibir avisos.</Notice>}

      <section aria-labelledby="este-telefono" className={`${panel} space-y-3 p-4 sm:p-5`}>
        <SectionHeading id="este-telefono" title="1. Activa los avisos en este teléfono" desc="En iPhone primero instala Banana Burn en tu pantalla de inicio (Compartir, Agregar a inicio) y ábrela desde ahí. En Android puedes activarlos desde Chrome o desde la app instalada. Repite este paso en cada teléfono o computadora donde quieras recibirlos." />
        <EnablePush />
      </section>

      <section aria-labelledby="que-avisos" className={`${panel} p-4 sm:p-5`}>
        <SectionHeading id="que-avisos" title="2. Elige qué te avisamos y por dónde" />
        <ActionForm action={saveAlertPrefs} className="mt-4 grid gap-5 lg:grid-cols-2">
          <fieldset>
            <legend className="mb-1 text-xs font-bold text-ink">Qué te avisamos</legend>
            <div className="grid gap-0.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {ALERT_KINDS.map((k) => (
                <label key={k} className={option}><input type="checkbox" name="kinds" value={k} defaultChecked={prefs.kinds.includes(k)} className={check} />{KIND_LABEL[k]}</label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1 text-xs font-bold text-ink">Por dónde</legend>
            <label className={option}><input type="checkbox" name="push" defaultChecked={prefs.push} className={check} />Notificación en el teléfono, al instante</label>
            <label className={option}><input type="checkbox" name="in_app" defaultChecked={prefs.in_app} className={check} />Campanita de la app</label>
            <label className={option}><input type="checkbox" name="email" defaultChecked={prefs.email} className={check} />Correo</label>
            <div className="ml-10 mt-1 grid gap-0.5" role="radiogroup" aria-label="Cuándo llega el correo">
              <label className={option}><input type="radio" name="email_mode" value="resumen" defaultChecked={prefs.email_mode === "resumen"} className={check} />Solo el resumen del día</label>
              <label className={option}><input type="radio" name="email_mode" value="instante" defaultChecked={prefs.email_mode === "instante"} className={check} />Un correo por cada aviso</label>
            </div>
            <p className="ml-10 text-xs text-muted">Un correo por aviso gasta del límite diario de correos de la app. El resumen manda uno solo al día.</p>
            <label className={`${option} mt-2`}><input type="checkbox" name="daily_summary" defaultChecked={prefs.daily_summary} className={check} />Resumen del día a las 8:00 p. m.</label>
          </fieldset>
          <div className="lg:col-span-2"><Submit>Guardar avisos</Submit></div>
        </ActionForm>
      </section>

      <section aria-labelledby="probar" className={`${panel} p-4 sm:p-5`}>
        <SectionHeading id="probar" title="3. Prueba que te lleguen" desc="Manda un aviso de prueba solo a ti, por los canales que tengas encendidos." />
        <ActionForm action={testAlert} className="mt-3"><Submit className={btnGhost} pendingText="Enviando…">Probar notificación</Submit></ActionForm>
      </section>

      <section aria-labelledby="historial" className="space-y-3">
        <SectionHeading id="historial" title="Últimos avisos" desc="Lo más reciente primero. Toca uno para abrir la cuenta." />
        {rows.length === 0 ? <Empty title="Todavía no hay avisos">Cuando alguien se registre o entre un pago, aparece aquí.</Empty> : (
          <ul className={`${panel} divide-y divide-line`}>
            {rows.map((r) => {
              const t = alertText(r, r.user_id ? people.get(r.user_id) ?? null : null);
              return (
                <li key={r.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3">
                  <Badge tone={TONE[r.kind] ?? "muted"}>{KIND_SHORT[r.kind] ?? r.kind}</Badge>
                  <div className="min-w-0 flex-1 basis-56">
                    <Link href={t.url} className={`${link} font-bold`}>{t.title}</Link>
                    <p className="text-sm text-muted text-pretty">{t.body}</p>
                  </div>
                  <p className="text-xs text-muted tabular-nums">
                    {fmtDateTime(r.created_at)}
                    <span className="block">{!r.dispatched_at ? "Pendiente" : r.push_sent ? `Push a ${r.push_sent}` : isAlertKind(r.kind) ? "Sin push" : ""}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
