"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ArrowRight, Check, Drop, Footprints, Moon, Plus } from "@/components/icons";
import { setDaily, type DailyField } from "@/app/actions/daily";
import type { DailyLog } from "@/lib/daily";
import { sumMeals, type MealItem } from "@/lib/meals-shared";
import { ProgressBar } from "@/components/progress-bar";

type Macros = { kcal: number; protein: number; carbs: number; fat: number };
type Target = Macros & { steps: number; sleep: number; water: number };
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
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0.001, v)))} style={{ transition: "stroke-dashoffset var(--dur-fill) var(--ease-out)" }} />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  );
}

/**
 * Panel principal de Hoy: calorías y macros (lo primero que debe entender la persona), más agua, pasos y sueño.
 * Comparte el mismo registro diario que antes manejaba DayTracker (acción setDaily).
 */
export function TodayPanel({ initial, base: base0, target, mode, dateKey, demo }: {
  initial: DailyLog; base: Macros; target: Target; mode: GoalMode; dateKey: string; demo: boolean;
}) {
  const key = `bb.daily.${dateKey}`;
  const [log, setLog] = useState<DailyLog>(initial);
  const [base, setBase] = useState<Macros>(base0);
  const [, start] = useTransition();

  // Demo: Nutrición guarda las comidas en este navegador; Hoy suma desde la misma fuente para que ambas cuadren.
  useEffect(() => {
    if (!demo) return;
    try {
      const s = localStorage.getItem(key); if (s) setLog(JSON.parse(s));
      const m = localStorage.getItem(`bb.meals.${dateKey}`);
      if (m) setBase(sumMeals(JSON.parse(m) as MealItem[]));
    } catch { /* */ }
  }, [demo, key, dateKey]);

  function add(field: DailyField, delta: number, absolute = false) {
    const cur = log[field] ?? 0;
    const next = { ...log, [field]: Math.max(0, Math.round((absolute ? delta : cur + delta) * 10) / 10) };
    setLog(next);
    try { navigator.vibrate?.(15); } catch { /* */ }
    if (demo) { try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* */ } return; }
    start(() => { setDaily(field, next[field] ?? 0); });
  }

  const kcal = log.kcal + base.kcal, protein = log.protein + base.protein;
  const left = target.kcal - kcal;
  const proteinLeft = Math.max(0, target.protein - protein);
  const macros = [
    { label: "Carbohidratos", val: base.carbs, goal: target.carbs, hint: "Energía para entrenar" },
    { label: "Grasas", val: base.fat, goal: target.fat, hint: "Hormonas y saciedad" },
  ];

  const small: { f: DailyField; label: string; icon: React.ReactNode; val: number; goal: number; unit: string; step: number; stepLabel: string; fmt: (n: number) => string }[] = [
    { f: "water", label: "Agua", icon: <Drop weight="duotone" className="size-5" />, val: log.water, goal: target.water, unit: "vasos", step: 1, stepLabel: "1 vaso", fmt: (n) => n0(n) },
    { f: "steps", label: "Pasos", icon: <Footprints weight="duotone" className="size-5" />, val: log.steps, goal: target.steps, unit: "", step: 1000, stepLabel: n0(1000), fmt: (n) => n0(n) },
    { f: "sleep", label: "Sueño", icon: <Moon weight="duotone" className="size-5" />, val: log.sleep, goal: target.sleep, unit: "h", step: 0.5, stepLabel: "½ h", fmt: (n) => n.toLocaleString("es-419", { maximumFractionDigits: 1 }) },
  ];

  return (
    <div className="space-y-3">
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
            <Ring v={kcal / target.kcal} size={152} stroke={14} track="rgb(255 255 255 / .1)" color={left < 0 ? "#F2A100" : "#FFD60A"}>
              <p className="text-[11px] font-bold text-white/75">{left >= 0 ? "Te quedan" : "Te pasaste"}</p>
              <p className="text-[34px] font-extrabold leading-none tabular-nums text-banana">{n0(Math.abs(left))}</p>
              <p className="mt-0.5 text-[11px] font-bold text-white/75">kcal</p>
            </Ring>
            <dl className="grid gap-1 text-sm sm:text-center">
              <div><dt className="inline text-white/75">Comiste </dt><dd className="inline font-extrabold tabular-nums">{n0(kcal)} kcal</dd></div>
              <div><dt className="inline text-white/75">Tu meta </dt><dd className="inline font-extrabold tabular-nums">{n0(target.kcal)} kcal</dd></div>
            </dl>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl bg-white/[.07] p-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-extrabold">Proteína</p>
                <p className="tabular-nums"><span className="text-xl font-extrabold text-banana">{n0(protein)}</span><span className="text-sm text-white/75"> / {n0(target.protein)} g</span></p>
              </div>
              <ProgressBar value={protein / target.protein} className="mt-2 h-3" track="bg-white/10" fill="bg-banana" label={`Proteína: ${n0(protein)} de ${n0(target.protein)} gramos`} />
              <p className="mt-2 text-xs text-white/75">{proteinLeft > 0 ? `Te faltan ${n0(proteinLeft)} g. La proteína protege tu músculo mientras bajas grasa.` : "Meta de proteína cumplida. Tu músculo te lo agradece."}</p>
              <div className="mt-2.5 flex gap-1.5">
                {[20, 30].map((g) => (
                  <button key={g} type="button" onClick={() => add("protein", g)} className="tap pressable inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-white/10 text-sm font-bold hover:bg-white/15">
                    <Plus weight="bold" className="size-3.5" />{g} g
                  </button>
                ))}
              </div>
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

        <p className="relative mt-4 border-t border-white/10 pt-3 text-xs text-white/75">{WHY[mode]} <Link href="/app/nutricion" className="font-bold text-banana underline-offset-4 hover:underline">Ver mi plan de comidas<ArrowRight weight="bold" className="ml-0.5 inline size-3" /></Link></p>
      </section>

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
