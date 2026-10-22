"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowsLeftRight, Banana, BananaFlame, CircleNotch, Barbell, BrandIcon, Check, CheckCircle, Egg, Gorilla, House, MonkeyBanana, Minus, PersonSimpleRun, Plus, Scales, Syringe, Target, Warning } from "@/components/icons";
import { ageOn, DAY_NAMES, planWeek, scheduleFor, targets } from "@/lib/engine";
import { MEDS, glp1Targets } from "@/lib/glp1";
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
      <button type="button" onClick={() => set(value - step)} className="pressable grid place-items-center w-16 h-full rounded-l-3xl text-muted active:text-ink active:bg-cream" aria-label="Menos"><Minus weight="bold" className="size-6" /></button>
      <p className="flex-1 text-center text-4xl font-extrabold text-ink tabular-nums">{nf(value, d)}<span className="ml-1 text-lg text-faint">{unit}</span></p>
      <button type="button" onClick={() => set(value + step)} className="pressable grid place-items-center w-16 h-full rounded-r-3xl text-muted active:text-ink active:bg-cream" aria-label="Más"><Plus weight="bold" className="size-6" /></button>
    </div>
  );
}

function Choice({ on, onClick, icon, t, d }: { on: boolean; onClick: () => void; icon: React.ReactNode; t: string; d?: string }) {
  return (
    <button type="button" onClick={onClick} className={`pressable w-full flex items-center gap-4 rounded-3xl border-2 p-4 text-left transition-[background-color,border-color,transform] duration-150 ease-[cubic-bezier(.23,1,.32,1)] active:scale-[.98] ${on ? "border-ink bg-banana" : "border-line bg-white hover:border-ink/40"}`} aria-pressed={on}>
      <span className={`grid place-items-center size-12 shrink-0 rounded-2xl [&>svg]:size-7 ${on ? "bg-white/70 text-ink" : "bg-banana-soft text-banana-ink"}`}>{icon}</span>
      <span className="flex-1 min-w-0"><span className="block font-extrabold text-ink">{t}</span>{d && <span className="block text-sm text-ink/70">{d}</span>}</span>
      <span aria-hidden className={`grid place-items-center size-6 shrink-0 rounded-full border-2 transition-colors duration-150 ${on ? "bg-ink border-ink text-white" : "border-line"}`}><Check weight="bold" className={`size-4 transition-[opacity,transform] duration-200 ease-[cubic-bezier(.23,1,.32,1)] ${on ? "opacity-100 scale-100" : "opacity-0 scale-50"}`} /></span>
    </button>
  );
}

