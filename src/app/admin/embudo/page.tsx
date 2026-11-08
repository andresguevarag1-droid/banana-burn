import { requireSection } from "@/lib/admin-auth";
import { ActionForm, Submit } from "@/components/admin/action-form";
import { DemoNotice, Field, FilterBar, Kpi, Notice, PageHeader, SectionHeading, Table, Td, Th, fmtDay, fmtNum, fmtPct, fw, inputSm, money, panel, tr } from "@/components/admin/ui";
import { COUNTRY_NAME } from "@/lib/countries";
import {
  CARD_ERA_LABEL, NO_COUNTRY, ORIGIN_LABEL, STEPS, adsOf, applyFilters, buildAccounts, campaignsOf, cohortTable, countriesOf, crWeeks, netAfterAds, pctOf,
  type CardEra, type CohortRow, type Filters, type FunnelRows, type Origin, type Week,
} from "@/lib/embudo-plata";
import { getFunnel } from "@/lib/embudo-plata-server";
import { saveAdSpend } from "./actions";

export const metadata = { title: "Embudo" };
export const dynamic = "force-dynamic";

type Params = { semana?: string; pais?: string; origen?: string; tarjeta?: string; campana?: string; anuncio?: string };

/** Modo demo: cuentas inventadas y marcadas como demo, para revisar la pantalla sin base. */
function demoRows(weeks: Week[]): FunnelRows {
  const profiles: FunnelRows["profiles"] = [];
  const events: NonNullable<FunnelRows["events"]> = [];
  const finished: string[] = [], second: string[] = [], charges: NonNullable<FunnelRows["charges"]> = [], condo: string[] = [];
  const signup: NonNullable<FunnelRows["signup"]> = [];
  weeks.forEach((w, wi) => {
    for (let i = 0; i < 14 - wi; i++) {
      const id = `00000000-0000-4000-8000-${String(wi * 100 + i).padStart(12, "0")}`;
      profiles.push({ id, created_at: new Date(Date.parse(w.start) + (i % 7) * 86400_000 + 3600_000).toISOString(), role: "free", country: i % 5 === 0 ? "CO" : "CR" });
      if (i % 4 === 0) condo.push(id);
      else if (i % 3 === 0) signup.push({ user_id: id, utm_source: "meta", utm_medium: "paid", utm_campaign: "Demo noviembre", utm_content: i % 2 ? "Demo video" : "Demo carrusel", fbclid: null });
      const reach = i % 10;
      if (reach < 8) events.push({ user_id: id, name: "hoy_view" });
      if (reach < 6) events.push({ user_id: id, name: "workout_open" });
      if (reach < 5) events.push({ user_id: id, name: "workout_first_set_view" });
      if (reach < 4) events.push({ user_id: id, name: "workout_first_set" });
      if (reach < 3) finished.push(id);
      if (reach < 2) second.push(id);
      if (reach < 2 && wi > 0) charges.push({ user_id: id, status: reach === 0 ? "succeeded" : "scheduled", amount_minor: 499 });
    }
  });
  return { profiles, testers: [], condo, utm: [], signup, events, finished, second, charges, methods: [], subs: [] };
}

const ORIGINS = Object.keys(ORIGIN_LABEL) as Origin[];
const ERAS = Object.keys(CARD_ERA_LABEL) as CardEra[];

const NoData = () => <span className="text-sm text-muted">Sin dato</span>;

function Cell({ n, total }: { n: number | null; total: number }) {
  if (n === null) return <NoData />;
  const pct = pctOf(n, total);
  return (
    <span className="block tabular-nums">
      <span className="font-bold text-ink">{fmtNum(n)}</span>
      {pct !== null && <span className="block text-xs text-muted">{fmtPct(pct)}</span>}
    </span>
  );
}

const weekLabel = (w: Week) => `${fmtDay(w.key)} al ${fmtDay(new Date(Date.parse(w.end) - 86400_000 - 6 * 3600_000).toISOString().slice(0, 10))}`;

