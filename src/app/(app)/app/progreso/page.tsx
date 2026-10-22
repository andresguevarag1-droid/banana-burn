import { getViewer } from "@/lib/supabase/server";
import { dashboard, getAthlete } from "@/lib/athlete";
import { getProgress, liftName, MAIN_LIFTS } from "@/lib/progress";
import { kcalAdjustment, weeklyTrend } from "@/lib/engine";
import { WeightChart } from "@/components/weight-chart";
import { WeighIn } from "@/components/weigh-in";
import { getDaily } from "@/lib/daily";
import { ProfileForm } from "./forms";

export const metadata = { title: "Progreso" };

const nf = (n: number, d = 1) => n.toLocaleString("es-CR", { minimumFractionDigits: d, maximumFractionDigits: d });

export default async function Progreso() {
  const v = (await getViewer())!;
  const a = await getAthlete(v);
  const d = dashboard(a);
  const [{ weights, lifts, workouts }, g] = await Promise.all([getProgress(v), getDaily(v, a.startWeight, a.currentWeight)]);
  const rate = weeklyTrend(weights.map((w) => ({ d: w.d, kg: w.v })));
  const adj = kcalAdjustment(rate, d.needPerWeek);
  const lost = a.startWeight - a.currentWeight;

  let insight: { tone: string; t: string; b: string };
  if (rate == null) insight = { tone: "bg-sky/10", t: "📏 Calibrando tu ritmo", b: "Pésate al menos 4 mañanas esta semana (al despertar, después del baño). Con eso calculo tu tendencia real." };
  else if (adj < 0) insight = { tone: "bg-ember/10", t: `🐢 Vas a ${nf(-rate, 2)} kg/sem, necesitas ${nf(d.needPerWeek, 2)}`, b: `Te bajo ${-adj} kcal al día (≈ ${Math.round(-adj / 4)} g de carbos menos) y súmale 2.000 pasos. Proteína intacta.` };
  else if (adj > 0) insight = { tone: "bg-banana-soft", t: `⚡ Vas muy rápido: ${nf(-rate, 2)} kg/sem`, b: `Te subo ${adj} kcal para no perder músculo ni fuerza. Lo rápido no dura; lo constante sí.` };
  else insight = { tone: "bg-peel/10", t: `✅ En ritmo: ${nf(-rate, 2)} kg/sem`, b: `Necesitas ${nf(d.needPerWeek, 2)} kg/sem para llegar a ${a.goalWeight} kg el ${new Date(a.goalDate + "T12:00:00").toLocaleDateString("es-CR", { day: "numeric", month: "long" })}. No cambies nada.` };

  return (
    <div className="space-y-6 animate-rise">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Progreso</p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">{lost > 0 ? `−${nf(lost)} kg desde que empezaste` : "Tu punto de partida"}</h1>
          <p className="mt-1 text-muted">{nf(a.currentWeight)} kg hoy · meta {a.goalWeight} kg · faltan {d.daysLeft} días</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] [&>*]:min-w-0">
        <section className="card p-5">
          <div className="flex items-center justify-between mb-2"><h2 className="font-bold text-ink">⚖️ Peso</h2></div>
          <WeightChart data={weights} goal={a.goalWeight} />
        </section>
        <div className="space-y-4">
          <section className={`rounded-[1.5rem] p-5 ${insight.tone}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Coach · ajuste semanal</p>
            <p className="mt-1 text-lg font-extrabold text-ink">{insight.t}</p>
            <p className="mt-1 text-sm text-body">{insight.b}</p>
          </section>
          <section className="card p-5">
            <h2 className="font-bold text-ink mb-3">Peso de hoy</h2>
            <WeighIn last={a.currentWeight} />
          </section>
        </div>
      </div>

      <section>
        <div className="flex items-baseline justify-between mb-3"><h2 className="font-bold text-ink">💪 Fuerza (1RM estimado)</h2><p className="text-xs text-muted">Si sube mientras bajas de peso = estás quemando grasa, no músculo</p></div>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {MAIN_LIFTS.map((k) => {
            const pts = lifts[k] ?? [];
            const cur = pts.at(-1)?.v, first = pts[0]?.v;
            const pct = cur && first ? ((cur - first) / first) * 100 : null;
            return (
              <div key={k} className="card p-4">
                <p className="text-sm font-semibold text-muted truncate">{liftName(k)}</p>
                <p className="mt-1 text-2xl font-extrabold text-ink tabular-nums">{cur ? `${nf(cur, 0)} kg` : "—"}</p>
                <p className="text-[10px] text-faint">1RM estimado</p>
                <p className={`text-xs font-bold ${pct && pct > 0 ? "text-peel" : "text-faint"}`}>{pct != null ? `${pct >= 0 ? "▲" : "▼"} ${nf(Math.abs(pct))} %` : "Sin datos aún"}</p>
                {pts.length > 1 && <div className="mt-2 -mx-1"><Spark data={pts.map((p) => p.v)} /></div>}
              </div>
            );
          })}
        </div>
      </section>

      <section id="logros" className="card p-5 scroll-mt-6">
        <div className="flex items-center gap-4">
          <span className="grid place-items-center size-14 rounded-2xl bg-banana text-3xl">{g.level.e}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Nivel {g.level.idx}</p>
            <p className="text-xl font-extrabold text-ink">{g.level.n}</p>
            <div className="mt-1.5 h-2.5 rounded-full bg-line overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-banana to-ember" style={{ width: `${Math.max(4, g.level.progress * 100)}%` }} /></div>
            <p className="mt-1 text-xs text-muted">{g.xp.toLocaleString("es-CR")} XP{g.level.next ? ` · ${g.level.toNext} para ${g.level.next.n}` : ""} · 🔥 racha {g.streak.days} días</p>
          </div>
        </div>
        <h2 className="mt-5 font-bold text-ink">🏅 Logros <span className="text-muted font-semibold">{g.badges.filter((b) => b.got).length}/{g.badges.length}</span></h2>
        <div className="mt-3 grid grid-cols-4 sm:grid-cols-8 gap-2">
          {g.badges.map((b) => (
            <div key={b.id} className={`rounded-2xl p-2 text-center ${b.got ? "bg-banana-soft" : "bg-cream opacity-60"}`} title={b.d}>
              <p className={`text-2xl ${b.got ? "" : "grayscale"}`}>{b.got ? b.e : "🔒"}</p>
              <p className="mt-1 text-[10px] font-bold leading-tight text-ink">{b.n}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-bold text-ink mb-3">🗓️ Últimos entrenos</h2>
        {workouts.length ? (
          <ul className="divide-y divide-line">
            {workouts.map((w, i) => (
              <li key={i} className="py-3 flex items-center gap-4">
                <span className="grid place-items-center size-11 rounded-2xl bg-banana-soft text-lg">{["😴", "😐", "🙂", "😄", "🤩"][(w.fun ?? 3) - 1] ?? "🏋️"}</span>
                <div className="flex-1 min-w-0"><p className="font-bold text-ink">{w.tpl}</p><p className="text-sm text-muted">{new Date(w.d + "T12:00:00").toLocaleDateString("es-CR", { weekday: "long", day: "numeric", month: "short" })}</p></div>
                <div className="text-right text-sm tabular-nums"><p className="font-bold text-ink">{w.vol.toLocaleString("es-CR")} kg</p><p className="text-muted">{w.sets} series</p></div>
              </li>
            ))}
          </ul>
        ) : <p className="text-muted">Tu primer entreno aparecerá aquí. ¡Hoy es buen día! 🍌</p>}
      </section>

      <details className="card group" open={!a.complete}>
        <summary className="cursor-pointer list-none p-5 flex items-center justify-between font-bold text-ink">🎯 Mi perfil y meta<span className="text-xl transition-transform group-open:rotate-45">+</span></summary>
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
