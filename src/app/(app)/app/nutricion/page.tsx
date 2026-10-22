import { getViewer } from "@/lib/supabase/server";
import { dashboard, getAthlete } from "@/lib/athlete";
import { getMeals } from "@/lib/meals";
import { FoodLog } from "./food-log";

export const metadata = { title: "Nutrición" };

const IDEAS = [
  { t: "Desayuno", e: "🍳", m: "Gallo pinto (1 taza) + 3 huevos + natilla light", k: 560, p: 30 },
  { t: "Pre-entreno", e: "🍌", m: "Banano + yogur griego + avena", k: 380, p: 25 },
  { t: "Almuerzo", e: "🍛", m: "Casado: arroz, frijoles, pechuga 180 g, ensalada", k: 720, p: 55 },
  { t: "Merienda", e: "🥤", m: "Batido de proteína con leche descremada", k: 250, p: 35 },
  { t: "Cena", e: "🐟", m: "Tilapia 200 g + yuca + vegetales salteados", k: 520, p: 45 },
];

export default async function Nutricion() {
  const v = (await getViewer())!;
  const d = dashboard(await getAthlete(v));
  const meals = await getMeals(v);
  const { t } = d;
  return (
    <div className="space-y-5 animate-rise">
      <header>
        <p className="eyebrow">Nutrición</p>
        <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">Comida de hoy</h1>
        <p className="mt-1 text-sm text-muted">Meta {t.kcal.toLocaleString("es-CR")} kcal · {t.protein} g proteína · se ajusta cada semana con tu peso real.</p>
      </header>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] items-start [&>*]:min-w-0">
        <FoodLog initial={meals.today} yesterday={meals.yesterday} targets={{ kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat }} dateKey={d.today.iso} demo={v.demo} />
        <aside className="space-y-3 lg:sticky lg:top-6">
          <details className="card group" open>
            <summary className="cursor-pointer list-none p-4 flex items-center justify-between font-bold text-ink">💡 Ideas: un día tico de {IDEAS.reduce((a, m) => a + m.k, 0).toLocaleString("es-CR")} kcal<span className="text-xl transition-transform group-open:rotate-45">+</span></summary>
            <ul className="px-4 pb-4 space-y-2">
              {IDEAS.map((m) => (
                <li key={m.t} className="flex gap-3 items-start"><span className="text-xl">{m.e}</span><div className="flex-1 min-w-0"><p className="text-sm font-bold text-ink">{m.t} <span className="font-semibold text-muted">· {m.k} kcal · {m.p} g P</span></p><p className="text-sm text-muted">{m.m}</p></div></li>
              ))}
            </ul>
          </details>
          <div className="card p-4 text-sm text-muted space-y-1.5">
            <p className="font-bold text-ink">Reglas Banana 🍌</p>
            <p>🥩 Proteína en cada comida (25–50 g).</p>
            <p>🍚 Carbos alrededor del entreno.</p>
            <p>🥗 Medio plato de vegetales en almuerzo y cena.</p>
            <p>🍺 Alcohol: máximo 2 al fin de semana.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
