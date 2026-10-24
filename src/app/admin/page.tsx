import Link from "next/link";
import { requireSection } from "@/lib/admin-auth";
import { getDashboard } from "@/lib/admin";
import { COACH_COST_PER_Q, getCoachTotals } from "@/lib/admin-coach";
import { delta, pct, RETENTION_WINDOWS, type Cell } from "@/lib/admin-kpis";
import { can, canSee, SECTION_CAPS, type Section } from "@/lib/admin-perms";
import { openSupportCount } from "@/lib/support-server";
import { getInstallStats } from "@/lib/install-stats";
import { BarChart, LineChart } from "@/components/admin/charts";
import { DemoNotice, Empty, Kpi, Notice, PageHeader, SectionHeading, Table, Td, Th, fmtDate, fmtNum, fmtPct, link, money, panel, tr } from "@/components/admin/ui";

export const metadata = { title: "Resumen" };

const SECTION_NAME: Record<Section, string> = { resumen: "Resumen", usuarios: "Usuarios", pagos: "Pagos", contenido: "Contenido", retos: "Retos", comunidad: "Comunidad", verificaciones: "Verificaciones", soporte: "Soporte", auditoria: "Auditoría", salud: "Salud" };

function RetCell({ c }: { c: Cell }) {
  if (c.rate === null) return <span className="text-xs text-muted" title={`${c.eligible} de la cohorte ya cumplieron esta ventana`}>En curso</span>;
  // Intensidad del fondo según la tasa (texto siempre oscuro para contraste AA).
  const a = Math.min(1, c.rate / 60);
  return (
    <span className="inline-flex min-w-16 justify-center rounded-lg px-2 py-1 font-bold tabular-nums text-ink" style={{ background: `rgb(255 214 10 / ${0.12 + a * 0.6})` }} title={`${c.n} de ${c.eligible} usuarios`}>
      {fmtPct(Math.round(c.rate))}<span className="sr-only"> ({c.n} de {c.eligible})</span>
    </span>
  );
}

