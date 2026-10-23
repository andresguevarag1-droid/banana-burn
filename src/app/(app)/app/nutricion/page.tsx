import { getViewer } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { dashboard, getAthlete } from "@/lib/athlete";
import { getMeals, getNutritionExtras } from "@/lib/meals";
import Link from "next/link";
import { FoodLog } from "./food-log";
import { getDaily } from "@/lib/daily";
import { PLANS, usd } from "@/lib/plans";
import { FirstTip } from "@/components/guide/first-tip";
import { ArrowRight, BananaBunch, BrandIcon, CaretDown, CheckCircle, Egg, ForkKnife, Grains, Leaf, Lightbulb, Wine } from "@/components/icons";

export const metadata = { title: "Nutrición" };

const IDEAS = [
  { t: "Desayuno", icon: "sunrise", m: "3 huevos, 2 tortillas de maíz y 1 taza de papaya", k: 400, p: 22 },
  { t: "Pre-entreno", icon: "banana", m: "Banana, yogur griego 200 g y 50 g de avena", k: 410, p: 28 },
  { t: "Almuerzo", icon: "fork", m: "1 taza de arroz, ½ de frijoles, pechuga 180 g y ensalada", k: 670, p: 68 },
  { t: "Merienda", icon: "drop", m: "Batido de proteína con leche descremada", k: 210, p: 33 },
  { t: "Cena", icon: "fish", m: "Tilapia 200 g, yuca 150 g y vegetales salteados", k: 550, p: 56 },
];

