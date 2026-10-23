"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Image from "next/image";
import { CoachPic } from "@/components/coach-pic";
import { ArrowRight, Check, CheckCircle, Drop, Footprints, Lock, Moon, Plus } from "@/components/icons";
import type { HoyFood } from "@/lib/hoy-food";
import type { DailyField } from "@/app/actions/daily";
import { useDailySave } from "@/components/use-daily-save";
import type { DailyLog } from "@/lib/daily";
import { sumMeals, type MealItem } from "@/lib/meals-shared";
import { ProgressBar } from "@/components/progress-bar";
import { PLANS } from "@/lib/plans";
import { clamp01 } from "@/lib/num";

type Macros = { kcal: number; protein: number; carbs: number; fat: number };
type Habits = { steps: number; sleep: number; water: number };
/** Calorías y macros de hoy: solo llegan con nutrición (Entreno + Nutrición, prueba o beta). */
/** `coach`: la coach del programa activo (Coach Platanita) firma la recomendación; sin ella, Coach Banana. */
export type NutritionNumbers = { base: Macros; target: Macros; mode: GoalMode; meal: HoyFood; coach?: { name: string; avatar: string } | null };
export type GoalMode = "acelerada" | "recomp" | "fuerza";

const n0 = (n: number) => Math.round(n).toLocaleString("es-419");

/** Qué significa la meta de calorías, en una línea, según el objetivo. */
const WHY: Record<GoalMode, string> = {
  acelerada: "Comes unas 500 kcal menos de lo que gastas: así bajas grasa a buen ritmo.",
  recomp: "Comes un poco menos de lo que gastas: bajas grasa despacio mientras ganas músculo.",
  fuerza: "Comes un poco más de lo que gastas: energía para ganar fuerza y músculo.",
};

function Ring({ v, size, stroke, track, color, children }: { v: number; size: number; stroke: number; track: string; color: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c}
          strokeDashoffset={c * (1 - clamp01(v, 0.001))} style={{ transition: "stroke-dashoffset var(--dur-fill) var(--ease-out)" }} />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  );
}

const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

/** Lo que trae Entreno + Nutrición en Hoy: sale de PLANS (plans.ts), la misma lista que ven en precios. */
const TEASER = PLANS.find((p) => p.nutrition)!.feats.slice(1, 5);

/**
 * Panel principal de Hoy: calorías y macros (lo primero que debe entender la persona), más agua, pasos y sueño.
 * Sin nutrición (plan Entreno) no recibe ni muestra números de comida: en su lugar va una invitación honesta
 * a Entreno + Nutrición. Agua, pasos y sueño son para todos. Usa el registro diario de la acción setDaily.
 */
