import { getViewer } from "@/lib/supabase/server";
import { dashboard, getAthlete } from "@/lib/athlete";
import { getDaily } from "@/lib/daily";
import { WeekTabs } from "./week-tabs";
import Link from "next/link";
import { mondayOf } from "@/lib/today";
import { Books, CaretRight, Lightning, TreePalm } from "@/components/icons";

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
        <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">Semana {block} de 6{d.deload && <span className="inline-flex items-center gap-1.5">, descarga <TreePalm weight="duotone" className="size-7 text-sky" /></span>}</h1>
        <div className="mt-3 flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={6} aria-valuenow={block} aria-label={`Semana ${block} de 6`}>
          {[1, 2, 3, 4, 5, 6].map((w) => <span key={w} className={`h-2 flex-1 rounded-full ${w < block ? "bg-ink" : w === block ? "bg-ember" : w === 6 ? "bg-sky/30" : "bg-line"}`} />)}
        </div>
        <p className="mt-2 text-sm text-muted">{a.trainDays} días por semana · nivel {a.level}{a.minutes ? `, ${a.minutes} min por sesión` : ""}. Ningún día repite al anterior ni al siguiente, los accesorios rotan cada lunes y la semana 6 es de descarga.</p>
      </header>
      <WeekTabs days={d.weekPlan} todayDow={d.today.dow} done={done} />
      <section className="rounded-[1.75rem] bg-ink text-white p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-banana">Exprés · sin equipo</p>
        <h2 className="mt-1 flex items-center gap-2 text-2xl font-extrabold">¿Día ocupado? Entrena donde estés <Lightning weight="fill" className="size-6 shrink-0 text-banana" /></h2>
        <p className="mt-1 text-sm text-white/70">Cuerpo completo con peso corporal en un espacio de 2 × 2 m. Cuenta para tu racha.</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[[10, "Activa"], [20, "Quema"], [30, "Completo"]].map(([m, l]) => (
            <Link key={m} href={`/app/entreno?expres=${m}`} className="rounded-2xl bg-white/10 hover:bg-white/15 p-4 text-center transition">
              <p className="text-3xl font-extrabold text-banana tabular-nums">{m}</p><p className="text-xs font-bold text-white/70">min · {l}</p>
            </Link>
          ))}
        </div>
      </section>
      <Link href="/app/ejercicios" className="card p-4 flex items-center gap-3"><span className="grid place-items-center size-11 shrink-0 rounded-xl bg-banana-soft text-banana-ink" aria-hidden><Books weight="duotone" className="size-6" /></span><span className="flex-1"><span className="block font-extrabold text-ink">Biblioteca de 1.324 ejercicios</span><span className="block text-sm text-muted">Busca por músculo o equipo, con pasos en español.</span></span><CaretRight weight="bold" className="size-5 shrink-0 text-faint" /></Link>
      <p className="text-sm text-faint text-center">¿Te perdiste un día? Toca cualquier día y hazlo ahora; el motor ajusta tus cargas igual.</p>
    </div>
  );
}
