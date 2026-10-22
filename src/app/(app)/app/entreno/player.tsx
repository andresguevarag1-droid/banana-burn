"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeftRight, Check, ChevronRight, GraduationCap, Minus, Plus, Trophy, X } from "lucide-react";
import { platesPerSide, type Prescription, type SetLog, type SlotCfg } from "@/lib/engine";
import type { Technique } from "@/lib/engine/technique";
import { levelOf } from "@/lib/gamify";
import { ExerciseMotion } from "@/components/exercise-motion";
import { RichTip } from "@/components/rich-tip";
import { Confetti } from "@/components/confetti";
import { saveWorkout } from "./actions";

export type PlayerExercise = { id: string; name: string; muscle: string; cfg: SlotCfg; tech: Technique | null; bw: boolean; barbell: boolean; rx: Prescription; best: number; lastSets: SetLog[] | null };
export type Gam = { xp: number; streak: number; todayDone: boolean };
type Row = { kg: string; reps: string; done: boolean; easy: boolean };
type Rest = { end: number; total: number } | null;
type Sheet = null | "tech" | "swap" | "exit";

const RX_BADGE: Record<Prescription["type"], [string, string]> = {
  cal: ["🎯 Calibración", "text-sky"],
  up: ["⬆️ Sube carga", "text-peel"],
  reps: ["➕ +1 rep", "text-banana-ink"],
  reset: ["🔄 Reinicio −10 %", "text-ember-ink"],
  deload: ["🌴 Descarga", "text-sky"],
};

const unitLbl = (u?: string) => (u === "s" ? "seg" : u === "m" ? "m" : "reps");
const num = (s: string) => Number(String(s).replace(",", ".")) || 0;
const kgFmt = (n: number) => n.toLocaleString("es-CR", { maximumFractionDigits: 2 });
const e1 = (kg: number, r: number) => kg * (1 + r / 30);
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const store = {
  get<T>(k: string): T | null { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* */ } },
};
const buzz = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* */ } };

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.18].forEach((t) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = t ? 1175 : 880; g.gain.setValueAtTime(0.22, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.35);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.35);
    });
  } catch { /* */ }
  buzz([200, 100, 200]);
}

const rowsFor = (e: PlayerExercise): Row[] => Array.from({ length: e.rx.sets }, (_, i) => ({ kg: e.rx.kg != null ? String(e.rx.kg) : "", reps: String(e.rx.reps[i] ?? e.cfg.lo), done: false, easy: false }));