export function Wizard({ name: initialName, demo }: { name: string; demo: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); window.scrollTo({ top: 0 }); };
  const [o, setO] = useState<Onboard>(() => ({ name: initialName, goal: "grasa", sex: "m", dob: "1995-01-01", heightCm: 175, weight: 85, goalWeight: 78, goalDate: suggestDate(85, 78).date, days: 4, equipment: "gym", level: "intermedio", minutes: 45, consent: false, glp1: typeof document !== "undefined" && document.cookie.includes("bb_programa=glp1"), glp1Med: "semaglutida", glp1Dow: 1 }));
  const [touchedDate, setTouchedDate] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [parq, setParq] = useState<boolean[]>([false, false, false, false]);
  const [medOk, setMedOk] = useState(false);
  const [pending, start] = useTransition();
  const up = (p: Partial<Onboard>) => setO((x) => {
    const n = { ...x, ...p };
    if (!touchedDate && (p.weight != null || p.goalWeight != null)) n.goalDate = suggestDate(n.weight, n.goalWeight).date;
    return n;
  });

  const age = ageOn(o.dob);
  const t = useMemo(() => {
    const base = targets({ kg: o.weight, heightCm: o.heightCm, age, sex: o.sex, mode: o.goal === "grasa" ? "acelerada" : "recomp" });
    if (!o.glp1) return base;
    const g = glp1Targets({ kg: o.weight, goalKg: o.goalWeight, heightCm: o.heightCm, age, sex: o.sex });
    return { ...base, kcal: g.kcal, protein: g.protein };
  }, [o, age]);
  const sug = suggestDate(o.weight, o.goalWeight);
  const weeksTo = Math.max(1, (new Date(o.goalDate + "T12:00:00").getTime() - Date.now()) / (7 * 864e5));
  const pace = (o.weight - o.goalWeight) / weeksTo;
  const paceWarn = pace > o.weight * 0.01;
  const goalBmi = o.goalWeight / (o.heightCm / 100) ** 2;
  const goalErr = o.goalWeight > o.weight ? "Tu meta es más alta que tu peso actual. Para ganar peso, elige el objetivo de fuerza." : goalBmi < 18.5 ? `Esa meta queda por debajo de un peso saludable para tu estatura (mínimo ${Math.ceil(18.5 * (o.heightCm / 100) ** 2)} kg).` : null;
  const parqYes = parq.some(Boolean);
  const week = planWeek(0, scheduleFor(o.days), { equipment: o.equipment, level: o.level, minutes: o.minutes });

  const canNext = [true, o.name.trim().length > 0 && age >= 18 && age <= 90, o.goalWeight > 0 && !goalErr, true, true, true, o.consent && (!parqYes || medOk)][step];

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
          <span className="mx-auto grid place-items-center size-24 rounded-[2rem] bg-banana-soft text-banana-ink"><MonkeyBanana className="size-16" /></span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-ink">¡Tu plan está listo, {o.name.split(" ")[0]}!</h1>
          <p className="mt-2 text-muted">Calculado para ti. Se ajusta solo cada semana con tu peso real.</p>
          <div className="mt-8 grid grid-cols-2 gap-3 text-left">
            {([[<BananaFlame key="k" className="size-5 text-ember-ink" />, t.kcal.toLocaleString("es-CR"), "kcal al día"], [<Egg key="p" weight="duotone" className="size-5 text-banana-ink" />, `${t.protein} g`, "proteína"], [<Barbell key="d" weight="duotone" className="size-5 text-banana-ink" />, `${o.days} días`, "de gym por semana"], [<Target key="g" weight="duotone" className="size-5 text-peel" />, `${nf(o.goalWeight)} kg`, new Date(o.goalDate + "T12:00:00").toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" })]] as const).map(([e, v, l], i) => (
              <div key={l} className="card p-4 transition-[opacity,translate] duration-300 ease-[cubic-bezier(.23,1,.32,1)] starting:opacity-0 starting:translate-y-2" style={{ transitionDelay: `${150 + i * 60}ms` }}><span className="grid place-items-center size-9 rounded-xl bg-cream">{e}</span><p className="mt-1 text-2xl font-extrabold text-ink tabular-nums">{v}</p><p className="text-xs font-semibold text-muted">{l}</p></div>
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
          {step > 0 ? <button onClick={() => go(step - 1)} className="pressable grid place-items-center size-10 rounded-full bg-white border border-line" aria-label="Atrás"><ArrowLeft weight="bold" className="size-5" /></button> : <Logo small />}
          <span className="text-sm font-bold text-muted tabular-nums">{step + 1} de {STEPS}</span>
        </div>
        <div className="mx-auto max-w-md mt-2 h-1.5 rounded-full bg-line overflow-hidden" role="progressbar" aria-label="Progreso" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step + 1}><div className="h-full w-full bg-ink rounded-full origin-left transition-transform duration-300 ease-[cubic-bezier(.23,1,.32,1)]" style={{ transform: `scaleX(${(step + 1) / STEPS})` }} /></div>
      </header>

      <section key={step} className={`flex-1 px-5 py-8 transition-[opacity,translate] duration-250 ease-[cubic-bezier(.23,1,.32,1)] starting:opacity-0 ${dir > 0 ? "starting:translate-x-6" : "starting:-translate-x-6"} motion-reduce:starting:translate-x-0`}>
        <div className="mx-auto max-w-md space-y-6">
          {step === 0 && (<>
            <div><h1 className="text-3xl font-extrabold tracking-tight text-ink">¿Qué quieres lograr?</h1><p className="mt-2 text-muted">Tu plan de entreno y comida cambia según tu meta.</p></div>
            <div className="space-y-3">
              <Choice on={o.goal === "grasa"} onClick={() => up({ goal: "grasa" })} icon={<BananaFlame />} t="Bajar grasa rápido" d="Déficit de 500 kcal, resultados visibles en 4 semanas" />
              <Choice on={o.goal === "recomp"} onClick={() => up({ goal: "recomp" })} icon={<Scales weight="duotone" />} t="Recomposición" d="Bajar grasa y ganar músculo a la vez, con déficit suave" />
              <Choice on={o.goal === "fuerza"} onClick={() => up({ goal: "fuerza" })} icon={<Barbell weight="duotone" />} t="Ganar fuerza" d="Más kilos en la barra sin subir grasa" />
            </div>
            <div className={`rounded-3xl border-2 p-4 ${o.glp1 ? "border-ink bg-white" : "border-dashed border-line"}`}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={o.glp1} onChange={(e) => up({ glp1: e.target.checked })} className="size-5 accent-ink" />
                <span><span className="flex items-center gap-1.5 font-extrabold text-ink"><Syringe weight="duotone" className="size-5 text-banana-ink" />Estoy en tratamiento con GLP-1</span><span className="block text-sm text-muted">Ozempic, Wegovy, Mounjaro, Zepbound, Saxenda… recetado por tu médico</span></span>
              </label>
              {o.glp1 && (
                <div className="mt-4 space-y-3 transition-[opacity,translate] duration-200 ease-[cubic-bezier(.23,1,.32,1)] starting:opacity-0 starting:-translate-y-1">
                  <p className="text-sm text-body">Activamos <b>Banana Shield</b>: más proteína, fuerza como prioridad y modo suave en días de náusea, para que pierdas grasa y no músculo.</p>
                  <label className="block"><span className="text-sm font-bold text-ink">Medicamento</span>
                    <select value={o.glp1Med} onChange={(e) => up({ glp1Med: e.target.value as Onboard["glp1Med"] })} className="input h-12 mt-1">{MEDS.map((m) => <option key={m.id} value={m.id}>{m.n} ({m.ex})</option>)}</select></label>
                  <label className="block"><span className="text-sm font-bold text-ink">Día de inyección</span>
                    <select value={o.glp1Dow ?? -1} onChange={(e) => up({ glp1Dow: Number(e.target.value) < 0 ? null : Number(e.target.value) })} className="input h-12 mt-1">
                      <option value={-1}>No es semanal (diario u oral)</option>{[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{DAY_NAMES[d]}</option>)}</select></label>
                </div>
              )}
            </div>
          </>)}

          {step === 1 && (<>
            <div><h1 className="text-3xl font-extrabold tracking-tight text-ink">Cuéntame de ti</h1><p className="mt-2 text-muted">Con esto estimamos cuánta energía gastas al día.</p></div>
            <label className="block"><span className="text-sm font-bold text-ink">¿Cómo te llamas?</span><input value={o.name} onChange={(e) => up({ name: e.target.value })} className="input mt-1.5 h-14 text-lg" autoComplete="given-name" /></label>
            <div><span className="text-sm font-bold text-ink">Sexo biológico</span><div className="mt-1.5 grid grid-cols-2 gap-2">{([["m", "Hombre"], ["f", "Mujer"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => up({ sex: k })} className={`pressable h-14 rounded-2xl border-2 font-bold transition-[background-color,border-color,color,transform] ${o.sex === k ? "border-ink bg-banana text-ink" : "border-line bg-white text-muted"}`} aria-pressed={o.sex === k}>{l}</button>)}</div></div>
            <label className="block"><span className="text-sm font-bold text-ink">Fecha de nacimiento</span><input type="date" value={o.dob} max={iso(new Date())} onChange={(e) => up({ dob: e.target.value })} className="input mt-1.5 h-14 text-lg" /><span className={`mt-1 block text-xs ${age < 18 ? "font-semibold text-bad" : "text-muted"}`} role={age < 18 ? "alert" : undefined}>{age < 18 ? "Banana Burn es para personas mayores de 18 años." : `${age} años`}</span></label>
            <div><span className="text-sm font-bold text-ink">Estatura</span><div className="mt-1.5"><Num value={o.heightCm} onChange={(n) => up({ heightCm: n })} step={1} unit="cm" min={130} max={220} d={0} /></div></div>
          </>)}

          {step === 2 && (<>
            <div><h1 className="text-3xl font-extrabold tracking-tight text-ink">Tu punto de partida</h1><p className="mt-2 text-muted">Pésate en la mañana si puedes. Si no, un aproximado sirve.</p></div>
            <div><span className="text-sm font-bold text-ink">Peso actual</span><div className="mt-1.5"><Num value={o.weight} onChange={(n) => up({ weight: n })} step={0.5} unit="kg" min={40} max={250} /></div></div>
            <div><span className="text-sm font-bold text-ink">Peso meta</span><div className="mt-1.5"><Num value={o.goalWeight} onChange={(n) => up({ goalWeight: n })} step={0.5} unit="kg" min={40} max={250} /></div></div>
            <label className="block"><span className="text-sm font-bold text-ink">¿Para cuándo?</span><input type="date" value={o.goalDate} min={iso(new Date())} onChange={(e) => { setTouchedDate(true); up({ goalDate: e.target.value }); }} className="input mt-1.5 h-14 text-lg" /></label>
            {goalErr ? <p role="alert" className="rounded-3xl bg-bad/10 p-4 text-sm font-semibold text-bad">{goalErr}</p> :
            <div className={`rounded-3xl p-4 ${paceWarn ? "bg-ember/10" : "bg-peel/10"}`}>
              <p className={`flex items-center gap-1.5 font-extrabold ${paceWarn ? "text-ember-ink" : "text-peel"}`}>{paceWarn ? <Warning weight="duotone" className="size-5 shrink-0" /> : <CheckCircle weight="duotone" className="size-5 shrink-0" />}{paceWarn ? "Muy agresivo" : "Ritmo sano"}: {nf(Math.max(0, pace), 2)} kg por semana</p>
              <p className="mt-1 text-sm text-body">{paceWarn ? `Más de 1 % por semana suele costar músculo. Te recomiendo el ${new Date(sug.date + "T12:00:00").toLocaleDateString("es-CR", { day: "numeric", month: "long" })}.` : "Perderás grasa y conservarás tu músculo."}</p>
              {paceWarn && <button type="button" onClick={() => { setTouchedDate(false); up({ goalDate: sug.date }); }} className="mt-3 chip h-8 bg-white text-ink">Usar fecha recomendada</button>}
            </div>}
          </>)}

          {step === 3 && (<>
            <div><h1 className="text-3xl font-extrabold tracking-tight text-ink">¿Cuánta experiencia tienes?</h1><p className="mt-2 text-muted">Ajustamos ejercicios, series y descansos a tu nivel.</p></div>
            <div className="space-y-3">
              <Choice on={o.level === "principiante"} onClick={() => up({ level: "principiante" })} icon={<BrandIcon name="plant" />} t="Principiante" d="Nunca o casi nunca he entrenado con pesas" />
              <Choice on={o.level === "intermedio"} onClick={() => up({ level: "intermedio" })} icon={<Banana />} t="Intermedio" d="Entreno hace meses y conozco los básicos" />
              <Choice on={o.level === "avanzado"} onClick={() => up({ level: "avanzado" })} icon={<Gorilla />} t="Avanzado" d="Más de 2 años entrenando en serio" />
            </div>
          </>)}

          {step === 4 && (<>
            <div><h1 className="text-3xl font-extrabold tracking-tight text-ink">¿Cuántos días puedes entrenar?</h1><p className="mt-2 text-muted">Sé realista: es mejor 4 días siempre que 6 a veces.</p></div>
            <div className="grid grid-cols-4 gap-2">{[3, 4, 5, 6].map((n) => <button key={n} type="button" onClick={() => up({ days: n })} className={`pressable h-20 rounded-3xl border-2 text-3xl font-extrabold tabular-nums transition-[background-color,border-color,color,transform] ${o.days === n ? "border-ink bg-banana text-ink" : "border-line bg-white text-muted"}`} aria-pressed={o.days === n}>{n}</button>)}</div>
            <div><p className="text-sm font-bold text-ink mb-2">¿Cuánto tiempo por sesión?</p><div className="grid grid-cols-5 gap-2">{[15, 20, 30, 45, 60].map((n) => <button key={n} type="button" onClick={() => up({ minutes: n })} className={`pressable h-14 rounded-2xl border-2 font-extrabold tabular-nums transition-[background-color,border-color,color,transform] ${o.minutes === n ? "border-ink bg-banana text-ink" : "border-line bg-white text-muted"}`} aria-pressed={o.minutes === n}>{n}<span className="text-xs font-bold"> min</span></button>)}</div>
              <p className="mt-2 text-xs text-muted">¿Un día sin tiempo? Siempre tendrás entrenos exprés de 10 minutos.</p></div>
            <div className="card p-4">
              <p className="text-sm font-bold text-ink mb-2">Así se vería tu semana</p>
              <ul className="space-y-1.5">{week.map((d) => <li key={d.dow} className="flex items-center justify-between text-sm"><span className="w-20 font-semibold text-muted capitalize">{DAY_NAMES[d.dow]}</span><span className={`flex-1 flex items-center gap-2 font-bold ${d.tpl ? "text-ink" : "text-faint"}`}><BrandIcon name={d.icon} className="size-4 shrink-0" />{d.name}</span>{d.tpl && <span className="text-xs text-muted tabular-nums">~{d.mins} min</span>}</li>)}</ul>
            </div>
          </>)}

          {step === 5 && (<>
            <div><h1 className="text-3xl font-extrabold tracking-tight text-ink">¿Dónde entrenas?</h1><p className="mt-2 text-muted">Elegimos los ejercicios según tu equipo.</p></div>
            <div className="space-y-3">
              <Choice on={o.equipment === "gym"} onClick={() => up({ equipment: "gym" })} icon={<Barbell weight="duotone" />} t="Gimnasio" d="Barras, mancuernas, poleas y máquinas" />
              <Choice on={o.equipment === "mixto"} onClick={() => up({ equipment: "mixto" })} icon={<ArrowsLeftRight weight="duotone" />} t="Gym y casa" d="A veces voy, a veces entreno en casa" />
              <Choice on={o.equipment === "casa"} onClick={() => up({ equipment: "casa" })} icon={<House weight="duotone" />} t="En casa con mancuernas" d="Un par de mancuernas o bandas" />
              <Choice on={o.equipment === "ninguno"} onClick={() => up({ equipment: "ninguno" })} icon={<PersonSimpleRun weight="duotone" />} t="Sin equipo" d="Solo tu cuerpo y un espacio de 2 × 2 m" />
            </div>
          </>)}

          {step === 6 && (<>
            <div><h1 className="text-3xl font-extrabold tracking-tight text-ink">Un último detalle</h1><p className="mt-2 text-muted">Tus datos de salud son tuyos y solo los usamos para personalizar tu plan.</p></div>
            <div className="card p-5 space-y-2 text-sm text-body">
              {["Cifrados y privados: nadie más ve tu peso ni tus fotos.", "Puedes exportarlos o borrar tu cuenta cuando quieras.", "Nunca vendemos tus datos."].map((x) => (
                <p key={x} className="flex items-start gap-2"><CheckCircle weight="duotone" className="size-5 shrink-0 text-peel" />{x}</p>
              ))}
            </div>
            <fieldset className="card p-5">
              <legend className="sr-only">Antes de empezar</legend>
              <p className="text-sm font-bold text-ink">Antes de empezar, ¿alguna aplica a ti?</p>
              <ul className="mt-3 space-y-2">
                {["Un médico me dijo que tengo una condición del corazón o presión alta no controlada", "Siento dolor de pecho, mareo o me desmayo al hacer ejercicio", "Tengo una lesión o dolor en articulaciones o espalda que empeora al moverme", o.sex === "f" ? "Estoy embarazada o di a luz hace menos de 6 meses" : "Tomo medicamentos para el corazón o la presión"].map((q, i) => (
                  <li key={i}><label className="flex gap-3 items-start text-sm text-body cursor-pointer"><input type="checkbox" checked={parq[i]} onChange={(e) => setParq((p) => p.map((x, j) => (j === i ? e.target.checked : x)))} className="mt-0.5 size-5 shrink-0 accent-ink" />{q}</label></li>
                ))}
              </ul>
              {parqYes && (
                <div className="mt-4 rounded-2xl bg-ember/10 p-3 text-sm text-body">
                  <p className="font-bold text-ember-ink">Habla con tu médico antes de empezar.</p>
                  <p className="mt-1">No es un no: es para que entrenes con seguridad. Cuando te dé el visto bueno, arrancamos en nivel principiante y con modo suave.</p>
                  <label className="mt-2 flex gap-3 items-start font-semibold text-ink cursor-pointer"><input type="checkbox" checked={medOk} onChange={(e) => { setMedOk(e.target.checked); if (e.target.checked) up({ level: "principiante" }); }} className="mt-0.5 size-5 shrink-0 accent-ink" />Mi médico me autorizó a hacer ejercicio</label>
                </div>
              )}
            </fieldset>
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
            <button disabled={!canNext} onClick={() => go(step + 1)} className="btn-primary w-full h-14 text-base">Continuar <ArrowRight className="size-5" /></button>
          ) : (
            <button disabled={!canNext || pending} onClick={finish} className="btn-banana w-full h-14 text-base">{pending ? <><CircleNotch weight="bold" className="size-5 animate-spin" />Calculando tu plan…</> : <>Crear mi plan <ArrowRight className="size-5" /></>}</button>
          )}
        </div>
      </footer>
    </main>
  );
}
