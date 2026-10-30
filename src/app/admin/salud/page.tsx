import { requireSection } from "@/lib/admin-auth";
import { getOpsHealth, type Beat } from "@/lib/admin-health";
import { beatState, byRoute, totals, type ErrorRow } from "@/lib/monitor/summary";
import { Badge, DemoNotice, Empty, Kpi, Nil, Notice, PageHeader, SectionHeading, Table, Td, Th, btnGhost, fmtDateTime, fmtNum, panel, tr } from "@/components/admin/ui";
import { SentryTest } from "@/components/admin/sentry-test";

export const metadata = { title: "Salud" };
export const dynamic = "force-dynamic";

const SOURCE: Record<string, string> = { client: "Navegador", boundary: "Pantalla de error", server: "Servidor" };
const TASK: Record<string, string> = { "cron:recordatorios": "Cron diario (avisos, cobros, retos, limpieza)", "cron:cobros": "Cron de cobros (00:20, solo cobros)" };
const INTEGRATION: Record<string, string> = {
  supabase: "Supabase (base y login)", serviceRole: "Service role (tareas del servidor)", anthropic: "Coach Banana (Anthropic)", onvo: "Pagos de planes (ONVO)",
  onvoOneTime: "Pagos de retos (ONVO)", resend: "Correos (Resend)", vapid: "Avisos push (VAPID)", cron: "Cron (CRON_SECRET)", emailUnsub: "Baja de correos firmada",
};

function BeatBadge({ b }: { b: Beat | undefined }) {
  const s = beatState(b);
  if (s === "ok") return <Badge tone="good">Bien</Badge>;
  if (s === "fallo") return <Badge tone="bad">Con fallas</Badge>;
  if (s === "atrasada") return <Badge tone="warn">Sin correr en más de 26 h</Badge>;
  return <Badge>Sin registros</Badge>;
}

