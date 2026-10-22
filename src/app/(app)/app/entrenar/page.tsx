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
    <div className="space-y-5 animate-enter">
      <header>
        <p className="text-sm font-semibold text-muted">{a.mode === "recomp" ? "Programa Recomposición Banana" : "Programa Quema Banana"}{a.glp1.on ? " con Banana Shield" : ""}</p>
        <h1 className="mt-0.5 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">Semana {block} de 6{d.deload && <span className="whitespace-nowrap">, descarga <TreePalm weight="duotone" className="inline size-7 align-[-0.15em] text-sky" aria-hidden /></span>}</h1>
        <div className="mt-3 flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={6} aria-valuenow={block} aria-label={`Semana ${block} de 6`}>
          {[1, 2, 3, 4, 5, 6].map((w) => <span key={w} className={`h-2 flex-1 rounded-full ${w < block ? "bg-ink" : w === block ? "bg-ember" : w === 6 ? "bg-sky/30" : "bg-line"}`} />)}
        </div>
        <p className="mt-2 max-w-[65ch] text-sm text-muted">{a.trainDays} días por semana, nivel {a.level}{a.minutes ? `, ${a.minutes} min por sesión` : ""}. Ningún día repite al anterior ni al siguiente, los accesorios rotan cada lunes y la semana 6 es de descarga.</p>
      </header>
      <WeekTabs days={d.weekPlan} todayDow={d.today.dow} done={done} />
      <section className="rounded-[1.75rem] bg-ink text-white p-5 sm:p-6">
        <h2 className="flex items-start gap-2.5 text-2xl font-extrabold"><Lightning weight="fill" className="mt-1 size-6 shrink-0 text-banana" aria-hidden />¿Día ocupado? Entrena donde estés</h2>
        <p className="mt-1 text-sm text-white/70">Exprés sin equipo: cuerpo completo con tu peso en un espacio de 2 × 2 m. Cuenta para tu racha.</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[[10, "Activa"], [20, "Quema"], [30, "Completo"]].map(([m, l]) => (
            <Link key={m} href={`/app/entreno?expres=${m}`} className="pressable rounded-2xl bg-white/10 hover:bg-white/15 px-2 py-4 text-center">
              <p className="text-3xl font-extrabold text-banana tabular-nums leading-none">{m}<span className="ml-0.5 text-sm font-bold">min</span></p><p className="mt-1.5 text-xs font-bold text-white/70">{l}</p>
            </Link>
          ))}
        </div>
      </section>
      <Link href="/app/ejercicios" className="card p-4 flex items-center gap-3"><span className="grid place-items-center size-11 shrink-0 rounded-xl bg-banana-soft text-banana-ink" aria-hidden><Books weight="duotone" className="size-6" /></span><span className="flex-1"><span className="block font-extrabold text-ink">Biblioteca de {(1324).toLocaleString("es-CR")} ejercicios</span><span className="block text-sm text-muted">Busca por músculo o equipo, con pasos en español.</span></span><CaretRight weight="bold" className="size-5 shrink-0 text-faint" /></Link>
      <p className="text-sm text-faint text-center">¿Te perdiste un día? Toca cualquier día y hazlo ahora; el motor ajusta tus cargas igual.</p>
    </div>
  );
}
