import Link from "next/link";
import { requireSection } from "@/lib/admin-auth";
import { getDashboard } from "@/lib/admin";
import { delta, money, pct, RETENTION_WINDOWS, type Cell } from "@/lib/admin-kpis";
import { can, SECTION_CAPS, type Section } from "@/lib/admin-perms";
import { BarChart, LineChart } from "@/components/admin/charts";
import { DemoNotice, Kpi, Notice, PageHeader, Table, Td, Th, fmtDate } from "@/components/admin/ui";

export const metadata = { title: "Resumen" };

const SECTION_NAME: Record<Section, string> = { resumen: "Resumen", usuarios: "Usuarios", pagos: "Pagos", contenido: "Contenido", comunidad: "Comunidad", auditoria: "Auditoría" };

function RetCell({ c }: { c: Cell }) {
  if (c.rate === null) return <span className="text-faint" title="La ventana aún no termina para esta cohorte">—</span>;
  // Intensidad del fondo según la tasa (texto siempre oscuro para contraste AA).
  const a = Math.min(1, c.rate / 60);
  return (
    <span className="inline-flex min-w-16 justify-center rounded-lg px-2 py-1 font-bold tabular-nums text-ink" style={{ background: `rgb(255 214 10 / ${0.12 + a * 0.6})` }} title={`${c.n} de ${c.eligible} usuarios`}>
      {c.rate.toFixed(0)} %
    </span>
  );
}

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ sin_acceso?: string }> }) {
  const v = await requireSection("resumen");
  const { sin_acceso } = await searchParams;
  const d = await getDashboard(v);
  const dNew = delta(d.new_7, d.new_prev_7);
  const workouts = d.series.map((s) => ({ day: s.day, n: s.workouts }));
  const signups = d.series.map((s) => ({ day: s.day, n: s.signups }));
  const active = d.series.map((s) => ({ day: s.day, n: s.active }));
  const avgWorkouts = workouts.length ? (workouts.reduce((a, b) => a + b.n, 0) / workouts.length).toFixed(1) : "0";

  return (
    <div className="space-y-8">
      <PageHeader title="Resumen" desc={`Métricas al ${fmtDate(d.today)} (hora de Costa Rica). Activo = cualquier entreno, pesaje, registro diario o comida.`} />
      {sin_acceso && sin_acceso in SECTION_CAPS && <Notice tone="warn" title={`Tu rol no tiene acceso a ${SECTION_NAME[sin_acceso as Section]}`}>Pide a un admin si necesitas permiso.</Notice>}
      {d.source === "demo" && <DemoNotice what="las métricas" />}
      {d.source === "fallback" && <Notice tone="warn" title="Cálculo directo (sin funciones de KPIs)">Aplica 0005_admin.sql para calcular en la base de datos; mientras tanto se calcula desde lecturas directas (puede ser lento con muchos usuarios).</Notice>}

      <section aria-labelledby="kpi-usuarios" className="space-y-3">
        <h2 id="kpi-usuarios" className="eyebrow">Usuarios y uso</h2>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <Kpi label="Usuarios totales" value={d.users_total} hint={`${pct(d.onboarded, d.users_total)} % completó la bienvenida`} />
          <Kpi label="Nuevos 7 d" value={d.new_7} hint={dNew === null ? "sin semana previa" : `${dNew >= 0 ? "+" : ""}${dNew} % vs. semana previa`} tone={dNew === null ? "muted" : dNew >= 0 ? "good" : "bad"} />
          <Kpi label="Nuevos 30 d" value={d.new_30} />
          <Kpi label="Activos hoy" value={d.active_today} hint={`${pct(d.active_today, d.users_total)} % del total`} />
          <Kpi label="Activos 7 d" value={d.active_7} hint={`DAU/WAU ${pct(d.active_today, d.active_7)} %`} />
          <Kpi label="Entrenos hoy" value={d.workouts_today} hint={`${d.workouts_7} en 7 d · ${avgWorkouts}/día (30 d)`} />
        </div>
      </section>

      {d.revenue && (
        <section aria-labelledby="kpi-ingresos" className="space-y-3">
          <h2 id="kpi-ingresos" className="eyebrow">Ingresos</h2>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Kpi label="MRR estimado" value={money(d.revenue.mrr)} hint="USD · anual ÷ 12, sin pruebas ni cortesías" />
            <Kpi label="Conversión a pago" value={`${d.revenue.conversion} %`} hint={`${d.paying} pagando de ${d.users_total}`} />
            <Kpi label="Churn 30 d" value={`${d.revenue.churn.rate} %`} hint={`${d.revenue.churn.lost} de ${d.revenue.churn.base} suscriptores al inicio`} tone={d.revenue.churn.rate > 8 ? "bad" : "muted"} />
            <Kpi label="Cortesías activas" value={d.comps_active} hint="planes regalados vigentes" />
          </div>
          {can(v.role, "payments.view") && <p className="text-xs text-muted"><Link href="/admin/pagos" className="font-semibold text-ink underline underline-offset-2">Ver detalle de pagos →</Link></p>}
        </section>
      )}

      <section aria-labelledby="graficas" className="space-y-3">
        <h2 id="graficas" className="eyebrow">Últimos 30 días</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card p-5"><h3 className="font-bold text-ink">Entrenos por día</h3><p className="text-xs text-muted mb-3">Barra negra = hoy</p><BarChart data={workouts} label="Entrenos por día" /></div>
          <div className="card p-5"><h3 className="font-bold text-ink">Usuarios activos por día</h3><p className="text-xs text-muted mb-3">Cualquier registro</p><LineChart data={active} label="Usuarios activos por día" /></div>
          <div className="card p-5"><h3 className="font-bold text-ink">Altas por día</h3><p className="text-xs text-muted mb-3">Nuevas cuentas</p><BarChart data={signups} label="Altas por día" color="var(--color-sky)" /></div>
        </div>
      </section>

      <section aria-labelledby="retencion" className="space-y-3">
        <h2 id="retencion" className="eyebrow">Retención por cohorte semanal</h2>
        <Table caption="Retención de usuarios por semana de registro" minWidth={560}>
          <thead className="border-b border-line">
            <tr><Th>Semana de alta</Th><Th className="text-right">Usuarios</Th>
              <Th className="text-center">D1 <span className="sr-only">(día {RETENTION_WINDOWS.d1[0]})</span></Th>
              <Th className="text-center">D7 <span className="sr-only">(días {RETENTION_WINDOWS.d7.join("–")})</span></Th>
              <Th className="text-center">D30 <span className="sr-only">(días {RETENTION_WINDOWS.d30.join("–")})</span></Th></tr>
          </thead>
          <tbody>
            {d.retention.map((r) => (
              <tr key={r.cohort} className="border-b border-line last:border-0">
                <Td className="font-semibold text-ink whitespace-nowrap">{fmtDate(r.cohort)}</Td>
                <Td className="text-right tabular-nums">{r.size}</Td>
                <Td className="text-center"><RetCell c={r.d1} /></Td>
                <Td className="text-center"><RetCell c={r.d7} /></Td>
                <Td className="text-center"><RetCell c={r.d30} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="text-xs text-muted">D1 = volvió al día siguiente · D7 = activo en los días 7–13 · D30 = activo en los días 30–36. “—” = la ventana aún no termina.</p>
      </section>
    </div>
  );
}
