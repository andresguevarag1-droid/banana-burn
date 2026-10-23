"use client";
import { useEffect, useState, useTransition } from "react";
import { FunnelTracker } from "@/components/analytics";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowsLeftRight, Banana, BananaFlame, CircleNotch, Barbell, BrandIcon, Check, CheckCircle, Egg, Gorilla, House, MonkeyBanana, Minus, PersonSimpleRun, Plus, Scales, Syringe, Target, Timer, Warning } from "@/components/icons";
import { ageOn, DAY_NAMES, planWeek, scheduleFor, targets } from "@/lib/engine";
import { MEDS, glp1Targets } from "@/lib/glp1";
import { Logo } from "@/components/brand";
import { Confetti } from "@/components/confetti";
import { completeOnboarding, type Onboard } from "./actions";
import { COUNTRIES, countryFromTz } from "@/lib/countries";
import { intentPath, type CheckoutIntent } from "@/lib/checkout-intent";
import { PLANS } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/copy";
import { GOALS, goalError, paceFor, suggestDate, type Goal } from "./goal";

const STEPS = 7;
const nf = (n: number, d = 1) => n.toLocaleString("es-419", { minimumFractionDigits: d, maximumFractionDigits: d });
const iso = (d: Date) => d.toISOString().slice(0, 10);
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const pad = (n: number) => String(n).padStart(2, "0");
const COMPLETO = PLANS.find((p) => p.nutrition)!;
const GOAL_ICON: Record<Goal, React.ReactNode> = { grasa: <BananaFlame />, recomp: <Scales weight="duotone" />, fuerza: <Barbell weight="duotone" /> };

/** Datos del wizard: lo que no se ha confirmado queda vacío (null) hasta que la persona lo toque. */
type Draft = Omit<Onboard, "sex" | "dob" | "heightCm" | "weight" | "goalWeight"> & { sex: Onboard["sex"] | null; heightCm: number | null; weight: number | null; goalWeight: number | null };
type Dob = { d: number | null; m: number | null; y: number | null };

/**
 * Número grande que se puede escribir (teclado decimal) o ajustar con − y +.
 * Vacío muestra un valor de referencia atenuado; − o + parten de ese valor.
 */
