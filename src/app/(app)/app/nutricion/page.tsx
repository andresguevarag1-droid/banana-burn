import { getViewer } from "@/lib/supabase/server";
import { dashboard, getAthlete } from "@/lib/athlete";

export const metadata = { title: "Nutrición" };

const MEALS = [
  { t: "Desayuno", e: "🍳", m: "Gallo pinto (1 taza) + 3 huevos + natilla light", k: 560, p: 30 },
  { t: "Pre-entreno", e: "🍌", m: "Plátano + yogurt griego + avena", k: 380, p: 25 },
  { t: "Almuerzo", e: "🍛", m: "Casado: arroz, frijoles, pechuga 180 g, ensalada", k: 720, p: 55 },
  { t: "Merienda", e: "🥤", m: "Batido de proteína con leche descremada", k: 250, p: 35 },
  { t: "Cena", e: "🐟", m: "Tilapia 200 g + yuca + vegetales salteados", k: 520, p: 45 },
];

export default async function Nutricion() {
  const v = (await getViewer())!;
  const { t } = dashboard(await getAthlete(v));
  const sum = MEALS.reduce((a, m) => ({ k: a.k + m.k, p: a.p + m.p }), { k: 0, p: 0 });
  const macros = [["Proteína", t.protein, 4, "bg-ember"], ["Carbos", t.carbs, 4, "bg-banana"], ["Grasa", t.fat, 9, "bg-peel"]] as const;
  return (
    <div className="space-y-6 animate-rise">
      <header>
        <p className="eyebrow">Nutrición</p>
        <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">{t.kcal.toLocaleString("es-CR")} kcal al día</h1>
        <p className="mt-2 text-muted">Mantenimiento estimado {t.tdee.toLocaleString("es-CR")} kcal · se ajusta solo cada semana con tu peso real.</p>
      </header>
      <section className="card p-5">
        <div className="flex h-4 rounded-full overflow-hidden">
          {macros.map(([n, g, k, c]) => <div key={n} className={c} style={{ width: `${((g * k) / t.kcal) * 100}%` }} />)}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {macros.map(([n, g, , c]) => (
            <div key={n}><p className="flex items-center gap-2 text-sm font-semibold text-muted"><span className={`size-2.5 rounded-full ${c}`} />{n}</p><p className="text-2xl font-extrabold text-ink tabular-nums">{g} g</p></div>
          ))}
        </div>
      </section>
      <section>
        <div className="flex items-baseline justify-between mb-3"><h2 className="font-bold text-ink">Un día tico de ejemplo 🇨🇷</h2><p className="text-sm text-muted tabular-nums">{sum.k} kcal · {sum.p} g proteína</p></div>
        <div className="space-y-2">
          {MEALS.map((m) => (
            <div key={m.t} className="card p-4 flex items-center gap-4">
              <span className="text-2xl">{m.e}</span>
              <div className="flex-1 min-w-0"><p className="font-bold text-ink">{m.t}</p><p className="text-sm text-muted">{m.m}</p></div>
              <div className="text-right text-sm tabular-nums"><p className="font-bold text-ink">{m.k} kcal</p><p className="text-muted">{m.p} g P</p></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
