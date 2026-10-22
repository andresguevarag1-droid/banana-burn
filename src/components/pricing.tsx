import Link from "next/link";
import { Check } from "lucide-react";

const PLANS = [
  { id: "free", name: "Gratis", price: "₡0", per: "para siempre", cta: "Empieza gratis", feats: ["Rutina del día y plan semanal", "Registro de series y peso", "Calculadora de calorías y proteína", "Racha y logros básicos"] },
  { id: "pro", name: "Pro", price: "₡4.990", per: "/mes", hot: true, cta: "Probar 7 días gratis", feats: ["Todo lo de Gratis", "Coach IA 24/7 que ajusta tu plan", "Progresión automática de cargas", "Nutrición tica: gallo pinto, casado y más", "Fotos y medidas con análisis", "Retos semanales y ligas"] },
  { id: "anual", name: "Pro anual", price: "₡39.900", per: "/año", cta: "Ahorra 33 %", feats: ["Todo lo de Pro", "2 meses de regalo + 1 extra", "Revisión de técnica prioritaria", "Acceso anticipado a novedades"] },
];

export function Pricing() {
  return (
    <div className="grid gap-5 md:grid-cols-3 items-stretch">
      {PLANS.map((p) => (
        <div key={p.id} className={`relative flex flex-col rounded-[1.75rem] p-7 ${p.hot ? "bg-ink text-white shadow-lift md:-translate-y-3" : "card"}`}>
          {p.hot && <span className="chip absolute -top-3 left-7 bg-banana text-ink">⭐ Más elegido</span>}
          <p className={`font-bold ${p.hot ? "text-banana" : "text-ink"}`}>{p.name}</p>
          <p className="mt-3 flex items-baseline gap-1"><span className={`text-4xl font-extrabold tracking-tight ${p.hot ? "" : "text-ink"}`}>{p.price}</span><span className={p.hot ? "text-white/60" : "text-muted"}>{p.per}</span></p>
          <ul className="mt-6 space-y-3 text-[15px] flex-1">
            {p.feats.map((f) => (
              <li key={f} className="flex gap-2.5"><Check className={`size-5 shrink-0 ${p.hot ? "text-banana" : "text-peel"}`} />{f}</li>
            ))}
          </ul>
          <Link href={`/entrar?modo=registro&plan=${p.id}`} className={`mt-8 ${p.hot ? "btn-banana" : "btn-ghost"}`}>{p.cta}</Link>
        </div>
      ))}
    </div>
  );
}