export function TodayPanel({ initial, nutrition, habits, dateKey, demo }: {
  initial: DailyLog; nutrition: NutritionNumbers | null; habits: Habits; dateKey: string; demo: boolean;
}) {
  const key = `bb.daily.${dateKey}`;
  const [log, setLog] = useState<DailyLog>(initial);
  const [base, setBase] = useState<Macros>(nutrition?.base ?? ZERO);
  const [meal, setMeal] = useState<HoyFood | null>(nutrition?.meal ?? null);
  const daily = useDailySave();
  const hasNutrition = nutrition !== null;

  // Demo: Nutrición guarda las comidas en este navegador; Hoy suma desde la misma fuente para que ambas cuadren.
  useEffect(() => {
    if (!demo) return;
    try {
      const s = localStorage.getItem(key); if (s) setLog(JSON.parse(s));
      const m = hasNutrition ? localStorage.getItem(`bb.meals.${dateKey}`) : null;
      if (m) {
        const list = JSON.parse(m) as MealItem[];
        setBase(sumMeals(list));
        setMeal((cur) => cur && { ...cur, slots: cur.slots.map((x) => { const it = list.filter((i) => i.slot === x.slot); return { ...x, items: it.map((i) => i.name), kcal: Math.round(it.reduce((a, i) => a + i.kcal, 0)), protein: Math.round(it.reduce((a, i) => a + i.protein, 0)) }; }) });
      }
    } catch { /* */ }
  }, [demo, key, dateKey, hasNutrition]);

  function add(field: DailyField, delta: number, absolute = false) {
    const cur = log[field] ?? 0;
    const next = { ...log, [field]: Math.max(0, Math.round((absolute ? delta : cur + delta) * 10) / 10) };
    setLog(next);
    try { navigator.vibrate?.(15); } catch { /* */ }
    if (demo) { try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* */ } return; }
    daily.save(field, next[field] ?? 0, () => setLog((l) => (l[field] === next[field] ? { ...l, [field]: cur } : l)));
  }

  const small: { f: DailyField; label: string; icon: React.ReactNode; val: number; goal: number; unit: string; step: number; stepLabel: string; fmt: (n: number) => string }[] = [
    { f: "water", label: "Agua", icon: <Drop weight="duotone" className="size-5" />, val: log.water, goal: habits.water, unit: "vasos", step: 1, stepLabel: "1 vaso", fmt: (n) => n0(n) },
    { f: "steps", label: "Pasos", icon: <Footprints weight="duotone" className="size-5" />, val: log.steps, goal: habits.steps, unit: "", step: 1000, stepLabel: n0(1000), fmt: (n) => n0(n) },
    { f: "sleep", label: "Sueño", icon: <Moon weight="duotone" className="size-5" />, val: log.sleep, goal: habits.sleep, unit: "h", step: 0.5, stepLabel: "½ h", fmt: (n) => n.toLocaleString("es-419", { maximumFractionDigits: 1 }) },
  ];

  return (
    <div className="space-y-3">
      {daily.toast}
      {nutrition ? <Numbers n={{ ...nutrition, meal: meal ?? nutrition.meal }} log={log} base={base} /> : <NutritionTeaser />}

      <div className="grid grid-cols-3 gap-2.5">
        {small.map((it) => {
          const done = it.val >= it.goal;
          return (
            <div key={it.f} className="card flex flex-col items-center p-3 text-center">
              <Ring v={it.val / it.goal} size={48} stroke={5} track="#F3EBD3" color="#1B1505">
                <span className="text-ink">{done ? <><Check weight="bold" className="size-5" /><span className="sr-only">Meta cumplida</span></> : it.icon}</span>
              </Ring>
              <p className="mt-1.5 text-xs font-bold text-muted">{it.label}</p>
              <p className="text-base font-extrabold leading-tight tabular-nums text-ink">{it.fmt(it.val)}<span className="text-[11px] font-semibold text-muted"> / {it.fmt(it.goal)}{it.unit ? ` ${it.unit}` : ""}</span></p>
              <button type="button" onClick={() => add(it.f, it.step)} aria-label={`Sumar ${it.stepLabel} a ${it.label.toLowerCase()}`}
                className="tap pressable mt-2 inline-flex h-11 w-full items-center justify-center gap-1 rounded-xl bg-banana-soft text-xs font-bold text-ink hover:bg-banana">
                <Plus weight="bold" className="size-3" />{it.stepLabel}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Calorías y macros de hoy (solo con nutrición). */
function Numbers({ n, log, base }: { n: NutritionNumbers; log: DailyLog; base: Macros }) {
  const t = n.target;
  const kcal = log.kcal + base.kcal, protein = log.protein + base.protein;
  const left = t.kcal - kcal;
  const proteinLeft = Math.max(0, t.protein - protein);
  const macros = [
    { label: "Carbohidratos", val: base.carbs, goal: t.carbs, hint: "Energía para entrenar" },
    { label: "Grasas", val: base.fat, goal: t.fat, hint: "Hormonas y saciedad" },
  ];
  return (
    <section aria-labelledby="hoy-numeros" className="relative overflow-hidden rounded-[1.75rem] bg-ink p-5 text-white sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-banana/15 blur-3xl" />
      <div className="relative flex items-center justify-between gap-3">
        <h2 id="hoy-numeros" className="text-lg font-extrabold">Tus números de hoy</h2>
        <Link href="/app/nutricion" className="tap pressable inline-flex h-11 items-center gap-1.5 rounded-full bg-banana px-4 text-sm font-extrabold text-ink">
          <Plus weight="bold" className="size-4" />Comida
        </Link>
      </div>

      <div className="relative mt-4 grid items-center gap-5 sm:grid-cols-[auto_1fr]">
        <div className="flex items-center gap-4 sm:flex-col sm:gap-2">
          <Ring v={kcal / t.kcal} size={152} stroke={14} track="rgb(255 255 255 / .1)" color={left < 0 ? "#F2A100" : "#FFD60A"}>
            <p className="text-[11px] font-bold text-white/75">{left >= 0 ? "Te quedan" : "Te pasaste"}</p>
            <p className="text-[34px] font-extrabold leading-none tabular-nums text-banana">{n0(Math.abs(left))}</p>
            <p className="mt-0.5 text-[11px] font-bold text-white/75">kcal</p>
          </Ring>
          <dl className="grid gap-1 text-sm sm:text-center">
            <div><dt className="inline text-white/75">Comiste </dt><dd className="inline font-extrabold tabular-nums">{n0(kcal)} kcal</dd></div>
            <div><dt className="inline text-white/75">Tu meta </dt><dd className="inline font-extrabold tabular-nums">{n0(t.kcal)} kcal</dd></div>
          </dl>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white/[.07] p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-extrabold">Proteína</p>
              <p className="tabular-nums"><span className="text-xl font-extrabold text-banana">{n0(protein)}</span><span className="text-sm text-white/75"> / {n0(t.protein)} g</span></p>
            </div>
            <ProgressBar value={protein / t.protein} className="mt-2 h-3" track="bg-white/10" fill="bg-banana" label={`Proteína: ${n0(protein)} de ${n0(t.protein)} gramos`} />
            <p className="mt-2 text-xs text-white/75">{proteinLeft > 0 ? `Te faltan ${n0(proteinLeft)} g. La proteína protege tu músculo mientras bajas grasa.` : "Meta de proteína cumplida. Tu músculo te lo agradece."}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {macros.map((m) => (
              <div key={m.label}>
                <p className="text-xs font-bold">{m.label}</p>
                <p className="text-xs tabular-nums text-white/75"><span className="font-extrabold text-white">{n0(m.val)}</span> / {n0(m.goal)} g</p>
                <ProgressBar value={m.val / m.goal} className="mt-1.5 h-2" track="bg-white/10" fill="bg-banana-soft" label={`${m.label}: ${n0(m.val)} de ${n0(m.goal)} gramos`} />
                <p className="mt-1 text-[11px] text-white/70">{m.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <MealToday meal={n.meal} coach={n.coach ?? null} />

      <p className="relative mt-4 border-t border-white/10 pt-3 text-xs text-white/75">{WHY[n.mode]} <Link href="/app/nutricion" className="font-bold text-banana underline-offset-4 hover:underline">Ver mi plan de comidas<ArrowRight weight="bold" className="ml-0.5 inline size-3" /></Link></p>
    </section>
  );
}

/**
 * Comida de hoy: qué comió en cada tiempo de comida (o que falta registrarlo) y lo que Coach Banana le recomienda
 * para el siguiente, calculado en el servidor con lo que le falta del día y la hora local.
 */
function MealToday({ meal, coach }: { meal: HoyFood; coach: NutritionNumbers["coach"] }) {
  const nx = meal.next;
  return (
    <div className="relative mt-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-extrabold">¿Qué has comido hoy?</h3>
        <Link href="/app/nutricion" className="tap text-xs font-bold text-banana underline-offset-4 hover:underline">Registrar comida</Link>
      </div>
      <ul className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {meal.slots.map((s) => {
          const has = s.items.length > 0;
          return (
            <li key={s.slot}>
              <Link href="/app/nutricion" aria-label={has ? `${s.label}: ${s.items.join(", ")}` : `${s.label}: registrar`}
                className={`pressable flex h-full min-h-[5.5rem] flex-col rounded-2xl p-3 ${has ? "bg-white/[.07] hover:bg-white/10" : "border border-dashed border-white/20 hover:border-white/40"}`}>
                <span className="flex items-center justify-between gap-1 text-xs font-bold text-white/75">{s.label}{has && <CheckCircle weight="fill" aria-hidden className="size-4 text-banana" />}</span>
                {has ? (
                  <>
                    <span className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-white">{s.items.join(", ")}</span>
                    <span className="mt-auto pt-1 text-[11px] font-semibold tabular-nums text-white/70">{n0(s.kcal)} kcal, {n0(s.protein)} g proteína</span>
                  </>
                ) : (
                  <span className={`mt-auto inline-flex items-center gap-1 pt-2 text-sm font-bold ${s.open ? "text-banana" : "text-white/55"}`}>
                    {s.open ? <><Plus weight="bold" className="size-3.5" />Anotar</> : "Sin registrar"}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {nx ? (
        <div className="mt-3 flex gap-3 rounded-2xl bg-banana p-3.5 text-ink">
          {coach ? <CoachPic src={coach.avatar} size={56} className="size-14 shrink-0 rounded-2xl object-cover" iconClassName="size-8" />
            : <Image src="/brand/mascota-sola.webp" alt="" width={56} height={56} className="size-14 shrink-0 object-contain" />}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-ink/75">{coach?.name ?? "Coach Banana"} te recomienda. {nx.when}:</p>
            <p className="mt-0.5 text-[17px] font-extrabold leading-tight text-balance">{nx.title}</p>
            <p className="mt-1 text-xs font-semibold tabular-nums text-ink/80">{n0(nx.kcal)} kcal y {n0(nx.protein)} g de proteína{nx.portions !== 1 ? ` (${nx.portions.toLocaleString("es-419")} porciones)` : ""}</p>
            {nx.others.length > 0 && <p className="mt-1 text-xs text-ink/75">También te sirve: {nx.others.join(" o ")}.</p>}
            <Link href="/app/nutricion/recetas" className="tap pressable mt-2.5 inline-flex h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-extrabold text-banana">Ver la receta<ArrowRight weight="bold" className="size-3.5" /></Link>
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-2xl bg-white/[.07] p-3.5 text-sm text-white/85">Ya cubriste lo que necesitabas hoy. Si te da hambre, elige fruta, yogur natural o vegetales.</p>
      )}
    </div>
  );
}

/** Plan Entreno: en vez de números de comida, qué trae Entreno + Nutrición y cómo mejorarlo. Mismo estilo de tarjeta oscura. */
function NutritionTeaser() {
  return (
    <section aria-labelledby="hoy-nutri" className="relative overflow-hidden rounded-[1.75rem] bg-ink p-5 text-white sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-banana/15 blur-3xl" />
      <div className="relative">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-banana"><Lock weight="fill" aria-hidden className="size-3.5" />Entreno + Nutrición</p>
        <h2 id="hoy-nutri" className="mt-2 text-lg font-extrabold text-balance">Suma tu plan de comida a tu entreno</h2>
      </div>
      <p className="relative mt-2 text-sm text-white/75 text-pretty">Tu entreno ya está listo. La nutrición es donde se pierde la grasa, y con este plan la tienes calculada para ti:</p>
      <ul className="relative mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {TEASER.map((f) => <li key={f} className="flex gap-2"><CheckCircle weight="fill" aria-hidden className="mt-0.5 size-4.5 shrink-0 text-banana" /><span>{f}</span></li>)}
      </ul>
      <Link href="/app/suscripcion" data-cta="hoy-nutricion-mejorar" className="tap pressable relative mt-4 inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-full bg-banana px-5 text-sm font-extrabold text-ink sm:w-auto">
        Ver Entreno + Nutrición<ArrowRight weight="bold" className="size-4" />
      </Link>
      <p className="relative mt-3 text-xs text-white/70">Agua, pasos y sueño siguen incluidos en tu plan.</p>
    </section>
  );
}