export function Player({ template, title, emoji, cardio, options, dateKey, gam }: { template: string; title: string; emoji: string; cardio?: string; options: PlayerExercise[][]; dateKey: string; gam: Gam }) {
  const key = `bb.session.v2.${dateKey}.${template}`;
  const [choice, setChoice] = useState<number[]>(() => options.map(() => 0));
  const exercises = useMemo(() => options.map((o, i) => o[choice[i]] ?? o[0]), [options, choice]);
  const [rows, setRows] = useState<Row[][]>(() => options.map((o) => rowsFor(o[0])));
  const [idx, setIdx] = useState(0);
  const [startedAt, setStartedAt] = useState<string>(() => new Date().toISOString());
  const [rest, setRest] = useState<Rest>(null);
  const [work, setWork] = useState<{ end: number; total: number; si: number; ex: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [prs, setPrs] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [phase, setPhase] = useState<"play" | "summary" | "saved">("play");
  const [fun, setFun] = useState(4);
  const [pending, start] = useTransition();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const loaded = useRef(false);

  // Restaurar sesión en curso
  useEffect(() => {
    const s = store.get<{ rows: Row[][]; idx: number; startedAt: string; prs: string[]; choice: number[] }>(key);
    if (s && s.rows?.length === options.length && s.choice?.length === options.length) { setRows(s.rows); setIdx(s.idx); setStartedAt(s.startedAt); setPrs(s.prs ?? []); setChoice(s.choice); }
    loaded.current = true;
  }, [key, options.length]);
  useEffect(() => { if (loaded.current && phase === "play") store.set(key, { rows, idx, startedAt, prs, choice }); }, [key, rows, idx, startedAt, prs, choice, phase]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  const restLeft = rest ? Math.max(0, (rest.end - now) / 1000) : 0;
  useEffect(() => { if (rest && restLeft <= 0) { beep(); setRest(null); } }, [rest, restLeft]);
  const workLeft = work ? Math.max(0, (work.end - now) / 1000) : 0;
  useEffect(() => {
    if (work && workLeft <= 0) { const w = work; setWork(null); beep(); if (w.ex === idx && !rows[idx][w.si].done) toggleDone(w.si); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [work, workLeft]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);

  const ex = exercises[idx];
  const totalSets = rows.flat().length;
  const doneSets = rows.flat().filter((r) => r.done).length;
  const elapsed = (now - new Date(startedAt).getTime()) / 1000;
  const here = rows[idx] ?? [];
  const activeSet = here.findIndex((r) => !r.done);

  const update = (si: number, patch: Partial<Row>) => setRows((all) => all.map((r, i) => (i !== idx ? r : r.map((s, j) => (j === si ? { ...s, ...patch } : s)))));
  const step = (si: number, field: "kg" | "reps", d: number) => {
    const cur = num(here[si][field]);
    const inc = field === "reps" ? (ex.cfg.unit === "s" ? 5 : ex.cfg.unit === "m" ? 5 : 1) : ex.barbell ? 2.5 : cur >= 20 ? 2 : 1;
    const next = Math.max(0, Math.round((cur + d * inc) * 100) / 100);
    // al cambiar kg de una serie pendiente, propaga a las siguientes pendientes
    setRows((all) => all.map((r, i) => (i !== idx ? r : r.map((s, j) => (j === si || (field === "kg" && j > si && !s.done) ? { ...s, [field]: String(next) } : s)))));
  };

  function toggleDone(si: number) {
    const row = here[si];
    if (row.done) { update(si, { done: false }); return; }
    update(si, { done: true });
    buzz(30);
    setJustDone(`${idx}-${si}`);
    setTimeout(() => setJustDone(null), 500);
    const kg = num(row.kg), reps = num(row.reps);
    if (kg > 0 && reps > 0 && ex.best > 0 && e1(kg, reps) > ex.best + 0.01 && !prs.includes(ex.id)) {
      setPrs((p) => [...p, ex.id]);
      setToast(`🏆 ¡Récord en ${ex.name}!`);
      buzz([40, 60, 40, 60, 120]);
    }
    const lastOfEx = here.filter((s, j) => j !== si && !s.done).length === 0;
    const lastOfAll = lastOfEx && idx === exercises.length - 1;
    if (!lastOfAll) setRest({ end: Date.now() + ex.cfg.rest * 1000, total: ex.cfg.rest });
    if (lastOfEx && !lastOfAll) setTimeout(() => setIdx((i) => Math.min(i + 1, exercises.length - 1)), 650);
  }

  function swap(to: number) {
    setChoice((c) => c.map((v, i) => (i === idx ? to : v)));
    setRows((all) => all.map((r, i) => (i === idx ? rowsFor(options[idx][to]) : r)));
    setSheet(null);
    setToast(`⇄ Cambiado a ${options[idx][to].name}`);
  }

  const summary = useMemo(() => {
    let vol = 0;
    rows.forEach((r) => r.forEach((s) => { if (s.done) vol += num(s.kg) * num(s.reps); }));
    const xp = doneSets * 10 + prs.length * 50 + (doneSets === totalSets && totalSets > 0 ? 30 : 0);
    return { vol: Math.round(vol), xp };
  }, [rows, doneSets, totalSets, prs.length]);

  function save() {
    start(async () => {
      const res = await saveWorkout({
        template, startedAt, fun, xp: summary.xp, prs: prs.length, title, emoji, prNames: prs.map((p) => exercises.find((e) => e.id === p)?.name ?? p),
        exercises: exercises.map((e, i) => ({ id: e.id, sets: rows[i].filter((s) => s.done).map((s) => ({ kg: s.kg ? num(s.kg) : null, reps: num(s.reps), rir: s.easy ? 4 : 2 })) })).filter((e) => e.sets.length),
      });
      if (!res.ok) return setSaveMsg(res.error ?? "Error al guardar.");
      store.del(key);
      setSaveMsg(res.demo ? "Modo demo: este entreno no se guardó en la nube." : null);
      setPhase("saved");
      buzz([60, 40, 60, 40, 200]);
      fetch("/api/coach/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        title, done: doneSets, total: totalSets, prs: prs.map((p) => exercises.find((e) => e.id === p)?.name ?? p), volume: summary.vol,
        mins: Math.round(elapsed / 60), fun, easy: rows.flat().filter((r) => r.easy).length, streak: gam.todayDone ? gam.streak : gam.streak + 1,
      }) }).then((r) => r.json()).then((j) => setFeedback(j.text || null)).catch(() => {});
    });
  }

  /* ---------- Pantallas especiales ---------- */
  if (!exercises.length) {
    return (
      <Shell>
        <div className="flex-1 grid place-items-center text-center px-6">
          <div><p className="text-6xl">🌴</p><h1 className="mt-4 text-3xl font-extrabold text-ink">Hoy toca descanso activo</h1><p className="mt-2 text-muted">{cardio}</p><Link href="/app" className="btn-primary mt-6">Volver a Hoy</Link></div>
        </div>
      </Shell>
    );
  }

  if (phase === "saved") {
    const before = levelOf(gam.xp), after = levelOf(gam.xp + summary.xp);
    const leveled = after.idx > before.idx;
    const streak = gam.todayDone ? gam.streak : gam.streak + 1;
    return (
      <Shell>
        <Confetti />
        <div className="flex-1 overflow-y-auto px-6 py-10 grid place-items-center text-center">
          <div className="w-full max-w-sm animate-rise">
            <p className="text-7xl animate-[pop_.6s_cubic-bezier(.2,1.6,.4,1)_both]">{leveled ? after.e : "🔥"}</p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-ink">{leveled ? `¡Subiste a ${after.n}!` : "¡Entreno completado!"}</h1>
            <p className="mt-2 text-lg font-semibold text-muted">{emoji} {title} · {fmt(elapsed)}</p>
            <div className="mt-8 grid grid-cols-3 gap-2">
              <Stat big={`+${summary.xp}`} small="XP" />
              <Stat big={`${streak} 🔥`} small={streak === 1 ? "día de racha" : "días de racha"} />
              <Stat big={summary.vol >= 1000 ? `${kgFmt(Math.round(summary.vol / 100) / 10)} t` : `${summary.vol} kg`} small="movidos" />
            </div>
            <div className="mt-4 card p-4 text-left">
              <p className="text-sm font-extrabold text-ink">{after.e} Nivel {after.idx} · {after.n}</p>
              <p className="text-xs font-semibold text-muted">{after.next ? `${after.toNext} XP para ${after.next.n}` : "Nivel máximo"}</p>
              <div className="mt-2 h-3 rounded-full bg-line overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-banana to-ember transition-all duration-1000" style={{ width: `${Math.max(4, after.progress * 100)}%` }} /></div>
            </div>
            {prs.length > 0 && (
              <div className="mt-3 rounded-[1.5rem] bg-banana p-4 text-left">
                <p className="font-extrabold text-ink flex items-center gap-2"><Trophy className="size-5" /> {prs.length === 1 ? "Récord personal" : `${prs.length} récords personales`}</p>
                <p className="text-sm text-ink/80">{prs.map((p) => exercises.find((e) => e.id === p)?.name).join(" · ")}</p>
              </div>
            )}
            {saveMsg && <p className="mt-3 text-sm text-banana-ink">{saveMsg}</p>}
            <div className="mt-4 card p-4 text-left" aria-live="polite">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">✨ Coach Banana</p>
              {feedback ? <p className="mt-1 text-[15px] text-ink leading-relaxed animate-rise">{feedback}</p> : <p className="mt-2 flex gap-1" aria-label="Analizando tu entreno">{[0, 1, 2].map((d) => <span key={d} className="size-2 rounded-full bg-faint animate-bounce" style={{ animationDelay: `${d * 120}ms` }} />)}</p>}
            </div>
            <Link href="/app" className="btn-primary w-full h-14 mt-6 text-base">Listo</Link>
          </div>
        </div>
      </Shell>
    );
  }

  if (phase === "summary") {
    return (
      <Shell>
        <div className="flex-1 overflow-y-auto px-5 py-6 animate-rise">
          <div className="mx-auto max-w-md">
            <button onClick={() => setPhase("play")} className="text-sm font-semibold text-muted">← Volver al entreno</button>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink">¿Terminamos? 💪</h1>
            <p className="text-muted">{doneSets} de {totalSets} series · {fmt(elapsed)}</p>
            {doneSets < totalSets && <p className="mt-3 rounded-2xl bg-banana-soft/60 p-3 text-sm font-semibold text-banana-ink">Te faltan {totalSets - doneSets} series. Puedes terminar igual; el motor lo toma en cuenta.</p>}
            <div className="mt-6 card p-5">
              <p className="font-bold text-ink">¿Qué tan divertido estuvo?</p>
              <p className="text-sm text-muted">Si se pone aburrido, metemos más variedad y retos.</p>
              <div className="mt-4 grid grid-cols-5 gap-2">
                {["😴", "😐", "🙂", "😄", "🤩"].map((f, i) => (
                  <button key={f} onClick={() => { setFun(i + 1); buzz(15); }} className={`h-14 rounded-2xl text-2xl transition ${fun === i + 1 ? "bg-banana scale-110 shadow-soft" : "bg-cream"}`} aria-label={`Diversión ${i + 1} de 5`}>{f}</button>
                ))}
              </div>
            </div>
            {saveMsg && <p role="alert" className="mt-4 text-sm font-semibold text-bad">{saveMsg}</p>}
            <button onClick={save} disabled={pending || doneSets === 0} className="btn-primary w-full h-14 mt-6 text-base">{pending ? "Guardando…" : "Guardar y celebrar 🎉"}</button>
          </div>
        </div>
      </Shell>
    );
  }

  /* ---------- Reproductor ---------- */
  const [badge, badgeCls] = RX_BADGE[ex.rx.type];
  const unit = unitLbl(ex.cfg.unit);
  const allDoneHere = here.every((r) => r.done);
  const plates = ex.barbell && activeSet >= 0 ? platesPerSide(num(here[activeSet].kg)) : null;
  const alts = options[idx].length - 1;

  return (
    <Shell>
      <header className="px-4 pt-[max(.75rem,env(safe-area-inset-top))] pb-2.5 bg-paper/95 backdrop-blur border-b border-line/60">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => setSheet("exit")} className="grid place-items-center size-10 rounded-full bg-white border border-line" aria-label="Salir del entreno"><X className="size-5" /></button>
          <div className="text-center min-w-0">
            <p className="font-extrabold text-ink truncate">{emoji} {title}</p>
            <p className="text-xs font-semibold text-muted tabular-nums">{fmt(elapsed)} · {doneSets}/{totalSets} series</p>
          </div>
          <span className="grid place-items-center h-10 min-w-10 px-2 rounded-full bg-banana text-sm font-extrabold text-ink tabular-nums" aria-label="Ejercicio actual">{idx + 1}/{exercises.length}</span>
        </div>
        <div className="mt-2.5 flex gap-1">
          {exercises.map((e, i) => {
            const d = rows[i].filter((s) => s.done).length / rows[i].length;
            return (
              <button key={i} onClick={() => setIdx(i)} className={`h-2 flex-1 rounded-full overflow-hidden ${i === idx ? "ring-2 ring-ink/20 ring-offset-1 ring-offset-paper bg-line" : "bg-line"}`} aria-label={`Ir a ${e.name}`}>
                <span className="block h-full bg-ink transition-all duration-300" style={{ width: `${d * 100}%` }} />
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overflow-x-hidden" role="region" aria-label="Series del ejercicio">
        <div className={`mx-auto max-w-xl px-4 pt-4 ${rest ? "pb-44" : "pb-6"}`}>
          {/* Encabezado del ejercicio: compacto para que las series quepan sin scroll */}
          <section key={ex.id} className="flex gap-3 items-stretch animate-rise">
            <button onClick={() => setSheet("tech")} className="relative shrink-0 w-[96px] rounded-3xl bg-banana overflow-hidden" aria-label="Ver técnica">
              {ex.tech?.anim ? <ExerciseMotion anim={ex.tech.anim} label={false} className="absolute inset-x-1 top-1 bottom-5" /> : <span className="text-4xl">🏋️</span>}
              <span className="absolute bottom-1.5 inset-x-0 text-[10px] font-bold text-ink/70">Técnica</span>
            </button>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{ex.muscle} · <span className={badgeCls}>{badge}</span></p>
              <h1 className="mt-0.5 text-[22px] leading-tight font-extrabold tracking-tight text-ink line-clamp-2">{ex.name}</h1>
              <p className="mt-0.5 text-sm font-bold text-ink tabular-nums">{ex.rx.sets} × {ex.rx.reps[0]}{ex.rx.reps.some((r) => r !== ex.rx.reps[0]) ? "+" : ""} {unit}{ex.rx.kg != null ? ` · ${kgFmt(ex.rx.kg)} kg` : ""}</p>
              <div className="mt-1.5 flex gap-1.5">
                <button onClick={() => setSheet("tech")} className="chip h-7 bg-white border border-line text-ink"><GraduationCap className="size-3.5" />Técnica</button>
                {alts > 0 && <button onClick={() => setSheet("swap")} className="chip h-7 bg-white border border-line text-ink"><ArrowLeftRight className="size-3.5" />Cambiar</button>}
              </div>
            </div>
          </section>
          <p className="mt-3 text-[13px] leading-snug text-muted">{ex.rx.note}</p>

          {/* Series */}
          <section className="mt-3 space-y-2">
            {here.map((r, si) => {
              const active = si === activeSet;
              const prev = ex.lastSets?.[si];
              const pop = justDone === `${idx}-${si}`;
              return (
                <div key={si} className={`rounded-3xl border transition-all duration-300 ${r.done ? "bg-peel/10 border-peel/30" : active ? "bg-white border-ink shadow-lift" : "bg-white/70 border-line"} ${pop ? "scale-[1.02]" : ""}`}>
                  <div className="flex items-center gap-2 p-2 pl-3">
                    <div className="w-9 shrink-0 text-center">
                      <p className={`text-lg font-extrabold leading-none ${r.done ? "text-peel" : "text-ink"}`}>{si + 1}</p>
                      {prev && <p className="mt-1 text-[10px] font-semibold text-faint leading-none tabular-nums" title="Última vez">{prev.kg ?? "PC"}×{prev.reps}</p>}
                    </div>
                    {!(ex.bw && ex.cfg.unit === "s") && <Stepper label={ex.bw ? "lastre kg" : "kg"} value={r.kg} placeholder={ex.bw ? "PC" : "—"} inputMode="decimal" disabled={r.done}
                      onMinus={() => step(si, "kg", -1)} onPlus={() => step(si, "kg", 1)} onChange={(v) => update(si, { kg: v })} />}
                    <Stepper label={unit} value={r.reps} inputMode="numeric" disabled={r.done}
                      onMinus={() => step(si, "reps", -1)} onPlus={() => step(si, "reps", 1)} onChange={(v) => update(si, { reps: v.replace(/\D/g, "") })} />
                    <button onClick={() => toggleDone(si)} className={`grid place-items-center size-14 shrink-0 rounded-2xl transition active:scale-90 ${r.done ? "bg-peel text-white" : active ? "bg-ink text-white" : "bg-line text-muted"}`} aria-label={r.done ? `Desmarcar serie ${si + 1}` : `Completar serie ${si + 1}`}>
                      <Check className="size-7" strokeWidth={3} />
                    </button>
                  </div>
                  {active && ex.cfg.unit === "s" && !rest && (
                    <div className="px-3 pb-3">
                      {work && work.si === si && work.ex === idx ? (
                        <div className="flex items-center gap-3 rounded-2xl bg-peel text-white p-3" aria-live="polite">
                          <span className="text-3xl font-extrabold tabular-nums w-20 text-center">{Math.ceil(workLeft)}</span>
                          <div className="flex-1 h-2 rounded-full bg-white/30 overflow-hidden"><div className="h-full bg-white" style={{ width: `${(1 - workLeft / work.total) * 100}%`, transition: "width .25s linear" }} /></div>
                          <button onClick={() => setWork(null)} className="h-9 px-3 rounded-full bg-white/20 text-sm font-bold">Parar</button>
                        </div>
                      ) : (
                        <button onClick={() => { const n = num(r.reps) || ex.cfg.hi; setWork({ end: Date.now() + n * 1000 + 3000, total: n + 3, si, ex: idx }); buzz(20); }} className="w-full h-12 rounded-2xl bg-peel text-white font-extrabold">▶ Iniciar {num(r.reps) || ex.cfg.hi} s <span className="font-semibold opacity-80">(3 s para prepararte)</span></button>
                      )}
                    </div>
                  )}
                  {active && plates && plates.length > 0 && <p className="px-4 pb-2.5 -mt-0.5 text-[12px] font-semibold text-muted">🏋️ Por lado: {plates.map(kgFmt).join(" + ")} kg <span className="text-faint">(barra 20)</span></p>}
                  {r.done && (
                    <label className="flex items-center gap-2 px-4 pb-2.5 -mt-0.5 text-xs font-semibold text-muted">
                      <input type="checkbox" checked={r.easy} onChange={(e) => update(si, { easy: e.target.checked })} className="size-4 accent-ink" />Muy fácil (me sobraron 4+)
                    </label>
                  )}
                </div>
              );
            })}
          </section>

          <p className="mt-3 text-center text-xs text-faint">Tempo 3-1-1 · 1–2 reps en reserva · descanso {ex.cfg.rest >= 120 ? `${ex.cfg.rest / 60} min` : `${ex.cfg.rest} s`}</p>
          {idx === exercises.length - 1 && cardio && <p className="mt-3 card p-4 text-sm font-semibold text-ink">🚶 Al final: {cardio}</p>}
        </div>
      </div>

      <footer className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-xl">
          {idx < exercises.length - 1 ? (
            <button onClick={() => setIdx(idx + 1)} className={`w-full h-14 text-base ${allDoneHere ? "btn-primary" : "btn-ghost"}`}>Siguiente: <span className="truncate">{exercises[idx + 1].name}</span> <ChevronRight className="size-5 shrink-0" /></button>
          ) : (
            <button onClick={() => setPhase("summary")} className="btn-banana w-full h-14 text-base">Terminar entreno 🏁</button>
          )}
        </div>
      </footer>

      {/* Descanso */}
      {rest && (
        <div className="fixed inset-x-0 bottom-0 z-[60] p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] animate-rise">
          <div className="mx-auto max-w-xl rounded-[1.75rem] bg-ink text-white p-5 shadow-lift">
            <div className="flex items-center gap-5">
              <RestRing left={restLeft} total={rest.total} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white/60">Descansa · respira hondo</p>
                <p className="font-bold truncate">Sigue: {activeSet >= 0 ? `serie ${activeSet + 1} · ${here[activeSet].kg || "PC"} kg × ${here[activeSet].reps}` : exercises[Math.min(idx + 1, exercises.length - 1)].name}</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setRest((r) => r && { ...r, end: r.end - 15000 })} className="h-10 px-3 rounded-full bg-white/10 text-sm font-bold">−15</button>
                  <button onClick={() => setRest((r) => r && { end: r.end + 15000, total: r.total + 15 })} className="h-10 px-3 rounded-full bg-white/10 text-sm font-bold">+15</button>
                  <button onClick={() => setRest(null)} className="h-10 px-5 rounded-full bg-banana text-ink text-sm font-bold ml-auto">Saltar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hojas */}
      {sheet && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm animate-[fade_.2s_both]" onClick={() => setSheet(null)}>
          <div className="w-full sm:max-w-lg max-h-[88dvh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] bg-paper p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-[sheet_.3s_cubic-bezier(.2,.9,.3,1)_both]" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" />
            {sheet === "tech" && ex.tech && (
              <div className="space-y-4">
                <div className="rounded-[1.5rem] bg-banana/90 px-4 pt-6 pb-2"><ExerciseMotion anim={ex.tech.anim} className="mx-auto h-56 max-w-[300px]" /></div>
                <h2 className="text-2xl font-extrabold text-ink">{ex.name}</h2>
                <p className="text-sm text-muted">{ex.tech.mus}</p>
                <ol className="space-y-2">{ex.tech.how.map((h, i) => <li key={i} className="flex gap-2.5"><span className="grid place-items-center size-6 shrink-0 rounded-full bg-banana text-xs font-bold text-ink">{i + 1}</span><span>{h}</span></li>)}</ol>
                {ex.tech.cues.length > 0 && <div className="flex flex-wrap gap-2">{ex.tech.cues.map((c) => <span key={c} className="chip bg-peel/10 text-peel">✓ {c}</span>)}</div>}
                {ex.tech.err.length > 0 && <div className="space-y-1">{ex.tech.err.map((c) => <p key={c} className="text-sm text-ember-ink">✗ {c}</p>)}</div>}
                {ex.tech.mono && <p className="rounded-2xl bg-white p-3 text-sm">🐒 <RichTip text={ex.tech.mono} /></p>}
                <button onClick={() => setSheet(null)} className="btn-primary w-full">Entendido</button>
              </div>
            )}
            {sheet === "swap" && (
              <div>
                <h2 className="text-2xl font-extrabold text-ink">Cambiar ejercicio</h2>
                <p className="text-sm text-muted">¿Máquina ocupada o sin equipo? Mismo patrón, mismas series.</p>
                <div className="mt-4 space-y-2">
                  {options[idx].map((o, i) => (
                    <button key={o.id} onClick={() => swap(i)} className={`w-full flex items-center gap-3 rounded-2xl border p-3 text-left transition ${choice[idx] === i ? "bg-banana border-banana" : "bg-white border-line hover:border-ink"}`}>
                      <span className="grid place-items-center size-12 shrink-0 rounded-xl bg-cream text-xl">{o.barbell ? "🏋️" : o.bw ? "🤸" : "💪"}</span>
                      <span className="flex-1 min-w-0"><span className="block font-bold text-ink">{o.name}</span><span className="block text-xs text-muted">{o.muscle}{i === 0 ? " · plan original" : ""}{o.rx.kg != null ? ` · sugerido ${kgFmt(o.rx.kg)} kg` : ""}</span></span>
                      {choice[idx] === i && <Check className="size-5 text-ink" />}
                    </button>
                  ))}
                </div>
                {here.some((r) => r.done) && <p className="mt-3 text-xs text-ember-ink">Al cambiar se reinician las series de este ejercicio.</p>}
              </div>
            )}
            {sheet === "exit" && (
              <div className="space-y-3">
                <h2 className="text-2xl font-extrabold text-ink">¿Salir del entreno?</h2>
                <p className="text-muted">Llevas {doneSets} de {totalSets} series. Tu progreso queda guardado en este teléfono.</p>
                <button onClick={() => setSheet(null)} className="btn-primary w-full h-13">Seguir entrenando 💪</button>
                {doneSets > 0 && <button onClick={() => { setSheet(null); setPhase("summary"); }} className="btn-ghost w-full h-13">Terminar y guardar</button>}
                <Link href="/app" className="btn w-full h-13 text-muted">Salir por ahora</Link>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && <div role="status" className="fixed top-24 inset-x-0 z-[90] flex justify-center px-4 animate-rise"><p className="rounded-full bg-ink text-white font-bold px-5 py-3 shadow-lift">{toast}</p></div>}
    </Shell>
  );
}

function Stepper({ label, value, placeholder, inputMode, disabled, onMinus, onPlus, onChange }: { label: string; value: string; placeholder?: string; inputMode: "decimal" | "numeric"; disabled?: boolean; onMinus: () => void; onPlus: () => void; onChange: (v: string) => void }) {
  return (
    <div className={`flex-1 min-w-0 rounded-2xl bg-cream ${disabled ? "opacity-70" : ""}`}>
      <div className="flex items-center h-12">
        <button type="button" disabled={disabled} onClick={onMinus} className="grid place-items-center w-9 h-full text-muted active:text-ink disabled:opacity-0" aria-label={`Menos ${label}`}><Minus className="size-4" strokeWidth={3} /></button>
        <input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} inputMode={inputMode} placeholder={placeholder} onFocus={(e) => e.target.select()}
          className="w-full min-w-0 bg-transparent text-center text-xl font-extrabold text-ink outline-none tabular-nums placeholder:text-faint" aria-label={label} />
        <button type="button" disabled={disabled} onClick={onPlus} className="grid place-items-center w-9 h-full text-muted active:text-ink disabled:opacity-0" aria-label={`Más ${label}`}><Plus className="size-4" strokeWidth={3} /></button>
      </div>
      <p className="-mt-1.5 pb-1 text-center text-[9px] font-bold uppercase tracking-wider text-faint">{label}</p>
    </div>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return <div className="card p-3"><p className="text-xl font-extrabold text-ink tabular-nums">{big}</p><p className="text-[11px] font-semibold text-muted">{small}</p></div>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex flex-col bg-paper">{children}</div>;
}

function RestRing({ left, total }: { left: number; total: number }) {
  const size = 84, sw = 8, r = (size - sw) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / .12)" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#FFD60A" strokeWidth={sw} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - left / Math.max(1, total))} style={{ transition: "stroke-dashoffset .25s linear" }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xl font-extrabold tabular-nums" aria-live="polite">{fmt(left)}</span>
    </div>
  );
}
