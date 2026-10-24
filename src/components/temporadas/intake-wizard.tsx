"use client";
// Cuestionario de inicio de una temporada: una pregunta por pantalla, con chips. Al final, "Así queda tu semana" con el
// plan armado alrededor del deporte (seasons.ts: planWeek), que la persona confirma o ajusta.
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle, CircleNotch, Warning } from "@/components/icons";
import {
  AREAS, AREA_LABEL, AVOID_LABEL, AVOID_OPTIONS, DOW_LONG, DOW_SHORT, EQUIPMENT, EQUIPMENT_LABEL, GOALS, LEVEL_LABEL, PLACE_LABEL, SPORTS, TIME_LABEL,
  parseIntake, planWeek, type SeasonIntake, type SportId,
} from "@/lib/seasons";
import { activateSeason, saveSeasonIntake } from "@/app/actions/temporadas";
import { WeekSummary } from "./week-summary";

type Draft = Record<string, unknown> & { running?: Record<string, unknown>; raquetas?: Record<string, unknown>; cross?: Record<string, unknown> };

const chip = (on: boolean) => `pressable min-h-12 px-4 rounded-2xl border-2 font-bold text-sm transition-[background-color,border-color,color,transform] ${on ? "border-ink bg-banana text-ink" : "border-line bg-white text-muted"}`;

