"use client";
import { useEffect, useState } from "react";
import { BananaFlame, Check, Drop, Egg, Footprints, Moon, Plus } from "@/components/icons";
import type { DailyField } from "@/app/actions/daily";
import { useDailySave } from "@/components/use-daily-save";
import type { DailyLog } from "@/lib/daily";
import { sumMeals, type MealItem } from "@/lib/meals-shared";

type Target = { kcal: number; protein: number; steps: number; sleep: number; water: number };

function MiniRing({ v, color, size = 56 }: { v: number; color: string; size?: number }) {
  const sw = 6, r = (size - sw) / 2, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3EBD3" strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0.001, v)))} style={{ transition: "stroke-dashoffset var(--dur-fill) var(--ease-out)" }} />
    </svg>
  );
}

export function DayTracker({ initial, base: base0, target, dateKey, demo }: { initial: DailyLog; base: { kcal: number; protein: number }; target: Target; dateKey: string; demo: boolean }) {
  const key = `bb.daily.${dateKey}`;
  const [log, setLog] = useState<DailyLog>(initial);
  const [edit, setEdit] = useState<DailyField | null>(null);
  const daily = useDailySave();

  // Demo: Nutrición guarda las comidas en este navegador; Hoy suma desde la misma fuente para que ambas cuadren.
  const [base, setBase] = useState(base0);
  useEffect(() => {
    if (!demo) return;
    try {
      const s = localStorage.getItem(key); if (s) setLog(JSON.parse(s));
      const m = localStorage.getItem(`bb.meals.${dateKey}`);
      if (m) { const t = sumMeals(JSON.parse(m) as MealItem[]); setBase({ kcal: t.kcal, protein: t.protein }); }
    } catch { /* */ }
  }, [demo, key, dateKey]);

  const b = (f: DailyField) => (f === "kcal" ? base.kcal : f === "protein" ? base.protein : 0);
  function set(field: DailyField, shown: number) {
    const value = shown - b(field);
    const next = { ...log, [field]: Math.max(0, Math.round(value * 10) / 10) };
    setLog(next);
    try { navigator.vibrate?.(15); } catch { /* */ }
    if (demo) { try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* */ } return; }
    const prev = log[field];
    daily.save(field, next[field] ?? 0, () => setLog((l) => (l[field] === next[field] ? { ...l, [field]: prev } : l)));
  }

  const items: { f: DailyField; label: string; icon: React.ReactNode; color: string; val: number; goal: number; unit: string; fmt: (n: number) => string; quick: [string, number][] }[] = [
    { f: "protein", label: "Proteína", icon: <Egg weight="duotone" className="size-5" />, color: "#1B1505", val: log.protein + base.protein, goal: target.protein, unit: "g", fmt: (n) => `${Math.round(n)}`, quick: [["+20 g", 20], ["+30 g", 30]] },
    { f: "kcal", label: "Calorías", icon: <BananaFlame className="size-5" />, color: "#C98200", val: log.kcal + base.kcal, goal: target.kcal, unit: "kcal", fmt: (n) => Math.round(n).toLocaleString("es-419"), quick: [["+250", 250], ["+500", 500]] },
    { f: "water", label: "Agua", icon: <Drop weight="duotone" className="size-5" />, color: "#8A6200", val: log.water, goal: target.water, unit: "vasos", fmt: (n) => `${Math.round(n)}`, quick: [["+1 vaso", 1]] },
    { f: "steps", label: "Pasos", icon: <Footprints weight="duotone" className="size-5" />, color: "#3F6B0E", val: log.steps, goal: target.steps, unit: "", fmt: (n) => Math.round(n).toLocaleString("es-419"), quick: [[`+${(1000).toLocaleString("es-419")}`, 1000]] },
    { f: "sleep", label: "Sueño", icon: <Moon weight="duotone" className="size-5" />, color: "#6A604B", val: log.sleep, goal: target.sleep, unit: "h", fmt: (n) => n.toLocaleString("es-419", { maximumFractionDigits: 1 }), quick: [["7 h", -7], ["8 h", -8]] },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {daily.toast}
      {items.map((it) => {
        const pct = it.val / it.goal;
        // Calorías: llegar a la meta no es un logro ni pasarse un fracaso; el anillo solo muestra cuánto va.
        const done = it.f !== "kcal" && pct >= 1;
        return (
          <div key={it.f} className={`card p-3.5 ${it.f === "protein" ? "col-span-2 lg:col-span-1" : ""}`}>
            <div className="flex items-center gap-3">
              <div className="relative grid place-items-center">
                <MiniRing v={pct} color={it.color} />
                <span className="absolute" style={{ color: it.color }}>{done ? <><Check weight="bold" className="size-5" /><span className="sr-only">Meta cumplida</span></> : it.icon}</span>
              </div>
              <button onClick={() => setEdit(edit === it.f ? null : it.f)} className="min-w-0 rounded-lg text-left transition-opacity hover:opacity-75" aria-label={`Editar ${it.label}`}>
                <p className="text-xs font-bold text-muted">{it.label}</p>
                <p className="text-lg font-extrabold text-ink tabular-nums leading-tight">{it.fmt(it.val)}</p>
                <p className="text-[11px] font-semibold text-faint tabular-nums">de {it.fmt(it.goal)} {it.unit}</p>
              </button>
            </div>
            {edit === it.f ? (
              <form className="mt-2.5 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); const n = Number(String(new FormData(e.currentTarget).get("v")).replace(",", ".")); if (Number.isFinite(n)) set(it.f, n); setEdit(null); }}>
                <input name="v" autoFocus defaultValue={it.val || ""} inputMode="decimal" className="w-full min-w-0 h-9 rounded-xl bg-cream px-3 text-sm font-bold text-ink outline-none focus:ring-2 focus:ring-banana" aria-label={`${it.label} total`} />
                <button className="tap pressable h-9 px-3 rounded-xl bg-ink text-white text-xs font-bold">OK</button>
              </form>
            ) : (
              <div className="mt-2.5 flex gap-1.5">
                {it.quick.map(([l, d]) => (
                  <button key={l} onClick={() => set(it.f, d < 0 ? -d : it.val + d)} className="tap pressable flex-1 h-9 rounded-xl bg-cream text-xs font-bold text-ink hover:bg-line/60 inline-flex items-center justify-center gap-1">
                    {d > 0 && <Plus weight="bold" className="size-3" />}{l.replace("+", "")}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
