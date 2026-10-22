"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { setDaily } from "@/app/actions/daily";

type G = { protein: number; perMeal: number; kcalMin: number; fiber: number; waterL: number; meals: number; phase: "inyeccion" | "post" | "normal" };

const PHASE = {
  inyeccion: { t: "💉 Día de inyección", b: "Comidas pequeñas y suaves, mucha agua. Si entrenas, modo suave: lo importante es no saltarte la fuerza." },
  post: { t: "🌤️ Día después de la inyección", b: "Es normal tener menos hambre y algo de náusea. Proteína primero en cada comida y entreno suave si lo necesitas." },
  normal: { t: "🛡️ Día para construir", b: "Tu mejor día para entrenar fuerte: así le dices a tu cuerpo que conserve el músculo." },
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
        <span className="grid place-items-center size-9 rounded-xl bg-ink text-banana"><ShieldCheck className="size-5" /></span>
        <h3 id="shield-t" className="font-extrabold text-ink">Banana Shield · GLP-1</h3>
        <Link href="/app/glp1" className="tap ml-auto text-sm font-bold text-banana-ink hover:text-ink">Guía →</Link>
      </div>
      <p className="mt-3 font-extrabold text-ink">{ph.t}</p>
      <p className="text-sm text-body">{ph.b}</p>
      <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        {[["🥩", `${g.perMeal} g`, `proteína × ${g.meals - 1} comidas`], ["🔥", `≥ ${g.kcalMin.toLocaleString("es-CR")}`, "kcal mínimas"], ["🥦", `${g.fiber} g`, "fibra"], ["💧", `${g.waterL.toLocaleString("es-CR")} L`, "agua"]].map(([e, v, l]) => (
          <div key={l} className="rounded-2xl bg-cream p-3"><dt className="text-[11px] font-semibold text-muted">{e} {l}</dt><dd className="text-lg font-extrabold text-ink tabular-nums">{v}</dd></div>
        ))}
      </dl>
      <fieldset className="mt-4">
        <legend className="text-sm font-bold text-ink">¿Náuseas hoy?</legend>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {["Nada", "Leve", "Media", "Fuerte"].map((l, i) => (
            <button key={l} type="button" onClick={() => pick(i)} aria-pressed={nausea === i} className={`tap pressable h-10 rounded-xl text-sm font-bold transition ${nausea === i ? "bg-ink text-white" : "bg-cream text-ink"}`}>{l}</button>
          ))}
        </div>
        {nausea >= 2 && <p className="mt-2 text-sm text-body" role="status">Prueba comidas pequeñas cada 3–4 h, evita frituras y picante, y toma té de jengibre. Si no puedes retener líquidos, <b>llama a tu médico</b>.</p>}
      </fieldset>
    </section>
  );
}