function Chips<T extends string | number>({ options, value, onChange, label }: { options: { v: T; l: string }[]; value: T | null | undefined; onChange: (v: T) => void; label: string }) {
  return <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">{options.map((o) => <button key={String(o.v)} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)} className={chip(value === o.v)}>{o.l}</button>)}</div>;
}
function Multi<T extends string | number>({ options, value, onChange, label }: { options: { v: T; l: string }[]; value: T[]; onChange: (v: T[]) => void; label: string }) {
  const toggle = (x: T) => onChange(value.includes(x) ? value.filter((y) => y !== x) : [...value, x]);
  return <div role="group" aria-label={label} className="flex flex-wrap gap-2">{options.map((o) => <button key={String(o.v)} type="button" aria-pressed={value.includes(o.v)} onClick={() => toggle(o.v)} className={chip(value.includes(o.v))}>{o.l}</button>)}</div>;
}
const DAYS = DOW_SHORT.map((l, v) => ({ v, l }));
function Days({ value, onChange, label }: { value: number[]; onChange: (v: number[]) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-7 gap-1.5">
      {DAYS.map((d) => <button key={d.v} type="button" aria-pressed={value.includes(d.v)} aria-label={DOW_LONG[d.v]} onClick={() => onChange(value.includes(d.v) ? value.filter((x) => x !== d.v) : [...value, d.v].sort())} className={`pressable h-12 rounded-2xl border-2 text-sm font-extrabold ${value.includes(d.v) ? "border-ink bg-banana text-ink" : "border-line bg-white text-muted"}`}>{d.l}</button>)}
    </div>
  );
}
function Q({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return <><div><h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink text-balance">{title}</h1>{sub && <p className="mt-2 text-muted text-pretty">{sub}</p>}</div>{children}</>;
}
const Label = ({ children }: { children: React.ReactNode }) => <p className="text-sm font-bold text-ink">{children}</p>;

export function IntakeWizard({ slug, sport, initial, started, startsLabel }: { slug: string; sport: SportId; initial: SeasonIntake | null; started: boolean; startsLabel: string }) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(() => (initial ? (JSON.parse(JSON.stringify(initial)) as Draft) : { level: "recreativo", years: 1, trainDays: [], time: "tarde", sessions: 3, minutes: 45, place: "gym", equipment: [], injuries: [], goal: GOALS[sport][0].id, eventDate: null, eventType: null, [sport]: {} }));
  const sp = (d[sport] ?? {}) as Record<string, unknown>;
  const up = (p: Draft) => setD((x) => ({ ...x, ...p }));
  const upS = (p: Record<string, unknown>) => setD((x) => ({ ...x, [sport]: { ...((x[sport] as Record<string, unknown>) ?? {}), ...p } }));
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const info = SPORTS[sport];
  const arr = <T = never,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);

  const steps = useMemo(() => {
    const s: { key: string; ok: () => boolean; node: () => React.ReactNode }[] = [];
    s.push({ key: "nivel", ok: () => true, node: () => (
      <Q title={`¿Cuál es tu nivel en ${info.name.toLowerCase()}?`} sub="Con esto ajustamos la carga y las progresiones.">
        <Chips label="Nivel" options={(["empezando", "recreativo", "competitivo"] as const).map((v) => ({ v, l: LEVEL_LABEL[v] }))} value={d.level as string} onChange={(level) => up({ level })} />
        <Label>¿Cuántos años llevas practicándolo?</Label>
        <Chips label="Años" options={[{ v: 0, l: "Menos de 1" }, { v: 1, l: "1 a 2" }, { v: 3, l: "3 a 5" }, { v: 6, l: "Más de 5" }]} value={d.years as number} onChange={(years) => up({ years })} />
      </Q>
    ) });
    if (sport === "running") {
      s.push({ key: "corre", ok: () => arr(sp.runDays).length > 0, node: () => (
        <Q title="¿Qué días corres?" sub="Tu fuerza se acomoda alrededor de tus carreras.">
          <Days label="Días que corres" value={arr(sp.runDays)} onChange={(runDays) => upS({ runDays, longRunDay: runDays.includes(sp.longRunDay as never) ? sp.longRunDay : null })} />
          {arr(sp.runDays).length > 0 && <><Label>¿Cuál es tu carrera larga?</Label><Chips label="Carrera larga" options={[...arr<number>(sp.runDays).map((v: number) => ({ v, l: DOW_SHORT[v] })), { v: -1, l: "No hago" }]} value={(sp.longRunDay as number | null) ?? -1} onChange={(v) => upS({ longRunDay: v < 0 ? null : v })} /></>}
        </Q>
      ) });
      s.push({ key: "volumen", ok: () => true, node: () => (
        <Q title="¿Cuánto corres y para qué te preparas?">
          <Label>Kilómetros por semana, más o menos</Label>
          <Chips label="Kilómetros" options={[{ v: 10, l: "Menos de 15" }, { v: 20, l: "15 a 30" }, { v: 40, l: "30 a 50" }, { v: 60, l: "Más de 50" }]} value={sp.kmWeek as number} onChange={(kmWeek) => upS({ kmWeek })} />
          <Label>Distancia objetivo</Label>
          <Chips label="Distancia" options={[{ v: "5k", l: "5K" }, { v: "10k", l: "10K" }, { v: "21k", l: "21K" }, { v: "42k", l: "42K" }, { v: "trail", l: "Trail" }]} value={sp.target as string} onChange={(target) => upS({ target })} />
        </Q>
      ) });
      s.push({ key: "ritmo", ok: () => true, node: () => (
        <Q title="Tu ritmo y dónde corres" sub="Opcional. Sirve para que tu coach te hable de tu carrera.">
          <Label>Tu mejor tiempo reciente</Label>
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Chips label="Distancia del tiempo" options={[{ v: "5k", l: "5K" }, { v: "10k", l: "10K" }]} value={sp.paceDist as string} onChange={(paceDist) => upS({ paceDist })} />
            <input inputMode="numeric" placeholder="mm:ss" aria-label="Tiempo" value={(sp.paceTime as string) ?? ""} onChange={(e) => upS({ paceTime: e.target.value.replace(/[^\d:]/g, "").slice(0, 8) })} className="input h-12" />
          </div>
          <Label>Superficie</Label>
          <Multi label="Superficie" options={[{ v: "calle", l: "Calle" }, { v: "pista", l: "Pista" }, { v: "montana", l: "Montaña" }]} value={arr(sp.surface)} onChange={(surface) => upS({ surface })} />
          <Label>¿Con qué registras tus carreras hoy?</Label>
          <Chips label="Registro" options={[{ v: "no", l: "Con nada" }, { v: "reloj", l: "Un reloj" }, { v: "strava", l: "Una app" }, { v: "ambos", l: "Las dos" }]} value={(sp.watch as string) ?? "no"} onChange={(watch) => upS({ watch })} />
        </Q>
      ) });
    }
    if (sport === "raquetas") {
      s.push({ key: "juega", ok: () => arr(sp.playDays).length > 0, node: () => (
        <Q title="¿Qué juegas y qué días?" sub="Nunca te ponemos piernas pesadas el día antes de un partido.">
          <Chips label="Deporte" options={[{ v: "tenis", l: "Tenis" }, { v: "padel", l: "Pádel" }, { v: "ambos", l: "Los dos" }]} value={(sp.which as string) ?? "padel"} onChange={(which) => upS({ which })} />
          <Label>Días de partido o clase</Label>
          <Days label="Días de juego" value={arr(sp.playDays)} onChange={(playDays) => upS({ playDays, competitiveDays: arr<number>(sp.competitiveDays).filter((x: number) => playDays.includes(x)) })} />
          {arr(sp.playDays).length > 0 && <><Label>¿Cuáles son partidos de competencia?</Label><Multi label="Partidos competitivos" options={arr<number>(sp.playDays).map((v: number) => ({ v, l: DOW_SHORT[v] }))} value={arr(sp.competitiveDays)} onChange={(competitiveDays) => upS({ competitiveDays })} /></>}
        </Q>
      ) });
      s.push({ key: "juego", ok: () => true, node: () => (
        <Q title="Tu juego">
          <Label>Mano dominante</Label>
          <Chips label="Mano" options={[{ v: "derecha", l: "Derecha" }, { v: "izquierda", l: "Izquierda" }]} value={(sp.hand as string) ?? "derecha"} onChange={(hand) => upS({ hand })} />
          <Label>Duración típica del partido</Label>
          <Chips label="Duración" options={[{ v: 60, l: "1 hora" }, { v: 90, l: "1 h 30 min" }, { v: 120, l: "2 horas o más" }]} value={(sp.matchMin as number) ?? 90} onChange={(matchMin) => upS({ matchMin })} />
          <label className="block"><span className="text-sm font-bold text-ink">Nivel o categoría (opcional)</span><input value={(sp.category as string) ?? ""} onChange={(e) => upS({ category: e.target.value.slice(0, 40) })} placeholder="Por ejemplo: cuarta, intermedio" className="input mt-1.5 h-12" /></label>
          <Label>Molestias típicas al jugar</Label>
          <Multi label="Molestias" options={[{ v: "codo", l: "Codo" }, { v: "hombro", l: "Hombro" }, { v: "muneca", l: "Muñeca" }, { v: "rodilla", l: "Rodilla" }, { v: "tobillo", l: "Tobillo" }]} value={arr(sp.pains)} onChange={(pains) => upS({ pains })} />
        </Q>
      ) });
    }
    if (sport === "cross") {
      s.push({ key: "box", ok: () => true, node: () => (
        <Q title="¿Ya vas a un box o a clases?" sub="Marca los días. Si no vas, déjalo vacío: tu temporada es todo tu entreno.">
          <Days label="Días de box" value={arr(sp.boxDays)} onChange={(boxDays) => upS({ boxDays })} />
          <Label>Experiencia con levantamientos olímpicos</Label>
          <Chips label="Olímpicos" options={[{ v: "nada", l: "Ninguna" }, { v: "basica", l: "Básica" }, { v: "solida", l: "Sólida" }]} value={(sp.oly as string) ?? "nada"} onChange={(oly) => upS({ oly })} />
          <Label>Experiencia con gimnásticos</Label>
          <Chips label="Gimnásticos" options={[{ v: "nada", l: "Ninguna" }, { v: "basica", l: "Básica" }, { v: "solida", l: "Sólida" }]} value={(sp.gymnastics as string) ?? "nada"} onChange={(gymnastics) => upS({ gymnastics })} />
        </Q>
      ) });
      s.push({ key: "evitar", ok: () => true, node: () => (
        <Q title="Movimientos y marcas" sub="Lo que marques aquí no aparece en tu temporada.">
          <Label>Movimientos que no puedes o no quieres hacer</Label>
          <Multi label="Evitar" options={AVOID_OPTIONS.map((v) => ({ v, l: AVOID_LABEL[v] }))} value={arr(sp.avoid)} onChange={(avoid) => upS({ avoid })} />
          <label className="block"><span className="text-sm font-bold text-ink">Tu tiempo en un WOD de referencia (opcional)</span><input value={(sp.benchWod as string) ?? ""} onChange={(e) => upS({ benchWod: e.target.value.slice(0, 60) })} placeholder="Por ejemplo: 12:30 en tu benchmark" className="input mt-1.5 h-12" /></label>
          <label className="block"><span className="text-sm font-bold text-ink">Sentadilla, 1 repetición máxima en kg (opcional)</span><input inputMode="numeric" value={(sp.squat1rm as number | null) ?? ""} onChange={(e) => upS({ squat1rm: Number(e.target.value.replace(/\D/g, "")) || null })} className="input mt-1.5 h-12" /></label>
        </Q>
      ) });
    }
    s.push({ key: "dias", ok: () => arr(d.trainDays).length > 0, node: () => (
      <Q title="¿Qué días puedes entrenar fuerza?" sub="Marca todos los que puedas. Elegimos los mejores alrededor de tu deporte.">
        <Days label="Días disponibles" value={arr(d.trainDays)} onChange={(trainDays) => up({ trainDays })} />
        <Label>¿Cuántas sesiones por semana quieres?</Label>
        <Chips label="Sesiones" options={[{ v: 2, l: "2" }, { v: 3, l: "3" }, { v: 4, l: "4" }]} value={d.sessions as number} onChange={(sessions) => up({ sessions })} />
      </Q>
    ) });
    s.push({ key: "tiempo", ok: () => true, node: () => (
      <Q title="¿Cuánto tiempo y a qué hora?">
        <Label>Minutos por sesión</Label>
        <Chips label="Minutos" options={[{ v: 30, l: "30 min" }, { v: 45, l: "45 min" }, { v: 60, l: "60 min" }]} value={d.minutes as number} onChange={(minutes) => up({ minutes })} />
        <Label>Horario</Label>
        <Chips label="Horario" options={(["manana", "mediodia", "tarde", "noche"] as const).map((v) => ({ v, l: TIME_LABEL[v] }))} value={d.time as string} onChange={(time) => up({ time })} />
      </Q>
    ) });
    s.push({ key: "lugar", ok: () => true, node: () => (
      <Q title="¿Dónde entrenas?">
        <Chips label="Lugar" options={(["gym", "gym_basico", "casa"] as const).map((v) => ({ v, l: PLACE_LABEL[v] }))} value={d.place as string} onChange={(place) => up({ place })} />
        {d.place !== "gym" && <><Label>¿Qué equipo tienes?</Label><Multi label="Equipo" options={EQUIPMENT.map((v) => ({ v, l: EQUIPMENT_LABEL[v] }))} value={arr(d.equipment)} onChange={(equipment) => up({ equipment })} /></>}
      </Q>
    ) });
    s.push({ key: "molestias", ok: () => true, node: () => (
      <Q title="¿Tienes alguna molestia ahora o hace poco?" sub="Solo la usamos para cambiar o evitar ejercicios. No es un diagnóstico.">
        <Multi label="Zonas" options={AREAS.map((v) => ({ v, l: AREA_LABEL[v] }))} value={arr(d.injuries)} onChange={(injuries) => up({ injuries })} />
        <p className="rounded-2xl bg-banana-soft p-3 text-sm font-semibold text-banana-ink">Si tienes dolor, consulta a un profesional de la salud antes de entrenar.</p>
      </Q>
    ) });
    s.push({ key: "objetivo", ok: () => true, node: () => (
      <Q title="¿Cuál es tu objetivo principal esta temporada?">
        <div className="grid gap-2">{GOALS[sport].map((g) => <button key={g.id} type="button" aria-pressed={d.goal === g.id} onClick={() => up({ goal: g.id })} className={`${chip(d.goal === g.id)} text-left text-base`}>{g.label}</button>)}</div>
      </Q>
    ) });
    s.push({ key: "evento", ok: () => true, node: () => (
      <Q title="¿Tienes una competencia o un evento importante?" sub="Opcional. Si cae dentro de la temporada, bajamos el volumen los días antes para que llegues fresco.">
        <label className="block"><span className="text-sm font-bold text-ink">Fecha</span><input type="date" value={(d.eventDate as string) ?? ""} onChange={(e) => up({ eventDate: e.target.value || null })} className="input mt-1.5 h-12" /></label>
        {d.eventDate ? <label className="block"><span className="text-sm font-bold text-ink">¿Qué es?</span><input value={(d.eventType as string) ?? ""} onChange={(e) => up({ eventType: e.target.value.slice(0, 60) })} placeholder={sport === "running" ? "Por ejemplo: 21K de mi ciudad" : sport === "raquetas" ? "Por ejemplo: torneo del club" : "Por ejemplo: competencia del box"} className="input mt-1.5 h-12" /></label> : null}
        {d.eventDate ? <button type="button" onClick={() => up({ eventDate: null, eventType: null })} className="tap text-sm font-semibold text-muted underline underline-offset-4">No tengo un evento</button> : null}
      </Q>
    ) });
    return s;
  }, [d, sp, sport, info.name]);

  const intake = parseIntake(d, sport);
  const plan = intake ? planWeek(sport, intake) : null;
  const TOTAL = steps.length + 1;
  const onSummary = step === steps.length;
  const cur = steps[step];
  const go = (n: number) => { setStep(n); setError(null); window.scrollTo({ top: 0 }); };

  function confirm(pause = false) {
    setError(null);
    start(async () => {
      const r = await saveSeasonIntake(slug, d);
      if (!r.ok) { setError(r.error ?? "No pudimos guardar."); return; }
      if (started) {
        const a = await activateSeason(slug, pause);
        if (a.conflict) { setConflict(a.conflict.title); return; }
        if (!a.ok && !a.demo) { setError(a.error ?? "No pudimos activar tu temporada."); return; }
        router.replace("/app");
      } else router.replace(`/app/temporadas/${slug}?listo=1`);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-md" style={{ ["--sport" as string]: info.accent, ["--sport-soft" as string]: info.accentSoft }}>
      <div className="flex items-center justify-between h-12">
        {step > 0 ? <button type="button" onClick={() => go(step - 1)} className="pressable grid place-items-center size-11 rounded-full bg-white border border-line" aria-label="Atrás"><ArrowLeft weight="bold" className="size-5" /></button> : <span className="chip h-8 bg-[var(--sport)] text-white">{info.name}</span>}
        <span className="text-sm font-bold text-muted tabular-nums">{step + 1} de {TOTAL}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-line overflow-hidden" role="progressbar" aria-label="Progreso" aria-valuemin={1} aria-valuemax={TOTAL} aria-valuenow={step + 1}><div className="h-full w-full bg-[var(--sport)] rounded-full origin-left transition-transform duration-300 ease-[cubic-bezier(.23,1,.32,1)]" style={{ transform: `scaleX(${(step + 1) / TOTAL})` }} /></div>
      <section key={step} className="py-7 space-y-5 transition-[opacity,translate] duration-200 ease-[cubic-bezier(.23,1,.32,1)] starting:opacity-0 starting:translate-x-4 motion-reduce:starting:translate-x-0">
        {!onSummary ? cur.node() : (
          <>
            <Q title="Así queda tu semana" sub={started ? "Confírmala o ajusta tus días. Puedes cambiarla cuando quieras desde la página de tu temporada." : `Tu temporada empieza el ${startsLabel}. Puedes cambiar tus respuestas antes y durante la temporada.`}>
              {plan && <WeekSummary sport={sport} plan={plan} />}
              {plan?.warnings.map((w) => <p key={w} role="alert" className="flex gap-2 rounded-2xl bg-ember/10 p-3 text-sm font-semibold text-ember-ink"><Warning weight="duotone" className="mt-0.5 size-5 shrink-0" />{w}</p>)}
              {plan && !plan.warnings.length && <p className="flex gap-2 rounded-2xl bg-peel/10 p-3 text-sm font-semibold text-peel"><CheckCircle weight="duotone" className="mt-0.5 size-5 shrink-0" />Nada de piernas pesadas el día antes de tu {sport === "running" ? "carrera larga" : sport === "raquetas" ? "partido" : "box"}.</p>}
            </Q>
          </>
        )}
        {error && <p role="alert" className="rounded-2xl bg-bad/10 p-3 text-sm font-semibold text-bad">{error}</p>}
        {conflict && (
          <div className="card p-4 space-y-3">
            <p className="text-sm text-body">Tienes activo <b>{conflict}</b>. Lo pausamos con su avance y activamos tu temporada.</p>
            <button type="button" disabled={pending} onClick={() => confirm(true)} className="btn-primary w-full h-12">Pausar y activar mi temporada</button>
          </div>
        )}
      </section>
      <div className="sticky bottom-0 -mx-5 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-paper via-paper to-transparent space-y-2">
        {!onSummary ? (
          <button type="button" disabled={!cur.ok()} onClick={() => go(step + 1)} className="btn-primary w-full h-14 text-base">Continuar <ArrowRight className="size-5" /></button>
        ) : (
          <>
            <button type="button" disabled={pending || !plan?.slots.length} onClick={() => confirm(false)} className="btn-banana w-full h-14 text-base">{pending ? <><CircleNotch weight="bold" className="size-5 animate-spin" />Guardando…</> : <>Confirmar mi semana <ArrowRight className="size-5" /></>}</button>
            <button type="button" onClick={() => go(steps.findIndex((s) => s.key === "dias"))} className="tap w-full h-11 text-sm font-semibold text-muted underline underline-offset-4">Ajustar mis días</button>
          </>
        )}
      </div>
    </div>
  );
}
