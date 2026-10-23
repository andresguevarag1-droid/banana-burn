"use client";
// Editor de programas (0024): datos para la tienda, fases, sesiones por fase y día con ejercicios de la biblioteca,
// nutrición opcional y ejercicios clave. Manda todo en dos campos ocultos (program y sessions) al guardar el reto.
import { useMemo, useState, useTransition } from "react";
import { CaretDown, Copy, MagnifyingGlass, Plus, Trash, WarningCircle } from "@/components/icons";
import { Field, btnGhost, inputSm, panel, textareaSm } from "@/components/admin/ui";
import { HABIT_KINDS, HABIT_KIND_LABEL, MAX_HABITS, MAX_TIPS, type HabitKind, type ProgramExperience, type ProgramHabit, LEVEL_LABEL, MAX_DAYS_PER_WEEK, MAX_EXERCISES, MAX_PHASES, MODE_LABEL, TEMPO_RE, programErrors, weeksOf, type ProgramExercise, type ProgramLevel, type ProgramMeta, type ProgramMode, type ProgramSession } from "@/lib/programs";
import { searchExercises, type ExerciseHit } from "./actions";

export const EMPTY_META: ProgramMeta = {
  phases: [{ name: "Base", weeks: 2 }, { name: "Progresión", weeks: 2 }], daysPerWeek: 3, sessionMinutes: 45, level: "principiante",
  equipment: "Gimnasio", adapt: true, who: "", result: "", outcomes: [], keyLifts: [], nutrition: null,
};
const sel = `${inputSm} pr-8`;
const small = `${inputSm} px-2! text-center tabular-nums`;

