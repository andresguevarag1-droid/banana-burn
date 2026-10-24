import { requireSection } from "@/lib/admin-auth";
import { getSeasons } from "@/lib/seasons-server";
import { exName, listDrafts, seasonStats } from "@/lib/admin-seasons";
import { AREA_LABEL, GOALS, LEVEL_LABEL, PLACE_LABEL, SPORTS, longDate, parseSeasonSlug, type Area, type Level, type Place } from "@/lib/seasons";
import { Badge, DemoNotice, Empty, Kpi, Notice, PageHeader, SectionHeading, SubTabs, Table, Td, Th, fmtNum, fmtPct, panel, trHover } from "@/components/admin/ui";
import { EditDraft, GenerateDraft } from "./forms";

export const metadata = { title: "Temporadas" };

const pct = (x: number | null) => (x == null ? "Sin votos" : fmtPct(Math.round(x * 100)));

function Bars({ title, rows, label }: { title: string; rows: { k: string; n: number; pct: number }[]; label?: (k: string) => string }) {
  if (!rows.length) return null;
  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <ul className="space-y-1">
        {rows.slice(0, 6).map((r) => (
          <li key={r.k} className="grid grid-cols-[minmax(0,8rem)_1fr_3rem] items-center gap-2 text-sm">
            <span className="truncate text-body">{label ? label(r.k) : r.k}</span>
            <span className="h-2 rounded-full bg-paper"><span className="block h-2 rounded-full bg-ink" style={{ width: `${Math.round(r.pct * 100)}%` }} /></span>
            <span className="text-right tabular-nums text-muted">{r.n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function AdminTemporadas({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const v = await requireSection("retos");
  const sp = await searchParams;
  const seasons = await getSeasons(v.demo);
  const s = seasons.find((x) => x.slug === sp.t) ?? seasons[0];
  if (!s) return <Empty title="Sin temporadas">Aplica la migración 0047_temporadas.sql.</Empty>;
  const m = parseSeasonSlug(s.slug)!;
  const [stats, drafts] = await Promise.all([seasonStats(v, s.slug, m.sport), listDrafts(v, m.sport)]);

  return (
    <div className="space-y-5">
      <PageHeader title="Temporadas" desc="Lo que la gente opina y responde, sin datos personales. Con esto se arma la próxima temporada; nada se publica solo." back={{ href: "/admin/retos", label: "Retos" }} />
      {v.demo && <DemoNotice what="las temporadas (datos de ejemplo)" />}
      <SubTabs label="Temporada" items={seasons.map((x) => ({ href: `/admin/retos/temporadas?t=${x.slug}`, label: x.title, current: x.slug === s.slug }))} />
      <p className="text-sm text-muted">{SPORTS[m.sport].mode}. Del {longDate(s.startsOn)} al {longDate(s.endsOn)}; inscripciones hasta el {longDate(s.enrollUntil)}.</p>

      {"error" in stats ? <Notice tone="warn" title="Sin estadísticas">{stats.error}</Notice> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi label="Personas con la temporada" value={fmtNum(stats.owners)} />
            <Kpi label="La empezaron" value={fmtNum(stats.started)} />
            <Kpi label="Cuestionarios" value={fmtNum(stats.intakes.length)} />
            <Kpi label="Siguen en la semana 8" value={fmtPct(Math.round((stats.retention[7]?.pct ?? 0) * 100))} hint="De quienes entrenaron al menos una vez" />
            <Kpi label="Carreras con GPS" value={fmtNum(stats.runs.count)} hint={`${stats.runs.km.toLocaleString("es-419")} km en la temporada`} />
          </div>

          <section className={`${panel} p-4 space-y-3`} aria-labelledby="ret">
            <SectionHeading id="ret" title="Retención por semana" desc="Personas con al menos una sesión hecha en esa semana." />
            <ol className="grid grid-cols-8 items-end gap-2" aria-label="Retención por semana">
              {stats.retention.map((r) => (
                <li key={r.week} className="flex flex-col items-center gap-1">
                  <span className="text-xs tabular-nums text-muted">{Math.round(r.pct * 100)}%</span>
                  <span className="w-full rounded-t-md bg-ink" style={{ height: `${Math.max(4, Math.round(r.pct * 96))}px` }} />
                  <span className="text-xs font-semibold text-ink">S{r.week}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="space-y-3" aria-labelledby="ex">
            <SectionHeading id="ex" title="Ejercicios" desc="Se marcan para cambiar con menos de 50 % a favor (5 votos o más) o si se saltan en 30 % de las sesiones." />
            {stats.exercises.length ? (
              <Table caption="Opinión por ejercicio" captionHidden minWidth={720}>
                <thead><tr><Th>Ejercicio</Th><Th className="text-right">Votos</Th><Th className="text-right">A favor</Th><Th className="text-right">Saltos</Th><Th className="text-right">Muy difícil</Th><Th className="text-right">Muy fácil</Th><Th>Próxima temporada</Th></tr></thead>
                <tbody>
                  {stats.exercises.map((e) => (
                    <tr key={e.id} className={trHover}>
                      <Td><span className="font-semibold text-ink">{exName(e.id)}</span><span className="block text-xs text-muted">{e.id}</span></Td>
                      <Td className="text-right tabular-nums">{fmtNum(e.votes)}</Td>
                      <Td className="text-right tabular-nums">{pct(e.likeRate)}</Td>
                      <Td className="text-right tabular-nums">{fmtPct(Math.round(e.skipRate * 100))}</Td>
                      <Td className="text-right tabular-nums">{fmtNum(e.hard)}</Td>
                      <Td className="text-right tabular-nums">{fmtNum(e.easy)}</Td>
                      <Td>{stats.replace.includes(e.id) ? <Badge tone="bad">Cambiar</Badge> : e.votes >= 5 && (e.likeRate ?? 0) >= 0.8 ? <Badge tone="good">Se queda</Badge> : <Badge>Sin cambio</Badge>}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : <Empty title="Todavía sin opiniones">Aparecen cuando la gente termina sesiones de la temporada.</Empty>}
          </section>

          <section className={`${panel} p-4 space-y-4`} aria-labelledby="cu">
            <SectionHeading id="cu" title="Respuestas del cuestionario" desc={`${stats.summary.total} respuestas, ${stats.summary.withEvent} con un evento en la temporada. Sin nombres ni datos de contacto.`} />
            {stats.summary.total ? (
              <div className="grid gap-5 md:grid-cols-3">
                <Bars title="Nivel" rows={stats.summary.level} label={(k) => LEVEL_LABEL[k as Level] ?? k} />
                <Bars title="Objetivo" rows={stats.summary.goal} label={(k) => GOALS[m.sport].find((g) => g.id === k)?.label ?? k} />
                <Bars title="Dónde entrena" rows={stats.summary.place} label={(k) => PLACE_LABEL[k as Place] ?? k} />
                <Bars title="Sesiones por semana" rows={stats.summary.sessions} />
                <Bars title="Minutos" rows={stats.summary.minutes} />
                <Bars title="Molestias" rows={stats.summary.injuries} label={(k) => AREA_LABEL[k as Area] ?? k} />
              </div>
            ) : <p className="text-sm text-muted">Todavía no hay respuestas.</p>}
          </section>
        </>
      )}

      <section className="space-y-3" aria-labelledby="bo">
        <SectionHeading id="bo" title="Próxima temporada" desc="Parte de esta temporada y cambia lo marcado. Usa el asistente dentro del tope diario; sin cupo, notas por reglas." action={<GenerateDraft slug={s.slug} />} />
        {drafts.length ? drafts.map((d) => (
          <article key={d.id} className={`${panel} p-4 space-y-3`}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-ink">{d.content.title}</h3>
              <Badge tone={d.status === "publicado" ? "good" : d.status === "descartado" ? "muted" : "warn"}>{d.status === "publicado" ? "Creada en la tienda" : d.status === "descartado" ? "Descartado" : "Borrador"}</Badge>
              <span className="text-xs text-muted">Del {longDate(d.content.startsOn)} al {longDate(d.content.endsOn)}</span>
            </div>
            {d.content.changes.length ? (
              <ul className="space-y-1 text-sm">{d.content.changes.map((c) => <li key={c.from} className="text-body"><b className="text-ink">{exName(c.from)}</b> {c.to ? <>por <b className="text-ink">{exName(c.to)}</b></> : "sin cambio"}. <span className="text-muted">{c.reason}.</span></li>)}</ul>
            ) : <p className="text-sm text-muted">Sin ejercicios para cambiar: mismas sesiones.</p>}
            {d.status === "borrador" ? <EditDraft id={d.id} title={d.content.title} notes={d.content.notes} /> : <p className="whitespace-pre-line text-sm text-body">{d.content.notes}</p>}
          </article>
        )) : <Empty title="Sin borradores">Crea el primero con el botón de arriba.</Empty>}
      </section>
    </div>
  );
}
