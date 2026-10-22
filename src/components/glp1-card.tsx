"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, BananaFlame, Drop, Egg, Leaf, ShieldCheck, SunHorizon, Syringe, type PhosphorIcon } from "@/components/icons";
import { setDaily } from "@/app/actions/daily";

type G = { protein: number; perMeal: number; kcalMin: number; fiber: number; waterL: number; meals: number; phase: "inyeccion" | "post" | "normal" };

const PHASE: Record<G["phase"], { I: PhosphorIcon; t: string; b: string }> = {
  inyeccion: { I: Syringe, t: "Día de inyección", b: "Comidas pequeñas y suaves, mucha agua. Si entrenas, modo suave: lo importante es no saltarte la fuerza." },
  post: { I: SunHorizon, t: "Día después de la inyección", b: "Es normal tener menos hambre y algo de náusea. Proteína primero en cada comida y entreno suave si lo necesitas." },
  normal: { I: ShieldCheck, t: "Día para construir", b: "Tu mejor día para entrenar fuerte: así le dices a tu cuerpo que conserve el músculo." },
};

/** Tarjeta del programa Banana Shield (GLP-1) en Hoy. */
export function Glp1Card({ g, nausea0, demo }: { g: G; nausea0: number; demo: boolean }) {
  const [nausea, setN] = useState(nausea0);
  const [, start] = useTransition();
  const ph = PHASE[g.phase];
  const pick = (n: number) => { setN(n); if (!demo) start(() => { setDaily("nausea", n); }); };
  return (
    <section className="rounded-[1.75rem] border-2 border-ink bg-white p-5" aria-labelledby="shield-t">
      <div className="flex items-center gap-2">
        <span className="grid place-items-center size-9 rounded-xl bg-ink text-banana"><ShieldCheck weight="duotone" className="size-5" /></span>
        <h3 id="shield-t" className="font-extrabold text-ink">Banana Shield <span className="font-semibold text-muted">para GLP-1</span></h3>
        <Link href="/app/glp1" className="tap ml-auto inline-flex items-center gap-1 text-sm font-bold text-banana-ink hover:text-ink">Guía <ArrowRight weight="bold" className="size-3.5" /></Link>
      </div>
      <p className="mt-3 flex items-center gap-2 font-extrabold text-ink"><ph.I weight="duotone" className="size-5 text-banana-ink" />{ph.t}</p>
      <p className="text-sm text-body">{ph.b}</p>
      <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        {([[<Egg key="i" weight="duotone" className="size-3.5" />, `${g.perMeal} g`, `proteína × ${g.meals - 1} comidas`], [<BananaFlame key="i" className="size-3.5" />, `≥ ${g.kcalMin.toLocaleString("es-CR")}`, "kcal mínimas"], [<Leaf key="i" weight="duotone" className="size-3.5" />, `${g.fiber} g`, "fibra"], [<Drop key="i" weight="duotone" className="size-3.5" />, `${g.waterL.toLocaleString("es-CR")} L`, "agua"]] as const).map(([icon, v, l]) => (
          <div key={l} className="rounded-2xl bg-cream p-3"><dt className="flex items-center justify-center gap-1 text-[11px] font-semibold text-muted"><span className="text-banana-ink">{icon}</span>{l}</dt><dd className="text-lg font-extrabold text-ink tabular-nums">{v}</dd></div>
        ))}
      </dl>
      <fieldset className="mt-4">
        <legend className="text-sm font-bold text-ink">¿Náuseas hoy?</legend>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {["Nada", "Leve", "Media", "Fuerte"].map((l, i) => (
            <button key={l} type="button" onClick={() => pick(i)} aria-pressed={nausea === i} className={`tap pressable h-10 rounded-xl text-sm font-bold ${nausea === i ? "bg-ink text-white" : "bg-cream text-ink"}`}>{l}</button>
          ))}
        </div>
        {nausea >= 2 && <p className="mt-2 text-sm text-body" role="status">Prueba comidas pequeñas cada 3 a 4 h, evita frituras y picante, y toma té de jengibre. Si no puedes retener líquidos, <b>llama a tu médico</b>.</p>}
      </fieldset>
    </section>
  );
}