function Num({ id, label, value, onChange, step, unit, min, max, d = 1, hint }: { id: string; label: string; value: number | null; onChange: (n: number) => void; step: number; unit: string; min: number; max: number; d?: number; hint: number }) {
  const fmt = (n: number) => (d ? nf(n, d) : String(Math.round(n)));
  const [text, setText] = useState(value == null ? "" : fmt(value));
  const [editing, setEditing] = useState(false);
  // Con el foco afuera, el texto sigue al valor (por ejemplo, después de tocar − o +).
  useEffect(() => { if (!editing) setText(value == null ? "" : fmt(value)); }, [value, editing]); // eslint-disable-line react-hooks/exhaustive-deps
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 10) / 10));
  const parse = (s: string) => { const n = Number(s.replace(",", ".")); return s.trim() !== "" && Number.isFinite(n) ? n : null; };
  const bump = (dir: 1 | -1) => { onChange(clamp((value ?? hint) + dir * step)); try { navigator.vibrate?.(8); } catch { /* sin vibración */ } };
  return (
    <div className={`flex items-center rounded-3xl bg-white border h-20 transition-[border-color,box-shadow] duration-150 focus-within:border-ink focus-within:ring-4 focus-within:ring-banana/40 ${value == null ? "border-dashed border-ink/30" : "border-line"}`}>
      <button type="button" onClick={() => bump(-1)} className="pressable grid place-items-center w-16 h-full rounded-l-3xl text-muted active:text-ink active:bg-cream" aria-label={`Menos ${nf(step, step % 1 ? 1 : 0)} ${unit}`}><Minus weight="bold" className="size-6" /></button>
      <label htmlFor={id} className="flex-1 min-w-0 h-full flex items-center justify-center gap-1 cursor-text">
        <input
          id={id} inputMode="decimal" enterKeyHint="done" autoComplete="off" aria-label={label}
          value={text} placeholder={fmt(hint)}
          onFocus={(e) => { setEditing(true); e.currentTarget.select(); }}
          onChange={(e) => {
            const s = e.target.value.replace(/[^\d.,]/g, "").slice(0, 5);
            setText(s);
            const n = parse(s);
            if (n != null && n >= min && n <= max) onChange(Math.round(n * 10) / 10);
          }}
          onBlur={() => { setEditing(false); const n = parse(text); if (n != null) onChange(clamp(n)); }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          className="w-[5ch] min-w-0 bg-transparent text-right text-4xl font-extrabold text-ink tabular-nums outline-none placeholder:text-ink/25"
        />
        <span className="text-lg text-faint">{unit}</span>
      </label>
      <button type="button" onClick={() => bump(1)} className="pressable grid place-items-center w-16 h-full rounded-r-3xl text-muted active:text-ink active:bg-cream" aria-label={`Más ${nf(step, step % 1 ? 1 : 0)} ${unit}`}><Plus weight="bold" className="size-6" /></button>
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

const SELECT = "input h-14 text-lg px-3";

export function Wizard({ name: initialName, demo, initialGoal, glp1, country, intent, trialEndsAt, trialBeta = false, nutrition = true }: {
  name: string; demo: boolean; initialGoal: Goal | null; glp1: boolean; country: string | null; intent: CheckoutIntent | null; trialEndsAt: string | null;
  /** El acceso gratis viene del período de prueba del servicio (beta), no solo de los 7 días. */
  trialBeta?: boolean;
  /** ¿Tiene nutrición hoy (Entreno + Nutrición, prueba o beta)? En Entreno el resumen no muestra calorías ni proteína. */
  nutrition?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); window.scrollTo({ top: 0 }); };
  const [o, setO] = useState<Draft>(() => ({
    name: initialName, goal: initialGoal ?? "grasa", sex: null, heightCm: null, weight: null, goalWeight: null, goalDate: "",
    days: 4, equipment: "gym", level: "intermedio", minutes: 45, consent: false, glp1, glp1Med: "semaglutida", glp1Dow: 1, country: country ?? "",
  }));
  const [dob, setDob] = useState<Dob>({ d: null, m: null, y: null });
  const [touchedDate, setTouchedDate] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [parq, setParq] = useState<boolean[]>([false, false, false, false]);
  const [medOk, setMedOk] = useState(false);
  const [pending, start] = useTransition();

  // País sugerido por la zona horaria del navegador: solo en el cliente, después de hidratar.
  useEffect(() => {
    if (country) return;
    let tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* sin Intl */ }
    setO((x) => (x.country ? x : { ...x, country: countryFromTz(tz) }));
  }, [country]);

  const up = (p: Partial<Draft>) => setO((x) => {
    const n = { ...x, ...p };
    if (!touchedDate && (p.weight != null || p.goalWeight != null) && n.weight != null && n.goalWeight != null) n.goalDate = suggestDate(n.weight, n.goalWeight).date;
    return n;
  });

  const dobIso = dob.d && dob.m && dob.y ? `${dob.y}-${pad(dob.m)}-${pad(dob.d)}` : "";
  const age = dobIso ? ageOn(dobIso) : null;
  const thisYear = new Date().getFullYear();
  const daysInMonth = dob.m && dob.y ? new Date(dob.y, dob.m, 0).getDate() : 31;
  const setDobPart = (p: Partial<Dob>) => setDob((x) => {
    const n = { ...x, ...p };
    if (n.d && n.m && n.y) n.d = Math.min(n.d, new Date(n.y, n.m, 0).getDate());
    return n;
  });

  const full: Onboard | null = o.sex && dobIso && o.heightCm != null && o.weight != null && o.goalWeight != null && o.goalDate
    ? { ...o, sex: o.sex, dob: dobIso, heightCm: o.heightCm, weight: o.weight, goalWeight: o.goalWeight }
    : null;
  // Metas del resumen final (cálculo barato: no hace falta memorizarlo).
  const t = (() => {
    if (!full) return null;
    const a = ageOn(full.dob);
    const base = targets({ kg: full.weight, heightCm: full.heightCm, age: a, sex: full.sex, mode: full.goal === "grasa" ? "acelerada" : full.goal === "fuerza" ? "fuerza" : "recomp" });
    if (!full.glp1) return base;
    const g = glp1Targets({ kg: full.weight, goalKg: full.goalWeight, heightCm: full.heightCm, age: a, sex: full.sex });
    return { ...base, kcal: g.kcal, protein: g.protein };
  })();

  const goalErr = o.weight != null && o.goalWeight != null && o.heightCm != null ? goalError({ goal: o.goal, weight: o.weight, goalWeight: o.goalWeight, heightCm: o.heightCm }) : null;
  const pace = o.weight != null && o.goalWeight != null && o.goalDate && !goalErr ? paceFor({ goal: o.goal, weight: o.weight, goalWeight: o.goalWeight, goalDate: o.goalDate }) : null;
  const sug = o.weight != null && o.goalWeight != null ? suggestDate(o.weight, o.goalWeight) : null;
  const parqYes = parq.some(Boolean);
  const week = planWeek(0, scheduleFor(o.days), { equipment: o.equipment, level: o.level, minutes: o.minutes });
  const trialEnd = trialEndsAt ? new Date(trialEndsAt).toLocaleDateString("es-419", { day: "numeric", month: "long" }) : null;
  const intentPlan = intent ? PLANS.find((p) => p.id === intent.plan) : null;

  const canNext = [
    true,
    o.name.trim().length > 0 && o.sex != null && age != null && age >= 18 && age <= 90 && o.heightCm != null && Boolean(o.country),
    o.weight != null && o.goalWeight != null && Boolean(o.goalDate) && !goalErr,
    true, true, true,
    Boolean(full) && o.consent && (!parqYes || medOk),
  ][step];

  function finish() {
    if (!full) return;
    setErr(null);
    start(async () => {
      const r = await completeOnboarding(full);
      if (!r.ok) return setErr(r.error ?? "No se pudo guardar tu plan. Intenta de nuevo.");
      setStep(STEPS);
    });
  }

  if (step === STEPS && full && t) {
    return (
      <main className="min-h-dvh bg-paper grid place-items-center px-6 py-10 text-center">
        <Confetti />
        <div className="max-w-md w-full animate-rise">
          <span className="mx-auto grid place-items-center size-24 rounded-[2rem] bg-banana-soft text-banana-ink"><MonkeyBanana className="size-16" /></span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-ink text-balance">¡Tu plan está listo, {full.name.trim().split(" ")[0]}!</h1>
          <p className="mt-2 text-muted text-pretty">{nutrition ? "Calculado para ti. Se ajusta solo cada semana con tu peso real." : "Calculado para ti. Tus cargas suben solas cuando dominas el rango."}</p>
          {trialEnd && (
            <p className="mt-5 rounded-2xl bg-peel/10 px-4 py-3 text-sm font-semibold text-ink text-pretty">
              {trialBeta ? `Estás en el período de prueba de Banana Burn: tienes todo incluido gratis hasta el ${trialEnd}.` : `Tu prueba gratis de ${TRIAL_DAYS} días ya empezó: tienes todo incluido hasta el ${trialEnd}.`} Sin tarjeta, así que no hay cobros automáticos; te avisamos en la app antes de que termine.
            </p>
          )}
          <div className="mt-6 grid grid-cols-2 gap-3 text-left">
            {([...(nutrition ? [[<BananaFlame key="k" className="size-5 text-ember-ink" />, t.kcal.toLocaleString("es-419"), "kcal al día"], [<Egg key="p" weight="duotone" className="size-5 text-banana-ink" />, `${t.protein} g`, "proteína al día"]] as const : [[<Timer key="m" weight="duotone" className="size-5 text-ember-ink" />, `${full.minutes} min`, "por sesión"], [<PersonSimpleRun key="l" weight="duotone" className="size-5 text-banana-ink" />, full.level.charAt(0).toUpperCase() + full.level.slice(1), "tu nivel"]] as const), [<Barbell key="d" weight="duotone" className="size-5 text-banana-ink" />, `${full.days} días`, "por semana"], [<Target key="g" weight="duotone" className="size-5 text-peel" />, `${nf(full.goalWeight)} kg`, new Date(full.goalDate + "T12:00:00").toLocaleDateString("es-419", { day: "numeric", month: "short", year: "numeric" })]] as const).map(([e, v, l], i) => (
              <div key={l} className="card p-4 transition-[opacity,translate] duration-300 ease-[cubic-bezier(.23,1,.32,1)] starting:opacity-0 starting:translate-y-2" style={{ transitionDelay: `${150 + i * 60}ms` }}><span className="grid place-items-center size-9 rounded-xl bg-cream">{e}</span><p className="mt-1 text-2xl font-extrabold text-ink tabular-nums">{v}</p><p className="text-xs font-semibold text-muted">{l}</p></div>
            ))}
          </div>
          {demo && <p className="mt-4 text-sm text-banana-ink">Modo demo: no se guardó nada.</p>}
          <FunnelTracker view="onboarding_done" props={{ goal: full.goal, trial: Boolean(trialEnd) }} />
          <button data-cta="bienvenida-hoy" onClick={() => { router.replace("/app"); router.refresh(); }} className="btn-primary w-full h-14 mt-8 text-base">Empezar mi entreno de hoy <ArrowRight className="size-5" /></button>
          {intent && intentPlan && (
            <button data-cta="bienvenida-activar" onClick={() => router.replace(intentPath(intent))} className="tap mt-4 w-full text-sm font-semibold text-muted underline underline-offset-4 transition-colors duration-150 hover:text-ink">
              {trialEnd ? `¿Ya te decidiste? Activa ${intentPlan.name} desde hoy` : `Activar ${intentPlan.name}`}
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-paper flex flex-col">
      <header className="px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mx-auto max-w-md flex items-center justify-between h-12">
          {step > 0 ? <button onClick={() => go(step - 1)} className="pressable grid place-items-center size-11 rounded-full bg-white border border-line" aria-label="Atrás"><ArrowLeft weight="bold" className="size-5" /></button> : <Logo small />}
          <span className="text-sm font-bold text-muted tabular-nums">{step + 1} de {STEPS}</span>
        </div>
        <div className="mx-auto max-w-md mt-2 h-1.5 rounded-full bg-line overflow-hidden" role="progressbar" aria-label="Progreso" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step + 1}><div className="h-full w-full bg-ink rounded-full origin-left transition-transform duration-300 ease-[cubic-bezier(.23,1,.32,1)]" style={{ transform: `scaleX(${(step + 1) / STEPS})` }} /></div>
      </header>

      <section key={step} className={`flex-1 px-5 py-8 transition-[opacity,translate] duration-250 ease-[cubic-bezier(.23,1,.32,1)] starting:opacity-0 ${dir > 0 ? "starting:translate-x-6" : "starting:-translate-x-6"} motion-reduce:starting:translate-x-0`}>
        <div className="mx-auto max-w-md space-y-6">
          {step === 0 && (<>
            <div><h1 className="text-3xl font-extrabold tracking-tight text-ink">¿Qué quieres lograr?</h1><p className="mt-2 text-muted">Tu plan de entreno y comida cambia según tu meta.</p></div>
            <div className="space-y-3">
              {GOALS.map((g) => <Choice key={g.id} on={o.goal === g.id} onClick={() => up({ goal: g.id })} icon={GOAL_ICON[g.id]} t={g.t} d={g.d} />)}
            </div>
            <div className={`rounded-3xl border-2 p-4 ${o.glp1 ? "border-ink bg-white" : "border-dashed border-line"}`}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={o.glp1} onChange={(e) => up({ glp1: e.target.checked })} className="size-5 accent-ink" />
                <span><span className="flex items-center gap-1.5 font-extrabold text-ink"><Syringe weight="duotone" className="size-5 text-banana-ink" />Estoy en tratamiento con GLP&#8209;1</span><span className="block text-sm text-muted">Ozempic, Wegovy, Mounjaro, Zepbound o Saxenda, recetado por tu médico</span></span>
              </label>
              {o.glp1 && (
                <div className="mt-4 space-y-3 transition-[opacity,translate] duration-200 ease-[cubic-bezier(.23,1,.32,1)] starting:opacity-0 starting:-translate-y-1">
                  <p className="text-sm text-body text-pretty"><b>Banana Shield</b> ajusta tu plan: más proteína, fuerza como prioridad y modo suave en días de náusea, para que pierdas grasa y no músculo. Está incluido en {COMPLETO.name}{trialEnd ? `; en tu prueba gratis lo tienes hasta el ${trialEnd}` : ""}.{!nutrition ? " Tu plan actual, Entreno, no lo incluye." : intent?.plan === "entreno" ? " El plan que elegiste, Entreno, no lo incluye después de la prueba." : ""}</p>
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
            <div role="group" aria-labelledby="sexo"><span id="sexo" className="text-sm font-bold text-ink">Sexo biológico</span><div className="mt-1.5 grid grid-cols-2 gap-2">{([["m", "Hombre"], ["f", "Mujer"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => up({ sex: k })} className={`pressable h-14 rounded-2xl border-2 font-bold transition-[background-color,border-color,color,transform] ${o.sex === k ? "border-ink bg-banana text-ink" : "border-line bg-white text-muted"}`} aria-pressed={o.sex === k}>{l}</button>)}</div></div>
            <fieldset>
              <legend className="text-sm font-bold text-ink">Fecha de nacimiento</legend>
              <div className="mt-1.5 grid grid-cols-[1fr_1.6fr_1.2fr] gap-2">
                <select aria-label="Día" value={dob.d ?? ""} onChange={(e) => setDobPart({ d: Number(e.target.value) || null })} className={SELECT} autoComplete="bday-day">
                  <option value="" disabled>Día</option>{Array.from({ length: daysInMonth }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                </select>
                <select aria-label="Mes" value={dob.m ?? ""} onChange={(e) => setDobPart({ m: Number(e.target.value) || null })} className={SELECT} autoComplete="bday-month">
                  <option value="" disabled>Mes</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <select aria-label="Año" value={dob.y ?? ""} onChange={(e) => setDobPart({ y: Number(e.target.value) || null })} className={SELECT} autoComplete="bday-year">
                  <option value="" disabled>Año</option>{Array.from({ length: 73 }, (_, i) => thisYear - 18 - i).map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              {age != null && <span className={`mt-1 block text-xs ${age < 18 ? "font-semibold text-bad" : "text-muted"}`} role={age < 18 ? "alert" : undefined}>{age < 18 ? "Banana Burn es para personas mayores de 18 años." : `${age} años`}</span>}
            </fieldset>
            <label className="block"><span className="text-sm font-bold text-ink">¿Dónde vives?</span><select value={o.country ?? ""} onChange={(e) => up({ country: e.target.value })} className="input mt-1.5 h-14 text-lg" autoComplete="country"><option value="" disabled>Elige tu país</option>{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select><span className="mt-1 block text-xs text-muted">Para tu horario, tus recordatorios y comidas de tu país.</span></label>
            <div><label htmlFor="estatura" className="text-sm font-bold text-ink">Estatura</label><div className="mt-1.5"><Num id="estatura" label="Estatura en centímetros" value={o.heightCm} onChange={(n) => up({ heightCm: n })} step={1} unit="cm" min={130} max={220} d={0} hint={170} /></div>
              <p className="mt-1.5 text-xs text-muted">Toca el número para escribirlo, o ajusta con − y +.</p></div>
          </>)}

          {step === 2 && (<>
            <div><h1 className="text-3xl font-extrabold tracking-tight text-ink">Tu punto de partida</h1><p className="mt-2 text-muted">Pésate en la mañana si puedes. Si no, un aproximado sirve.</p></div>
            <div><label htmlFor="peso" className="text-sm font-bold text-ink">Peso actual</label><div className="mt-1.5"><Num id="peso" label="Peso actual en kilos" value={o.weight} onChange={(n) => up({ weight: n })} step={0.5} unit="kg" min={40} max={250} hint={75} /></div></div>
            <div><label htmlFor="meta" className="text-sm font-bold text-ink">Peso meta</label><div className="mt-1.5"><Num id="meta" label="Peso meta en kilos" value={o.goalWeight} onChange={(n) => up({ goalWeight: n })} step={0.5} unit="kg" min={40} max={250} hint={o.weight ?? 75} /></div>
              <p className="mt-1.5 text-xs text-muted">{o.goal === "fuerza" ? "Puede ser igual o mayor a tu peso actual." : o.goal === "recomp" ? "En recomposición suele quedar cerca de tu peso actual." : "Toca el número para escribirlo, o ajusta con − y +."}</p></div>
            <label className="block"><span className="text-sm font-bold text-ink">¿Para cuándo?</span><input type="date" value={o.goalDate} min={iso(new Date())} disabled={o.weight == null || o.goalWeight == null} onChange={(e) => { setTouchedDate(true); up({ goalDate: e.target.value }); }} className="input mt-1.5 h-14 text-lg disabled:opacity-60" /></label>
            {goalErr ? <p role="alert" className="rounded-3xl bg-bad/10 p-4 text-sm font-semibold text-bad">{goalErr}</p> : pace && (
              <div className={`rounded-3xl p-4 ${pace.tooFast ? "bg-ember/10" : "bg-peel/10"}`}>
                <p className={`flex items-center gap-1.5 font-extrabold ${pace.tooFast ? "text-ember-ink" : "text-peel"}`}>{pace.tooFast ? <Warning weight="duotone" className="size-5 shrink-0" /> : <CheckCircle weight="duotone" className="size-5 shrink-0" />}{pace.title}{pace.direction !== "mantiene" && `: ${nf(pace.kgPerWeek, 2)} kg por semana`}</p>
                <p className="mt-1 text-sm text-body">{pace.body}{pace.tooFast && sug ? ` Te recomiendo el ${new Date(sug.date + "T12:00:00").toLocaleDateString("es-419", { day: "numeric", month: "long" })}.` : ""}</p>
                {pace.tooFast && sug && <button type="button" onClick={() => { setTouchedDate(false); up({ goalDate: sug.date }); }} className="mt-3 chip h-8 bg-white text-ink">Usar fecha recomendada</button>}
              </div>
            )}
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
            <div className="rounded-3xl bg-white border-2 border-line p-4 has-[:checked]:border-ink">
              <label className="flex gap-3 items-start cursor-pointer">
                <input type="checkbox" checked={o.consent} onChange={(e) => up({ consent: e.target.checked })} className="mt-1 size-5 shrink-0 accent-ink" aria-describedby="consent-ley" />
                <span className="text-sm text-body">Autorizo a Banana Burn a procesar mis datos de salud (peso, medidas, alimentación) para personalizar mi plan.</span>
              </label>
              <p id="consent-ley" className="mt-2 pl-8 text-xs text-muted text-pretty">
                Según la Ley 8968 de Costa Rica, donde está la empresa. Lee la{" "}
                <Link href="/privacidad#sensibles" target="_blank" rel="noopener" className="tap font-semibold text-ink underline underline-offset-2">Política de privacidad</Link> (se abre en otra pestaña).
              </p>
            </div>
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