function ErrorTable({ rows, caption }: { rows: ErrorRow[]; caption: string }) {
  return (
    <Table caption={caption} captionHidden minWidth={760}>
      <thead className="border-b border-line">
        <tr><Th>Ruta o área</Th><Th>Origen</Th><Th>Tipo</Th><Th>Mensaje (limpio)</Th><Th className="text-right">Veces</Th><Th>Última vez</Th></tr>
      </thead>
      <tbody>
        {rows.slice(0, 30).map((r, i) => (
          <tr key={`${r.route}-${r.kind}-${i}`} className={tr}>
            <Td className="font-mono text-xs text-ink whitespace-nowrap">{r.route}</Td>
            <Td className="text-sm whitespace-nowrap">{SOURCE[r.source] ?? r.source}</Td>
            <Td className="font-mono text-xs whitespace-nowrap">{r.kind}</Td>
            <Td className="max-w-80 truncate text-sm text-muted" >{r.message ? <span title={r.message}>{r.message}</span> : <Nil />}</Td>
            <Td className="text-right font-bold tabular-nums">{fmtNum(Number(r.hits))}</Td>
            <Td className="text-sm whitespace-nowrap">{fmtDateTime(r.last_at)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export default async function SaludPage() {
  const v = await requireSection("salud");
  const h = await getOpsHealth(v);
  const t24 = h.errors24 ? totals(h.errors24) : null;
  const t7 = h.errors7d ? totals(h.errors7d) : null;
  const routes24 = h.errors24 ? byRoute(h.errors24).slice(0, 8) : [];
  const cron = h.beats?.find((b) => b.name === "cron:recordatorios");
  const cobros = h.beats?.find((b) => b.name === "cron:cobros");

  return (
    <div className="space-y-7">
      <PageHeader title="Salud" desc="Estado técnico de la app: versión, base de datos, errores, tareas programadas y pagos. Sin datos de usuarios." />
      {h.demo && <DemoNotice what="los errores y las tareas" />}
      {h.migrationMissing && <Notice tone="warn" title="Falta la migración 0041_monitoreo.sql">Ejecútala en el SQL Editor de Supabase para guardar y ver los errores de la app y la última corrida del cron.</Notice>}

      <section aria-labelledby="estado" className="space-y-2.5">
        <SectionHeading id="estado" title="Estado" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Kpi label="Versión" value={<span className="font-mono">{h.build.commit ?? "local"}</span>} hint={h.build.builtAt ? `Build del ${fmtDateTime(h.build.builtAt)} (${h.build.env})` : `Entorno ${h.build.env}`} />
          <Kpi label="Base de datos" value={h.db.ok ? "Responde" : "Sin respuesta"} tone={h.db.ok ? "good" : "bad"} hint={h.db.ms !== null ? `${fmtNum(h.db.ms)} ms${h.db.via === "auth" ? " (vía Auth)" : ""}` : undefined} />
          <Kpi label="Errores 24 h" value={t24 ? fmtNum(t24.total) : "-"} tone={t24 && t24.total > 0 ? "bad" : "muted"} hint={t24 ? `${fmtNum(t24.server)} servidor, ${fmtNum(t24.boundary + t24.client)} navegador` : "Sin datos"} />
          <Kpi label="Errores 7 d" value={t7 ? fmtNum(t7.total) : "-"} hint={t7 ? `${fmtNum(t7.server)} servidor, ${fmtNum(t7.boundary + t7.client)} navegador` : "Sin datos"} />
        </div>
      </section>

      <section aria-labelledby="tareas" className="space-y-2.5">
        <SectionHeading id="tareas" title="Tareas y pagos" />
        <div className="grid gap-3 lg:grid-cols-2">
          <div className={`${panel} p-4 space-y-2`}>
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold text-ink">{TASK["cron:recordatorios"]}</h3><BeatBadge b={cron} /></div>
            {cron ? (
              <p className="text-sm text-muted">Última corrida: {fmtDateTime(cron.last_at)}{cron.ms !== null ? `, ${fmtNum(Math.round(cron.ms / 100) / 10)} s` : ""}. Corre todos los días a las 7:00 a. m. (hora de Costa Rica).</p>
            ) : <p className="text-sm text-muted">Todavía no hay registros. Aparecen después de la próxima corrida del cron con 0041 aplicada.</p>}
          </div>
          <div className={`${panel} p-4 space-y-2`}>
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold text-ink">{TASK["cron:cobros"]}</h3><BeatBadge b={cobros} /></div>
            {cobros ? (
              <p className="text-sm text-muted">Última corrida: {fmtDateTime(cobros.last_at)}{cobros.ms !== null ? `, ${fmtNum(Math.round(cobros.ms / 100) / 10)} s` : ""}. Corre todos los días a las 12:20 a. m. (hora de Costa Rica), 4 cobros a la vez.</p>
            ) : <p className="text-sm text-muted">Todavía no hay registros. Aparece después de su primera corrida.</p>}
          </div>
          <div className={`${panel} p-4 space-y-2`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-ink">Webhooks de pago con error (7 d)</h3>
              {h.webhookFails ? <Badge tone={h.webhookFails.count ? "bad" : "good"}>{fmtNum(h.webhookFails.count)}</Badge> : <Badge>Sin acceso</Badge>}
            </div>
            {h.webhookFails?.recent.length ? (
              <ul className="space-y-1 text-sm">
                {h.webhookFails.recent.map((w, i) => <li key={i} className="flex flex-wrap justify-between gap-2"><span className="font-mono text-xs text-ink">{w.type}</span><span className="text-muted tabular-nums">{fmtDateTime(w.received_at)}, {fmtNum(w.attempts)} {w.attempts === 1 ? "intento" : "intentos"}</span></li>)}
              </ul>
            ) : <p className="text-sm text-muted">{h.webhookFails ? "Ningún evento de ONVO quedó con error. ONVO reintenta los que fallan." : "Tu rol no puede leer los eventos de pago."}</p>}
          </div>
        </div>
      </section>

      <section aria-labelledby="rutas" className="space-y-2.5">
        <SectionHeading id="rutas" title="Errores por ruta (24 h)" desc="El mismo error repetido en 10 minutos cuenta como una fila con varias veces." />
        {h.errors24 === null ? <Empty title="Sin datos de errores">Aplica 0041_monitoreo.sql para empezar a registrarlos.</Empty>
          : routes24.length === 0 ? <Empty title="Sin errores en las últimas 24 horas">Todo en orden.</Empty>
          : (
            <div className={`${panel} p-4`}>
              <ul className="space-y-1.5">
                {routes24.map((r) => {
                  const max = routes24[0].hits || 1;
                  return (
                    <li key={r.route} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs text-ink" title={r.route}>{r.route}</p>
                        <div className="mt-1 h-2 rounded-full bg-line" aria-hidden><div className="h-2 rounded-full bg-ember" style={{ width: `${Math.max(4, (r.hits / max) * 100)}%` }} /></div>
                      </div>
                      <span className="font-bold tabular-nums text-ink">{fmtNum(r.hits)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
      </section>

      {h.errors7d && h.errors7d.length > 0 && (
        <section aria-labelledby="detalle" className="space-y-2.5">
          <SectionHeading id="detalle" title="Detalle (7 días)" desc="Los mensajes se guardan sin correos, números, ids ni tokens. El código de referencia de la pantalla de error (digest) coincide con el log de Vercel." />
          <ErrorTable rows={h.errors7d} caption="Errores de los últimos 7 días" />
        </section>
      )}

      <section aria-labelledby="integraciones" className="space-y-2.5">
        <SectionHeading id="integraciones" title="Integraciones" desc="Solo si la variable está puesta en Vercel; nunca se muestra su valor." />
        <div className={`${panel} p-4`}>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(h.integrations).map(([k, on]) => (
              <li key={k} className="flex items-center justify-between gap-2 text-sm"><span className="text-ink">{INTEGRATION[k] ?? k}</span><Badge tone={on ? "good" : "warn"}>{on ? "Configurada" : "Falta"}</Badge></li>
            ))}
          </ul>
          {h.missing.length > 0 && <p className="mt-3 text-xs text-muted text-pretty">Pendiente para producción: {h.missing.join("; ")}.</p>}
        </div>
      </section>

      <section aria-labelledby="sentry" className="space-y-2.5">
        <SectionHeading id="sentry" title="Probar Sentry" desc="Manda un error de prueba. En Sentry debe aparecer en un minuto, con el archivo y la línea donde ocurrió y sin datos de la cuenta." />
        <div className={`${panel} p-4`}><SentryTest className={btnGhost} /></div>
      </section>
    </div>
  );
}