const d0demo = (v: { demo?: boolean }) => Boolean(v.demo);

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ sin_acceso?: string }> }) {
  const v = await requireSection("resumen");
  const { sin_acceso } = await searchParams;
  const [d, coach, support, inst] = await Promise.all([getDashboard(v), getCoachTotals(v).catch(() => null), canSee(v.role, "soporte") ? openSupportCount(v).catch(() => null) : Promise.resolve(null), d0demo(v) ? Promise.resolve(null) : getInstallStats()]);
  const dNew = delta(d.new_7, d.new_prev_7);
  const workouts = d.series.map((s) => ({ day: s.day, n: s.workouts }));
  const signups = d.series.map((s) => ({ day: s.day, n: s.signups }));
  const active = d.series.map((s) => ({ day: s.day, n: s.active }));
  const avgWorkouts = fmtNum(workouts.length ? Math.round((workouts.reduce((a, b) => a + b.n, 0) / workouts.length) * 10) / 10 : 0);
  const hasCohorts = d.retention.some((r) => r.size > 0);

  return (
    <div className="space-y-7">
      <PageHeader title="Resumen" desc={`Métricas al ${fmtDate(d.today)}, hora de Costa Rica. Activo: cualquier entreno, pesaje, registro o comida.`} />
      {sin_acceso && sin_acceso in SECTION_CAPS && <Notice tone="warn" title={`Tu rol no tiene acceso a ${SECTION_NAME[sin_acceso as Section]}`}>Pide a un admin si necesitas permiso.</Notice>}
      {d.source === "demo" && <DemoNotice what="las métricas" />}
      {d.source === "fallback" && <Notice tone="warn" title="Cálculo directo (sin funciones de KPIs)">Aplica 0005_admin.sql para calcular en la base de datos; mientras tanto se calcula desde lecturas directas (puede ser lento con muchos usuarios).</Notice>}
      {support && (
        <Link href="/admin/soporte" className={`${panel} flex flex-wrap items-center gap-x-6 gap-y-2 p-4 outline-none transition-colors duration-150 hover:bg-white focus-visible:ring-4 focus-visible:ring-banana/50`}>
          <span className="min-w-0 flex-1"><span className="block text-base font-bold text-ink">Soporte</span><span className="block text-sm text-muted">Reportes de las personas: responde, cambia el estado y les avisamos.</span></span>
          <span className="tabular-nums"><b className="text-2xl font-extrabold text-ink">{fmtNum(support.open)}</b> <span className="text-sm text-muted">{support.open === 1 ? "caso abierto" : "casos abiertos"}</span></span>
          {support.late > 0 && <span className="chip h-7 bg-[#FDECEC] text-[#B4232A] tabular-nums">{fmtNum(support.late)} sin respuesta en 24 h</span>}
        </Link>
      )}
      {d.users_total === 0 && <Empty title="Todavía no hay usuarios">Cuando alguien cree su cuenta, sus métricas aparecen aquí.</Empty>}

      <section aria-labelledby="kpi-usuarios" className="space-y-2.5">
        <SectionHeading id="kpi-usuarios" title="Usuarios y uso" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <Kpi label="Usuarios totales" value={fmtNum(d.users_total)} hint={`${fmtPct(pct(d.onboarded, d.users_total))} completó la bienvenida`} />
          <Kpi label="Nuevos 7 d" value={fmtNum(d.new_7)} hint={dNew === null ? "sin semana previa" : `${dNew >= 0 ? "+" : ""}${fmtPct(dNew)} vs. semana previa`} tone={dNew === null ? "muted" : dNew >= 0 ? "good" : "bad"} />
          <Kpi label="Nuevos 30 d" value={fmtNum(d.new_30)} />
          <Kpi label="Activos hoy" value={fmtNum(d.active_today)} hint={`${fmtPct(pct(d.active_today, d.users_total))} del total`} />
          <Kpi label="Activos 7 d" value={fmtNum(d.active_7)} hint={`DAU/WAU ${fmtPct(pct(d.active_today, d.active_7))}`} />
          <Kpi label="Entrenos hoy" value={fmtNum(d.workouts_today)} hint={`${fmtNum(d.workouts_7)} en 7 d, ${avgWorkouts} por día en 30 d`} />
        </div>
      </section>

      {inst && (
        <section aria-labelledby="kpi-linkapp" className="space-y-2.5">
          <SectionHeading id="kpi-linkapp" title="LinkApp y avisos" />
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Kpi label="Instalada" value={fmtNum(inst.installed)} hint={`${fmtPct(pct(inst.installed, inst.users))} de los usuarios`} />
            <Kpi label="Instalada 7 d" value={fmtNum(inst.installed7)} hint="primera vez abierta instalada" />
            <Kpi label="Avisos activos" value={fmtNum(inst.push)} hint={`${fmtPct(pct(inst.push, inst.users))} de los usuarios`} />
            <Kpi label="Sin instalar" value={fmtNum(Math.max(0, inst.users - inst.installed))} hint="les sale la tarjeta en Hoy" tone="muted" />
          </div>
        </section>
      )}

      {coach && (
        <section aria-labelledby="kpi-coach" className="space-y-2.5">
          <SectionHeading id="kpi-coach" title="Coach Banana" />
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Kpi label="Preguntas hoy" value={fmtNum(coach.dayTotal)} hint={`${fmtNum(coach.usersToday)} personas`} />
            <Kpi label="Preguntas del mes" value={fmtNum(coach.monthTotal)} hint={`${fmtNum(coach.usersMonth)} personas`} />
            <Kpi label="Costo estimado del mes" value={money(Math.round(coach.monthTotal * COACH_COST_PER_Q * 100) / 100)} hint={`Aproximado, a unos USD ${COACH_COST_PER_Q.toLocaleString("es-419")} por pregunta`} />
            <Kpi label="Llegaron al tope hoy" value={fmtNum(coach.atLimitToday)} hint="Usaron todas sus preguntas del día" />
          </div>
        </section>
      )}

      {d.revenue && (
        <section aria-labelledby="kpi-ingresos" className="space-y-2.5">
          <SectionHeading id="kpi-ingresos" title="Ingresos" action={can(v.role, "payments.view") && <Link href="/admin/pagos" className={`text-sm ${link}`}>Ver pagos</Link>} />
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Kpi label="MRR estimado" value={money(d.revenue.mrr)} hint="En USD; anual ÷ 12, sin pruebas ni cortesías" />
            <Kpi label="Conversión a pago" value={fmtPct(d.revenue.conversion)} hint={`${fmtNum(d.paying)} pagando de ${fmtNum(d.users_total)}`} />
            <Kpi label="Churn 30 d" value={fmtPct(d.revenue.churn.rate)} hint={`${fmtNum(d.revenue.churn.lost)} de ${fmtNum(d.revenue.churn.base)} suscriptores al inicio`} tone={d.revenue.churn.rate > 8 ? "bad" : "muted"} />
            <Kpi label="Cortesías activas" value={fmtNum(d.comps_active)} hint="planes regalados vigentes" />
          </div>
        </section>
      )}

      <section aria-labelledby="graficas" className="space-y-2.5">
        <SectionHeading id="graficas" title="Últimos 30 días" />
        <div className="grid gap-3 lg:grid-cols-3">
          <div className={`${panel} p-4`}><h3 className="text-sm font-bold text-ink">Entrenos por día</h3><p className="mb-3 text-xs text-muted">La barra oscura es hoy</p><BarChart data={workouts} label="Entrenos por día" /></div>
          <div className={`${panel} p-4`}><h3 className="text-sm font-bold text-ink">Usuarios activos por día</h3><p className="mb-3 text-xs text-muted">Con cualquier registro</p><LineChart data={active} label="Usuarios activos por día" /></div>
          <div className={`${panel} p-4`}><h3 className="text-sm font-bold text-ink">Altas por día</h3><p className="mb-3 text-xs text-muted">Cuentas nuevas</p><BarChart data={signups} label="Altas por día" color="var(--color-sky)" /></div>
        </div>
      </section>

      <section aria-labelledby="retencion" className="space-y-2.5">
        <SectionHeading id="retencion" title="Retención por cohorte semanal" />
        {hasCohorts ? (
        <Table caption="Retención de usuarios por semana de registro" captionHidden minWidth={520}>
          <thead className="border-b border-line">
            <tr><Th className="w-2/5">Semana de alta</Th><Th className="text-right">Usuarios</Th>
              <Th className="text-center">D1 <span className="sr-only">(día {RETENTION_WINDOWS.d1[0]})</span></Th>
              <Th className="text-center">D7 <span className="sr-only">(días {RETENTION_WINDOWS.d7.join("–")})</span></Th>
              <Th className="text-center">D30 <span className="sr-only">(días {RETENTION_WINDOWS.d30.join("–")})</span></Th></tr>
          </thead>
          <tbody>
            {d.retention.map((r) => (
              <tr key={r.cohort} className={tr}>
                <Td className="font-semibold text-ink whitespace-nowrap">{fmtDate(r.cohort)}</Td>
                <Td className="text-right tabular-nums">{fmtNum(r.size)}</Td>
                <Td className="text-center"><RetCell c={r.d1} /></Td>
                <Td className="text-center"><RetCell c={r.d7} /></Td>
                <Td className="text-center"><RetCell c={r.d30} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
        ) : <Empty title="Sin cohortes todavía">Las cohortes aparecen cuando hay altas en las últimas 8 semanas.</Empty>}
        <p className="max-w-prose text-xs leading-relaxed text-muted text-pretty">D1: volvió al día siguiente. D7: activo entre los días 7 y 13. D30: activo entre los días 30 y 36. &quot;En curso&quot;: no todos en la cohorte han cumplido esa ventana, así que aún no se calcula.</p>
      </section>
    </div>
  );
}
