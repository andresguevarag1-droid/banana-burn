"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Minus, Plus } from "lucide-react";
import { ageOn, DAY_NAMES, planWeek, scheduleFor, targets } from "@/lib/engine";
import { Logo } from "@/components/brand";
import { Confetti } from "@/components/confetti";
import { completeOnboarding, type Onboard } from "./actions";
import { INTENT_COOKIE, decodeIntent, intentPath } from "@/lib/checkout-intent";

const STEPS = 7;
const nf = (n: number, d = 1) => n.toLocaleString("es-CR", { minimumFractionDigits: d, maximumFractionDigits: d });
const iso = (d: Date) => d.toISOString().slice(0, 10);

function suggestDate(w: number, g: number) {
  const perWeek = Math.max(0.3, w * 0.0075); // ~0,75 % del peso por semana: rápido pero sano
  const weeks = Math.ceil(Math.max(0, w - g) / perWeek);
  const d = new Date(); d.setDate(d.getDate() + Math.max(4, weeks) * 7);
  return { date: iso(d), perWeek };
}

function Num({ value, onChange, step, unit, min, max, d = 1 }: { value: number; onChange: (n: number) => void; step: number; unit: string; min: number; max: number; d?: number }) {
  const set = (n: number) => { onChange(Math.min(max, Math.max(min, Math.round(n * 10) / 10))); try { navigator.vibrate?.(8); } catch { /* */ } };
  return (
    <div className="flex items-center rounded-3xl bg-white border border-line h-20">
      <button type="button" onClick={() => set(value - step)} className="grid place-items-center w-16 h-full text-muted active:text-ink" aria-label="Menos"><Minus className="size-6" strokeWidth={3} /></button>
      <p className="flex-1 text-center text-4xl font-extrabold text-ink tabular-nums">{nf(value, d)}<span className="ml-1 text-lg text-faint">{unit}</span></p>
      <button type="button" onClick={() => set(value + step)} className="grid place-items-center w-16 h-full text-muted active:text-ink" aria-label="Más"><Plus className="size-6" strokeWidth={3} /></button>
    </div>
  );
}

function Choice({ on, onClick, e, t, d }: { on: boolean; onClick: () => void; e: string; t: string; d?: string }) {
  return (
    <button type="button" onClick={onClick} className={`w-full flex items-center gap-4 rounded-3xl border-2 p-4 text-left transition active:scale-[.98] ${on ? "border-ink bg-banana" : "border-line bg-white hover:border-ink/40"}`} aria-pressed={on}>
      <span className="text-3xl">{e}</span>
      <span className="flex-1 min-w-0"><span className="block font-extrabold text-ink">{t}</span>{d && <span className="block text-sm text-ink/70">{d}</span>}</span>
      <span className={`grid place-items-center size-6 rounded-full border-2 ${on ? "bg-ink border-ink text-white" : "border-line"}`}>{on && <Check className="size-4" strokeWidth={3} />}</span>
    </button>
  );
}

