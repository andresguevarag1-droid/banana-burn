import Link from "next/link";
import { getViewer } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { dashboard, getAthlete } from "@/lib/athlete";
import { getMeals } from "@/lib/meals";
import { getDaily } from "@/lib/daily";
import { RECIPES, localHour } from "@/lib/recipes";
import { SLOTS_MEAL } from "@/lib/meals-shared";
import { MenuToday, RecipeCard } from "./recipe-card";
import { MyRecipes } from "./my-recipes";
import { listRecipes } from "@/app/actions/meals";
import { PLANS, usd } from "@/lib/plans";
import { ArrowLeft, BananaBunch, BrandIcon } from "@/components/icons";

export const metadata = { title: "Recetas y plan de comidas" };

const SLOT_N = { desayuno: "Desayuno", almuerzo: "Almuerzo", merienda: "Merienda", cena: "Cena" } as const;
const SLOT_ICON = Object.fromEntries(SLOTS_MEAL.map((s) => [s.id, s.icon])) as Record<keyof typeof SLOT_N, string>;

export default async function Recetas() {
  const v = (await getViewer())!;
  if (!(await getEntitlements(v)).nutrition) {
    const p = PLANS.find((x) => x.nutrition)!;
    return (
      <div className="max-w-xl mx-auto text-center py-8 animate-enter">
        <span className="mx-auto grid place-items-center size-20 rounded-3xl bg-banana-soft text-banana-ink"><BananaBunch className="size-11" /></span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink text-balance">Recetas y plan de comidas</h1>
        <p className="mt-3 text-muted text-pretty">Las recetas latinas, el Menú flash y Mis recetas están incluidos en {p.name}, junto con tus calorías y macros calculados para ti.</p>
        <Link href="/app/suscripcion" data-cta="recetas-mejorar" className="btn-banana w-full h-14 mt-6 text-base">Mejorar a {p.name} por {usd(p.price.mes)}/mes</Link>
        <p className="mt-2 text-xs text-faint">Cancela cuando quieras.</p>
      </div>
    );
  }
  const d = dashboard(await getAthlete(v));
  const [meals, daily, mine] = await Promise.all([getMeals(v), getDaily(v, 0, 0), listRecipes().catch(() => [])]);
  const dateKey = d.today.iso;
  const base = v.demo ? meals.today : undefined;
  return (
    <div className="space-y-6 animate-enter">
      <header>
        <Link href="/app/nutricion" className="tap inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft weight="bold" className="size-4" />Nutrición</Link>
        <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">Recetas latinas fit</h1>
        <p className="mt-1 text-muted">Fáciles, con ingredientes de cualquier supermercado. Macros aproximados.</p>
      </header>
      <MenuToday target={{ kcal: d.t.kcal, protein: d.t.protein }} eaten={meals.today} quick={{ kcal: daily.log.kcal ?? 0, protein: daily.log.protein ?? 0 }} dateKey={dateKey} demo={v.demo} hour={localHour(new Date(), v.tz)} />
      <MyRecipes initial={mine} demo={v.demo} />
      {(["desayuno", "almuerzo", "merienda", "cena"] as const).map((s) => (
        <section key={s}><h2 className="flex items-center gap-2.5 font-extrabold text-ink mb-2"><span className="grid place-items-center size-9 shrink-0 rounded-xl bg-banana-soft text-banana-ink"><BrandIcon name={SLOT_ICON[s]} className="size-5" /></span>{SLOT_N[s]}</h2><div className="space-y-2">{RECIPES.filter((r) => r.slot === s).map((r) => <RecipeCard key={r.id} r={r} dateKey={dateKey} demo={v.demo} base={base} />)}</div></section>
      ))}
    </div>
  );
}