export default async function Nutricion() {
  const v = (await getViewer())!;
  // Sin nutrición no se leen comidas ni metas: solo la invitación a Entreno + Nutrición.
  if (!(await getEntitlements(v)).nutrition) {
    const p = PLANS.find((x) => x.nutrition)!;
    return (
      <div className="max-w-xl mx-auto text-center py-8 animate-enter">
        <span className="mx-auto grid place-items-center size-20 rounded-3xl bg-banana-soft text-banana-ink"><BananaBunch className="size-11" /></span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink">Baja de peso más rápido con tu plan de nutrición</h1>
        <p className="mt-3 text-muted">Tu entreno ya está listo. La nutrición es donde se pierde la grasa: calorías y macros para ti, registro con comida de toda Latinoamérica y ajuste cada semana según tu peso real.</p>
        <ul className="mt-6 space-y-2 text-left card p-5">{p.feats.slice(1).map((f) => <li key={f} className="flex gap-2.5 text-ink"><CheckCircle weight="fill" className="size-5 shrink-0 mt-0.5 text-peel" />{f}</li>)}</ul>
        <Link href="/app/suscripcion" data-cta="nutricion-mejorar" className="btn-banana w-full h-14 mt-6 text-base">Mejorar a {p.name} por {usd(p.price.mes)}/mes</Link>
        <p className="mt-2 text-xs text-faint">Cancela cuando quieras. Tus entrenos y tu progreso no cambian.</p>
      </div>
    );
  }
  const d = dashboard(await getAthlete(v));
  const [meals, daily, extras] = await Promise.all([getMeals(v), getDaily(v, 0, 0), getNutritionExtras(v)]);
  const { t } = d;
  const px = d.program?.meta.experience ?? null;
  return (
    <div className="space-y-5 animate-enter">
      <FirstTip id="nutricion" title="Registra como comes de verdad">Busca tu comida o arma tu plato. No tiene que ser perfecto: con registrar la mayoría de tus comidas ya ves si vas bien con tus calorías y tu proteína.</FirstTip>
      <header>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">Comida de hoy</h1>
        <p className="mt-1 text-sm text-muted">Tu meta: {t.kcal.toLocaleString("es-CO")} kcal y {t.protein} g de proteína. {px ? `Ajustada a ${d.program!.title}.` : "Se ajusta cada semana con tu peso real."}</p>
      </header>
      {px && px.food.length > 0 && (
        <section aria-labelledby="comida-programa" className="rounded-[1.5rem] bg-ink p-5 text-cream">
          <p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-banana">{px.mode}</p>
          <h2 id="comida-programa" className="mt-1 text-xl font-extrabold text-white">Cómo comer en {d.program!.title}</h2>
          {d.program!.meta.nutrition?.note && <p className="mt-1 text-sm text-cream/85">{d.program!.meta.nutrition.note}</p>}
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {px.food.map((f) => <li key={f} className="flex items-start gap-2 text-sm"><CheckCircle weight="fill" className="mt-0.5 size-4 shrink-0 text-banana" />{f}</li>)}
          </ul>
        </section>
      )}
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] items-start [&>*]:min-w-0">
        <FoodLog quick={{ kcal: daily.log.kcal ?? 0, protein: daily.log.protein ?? 0 }} initial={meals.today} yesterday={meals.yesterday} targets={{ kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat }} dateKey={d.today.iso} demo={v.demo} country={v.country} extras={extras} />
        <aside className="space-y-3 lg:sticky lg:top-6">
          <Link href="/app/nutricion/recetas" className="pressable flex items-center gap-3 rounded-[1.5rem] bg-banana p-4 hover:shadow-lift">
            <span className="grid place-items-center size-12 shrink-0 rounded-2xl bg-ink text-banana"><BananaBunch className="size-7" /></span>
            <span className="flex-1 min-w-0">
              <span className="block font-extrabold text-ink">Plan de comidas y recetas</span>
              <span className="block text-sm text-ink/70">Tu menú con lo que te falta hoy, con recetas latinas fáciles.</span>
            </span>
            <ArrowRight weight="bold" className="size-5 shrink-0 text-ink" />
          </Link>
          <details className="card group" open>
            <summary className="cursor-pointer list-none p-4 flex items-center justify-between gap-3 font-bold text-ink"><span className="flex items-center gap-2"><Lightbulb weight="duotone" className="size-5 shrink-0 text-banana-ink" />Ideas para un día completo</span><CaretDown weight="bold" className="size-5 shrink-0 text-muted transition-transform duration-(--dur-fast) ease-out group-open:rotate-180" /></summary>
            <ul className="px-4 pb-4 space-y-2">
              {IDEAS.map((m) => (
                <li key={m.t} className="flex gap-3 items-start"><span className="grid place-items-center size-8 shrink-0 rounded-lg bg-banana-soft text-banana-ink"><BrandIcon name={m.icon} className="size-4.5" /></span><div className="flex-1 min-w-0"><p className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm font-bold text-ink">{m.t} <span className="text-xs font-semibold text-muted tabular-nums">{m.k} kcal, {m.p} g prot.</span></p><p className="text-sm text-muted">{m.m}</p></div></li>
              ))}
            </ul>
          </details>
          <div className="card p-4 text-sm text-muted space-y-1.5">
            <p className="flex items-center gap-2 font-bold text-ink"><BananaBunch className="size-5 text-banana-ink" />Reglas Banana</p>
            <p className="flex items-start gap-2"><Egg weight="duotone" className="size-4 shrink-0 mt-0.5 text-banana-ink" />Proteína en cada comida (25-50 g).</p>
            <p className="flex items-start gap-2"><Grains weight="duotone" className="size-4 shrink-0 mt-0.5 text-banana-ink" />Carbos alrededor del entreno.</p>
            <p className="flex items-start gap-2"><Leaf weight="duotone" className="size-4 shrink-0 mt-0.5 text-banana-ink" />Medio plato de vegetales en almuerzo y cena.</p>
            <p className="flex items-start gap-2"><Wine weight="duotone" className="size-4 shrink-0 mt-0.5 text-banana-ink" />Alcohol: máximo 2 al fin de semana.</p>
            <p className="flex items-start gap-2"><ForkKnife weight="duotone" className="size-4 shrink-0 mt-0.5 text-banana-ink" />¿Comiste fuera o algo no tan fit? Regístralo igual: suma XP y tu semana se equilibra.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