export function Wizard({ name: initialName, demo }: { name: string; demo: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [o, setO] = useState<Onboard>(() => ({ name: initialName, goal: "grasa", sex: "m", dob: "1995-01-01", heightCm: 175, weight: 85, goalWeight: 78, goalDate: suggestDate(85, 78).date, days: 4, equipment: "gym", level: "intermedio", minutes: 45, consent: false }));
  const [touchedDate, setTouchedDate] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const up = (p: Partial<Onboard>) => setO((x) => {
    const n = { ...x, ...p };
    if (!touchedDate && (p.weight != null || p.goalWeight != null)) n.goalDate = suggestDate(n.weight, n.goalWeight).date;
    return n;
  });

  const age = ageOn(o.dob);
  const t = useMemo(() => targets({ kg: o.weight, heightCm: o.heightCm, age, sex: o.sex, mode: o.goal === "grasa" ? "acelerada" : "recomp" }), [o, age]);
  const sug = suggestDate(o.weight, o.goalWeight);
  const weeksTo = Math.max(1, (new Date(o.goalDate + "T12:00:00").getTime() - Date.now()) / (7 * 864e5));
  const pace = (o.weight - o.goalWeight) / weeksTo;
  const paceWarn = pace > o.weight * 0.01;
  const week = planWeek(0, scheduleFor(o.days), { equipment: o.equipment, level: o.level, minutes: o.minutes });

  const canNext = [true, o.name.trim().length > 0 && age >= 16 && age <= 90, o.goalWeight > 0, true, true, true, o.consent][step];

  function finish() {
    setErr(null);
    start(async () => {
      const r = await completeOnboarding(o);
      if (!r.ok) return setErr(r.error ?? "Error");
      setStep(STEPS);
    });
  }

  if (step === STEPS) {
    return (
      <main className="min-h-dvh bg-paper grid place-items-center px-6 py-10 text-center">
        <Confetti />
        <div className="max-w-md w-full animate-rise">
          <p className="text-7xl">🍌</p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-ink">¡Tu plan está listo, {o.name.split(" ")[0]}!</h1>
          <p className="mt-2 text-muted">Calculado para ti. Se ajusta solo cada semana con tu peso real.</p>
          <div className="mt-8 grid grid-cols-2 gap-3 text-left">
            {[["🔥", t.kcal.toLocaleString("es-CR"), "kcal al día"], ["🥩", `${t.protein} g`, "proteína"], ["🏋️", `${o.days} días`, "de gym por semana"], ["🎯", `${nf(o.goalWeight)} kg`, new Date(o.goalDate + "T12:00:00").toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" })]].map(([e, v, l]) => (
              <div key={l} className="card p-4"><p className="text-xl">{e}</p><p className="mt-1 text-2xl font-extrabold text-ink tabular-nums">{v}</p><p className="text-xs font-semibold text-muted">{l}</p></div>
            ))}
          </div>
          {demo && <p className="mt-4 text-sm text-banana-ink">Modo demo: no se guardó nada.</p>}
          {(() => {
            const intent = typeof document !== "undefined" ? decodeIntent(document.cookie.split("; ").find((c) => c.startsWith(INTENT_COOKIE + "="))?.split("=")[1]) : null;
            return intent
              ? <button onClick={() => router.replace(intentPath(intent))} className="btn-banana w-full h-14 mt-8 text-base">Activar mi plan <ArrowRight className="size-5" /></button>
              : <button onClick={() => { router.replace("/app"); router.refresh(); }} className="btn-primary w-full h-14 mt-8 text-base">Ver mi rutina de hoy <ArrowRight className="size-5" /></button>;
          })()}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-paper flex flex-col">
      <header className="px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mx-auto max-w-md flex items-center justify-between h-12">
          {step > 0 ? <button onClick={() => setStep(step - 1)} className="grid place-items-center size-10 rounded-full bg-white border border-line" aria-label="Atrás"><ArrowLeft className="size-5" /></button> : <Logo small />}
          <span className="text-sm font-bold text-muted tabular-nums">{step + 1} de {STEPS}</span>
        </div>
        <div className="mx-auto max-w-md mt-2 h-1.5 rounded-full bg-line overflow-hidden"><div className="h-full bg-ink rounded-full transition-all duration-500" style={{ width: `${((step + 1) / STEPS) * 100}%` }} /></div>
      </header>

      <section key={step} className="flex-1 px-5 py-8 animate-rise">
        <div className="mx-auto max-w-md space-y-6">
          {step === 0 && (<>
            <div><h1 className="text-3xl font-extrabold tracking-tight text-ink">¿Qué quieres lograr? 🎯</h1><p className="mt-2 text-muted">Tu plan de entreno y comida cambia según tu meta.</p></div>
            <div className="space-y-3">
              <Choice on={o.goal === "grasa"} onClick={() => up({ goal: "grasa" })} e="🔥" t="Bajar grasa rápido" d="Déficit de 500 kcal · resultados visibles en 4 semanas" />
              <Choice on={o.goal === "recomp"} onClick={() => up({ goal: "recomp" })} e="⚖️" t="Recomposición" d="Bajar grasa y ganar músculo a la vez · déficit suave" />
              <Choice on={o.goal === "fuerza"} onClick={() => up({ goal: "fuerza" })} e="💪" t="Ganar fuerza" d="Más kilos en la barra sin subir grasa" />
            </div>
          </>)}

          {step === 1 && (<>
            <div><h1 className="text-3xl font-extrabold tracking-tight text-ink">Cuéntame de ti 👋</h1><p className="mt-2 text-muted">Lo usamos para calcular tu metabolismo exacto.</p></div>
            <label className="block"><span className="text-sm font-bold text-ink">¿Cómo te llamas?</span><input value={o.name} onChange={(e) => up({ name: e.target.value })} className="input mt-1.5 h-14 text-lg" autoComplete="given-name" /></label>
            <div><span className="text-sm font-bold text-ink">Sexo biológico</span><div className="mt-1.5 grid grid-cols-2 gap-2">{([["m", "👨 Hombre"], ["f", "👩 Mujer"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => up({ sex: k })} className={`h-14 rounded-2xl border-2 font-bold ${o.sex === k ? "border-ink bg-banana text-ink" : "border-line bg-white text-muted"}`}>{l}</button>)}</div></div>
            <label className="block"><span className="text-sm font-bold text-ink">Fecha de nacimiento</span><input type="date" value={o.dob} max={iso(new Date())} onChange={(e) => up({ dob: e.target.value })} className="input mt-1.5 h-14 text-lg" /><span className="mt-1 block text-xs text-muted">{age} años</span></label>
            <div><span className="text-sm font-bold text-ink">Estatura</span><div className="mt-1.5"><Num value={o.heightCm} onChange={(n) => up({ heightCm: n })} step={1} unit="cm" min={130} max={220} d={0} /></div></div>
          </>)}

          {step === 2 && (<>
            <div><h1 className="text-3xl font-extrabold tracking-tight text-ink">Tu punto de partida ⚖️</h1><p className="mt-2 text-muted">Pésate en la mañana si puedes. Si no, un aproximado sirve.</p></div>
            <div><span className="text-sm font-bold text-ink">Peso actual</span><div className="mt-1.5"><Num value={o.weight} onChange={(n) => up({ weight: n })} step={0.5} unit="kg" min={40} max={250} /></div></div>
            <div><span className="text-sm font-bold text-ink">Peso meta</span><div className="mt-1.5"><Num value={o.goalWeight} onChange={(n) => up({ goalWeight: n })} step={0.5} unit="kg" min={40} max={250} /></div></div>
            <label className="block"><span className="text-sm font-bold text-ink">¿Para cuándo?</span><input type="date" value={o.goalDate} min={iso(new Date())} onChange={(e) => { setTouchedDate(true); up({ goalDate: e.target.value }); }} className="input mt-1.5 h-14 text-lg" /></label>
            <div className={`rounded-3xl p-4 ${paceWarn ? "bg-ember/10" : "bg-peel/10"}`}>
              <p className={`font-extrabold ${paceWarn ? "text-ember-ink" : "text-peel"}`}>{paceWarn ? "⚠️ Muy agresivo" : "✅ Ritmo sano"}: {nf(Math.max(0, pace), 2)} kg por semana</p>
              <p className="mt-1 text-sm text-body">{paceWarn ? `Más de 1 % por semana suele costar músculo. Te recomiendo el ${new Date(sug.date + "T12:00:00").toLocaleDateString("es-CR", { day: "numeric", month: "long" })}.` : "Perderás grasa y conservarás tu músculo."}</p>
              {paceWarn && <button type="button" onClick={() => { setTouchedDate(false); up({ goalDate: sug.date }); }} className="mt-2 chip h-8 bg-white text-ink">Usar fecha recomendada</button>}
            </div>
          </>)}

          {step === 3 && (<>
            <div><h1 className="text-3xl font-extrabold tracking-tight text-ink">¿Cuánta experiencia tienes? 💪</h1><p className="mt-2 text-muted">Ajustamos ejercicios, series y descansos a tu nivel.</p></div>
            <div className="space-y-3">
              <Choice on={o.level === "principiante"} onClick={() => up({ level: "principiante" })} e="🌱" t="Principiante" d="Nunca o casi nunca he entrenado con pesas" />
              <Choice on={o.level === "intermedio"} onClick={() => up({ level: "intermedio" })} e="🍌" t="Intermedio" d="Entreno hace meses y conozco los básicos" />
              <Choice on={o.level === "avanzado"} onClick={() => up({ level: "avanzado" })} e="🦍" t="Avanzado" d="Más de 2 años entrenando en serio" />
            </div>
          </>)}

          {step === 4 && (<>
            <div><h1 className="text-3xl font-extrabold tracking-tight text-ink">¿Cuántos días puedes entrenar? 📅</h1><p className="mt-2 text-muted">Sé realista: es mejor 4 días siempre que 6 a veces.</p></div>
            <div className="grid grid-cols-4 gap-2">{[3, 4, 5, 6].map((n) => <button key={n} type="button" onClick={() => up({ days: n })} className={`h-20 rounded-3xl border-2 text-3xl font-extrabold ${o.days === n ? "border-ink bg-banana text-ink" : "border-line bg-white text-muted"}`}>{n}</button>)}</div>
            <div><p className="text-sm font-bold text-ink mb-2">¿Cuánto tiempo por sesión?</p><div className="grid grid-cols-4 gap-2">{[20, 30, 45, 60].map((n) => <button key={n} type="button" onClick={() => up({ minutes: n })} className={`h-14 rounded-2xl border-2 font-extrabold ${o.minutes === n ? "border-ink bg-banana text-ink" : "border-line bg-white text-muted"}`}>{n}<span className="text-xs font-bold"> min</span></button>)}</div>
              <p className="mt-2 text-xs text-muted">¿Un día sin tiempo? Siempre tendrás entrenos exprés de 10 minutos.</p></div>
            <div className="card p-4">
              <p className="text-sm font-bold text-ink mb-2">Así se vería tu semana</p>
              <ul className="space-y-1.5">{week.map((d) => <li key={d.dow} className="flex items-center justify-between text-sm"><span className="w-20 font-semibold text-muted capitalize">{DAY_NAMES[d.dow]}</span><span className={`flex-1 font-bold ${d.tpl ? "text-ink" : "text-faint"}`}>{d.emoji} {d.name}</span>{d.tpl && <span className="text-xs text-muted tabular-nums">~{d.mins} min</span>}</li>)}</ul>
            </div>
          </>)}

          {step === 5 && (<>
            <div><h1 className="text-3xl font-extrabold tracking-tight text-ink">¿Dónde entrenas? 🏋️</h1><p className="mt-2 text-muted">Elegimos los ejercicios según tu equipo.</p></div>
            <div className="space-y-3">
              <Choice on={o.equipment === "gym"} onClick={() => up({ equipment: "gym" })} e="🏋️" t="Gimnasio" d="Barras, mancuernas, poleas y máquinas" />
              <Choice on={o.equipment === "mixto"} onClick={() => up({ equipment: "mixto" })} e="🔀" t="Gym y casa" d="A veces voy, a veces entreno en casa" />
              <Choice on={o.equipment === "casa"} onClick={() => up({ equipment: "casa" })} e="🏠" t="En casa con mancuernas" d="Un par de mancuernas o bandas" />
              <Choice on={o.equipment === "ninguno"} onClick={() => up({ equipment: "ninguno" })} e="🛏️" t="Sin equipo" d="Solo tu cuerpo y un espacio de 2 × 2 m" />
            </div>
          </>)}

          {step === 6 && (<>
            <div><h1 className="text-3xl font-extrabold tracking-tight text-ink">Un último detalle 🔒</h1><p className="mt-2 text-muted">Tus datos de salud son tuyos y solo los usamos para personalizar tu plan.</p></div>
            <div className="card p-5 space-y-2 text-sm text-body">
              <p>✅ Cifrados y privados: nadie más ve tu peso ni tus fotos.</p>
              <p>✅ Puedes exportarlos o borrar tu cuenta cuando quieras.</p>
              <p>✅ Nunca vendemos tus datos.</p>
            </div>
            <label className="flex gap-3 items-start rounded-3xl bg-white border-2 border-line p-4 cursor-pointer has-[:checked]:border-ink">
              <input type="checkbox" checked={o.consent} onChange={(e) => up({ consent: e.target.checked })} className="mt-1 size-5 accent-ink" />
              <span className="text-sm text-body">Autorizo a Banana Burn a procesar mis datos de salud (peso, medidas, alimentación) para personalizar mi plan, según la Ley 8968 de Costa Rica.</span>
            </label>
            {err && <p role="alert" className="rounded-2xl bg-bad/10 p-3 text-sm font-semibold text-bad">{err}</p>}
          </>)}
        </div>
      </section>

      <footer className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md">
          {step < STEPS - 1 ? (
            <button disabled={!canNext} onClick={() => setStep(step + 1)} className="btn-primary w-full h-14 text-base">Continuar <ArrowRight className="size-5" /></button>
          ) : (
            <button disabled={!canNext || pending} onClick={finish} className="btn-banana w-full h-14 text-base">{pending ? "Calculando tu plan…" : "Crear mi plan 🍌"}</button>
          )}
        </div>
      </footer>
    </main>
  );
}
