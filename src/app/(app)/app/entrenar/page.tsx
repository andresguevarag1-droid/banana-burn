import { getViewer } from "@/lib/supabase/server";
import { dashboard, getAthlete } from "@/lib/athlete";
import { getDaily } from "@/lib/daily";
import { WeekTabs } from "./week-tabs";
import { mondayOf } from "@/lib/today";

export const metadata = { title: "Entrenar" };

export default async function Entrenar() {
  const v = (await getViewer())!;
  const a = await getAthlete(v);
  const d = dashboard(a);
  const g = await getDaily(v, a.startWeight, a.currentWeight);
  const block = (d.week % 6) + 1;
  const done = g.week.filter((w) => w.active && w.d < d.today.iso && w.d >= mondayOf(d.today.iso)).map((w) => new Date(w.d + "T12:00:00").getDay()).filter((dow) => d.weekPlan.find((p) => p.dow === dow)?.tpl);
  return (
    <div className="space-y-5 animate-rise">
      <header>
        <p className="eyebrow">Programa Recomposición Banana</p>
        <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">Semana {block} de 6{d.deload && " · descarga 🌴"}</h1>
        <div className="mt-3 flex gap-1.5" aria-label={`Semana ${block} de 6`}>
          {[1, 2, 3, 4, 5, 6].map((w) => <span key={w} className={`h-2 flex-1 rounded-full ${w < block ? "bg-ink" : w === block ? "bg-ember" : w === 6 ? "bg-sky/30" : "bg-line"}`} />)}
        </div>
        <p className="mt-2 text-sm text-muted">{a.trainDays} días por semana · ningún día repite al anterior ni al siguiente · los accesorios rotan cada lunes · la semana 6 es de descarga.</p>
      </header>
      <WeekTabs days={d.weekPlan} todayDow={d.today.dow} done={done} />
      <p className="text-sm text-faint text-center">¿Te perdiste un día? Toca cualquier día y hazlo ahora; el motor ajusta tus cargas igual.</p>
    </div>
  );
}