export default async function Embudo({ searchParams }: { searchParams: Promise<Params> }) {
  const v = await requireSection("embudo");
  const q = await searchParams;
  const weeks = crWeeks();
  const week = weeks.find((w) => w.key === q.semana) ?? weeks[0];
  const filters: Filters = {
    country: q.pais || undefined,
    origin: ORIGINS.includes(q.origen as Origin) ? (q.origen as Origin) : undefined,
    era: ERAS.includes(q.tarjeta as CardEra) ? (q.tarjeta as CardEra) : undefined,
    campaign: q.campana || undefined,
    ad: q.anuncio || undefined,
  };
  const filtered = Boolean(filters.country || filters.origin || filters.era || filters.campaign || filters.ad || q.semana);

  const { rows, spend } = v.demo ? { rows: demoRows(weeks), spend: new Map([[weeks[1].key, 40]]) } : await getFunnel(weeks);
  const accounts = rows ? buildAccounts(rows) : null;
  const shown = accounts ? applyFilters(accounts, filters) : null;
  const table: CohortRow[] | null = shown ? cohortTable(shown, weeks) : null;
  const current = table?.find((r) => r.week === week.key) ?? null;
  // Sin fila guardada para la semana: sin dato (no se asume $0).
  const ads = spend?.get(week.key) ?? null;
  const result = netAfterAds(current?.net ?? null, ads);
  const countries = accounts ? countriesOf(accounts) : [];
  // Solo los valores que existen en las 8 semanas.
  const campaigns = accounts ? campaignsOf(accounts) : [];
  const adNames = accounts ? adsOf(accounts, filters.campaign) : [];
  const originMissing = accounts?.some((a) => a.origin === null) ?? false;
  const estimated = table?.some((r) => r.estimated) ?? false;
  const unknownSources = rows ? (["events", "finished", "second", "charges", "methods", "subs"] as const).filter((k) => rows[k] === null).length : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Embudo de plata" desc="Cuentas nuevas por semana de registro (lunes a domingo, hora de Costa Rica), sin staff ni testers, y cuántas llegan a cada paso hasta pagar. Solo cantidades. Sirve para decidir cada semana dónde poner el presupuesto de anuncios." />
      {v.demo && <DemoNotice what="el embudo" />}
      {!v.demo && !rows && <Notice tone="warn" title="Sin dato">No se pudieron leer las cuentas nuevas o los testers. Revisa la conexión con la base (SUPABASE_SERVICE_ROLE_KEY en Vercel, la revisa Andrés).</Notice>}
      {unknownSources > 0 && <Notice tone="warn" title="Algunas fuentes no respondieron">Las columnas que dependen de ellas dicen &quot;Sin dato&quot;. Recarga en un momento.</Notice>}
      {originMissing && <Notice tone="warn" title="Sin origen">No se pudieron leer condominios o anuncios: los filtros de origen, campaña y anuncio no están disponibles.</Notice>}

      <FilterBar label="Filtros del embudo" filtered={filtered} clearHref="/admin/embudo">
        <Field label="Semana" htmlFor="e-sem" className={fw.select}>
          <select id="e-sem" name="semana" defaultValue={week.key} className={inputSm}>{weeks.map((w) => <option key={w.key} value={w.key}>{weekLabel(w)}</option>)}</select>
        </Field>
        <Field label="País" htmlFor="e-pais" className={fw.select}>
          <select id="e-pais" name="pais" defaultValue={filters.country ?? ""} className={inputSm}>
            <option value="">Todos</option>
            {countries.map((c) => <option key={c} value={c}>{COUNTRY_NAME[c] ?? c}</option>)}
            <option value={NO_COUNTRY}>Sin dato</option>
          </select>
        </Field>
        <Field label="Origen" htmlFor="e-origen" className={fw.select}>
          <select id="e-origen" name="origen" defaultValue={filters.origin ?? ""} className={inputSm} disabled={originMissing}>
            <option value="">Todos</option>
            {ORIGINS.map((o) => <option key={o} value={o}>{ORIGIN_LABEL[o]}</option>)}
          </select>
        </Field>
        <Field label="Campaña" htmlFor="e-campana" className={fw.select}>
          <select id="e-campana" name="campana" defaultValue={filters.campaign ?? ""} className={inputSm} disabled={originMissing}>
            <option value="">Todas</option>
            {campaigns.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Anuncio" htmlFor="e-anuncio" className={fw.select}>
          <select id="e-anuncio" name="anuncio" defaultValue={filters.ad ?? ""} className={inputSm} disabled={originMissing}>
            <option value="">Todos</option>
            {adNames.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Cuentas" htmlFor="e-tarjeta" className={fw.select}>
          <select id="e-tarjeta" name="tarjeta" defaultValue={filters.era ?? ""} className={inputSm}>
            <option value="">Todas</option>
            {ERAS.map((e) => <option key={e} value={e}>{CARD_ERA_LABEL[e]}</option>)}
          </select>
        </Field>
      </FilterBar>

      <section aria-labelledby="semana" className="space-y-2.5">
        <SectionHeading id="semana" title={`Semana del ${weekLabel(week)}`} desc="Cuentas que se registraron esa semana, con los filtros elegidos. El gasto en anuncios es el de toda la semana." />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Kpi label="Registros" value={current ? fmtNum(current.registrados) : <NoData />} />
          <Kpi label="Primeros entrenos" value={current?.steps.finished != null ? fmtNum(current.steps.finished) : <NoData />} />
          <Kpi label="Primeros pagos" value={current?.steps.paid != null ? fmtNum(current.steps.paid) : <NoData />} />
          <Kpi label="Ingreso neto" value={current?.net != null ? money(current.net) : <NoData />} hint={current?.estimated ? "Comisión estimada" : undefined} tone="muted" />
          <div className={`${panel} p-4`}>
            <ActionForm action={saveAdSpend}>
              <input type="hidden" name="week" value={week.key} />
              <label htmlFor="e-gasto" className="block text-[13px] font-semibold text-muted">Gasto en anuncios (USD)</label>
              <div className="mt-2 flex gap-2">
                <input id="e-gasto" name="amount" inputMode="decimal" autoComplete="off" required defaultValue={ads != null ? String(ads) : ""} placeholder="Sin dato"
                  className={`${inputSm} min-w-0 flex-1 tabular-nums`} />
                <Submit pendingText="Guardando…">Guardar</Submit>
              </div>
            </ActionForm>
          </div>
          <Kpi label="Ingreso neto menos anuncios" value={result != null ? money(result) : <NoData />} tone={result == null ? "muted" : result > 0 ? "good" : "bad"}
            hint={result == null ? undefined : result > 0 ? "La semana se pagó sola" : "Los anuncios todavía no se recuperan"} />
        </div>
      </section>

      <section aria-labelledby="tabla" className="space-y-2.5">
        <SectionHeading id="tabla" title="Últimas 8 semanas" desc="Cantidad y % sobre los registrados de cada semana. Pagaron: cobro de la prueba aprobado o suscripción vigente pagada. Ingreso neto: primer pago sin IVA (13 %) ni comisión (ONVO 3.9 % + $0.35, Tilopay 4.25 % + $0.35)." />
        {!table ? (
          <div className={`${panel} p-4`}><NoData /></div>
        ) : (
          <Table caption="Embudo de plata por semana de registro" captionHidden minWidth={1100}>
            <thead className="border-b border-line">
              <tr><Th>Semana</Th><Th className="text-right">Registrados</Th>{STEPS.map((s) => <Th key={s.key} className="text-right">{s.label}</Th>)}<Th className="text-right">Ingreso neto</Th></tr>
            </thead>
            <tbody>
              {table.map((r, i) => (
                <tr key={r.week} className={tr}>
                  <Td className="whitespace-nowrap font-semibold">{weekLabel(weeks[i])}</Td>
                  <Td className="text-right tabular-nums font-bold">{fmtNum(r.registrados)}</Td>
                  {STEPS.map((s) => <Td key={s.key} className="text-right"><Cell n={r.steps[s.key]} total={r.registrados} /></Td>)}
                  <Td className="text-right tabular-nums">{r.net === null ? <NoData /> : <span className="font-bold text-ink">{money(r.net)}{r.estimated && <span className="block text-xs font-normal text-muted">Estimado</span>}</span>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <p className="text-xs text-muted text-pretty">
          Origen: condominio si la cuenta está en un condominio; anuncio si la primera visita traía utm o fbclid (o el enlace de referidor los traía); si no, orgánico.
          Campaña y anuncio: utm_campaign y utm_content de la primera visita (docs/metas/atribucion.md).
          País: el del perfil. {estimated && "La comisión no se guarda con el cobro: se calcula con la tarifa y se marca como estimada."}
        </p>
      </section>
    </div>
  );
}
