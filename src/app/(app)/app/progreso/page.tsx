import { getViewer } from "@/lib/supabase/server";
import { dashboard, getAthlete } from "@/lib/athlete";
import { getProgress, LIFTS_WEEKS } from "@/lib/progress";
import { kcalAdjustment, weeklyTrend } from "@/lib/engine";
import { WeightChart } from "@/components/weight-chart";
import { WeighIn } from "@/components/weigh-in";
import { getDaily } from "@/lib/daily";
import { ProfileForm } from "./forms";
import { Measures, Photos } from "./body";
import { ProgressBar } from "@/components/progress-bar";
import { FUN_LABELS } from "@/components/workout/logic";
import { getMeasures, getPhotos } from "@/lib/measures";
import { navyBodyFat } from "@/lib/body";
import { BananaCoin, BananaFlame, BananaMedal, Barbell, BrandIcon, Calendar, Camera, CheckCircle, Lightning, LevelIcon, Lock, Monkey, MonkeyBanana, CaretDown, Ruler, Scales, Smiley, SmileyMeh, SmileySad, Target, TrendDown, TrendUp, Timer, type PhosphorIcon } from "@/components/icons";

export const metadata = { title: "Progreso" };

const nf = (n: number, d = 1) => n.toLocaleString("es-419", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Encabezado de sección con ícono en mosaico. */
function H({ icon: I, children }: { icon: PhosphorIcon | typeof Monkey; children: React.ReactNode }) {
  return <h2 className="flex items-center gap-2 font-bold text-ink"><span className="grid place-items-center size-8 shrink-0 rounded-lg bg-banana-soft text-banana-ink"><I weight="duotone" className="size-5" /></span>{children}</h2>;
}
// Misma escala y etiquetas que la pregunta "¿Qué tan divertido estuvo?" del reproductor
const FUN: { I: PhosphorIcon; w: "duotone" | "fill"; l: string }[] = [
  { I: SmileySad, w: "duotone", l: FUN_LABELS[0] }, { I: SmileyMeh, w: "duotone", l: FUN_LABELS[1] }, { I: Smiley, w: "duotone", l: FUN_LABELS[2] }, { I: Smiley, w: "fill", l: FUN_LABELS[3] }, { I: Smiley, w: "fill", l: FUN_LABELS[4] },
];

export default async function Progreso() {
  const v = (await getViewer())!;
  const a = await getAthlete(v);
  const d = dashboard(a);
  const [{ weights, tracked, workouts }, g, measures, photos] = await Promise.all([getProgress(v), getDaily(v, a.startWeight, a.currentWeight), getMeasures(v), getPhotos(v)]);
  const lm = measures.at(-1);
  const bf = lm ? navyBodyFat({ sex: a.sex, heightCm: a.heightCm, waist: lm.waist, neck: lm.neck, hip: lm.hip }) : null;
  const rate = weeklyTrend(weights.map((w) => ({ d: w.d, kg: w.v })));
  const adj = kcalAdjustment(rate, d.needPerWeek);
  const lost = a.startWeight - a.currentWeight;

  let insight: { tone: string; icon: PhosphorIcon; ink: string; t: string; b: string };
  if (rate == null) insight = { tone: "bg-sky/10", icon: Ruler, ink: "text-sky", t: "Calibrando tu ritmo", b: "Pésate al menos 4 mañanas esta semana (al despertar, después del baño). Con eso calculo tu tendencia real." };
  else if (adj <= -150) insight = { tone: "bg-ember/10", icon: Timer, ink: "text-ember-ink", t: `Vas a ${nf(-rate, 2)} kg/sem, necesitas ${nf(d.needPerWeek, 2)}`, b: `Te bajo ${-adj} kcal al día (≈ ${Math.round(-adj / 4)} g de carbos menos) y súmale 2.000 pasos. Proteína intacta.` };
  else if (adj < 0) insight = { tone: "bg-banana-soft", icon: Target, ink: "text-banana-ink", t: `Casi: ${nf(-rate, 2)} de ${nf(d.needPerWeek, 2)} kg/sem`, b: `Vas bien, pero un poco por debajo del ritmo. Ajuste suave: −${-adj} kcal al día (media taza de arroz menos en la cena). Proteína intacta.` };
  else if (adj > 0) insight = { tone: "bg-banana-soft", icon: Lightning, ink: "text-banana-ink", t: `Vas muy rápido: ${nf(-rate, 2)} kg/sem`, b: `Te subo ${adj} kcal para no perder músculo ni fuerza. Lo rápido no dura; lo constante sí.` };
  else insight = { tone: "bg-peel/10", icon: CheckCircle, ink: "text-peel", t: `En ritmo: ${nf(-rate, 2)} kg/sem`, b: `Necesitas ${nf(d.needPerWeek, 2)} kg/sem para llegar a ${a.goalWeight} kg el ${new Date(a.goalDate + "T12:00:00").toLocaleDateString("es-419", { day: "numeric", month: "long" })}. No cambies nada.` };

  return (
    <div className="space-y-6 animate-enter">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">{lost > 0 ? `−${nf(lost)} kg desde que empezaste` : "Tu punto de partida"}</h1>
          <p className="mt-1 text-muted tabular-nums">Hoy pesas {nf(a.currentWeight)} kg. Tu meta es {a.goalWeight.toLocaleString("es-419")} kg y faltan {d.daysLeft} días.</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] [&>*]:min-w-0">
        <section className="card p-5">
          <div className="flex items-center justify-between mb-2"><H icon={Scales}>Peso</H></div>
          <WeightChart data={weights} goal={a.goalWeight} />
        </section>
        <div className="space-y-4">
          <section className={`rounded-[1.5rem] p-5 ${insight.tone}`}>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-muted"><Monkey className="size-4 text-ink" />Ajuste semanal del coach</p>
            <p className="mt-2 flex items-start gap-2.5 text-lg font-extrabold text-ink"><span className={`grid place-items-center size-9 shrink-0 rounded-xl bg-white/80 ${insight.ink}`}><insight.icon weight="duotone" className="size-5" /></span><span className="pt-1 leading-snug">{insight.t}</span></p>
            <p className="mt-1 text-sm text-body">{insight.b}</p>
          </section>
          <section className="card p-5">
            <h2 className="font-bold text-ink mb-3">Peso de hoy</h2>
            <WeighIn last={a.currentWeight} />
          </section>
        </div>
      </div>

      <dl className="card grid grid-cols-3 divide-x divide-line">
        {([
          [<Barbell key="i" weight="duotone" className="size-5" />, "bg-banana-soft text-banana-ink", g.workoutsTotal, "entrenos completados"],
          [<BananaFlame key="i" weight="fill" className="size-5" />, "bg-ember/10 text-ember-ink", g.streak.days, g.streak.days === 1 ? "día de racha" : "días de racha"],
          [<BananaCoin key="i" className="size-5" />, "bg-banana-soft text-banana-ink", g.xp.toLocaleString("es-419"), "XP total"],
        ] as const).map(([icon, tile, v2, l]) => (
          <div key={l} className="px-2 py-4 flex flex-col items-center text-center"><span aria-hidden className={`grid place-items-center size-9 rounded-xl ${tile}`}>{icon}</span><dt className="order-last text-[11px] font-semibold text-muted">{l}</dt><dd className="mt-1.5 text-2xl font-extrabold text-ink tabular-nums">{v2}</dd></div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <section className="card p-5"><div className="mb-3"><H icon={Ruler}>Medidas</H></div><Measures history={measures} bodyFat={bf} demo={v.demo} /></section>
        <section className="card p-5"><div className="mb-3"><H icon={Camera}>Fotos de progreso</H></div><Photos photos={photos} userId={v.id} demo={v.demo} /></section>
      </div>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-3"><H icon={Barbell}>Fuerza (1RM estimado)</H><p className="text-xs text-muted">Si sube mientras bajas de peso, estás quemando grasa y no músculo.</p></div>
        {tracked.length ? (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            {tracked.map((l) => {
              const pts = l.pts;
              const cur = pts.at(-1)?.v, first = pts[0]?.v;
              const pct = cur && first && pts.length > 1 ? ((cur - first) / first) * 100 : null;
              return (
                <div key={l.id} className="card p-4">
                  <p className="text-sm font-semibold text-muted line-clamp-2 leading-snug min-h-[2lh]">{l.name}</p>
                  <p className="mt-1 text-2xl font-extrabold text-ink tabular-nums">{cur ? `${nf(cur, 0)} kg` : <span className="text-faint">Sin dato</span>}</p>
                  <p className={`inline-flex items-center gap-1 text-xs font-bold ${pct && pct > 0 ? "text-peel" : "text-muted"}`}>{pct != null ? <>{pct >= 0 ? <TrendUp weight="bold" className="size-3.5" /> : <TrendDown weight="bold" className="size-3.5" />}<span className="sr-only">{pct >= 0 ? "Sube" : "Baja"}</span>{nf(Math.abs(pct))} %</> : "Un solo registro"}</p>
                  {pts.length > 1 && <div className="mt-2 -mx-1"><Spark data={pts.map((p) => p.v)} /></div>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card p-4 flex items-center gap-3 text-muted"><span className="grid place-items-center size-11 shrink-0 rounded-2xl bg-banana-soft text-banana-ink"><Barbell weight="duotone" className="size-6" /></span><p>Aquí verás tus ejercicios con carga más frecuentes de las últimas {LIFTS_WEEKS} semanas. Registra el peso de tus series en el entreno.</p></div>
        )}
      </section>

      <section id="logros" className="card p-5 scroll-mt-6">
        <div className="flex items-center gap-4">
          <span className="grid place-items-center size-16 shrink-0 rounded-2xl bg-banana-soft ring-1 ring-banana/40"><LevelIcon idx={g.level.idx} className="size-9" /></span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-muted">Nivel {g.level.idx}</p>
            <p className="text-xl font-extrabold text-ink">{g.level.n}</p>
            <ProgressBar value={g.level.progress} min={0.04} className="mt-1.5 h-2.5" fill="bg-ember" label={`Progreso del nivel ${g.level.idx}`} />
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1"><BananaCoin className="size-3.5 text-banana-ink" />{g.xp.toLocaleString("es-419")} XP{g.level.next ? `, faltan ${g.level.toNext} para ${g.level.next.n}` : ""}</span>
              <span className="inline-flex items-center gap-1"><BananaFlame className="size-3.5 text-ember-ink" />Racha de {g.streak.days} días</span>
            </p>
          </div>
        </div>
        <div className="mt-5"><H icon={BananaMedal}>Logros <span className="text-muted font-semibold tabular-nums">{g.badges.filter((b) => b.got).length}/{g.badges.length}</span></H></div>
        <div className="mt-3 grid grid-cols-4 sm:grid-cols-8 gap-2">
          {g.badges.map((b) => (
            <div key={b.id} role="img" aria-label={`Logro: ${b.n}, ${b.got ? "desbloqueado" : "bloqueado"}. ${b.d}.`} title={b.d}
              className={`flex flex-col items-center rounded-2xl p-2 text-center ${b.got ? "bg-banana-soft text-banana-ink ring-1 ring-banana/40" : "bg-cream text-faint"}`}>
              <span className="relative grid place-items-center size-10">
                <BrandIcon name={b.icon} weight="duotone" className={b.got ? "size-8" : "size-8 opacity-50"} />
                {!b.got && <span className="absolute -bottom-0.5 -right-0.5 grid place-items-center size-4.5 rounded-full bg-white text-muted ring-1 ring-line"><Lock weight="bold" className="size-2.5" /></span>}
              </span>
              <p className={`mt-1 text-[10px] font-bold leading-tight ${b.got ? "text-ink" : "text-muted"}`}>{b.n}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-3"><H icon={Calendar}>Últimos entrenos</H></div>
        {workouts.length ? (
          <ul className="divide-y divide-line">
            {workouts.map((w, i) => (
              <li key={i} className="py-3 flex items-center gap-4">
                {(() => { const f = FUN[(w.fun ?? 0) - 1]; return f ? <span className="grid place-items-center size-11 shrink-0 rounded-2xl bg-banana-soft text-banana-ink" title={`Diversión: ${f.l}`}><f.I weight={f.w} className="size-6" /><span className="sr-only">Diversión: {f.l}</span></span> : <span className="grid place-items-center size-11 shrink-0 rounded-2xl bg-banana-soft text-banana-ink"><Barbell weight="duotone" className="size-6" /></span>; })()}
                <div className="flex-1 min-w-0"><p className="font-bold text-ink">{w.tpl}</p><p className="text-sm text-muted">{new Date(w.d + "T12:00:00").toLocaleDateString("es-419", { weekday: "long", day: "numeric", month: "short" })}</p></div>
                <div className="text-right text-sm tabular-nums">{w.vol > 0 ? <><p className="font-bold text-ink">{w.vol.toLocaleString("es-419")} kg</p><p className="text-muted">{w.sets} series</p></> : <><p className="font-bold text-ink">{w.sets} series</p>{w.mins ? <p className="text-muted">{w.mins} min</p> : null}</>}</div>
              </li>
            ))}
          </ul>
        ) : <div className="flex items-center gap-3 text-muted"><span className="grid place-items-center size-11 shrink-0 rounded-2xl bg-banana-soft text-banana-ink"><MonkeyBanana className="size-6" /></span><p>Tu primer entreno aparecerá aquí. Hoy es buen día para empezar.</p></div>}
      </section>

      <details id="meta" className="card group scroll-mt-6" open={!a.complete}>
        <summary className="cursor-pointer list-none p-5 flex items-center justify-between"><H icon={Target}>Mi perfil y meta</H><CaretDown weight="bold" className="size-5 text-muted transition-transform duration-(--dur-fast) ease-out group-open:rotate-180" /></summary>
        <div className="px-5 pb-5"><ProfileForm a={a} /></div>
      </details>
    </div>
  );
}

function Spark({ data }: { data: number[] }) {
  const W = 120, H = 32, lo = Math.min(...data), hi = Math.max(...data), r = hi - lo || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - 3 - ((v - lo) / r) * (H - 6)}`).join(" ");
  return <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-8" aria-hidden><polyline points={pts} fill="none" stroke="#FF5A1F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
