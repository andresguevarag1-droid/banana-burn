import { redirect } from "next/navigation";
import { Crown, Info, Wallet } from "@/components/icons";
import { getViewer } from "@/lib/supabase/server";
import { getAffiliatePage } from "@/lib/affiliate-page";
import { AffShare } from "./share";
import { MethodForm } from "./method-form";

export const metadata = { title: "Mis referidos", robots: { index: false } };
export const dynamic = "force-dynamic";

const usd = (minor: number) => `$${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const n = (x: number) => x.toLocaleString("es-419");
const STATUS: Record<string, [string, string]> = {
  pagando: ["Pagando", "bg-peel/10 text-peel"], pago_fallido: ["Pago fallido", "bg-ember/15 text-ember-ink"],
  cancelado: ["Canceló", "bg-line text-muted"], registrado: ["Solo registro", "bg-line text-muted"],
};
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const period = (p: string) => { const [y, m] = p.split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; };
const date = (iso: string, tz: string) => new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long", timeZone: tz });

export default async function Afiliados() {
  const v = (await getViewer())!;
  const d = await getAffiliatePage(v);
  if (!d) redirect("/app");
  const s = d.settings;
  const top = s.tiers[s.tiers.length - 1];
  const t = d.tier;
  const pct = t.next ? Math.min(100, Math.round((d.stats.active / t.next.min) * 100)) : 100;

  return (
    <div className="max-w-2xl space-y-5 animate-enter">
      <header>
        <p className="eyebrow">Mis referidos</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink text-balance">Recomienda Banana Burn y gana cada mes</h1>
      </header>

      {d.demo && (
        <p className="flex items-start gap-2.5 rounded-2xl bg-ink p-4 text-sm text-white/90">
          <Info weight="duotone" className="size-5 shrink-0 text-banana" />
          <span><b>Modo demo:</b> el enlace, las personas y los montos de esta página son de ejemplo.</span>
        </p>
      )}
      {!d.active && <p className="rounded-2xl bg-banana-soft p-4 text-sm font-semibold text-banana-ink">Tu rol de referidor está pausado. Lo que ya ganaste se te paga igual; no se suman comisiones nuevas.</p>}

      <section aria-labelledby="aff-nivel" className="rounded-[1.5rem] bg-banana p-5 text-ink sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-ink/70">{t.level ? `Nivel ${t.level} de ${s.tiers.length}` : "Todavía sin nivel"}</p>
            <h2 id="aff-nivel" className="text-4xl font-extrabold tabular-nums">{t.rate} %</h2>
            <p className="mt-1 text-sm font-semibold">de lo que pagan tus referidos, en todos sus pagos.</p>
          </div>
          {t.level === s.tiers.length && <Crown weight="duotone" className="size-10 shrink-0" aria-hidden />}
        </div>
        <div className="mt-4">
          <div className="h-3 overflow-hidden rounded-full bg-white/60" role="progressbar" aria-valuemin={0} aria-valuemax={t.next?.min ?? d.stats.active} aria-valuenow={d.stats.active} aria-label="Referidos pagando">
            <div className="h-full rounded-full bg-ink transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-sm font-semibold">
            {t.next ? <>Tienes {n(d.stats.active)} referidos pagando. Te faltan <b>{n(t.toNext)}</b> para el {t.next.rate} %.</> : <>Tienes {n(d.stats.active)} referidos pagando: estás en el nivel máximo.</>}
          </p>
          {t.next?.min === top.min && <p className="mt-1 text-sm">En el {top.rate} % la app te sale gratis mientras te mantengas ahí.</p>}
          {d.perk && <p className="mt-2 rounded-2xl bg-white/70 p-3 text-sm font-semibold">Tu acceso a la app es gratis por estar en el nivel máximo.</p>}
        </div>
        <ol className="mt-4 grid grid-cols-4 gap-1.5 text-center text-xs font-bold" aria-label="Niveles">
          {s.tiers.map((x, i) => {
            const to = s.tiers[i + 1]?.min;
            return <li key={x.min} className={`rounded-xl px-1 py-2 ${t.level === i + 1 ? "bg-ink text-banana" : "bg-white/60"}`}><span className="block text-base font-extrabold">{x.rate} %</span>{to ? `${x.min} a ${to - 1}` : `${x.min} o más`}</li>;
          })}
        </ol>
      </section>

      <section aria-label="Tu enlace" className="card p-5 sm:p-6">
        <AffShare link={d.link} qr={d.qr} demo={d.demo} />
      </section>

      <section aria-labelledby="aff-saldo" className="card p-5 sm:p-6">
        <h2 id="aff-saldo" className="flex items-center gap-2 font-extrabold text-ink"><Wallet weight="duotone" className="size-5" aria-hidden />Tus ganancias</h2>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-2xl bg-paper p-3"><dt className="font-semibold text-muted">En espera</dt><dd className="text-xl font-extrabold tabular-nums text-ink">{usd(d.bal.pending)}</dd></div>
          <div className="rounded-2xl bg-banana-soft p-3"><dt className="font-semibold text-banana-ink">Disponible</dt><dd className="text-xl font-extrabold tabular-nums text-ink">{usd(d.bal.available)}</dd></div>
          <div className="rounded-2xl bg-paper p-3"><dt className="font-semibold text-muted">Pagado</dt><dd className="text-xl font-extrabold tabular-nums text-ink">{usd(d.bal.paid)}</dd></div>
        </dl>
        <p className="mt-3 text-sm text-muted">
          Cada pago espera {s.hold_days} días (por si hay un reembolso) y luego queda disponible. Pagamos a inicios de cada mes desde {usd(s.min_payout_minor)}: el próximo, alrededor del {date(d.nextPayout, v.tz)}.
          {!d.method && " Guarda tu método de pago para recibirlo."}
        </p>
        {d.months.length > 0 && (
          <table className="mt-4 w-full text-sm">
            <caption className="sr-only">Ganancias por mes</caption>
            <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="py-2 font-semibold">Mes</th><th className="py-2 text-right font-semibold">Ganado</th><th className="py-2 text-right font-semibold">Pagado</th></tr></thead>
            <tbody>{d.months.slice(0, 12).map((m) => (
              <tr key={m.period} className="border-b border-line/60 last:border-0">
                <td className="py-2 capitalize">{period(m.period)}{m.reversed > 0 && <span className="block text-xs text-muted normal-case">Reembolsos: {usd(m.reversed)}</span>}</td>
                <td className="py-2 text-right tabular-nums">{usd(m.earned)}</td>
                <td className="py-2 text-right tabular-nums">{usd(m.paid)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
        {d.payouts.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm">
            {d.payouts.slice(0, 6).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-paper px-3 py-2">
                <span className="capitalize">{period(p.period)}</span>
                <span className="tabular-nums font-bold text-ink">{usd(p.amount)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${p.status === "pagado" ? "bg-peel/10 text-peel" : "bg-banana-soft text-banana-ink"}`}>{p.status === "pagado" ? `Pagado${p.paidAt ? ` el ${date(p.paidAt, v.tz)}` : ""}` : "En proceso"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="aff-stats" className="card p-5 sm:p-6">
        <h2 id="aff-stats" className="font-extrabold text-ink">Tus números</h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {([["Visitas a tu enlace", d.stats.clicks_total, d.stats.clicks_month], ["Cuentas creadas", d.stats.signups_total, d.stats.signups_month], ["Pagando hoy", d.stats.active, null], ["Cancelaron", d.stats.canceled, null]] as const).map(([l, all, month]) => (
            <div key={l} className="rounded-2xl bg-paper p-3">
              <dt className="font-semibold text-muted">{l}</dt>
              <dd className="text-xl font-extrabold tabular-nums text-ink">{n(all)}</dd>
              {month !== null && <dd className="text-xs text-muted">{n(month)} este mes</dd>}
            </div>
          ))}
        </dl>
        {d.referrals.length > 0 ? (
          <ul className="mt-4 divide-y divide-line text-sm">
            {d.referrals.slice(0, 50).map((r, i) => {
              const [label, cls] = STATUS[r.status] ?? STATUS.registrado;
              return (
                <li key={`${r.created_at}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0"><p className="truncate font-bold text-ink">{r.label}</p><p className="text-xs text-muted">Desde el {date(r.created_at, v.tz)}{r.earned_minor > 0 ? `, te ha dado ${usd(r.earned_minor)}` : ""}</p></div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{label}</span>
                </li>
              );
            })}
          </ul>
        ) : <p className="mt-4 text-sm text-muted">Cuando alguien cree su cuenta con tu enlace, aparece aquí (solo nombre e inicial).</p>}
      </section>

      <section aria-labelledby="aff-metodo" className="card p-5 sm:p-6">
        <h2 id="aff-metodo" className="mb-3 font-extrabold text-ink">Método de pago</h2>
        <MethodForm current={d.method} />
      </section>

      <section aria-labelledby="aff-reglas" className="card p-5 sm:p-6">
        <h2 id="aff-reglas" className="font-extrabold text-ink">Reglas del programa</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-body">
          <li>Cuenta quien crea su cuenta nueva desde tu enlace en los {s.cookie_days} días siguientes a su visita. Si llegó por el enlace de otra persona después, cuenta el último enlace.</li>
          <li>Tu porcentaje depende de cuántos referidos están pagando hoy y aplica a todos sus pagos desde que llegas al nivel. Si bajas de nivel, los pagos nuevos usan el porcentaje nuevo.</li>
          <li>La comisión se calcula sobre lo que pagó la persona, sin impuestos y sin la comisión del procesador de pagos.</li>
          <li>Tu propia cuenta no cuenta, ni otra cuenta tuya, ni pagos con tu misma tarjeta. Las pruebas gratis y las cortesías no generan comisión.</li>
          <li>Si un pago se reembolsa, su comisión se anula. Si ya se te había pagado, se descuenta del siguiente pago.</li>
          <li>En el nivel máximo ({top.min} o más pagando) no pagas la app. Si bajas, el acceso gratis dura hasta fin de mes y te avisamos antes.</li>
          <li>Cuando compartas tu enlace en redes, di que ganas una comisión si alguien se suscribe (por ejemplo: &quot;Enlace de referido: gano una comisión si te suscribes&quot;). No prometas resultados de peso ni descuentos que no existen.</li>
        </ul>
        <p className="mt-3 text-xs text-muted">Detalles en los <a href="/terminos#afiliados" className="font-semibold underline">Términos</a>. Tú declaras estos ingresos según las leyes de tu país.</p>
      </section>
    </div>
  );
}