export function ProgramEditor({ init, sessions: init2, names: names0 }: { init: ProgramMeta; sessions: ProgramSession[]; names: Record<string, string> }) {
  const [meta, setMeta] = useState<ProgramMeta>(init);
  const [sessions, setSessions] = useState<ProgramSession[]>(init2);
  const [names, setNames] = useState<Record<string, string>>(names0);
  const [phase, setPhase] = useState(1);
  const [day, setDay] = useState(1);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ExerciseHit[]>([]);
  const [searching, startSearch] = useTransition();
  const set = (patch: Partial<ProgramMeta>) => setMeta((m) => ({ ...m, ...patch }));

  const cur = sessions.find((s) => s.phase === phase && s.day === day) ?? { phase, day, title: `Día ${day}`, focus: "", exercises: [] as ProgramExercise[] };
  const putSession = (patch: Partial<ProgramSession>) => setSessions((list) => {
    const rest = list.filter((s) => !(s.phase === phase && s.day === day));
    return [...rest, { ...cur, ...patch }].sort((a, b) => a.phase - b.phase || a.day - b.day);
  });
  const putEx = (i: number, patch: Partial<ProgramExercise>) => putSession({ exercises: cur.exercises.map((e, k) => (k === i ? { ...e, ...patch } : e)) });
  const moveEx = (i: number, d: -1 | 1) => { const ex = [...cur.exercises]; const j = i + d; if (j < 0 || j >= ex.length) return; [ex[i], ex[j]] = [ex[j], ex[i]]; putSession({ exercises: ex }); };
  const add = (h: ExerciseHit) => {
    if (cur.exercises.length >= MAX_EXERCISES) return;
    setNames((n) => ({ ...n, [h.id]: h.name }));
    putSession({ exercises: [...cur.exercises, { id: h.id, sets: 3, lo: 8, hi: 12, rest: 90, tempo: "3-1-1" }] });
    setQ(""); setHits([]);
  };
  const search = (t: string) => { setQ(t); if (t.trim().length < 2) { setHits([]); return; } startSearch(async () => setHits(await searchExercises(t))); };
  const copyPrev = () => {
    if (phase < 2) return;
    setSessions((list) => [...list.filter((s) => s.phase !== phase), ...list.filter((s) => s.phase === phase - 1).map((s) => ({ ...s, phase, exercises: s.exercises.map((e) => ({ ...e })) }))].sort((a, b) => a.phase - b.phase || a.day - b.day));
  };
  const setPhases = (phases: ProgramMeta["phases"]) => { set({ phases }); if (phase > phases.length) setPhase(phases.length); };

  const visible = sessions.filter((s) => s.phase <= meta.phases.length && s.day <= meta.daysPerWeek);
  const errors = useMemo(() => programErrors(meta, visible, () => true), [meta, visible]);
  const used = [...new Set(visible.flatMap((s) => s.exercises.map((e) => e.id)))];
  const nameOf = (id: string) => names[id] ?? id;
  const n = meta.nutrition;
  const x = meta.experience;
  const EMPTY_X: ProgramExperience = { mode: "", welcome: "", habits: [], tips: [], coachFocus: "", restDay: "", food: [] };
  const setX = (patch: Partial<ProgramExperience>) => set({ experience: { ...(x ?? EMPTY_X), ...patch } });
  const putHabit = (i: number, patch: Partial<ProgramHabit>) => setX({ habits: (x?.habits ?? []).map((h, k) => (k === i ? { ...h, ...patch } : h)) });

  return (
    <div className="space-y-5">
      <input type="hidden" name="program" value={JSON.stringify({ ...meta, keyLifts: meta.keyLifts.filter((k) => used.includes(k)) })} />
      <input type="hidden" name="sessions" value={JSON.stringify(visible)} />

      <section className={`${panel} grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4`} aria-label="Datos del programa">
        <h2 className="font-extrabold text-ink sm:col-span-2 lg:col-span-4">Programa: para quién y qué logra</h2>
        <Field label="Para quién es" htmlFor="pg-who" className="sm:col-span-2"><textarea id="pg-who" rows={3} maxLength={400} value={meta.who} onChange={(e) => set({ who: e.target.value })} className={textareaSm} /></Field>
        <Field label="Objetivo (sin promesas de resultados)" htmlFor="pg-res" className="sm:col-span-2"><textarea id="pg-res" rows={3} maxLength={400} value={meta.result} onChange={(e) => set({ result: e.target.value })} className={textareaSm} /></Field>
        <Field label="Qué incluye (una línea cada uno)" htmlFor="pg-out" className="sm:col-span-2 lg:col-span-4"><textarea id="pg-out" rows={3} value={meta.outcomes.join("\n")} onChange={(e) => set({ outcomes: e.target.value.split("\n").slice(0, 8) })} className={textareaSm} /></Field>
        <Field label="Nivel" htmlFor="pg-lv"><select id="pg-lv" value={meta.level} onChange={(e) => set({ level: e.target.value as ProgramLevel })} className={sel}>{Object.entries(LEVEL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Equipo (texto)" htmlFor="pg-eq"><input id="pg-eq" maxLength={80} value={meta.equipment} onChange={(e) => set({ equipment: e.target.value })} className={inputSm} /></Field>
        <Field label="Minutos por sesión" htmlFor="pg-min"><input id="pg-min" type="number" min={5} max={180} value={meta.sessionMinutes} onChange={(e) => set({ sessionMinutes: Number(e.target.value) || 45 })} className={inputSm} /></Field>
        <Field label="Sesiones por semana" htmlFor="pg-dpw" hint="Incluye las opcionales"><input id="pg-dpw" type="number" min={1} max={MAX_DAYS_PER_WEEK} value={meta.daysPerWeek} onChange={(e) => { const d = Math.max(1, Math.min(MAX_DAYS_PER_WEEK, Number(e.target.value) || 1)); set({ daysPerWeek: d }); if (day > d) setDay(d); }} className={inputSm} /></Field>
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink sm:col-span-2"><input type="checkbox" checked={meta.adapt} onChange={(e) => set({ adapt: e.target.checked })} className="size-4 accent-[#1B1505]" />Adaptar a casa o sin equipo (usa la alternativa de cada ejercicio)</label>
      </section>

      <section className={`${panel} p-4 sm:p-5`} aria-labelledby="pg-fases">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="pg-fases" className="font-extrabold text-ink">Fases</h2>
          <p className="text-sm font-semibold text-muted tabular-nums">{weeksOf(meta)} semanas en total</p>
        </div>
        <p className="mt-1 text-sm text-muted">Cada semana de una fase repite sus sesiones; las cargas suben solas. Marca descarga en programas de 8 semanas o más.</p>
        <ol className="mt-3 space-y-2">
          {meta.phases.map((p, i) => (
            <li key={i} className="grid grid-cols-[2rem_1fr_4.5rem] items-center gap-2 rounded-xl border border-line p-2 sm:grid-cols-[2rem_12rem_4.5rem_8rem_1fr_auto]">
              <span className="grid h-10 place-items-center rounded-lg bg-cream text-sm font-extrabold text-ink">{i + 1}</span>
              <input aria-label={`Nombre de la fase ${i + 1}`} value={p.name} maxLength={40} onChange={(e) => setPhases(meta.phases.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} className={inputSm} />
              <input aria-label={`Semanas de la fase ${i + 1}`} type="number" min={1} max={52} value={p.weeks} onChange={(e) => setPhases(meta.phases.map((x, k) => (k === i ? { ...x, weeks: Math.max(1, Number(e.target.value) || 1) } : x)))} className={small} />
              <label className="col-start-2 flex min-h-11 items-center gap-2 text-sm text-ink sm:col-start-auto"><input type="checkbox" checked={!!p.deload} onChange={(e) => setPhases(meta.phases.map((x, k) => (k === i ? { ...x, deload: e.target.checked || undefined } : x)))} className="size-4 accent-[#1B1505]" />Descarga</label>
              <input aria-label={`Enfoque de la fase ${i + 1}`} placeholder="Enfoque (se muestra a la persona)" value={p.focus ?? ""} maxLength={160} onChange={(e) => setPhases(meta.phases.map((x, k) => (k === i ? { ...x, focus: e.target.value } : x)))} className={`${inputSm} col-span-2 col-start-2 sm:col-span-1 sm:col-start-auto`} />
              <button type="button" disabled={meta.phases.length <= 1} onClick={() => setPhases(meta.phases.filter((_, k) => k !== i))} className={`${btnGhost} col-start-3 row-start-1 px-2! sm:col-start-auto sm:row-start-auto`} aria-label={`Quitar la fase ${i + 1}`}><Trash className="size-4" /></button>
            </li>
          ))}
        </ol>
        <button type="button" disabled={meta.phases.length >= MAX_PHASES} onClick={() => setPhases([...meta.phases, { name: `Fase ${meta.phases.length + 1}`, weeks: 2 }])} className={`${btnGhost} mt-3`}><Plus className="size-4" />Agregar fase</button>
      </section>

      <section className={`${panel} p-4 sm:p-5`} aria-labelledby="pg-ses">
        <h2 id="pg-ses" className="font-extrabold text-ink">Sesiones</h2>
        <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Fase">
          {meta.phases.map((p, i) => <button key={i} type="button" role="tab" aria-selected={phase === i + 1} onClick={() => setPhase(i + 1)} className={`h-11 rounded-full px-3.5 text-sm font-bold active:scale-[.97] transition-transform duration-150 ease-out ${phase === i + 1 ? "bg-ink text-white" : "bg-cream text-ink"}`}>Fase {i + 1}: {p.name}</button>)}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Día">
          {Array.from({ length: meta.daysPerWeek }, (_, k) => k + 1).map((d) => {
            const s = visible.find((x) => x.phase === phase && x.day === d);
            return <button key={d} type="button" role="tab" aria-selected={day === d} onClick={() => setDay(d)} className={`h-11 rounded-xl border px-3 text-sm font-bold active:scale-[.97] transition-transform duration-150 ease-out ${day === d ? "border-ink bg-banana text-ink" : "border-line bg-white text-ink"}`}>Día {d}{s?.exercises.length ? ` (${s.exercises.length})` : " vacío"}</button>;
          })}
          {phase > 1 && <button type="button" onClick={copyPrev} className={`${btnGhost} ml-auto`}><Copy className="size-4" />Copiar sesiones de la fase {phase - 1}</button>}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="Título de la sesión" htmlFor="pg-st"><input id="pg-st" maxLength={60} value={cur.title} onChange={(e) => putSession({ title: e.target.value })} className={inputSm} /></Field>
          <Field label="Enfoque" htmlFor="pg-sf"><input id="pg-sf" maxLength={120} value={cur.focus} onChange={(e) => putSession({ focus: e.target.value })} className={inputSm} /></Field>
          <label className="flex min-h-11 items-center gap-2 self-end text-sm text-ink"><input type="checkbox" checked={!!cur.optional} onChange={(e) => putSession({ optional: e.target.checked || undefined })} className="size-4 accent-[#1B1505]" />Opcional</label>
        </div>

        <ol className="mt-3 space-y-2">
          {cur.exercises.map((e, i) => (
            <li key={`${e.id}-${i}`} className="rounded-xl border border-line p-2.5">
              <div className="flex items-center gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink text-xs font-bold text-white">{i + 1}</span>
                <p className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{nameOf(e.id)} <span className="font-normal text-faint">{e.id}</span></p>
                <button type="button" onClick={() => moveEx(i, -1)} disabled={i === 0} className={`${btnGhost} px-2!`} aria-label="Subir"><CaretDown className="size-4 rotate-180" /></button>
                <button type="button" onClick={() => moveEx(i, 1)} disabled={i === cur.exercises.length - 1} className={`${btnGhost} px-2!`} aria-label="Bajar"><CaretDown className="size-4" /></button>
                <button type="button" onClick={() => putSession({ exercises: cur.exercises.filter((_, k) => k !== i) })} className={`${btnGhost} px-2!`} aria-label={`Quitar ${nameOf(e.id)}`}><Trash className="size-4" /></button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-[repeat(5,5.5rem)_1fr]">
                <label className="text-[11px] font-semibold text-muted">Series<input type="number" min={1} max={10} value={e.sets} onChange={(x) => putEx(i, { sets: Number(x.target.value) || 1 })} className={`${small} mt-0.5`} /></label>
                <label className="text-[11px] font-semibold text-muted">Desde<input type="number" min={1} value={e.lo} onChange={(x) => putEx(i, { lo: Number(x.target.value) || 1 })} className={`${small} mt-0.5`} /></label>
                <label className="text-[11px] font-semibold text-muted">Hasta<input type="number" min={1} value={e.hi} onChange={(x) => putEx(i, { hi: Number(x.target.value) || 1 })} className={`${small} mt-0.5`} /></label>
                <label className="text-[11px] font-semibold text-muted">Unidad<select value={e.unit ?? ""} onChange={(x) => putEx(i, { unit: (x.target.value || undefined) as ProgramExercise["unit"] })} className={`${sel} mt-0.5`}><option value="">reps</option><option value="s">seg</option><option value="m">metros</option></select></label>
                <label className="text-[11px] font-semibold text-muted">Descanso (s)<input type="number" min={0} max={600} step={15} value={e.rest} onChange={(x) => putEx(i, { rest: Number(x.target.value) || 0 })} className={`${small} mt-0.5`} /></label>
                <label className="text-[11px] font-semibold text-muted">Tempo<input value={e.tempo ?? ""} maxLength={5} placeholder="3-1-1" onChange={(x) => putEx(i, { tempo: x.target.value || undefined })} className={`${small} mt-0.5 ${e.tempo && !TEMPO_RE.test(e.tempo) ? "border-bad!" : ""}`} /></label>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_12rem]">
                <input aria-label="Nota" placeholder="Nota para la persona (opcional)" maxLength={160} value={e.note ?? ""} onChange={(x) => putEx(i, { note: x.target.value || undefined })} className={inputSm} />
                <input aria-label="Alternativa en casa (id)" placeholder="En casa: id (glutebridge, ds:0710)" maxLength={30} value={e.home ?? ""} onChange={(x) => putEx(i, { home: x.target.value.trim() || undefined })} className={inputSm} />
              </div>
            </li>
          ))}
        </ol>
        {cur.exercises.length === 0 && <p className="mt-3 rounded-xl bg-cream p-3 text-sm text-muted">Sesión vacía. Busca ejercicios abajo para agregarlos.</p>}

        <div className="relative mt-3">
          <label htmlFor="pg-q" className="sr-only">Buscar ejercicio</label>
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input id="pg-q" value={q} onChange={(e) => search(e.target.value)} placeholder="Buscar en la biblioteca: sentadilla, hip, remo..." autoComplete="off" className={`${inputSm} pl-9!`} disabled={cur.exercises.length >= MAX_EXERCISES} />
          {(hits.length > 0 || searching) && (
            <ul className="mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-white shadow-soft">
              {searching && !hits.length && <li className="p-3 text-sm text-muted">Buscando…</li>}
              {hits.map((h) => <li key={h.id}><button type="button" onClick={() => add(h)} className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-paper"><span className="min-w-0"><span className="block truncate font-bold text-ink">{h.name}</span><span className="block text-xs text-muted">{h.muscle}, {h.eq}</span></span><Plus className="size-4 shrink-0" /></button></li>)}
            </ul>
          )}
        </div>
      </section>

      <section className={`${panel} grid gap-3 p-4 sm:grid-cols-3 sm:p-5`} aria-label="Nutrición y ejercicios clave">
        <h2 className="font-extrabold text-ink sm:col-span-3">Nutrición opcional</h2>
        <p className="-mt-2 text-sm text-muted sm:col-span-3">Solo se aplica a quien ya tiene Entreno + Nutrición. El programa nunca da acceso a nutrición.</p>
        <Field label="Calorías" htmlFor="pg-nm"><select id="pg-nm" value={n?.mode ?? ""} onChange={(e) => set({ nutrition: e.target.value || n?.proteinPerKg ? { ...n, mode: (e.target.value || undefined) as ProgramMode | undefined } : null })} className={sel}><option value="">Sin cambio</option>{Object.entries(MODE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Proteína (g por kg)" htmlFor="pg-np" hint="Entre 1,2 y 2,4. Vacío = la del plan"><input id="pg-np" type="number" min={1.2} max={2.4} step={0.1} value={n?.proteinPerKg ?? ""} onChange={(e) => { const v = e.target.value ? Number(e.target.value) : undefined; set({ nutrition: v || n?.mode ? { ...n, proteinPerKg: v } : null }); }} className={inputSm} /></Field>
        <Field label="Nota de nutrición" htmlFor="pg-nn"><input id="pg-nn" maxLength={240} value={n?.note ?? ""} disabled={!n} onChange={(e) => set({ nutrition: n ? { ...n, note: e.target.value || undefined } : null })} className={inputSm} /></Field>
        <fieldset className="sm:col-span-3">
          <legend className="text-sm font-bold text-ink">Ejercicios clave (fuerza al inicio y al final, máx. 4)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {used.length ? used.map((id) => {
              const on = meta.keyLifts.includes(id);
              return <label key={id} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm ${on ? "border-ink bg-banana-soft" : "border-line"}`}><input type="checkbox" checked={on} disabled={!on && meta.keyLifts.length >= 4} onChange={(e) => set({ keyLifts: e.target.checked ? [...meta.keyLifts, id] : meta.keyLifts.filter((k) => k !== id) })} className="size-4 accent-[#1B1505]" />{nameOf(id)}</label>;
            }) : <p className="text-sm text-muted">Agrega ejercicios a las sesiones primero.</p>}
          </div>
          <label className="mt-3 block max-w-sm text-sm font-semibold text-ink" htmlFor="pg-prev">Ejercicio con técnica animada en la tienda
            <select id="pg-prev" value={meta.previewExercise ?? ""} onChange={(e) => set({ previewExercise: e.target.value || undefined })} className={`${sel} mt-1`}><option value="">El primero de la semana 1</option>{used.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}</select>
          </label>
        </fieldset>
      </section>

      <section className={`${panel} grid gap-3 p-4 sm:grid-cols-2 sm:p-5`} aria-label="Experiencia en la app">
        <h2 className="font-extrabold text-ink sm:col-span-2">Experiencia en la app</h2>
        <p className="-mt-2 text-sm text-muted sm:col-span-2">Lo que cambia mientras el programa está activo: el nombre del modo, los hábitos de cada día, el consejo semanal de la coach y cómo comer. Vacío = textos genéricos.</p>
        <Field label="Nombre del modo" htmlFor="px-mode" hint="Ej.: Modo glúteo"><input id="px-mode" maxLength={40} value={x?.mode ?? ""} onChange={(e) => setX({ mode: e.target.value })} className={inputSm} /></Field>
        <Field label="Descanso activo" htmlFor="px-rest" hint="Qué hacer los días sin sesión"><input id="px-rest" maxLength={140} value={x?.restDay ?? ""} disabled={!x} onChange={(e) => setX({ restDay: e.target.value })} className={inputSm} /></Field>
        <Field label="Bienvenida (primer día)" htmlFor="px-wel" className="sm:col-span-2"><textarea id="px-wel" rows={2} maxLength={280} value={x?.welcome ?? ""} disabled={!x} onChange={(e) => setX({ welcome: e.target.value })} className={textareaSm} /></Field>
        <Field label="Coach del programa" htmlFor="px-who" hint="Coach Platanita: programas de chicas"><select id="px-who" value={x?.coach ?? "banana"} disabled={!x} onChange={(e) => setX({ coach: e.target.value === "platanita" ? "platanita" : undefined })} className={sel}><option value="banana">Coach Banana</option><option value="platanita">Coach Platanita</option></select></Field>
        <Field label="Enfoque para la coach" htmlFor="px-coach" className="sm:col-span-2"><textarea id="px-coach" rows={2} maxLength={300} value={x?.coachFocus ?? ""} disabled={!x} onChange={(e) => setX({ coachFocus: e.target.value })} className={textareaSm} /></Field>
        <Field label={`Consejo por semana (una línea por semana, ${weeksOf(meta)} semanas)`} htmlFor="px-tips" className="sm:col-span-2"><textarea id="px-tips" rows={4} value={(x?.tips ?? []).join("\n")} disabled={!x} onChange={(e) => setX({ tips: e.target.value.split("\n").slice(0, MAX_TIPS) })} className={textareaSm} /></Field>
        <Field label="Cómo comer (una línea cada uno, máx. 4)" htmlFor="px-food" className="sm:col-span-2"><textarea id="px-food" rows={3} value={(x?.food ?? []).join("\n")} disabled={!x} onChange={(e) => setX({ food: e.target.value.split("\n").slice(0, 4) })} className={textareaSm} /></Field>
        <fieldset className="sm:col-span-2" disabled={!x}>
          <legend className="text-sm font-bold text-ink">Hábitos de cada día (máx. {MAX_HABITS})</legend>
          <div className="mt-2 space-y-2">
            {(x?.habits ?? []).map((h, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[2fr_1fr_6rem_auto]">
                <input aria-label={`Hábito ${i + 1}`} maxLength={60} value={h.label} onChange={(e) => putHabit(i, { label: e.target.value })} className={`${inputSm} col-span-2 sm:col-span-1`} />
                <select aria-label={`Tipo del hábito ${i + 1}`} value={h.kind} onChange={(e) => putHabit(i, { kind: e.target.value as HabitKind, target: undefined })} className={sel}>{HABIT_KINDS.map((k) => <option key={k} value={k}>{HABIT_KIND_LABEL[k]}</option>)}</select>
                <input aria-label={`Meta del hábito ${i + 1}`} type="number" value={h.target ?? ""} disabled={!["pasos", "agua", "sueno"].includes(h.kind)} onChange={(e) => putHabit(i, { target: e.target.value ? Number(e.target.value) : undefined })} className={small} />
                <button type="button" onClick={() => setX({ habits: (x?.habits ?? []).filter((_, k) => k !== i) })} className={`${btnGhost} px-2!`} aria-label={`Quitar el hábito ${i + 1}`}><Trash className="size-4" /></button>
              </div>
            ))}
            {(x?.habits.length ?? 0) < MAX_HABITS && <button type="button" onClick={() => setX({ habits: [...(x?.habits ?? []), { key: `h${Date.now().toString(36).slice(-6)}`, label: "", kind: "check" }] })} className={btnGhost}><Plus className="size-4" />Agregar hábito</button>}
          </div>
        </fieldset>
      </section>

      {errors.length > 0 && (
        <div className="rounded-2xl border border-[#F2C2C3] bg-[#FDECEC] p-4" role="status">
          <p className="flex items-center gap-2 text-sm font-extrabold text-bad"><WarningCircle weight="duotone" className="size-5" />Falta para publicar ({errors.length})</p>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-body">{errors.slice(0, 8).map((e) => <li key={e}>{e}</li>)}</ul>
          <p className="mt-2 text-xs text-muted">Puedes guardarlo como borrador mientras tanto.</p>
        </div>
      )}
    </div>
  );
}
