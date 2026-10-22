"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { PLANS, annualSavingPct, perMonthAnnual, usd, type Billing } from "@/lib/plans";

export function Pricing() {
  const [b, setB] = useState<Billing>("anual");
  const save = Math.max(...PLANS.map(annualSavingPct));
  return (
    <div>
      <div className="flex justify-center mb-10">
        <div className="inline-flex rounded-full bg-white border border-line p-1 shadow-soft" role="tablist" aria-label="Periodo de pago">
          {(["mes", "anual"] as const).map((k) => (
            <button key={k} role="tab" aria-selected={b === k} onClick={() => setB(k)} className={`h-11 px-5 rounded-full text-sm font-bold transition ${b === k ? "bg-ink text-white" : "text-muted"}`}>
              {k === "mes" ? "Mensual" : <>Anual <span className={`ml-1 chip h-6 px-2 ${b === k ? "bg-banana text-ink" : "bg-peel/10 text-peel"}`}>−{save} %</span></>}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2 max-w-4xl mx-auto items-stretch">
        {PLANS.map((p) => {
          const hot = p.nutrition;
          return (
            <div key={p.id} className={`relative flex flex-col rounded-[1.75rem] p-7 sm:p-8 ${hot ? "bg-ink text-white shadow-lift" : "card"}`}>
              {hot && <span className="chip absolute -top-3 left-7 bg-banana text-ink">⭐ Más resultados</span>}
              <p className={`text-lg font-extrabold ${hot ? "text-banana" : "text-ink"}`}>{p.name}</p>
              <p className={`text-sm ${hot ? "text-white/60" : "text-muted"}`}>{p.tagline}</p>
              <p className="mt-5 flex items-baseline gap-1.5">
                <span className={`text-5xl font-extrabold tracking-tight tabular-nums ${hot ? "" : "text-ink"}`}>{usd(b === "mes" ? p.price.mes : p.price.anual)}</span>
                <span className={hot ? "text-white/60" : "text-muted"}>{b === "mes" ? "/mes" : "/año"}</span>
              </p>
              <p className={`mt-1 h-5 text-sm font-semibold ${hot ? "text-banana" : "text-peel"}`}>{b === "anual" ? `Equivale a ${usd(perMonthAnnual(p))}/mes · ahorras ${usd(Math.round((p.price.mes * 12 - p.price.anual) * 100) / 100)}` : ""}</p>
              <ul className="mt-6 space-y-3 text-[15px] flex-1">
                {p.feats.map((f) => <li key={f} className="flex gap-2.5"><Check className={`size-5 shrink-0 ${hot ? "text-banana" : "text-peel"}`} />{f}</li>)}
                {!p.nutrition && <li className="flex gap-2.5 text-faint"><X className="size-5 shrink-0" />Plan de nutrición y registro de comidas</li>}
              </ul>
              <Link href={`/entrar?modo=registro&plan=${p.id}&pago=${b}`} className={`mt-8 h-13 ${hot ? "btn-banana" : "btn-primary"}`}>Elegir {p.name}</Link>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-sm text-muted">Precios en dólares (USD) · tarjeta, SINPE Móvil o Apple Pay · cancela cuando quieras</p>
    </div>
  );
}
