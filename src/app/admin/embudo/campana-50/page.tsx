// #332: campaña "primer mes al 50 %" a las cuentas creadas antes de la tarjeta obligatoria. Muestra cuántas cuentas hay en cada
// segmento y la vista previa de cada correo. No envía nada solo: envía una tanda de hasta 50 cuando un admin toca "Enviar".
import { requireSection } from "@/lib/admin-auth";
import { can } from "@/lib/admin-perms";
import { ActionForm, Submit } from "@/components/admin/action-form";
import { Kpi, Notice, PageHeader, SectionHeading, panel } from "@/components/admin/ui";
import { adminClient } from "@/lib/supabase/admin";
import { campana50 } from "@/lib/email/templates";
import { loadAudience, type CampaignAudience } from "@/lib/campana-50-server";
import { BATCH_SIZE, OFFER_DAYS } from "@/lib/campana-50";
import { sendCampaign50 } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const metadata = { title: "Campaña 50 %" };

const SAMPLE_UNSUB = "https://bananaburn.app/api/email/baja";

export default async function Campana50() {
  const v = await requireSection("embudo");
  const allowed = can(v.role, "marketing.campaign");
  const admin = v.demo ? null : adminClient();
  let audience: CampaignAudience | null = v.demo ? { targets: [], counts: { entrenaron: 38, sin_entreno: 154 }, sent: 0 } : null;
  let err = false;
  if (admin) audience = await loadAudience(admin).catch(() => { err = true; return null; });
  const total = audience ? audience.counts.entrenaron + audience.counts.sin_entreno : 0;
  const previews = [
    { key: "entrenaron", label: "Entrenaron al menos una vez", mail: campana50({ segment: "entrenaron", progress: { workouts: 3, sets: 27, kg: 2150 }, unsubscribe: SAMPLE_UNSUB, offerDays: OFFER_DAYS }) },
    { key: "sin_entreno", label: "Nunca entrenaron", mail: campana50({ segment: "sin_entreno", progress: null, unsubscribe: SAMPLE_UNSUB, offerDays: OFFER_DAYS }) },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader title="Campaña 50 % cuentas actuales" back={{ href: "/admin/embudo", label: "Embudo" }}
        desc={`Cuentas creadas antes de la tarjeta obligatoria que nunca pagaron. Cada correo deja la oferta del primer mes al 50 % por ${OFFER_DAYS} días. Nada sale solo: cada toque envía una tanda de hasta ${BATCH_SIZE}.`} />
      {err && <Notice tone="warn" title="No pudimos leer la audiencia">Revisa que la migración 0078_campana_50_actuales.sql esté aplicada en Supabase.</Notice>}
      {audience && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi label="Entrenaron, sin pagar" value={audience.counts.entrenaron} />
          <Kpi label="Nunca entrenaron" value={audience.counts.sin_entreno} />
          <Kpi label="Ya enviados" value={audience.sent} hint="Una sola vez por cuenta" />
        </div>
      )}
      <p className="text-sm text-muted text-pretty">Fuera de la campaña: staff, testers, cortesías y condominios vigentes, quien ya pagó o tiene un cobro en curso y quien se dio de baja de los correos. Los correos rebotados no se envían.</p>

      {allowed ? (
        <section className={`${panel} p-5`} aria-labelledby="enviar">
          <SectionHeading id="enviar" title="Enviar" />
          <ActionForm action={sendCampaign50} className="mt-3 space-y-3">
            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" name="confirm" value="1" className="mt-1 size-4" required />
              <span>Revisé las vistas previas. Enviar la siguiente tanda (hasta {Math.min(BATCH_SIZE, total)} de {total} pendientes).</span>
            </label>
            <Submit pendingText="Enviando…">Enviar tanda</Submit>
          </ActionForm>
        </section>
      ) : (
        <Notice title="Solo un admin puede enviar esta campaña">Puedes ver los conteos y las vistas previas.</Notice>
      )}

      {previews.map((p) => (
        <section key={p.key} className="space-y-2" aria-labelledby={`prev-${p.key}`}>
          <SectionHeading id={`prev-${p.key}`} title={`${p.label}: «${p.mail.subject}»`} />
          <iframe title={`Vista previa: ${p.label}`} srcDoc={p.mail.html} sandbox="" className={`${panel} h-[640px] w-full`} />
        </section>
      ))}
    </div>
  );
}
