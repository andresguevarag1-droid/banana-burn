"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Minus, Plus, Trophy, X } from "lucide-react";
import type { Prescription, SlotCfg } from "@/lib/engine";
import { saveWorkout } from "./actions";

export type PlayerExercise = { bw: boolean; id: string; name: string; muscle: string; cfg: SlotCfg; rx: Prescription; best: number; last: string | null };
type Row = { kg: string; reps: string; done: boolean; easy: boolean };
type Rest = { end: number; total: number } | null;

const RX_BADGE: Record<Prescription["type"], [string, string]> = {
  cal: ["🎯 Calibración", "bg-sky/10 text-sky"],
  up: ["⬆️ Sube", "bg-peel/10 text-peel"],
  reps: ["➕ Más reps", "bg-banana-soft text-banana-ink"],
  reset: ["🔄 Reinicio", "bg-ember/10 text-ember-ink"],
  deload: ["🌴 Descarga", "bg-sky/10 text-sky"],
};

const unitLbl = (u?: string) => (u === "s" ? "seg" : u === "m" ? "metros" : "reps");
const e1 = (kg: number, r: number) => kg * (1 + r / 30);
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const store = {
  get<T>(k: string): T | null { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* */ } },
};

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 880; g.gain.setValueAtTime(0.25, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.5);
  } catch { /* */ }
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* */ }
}

export function Player({ template, title, cardio, exercises, dateKey }: { template: string; title: string; cardio?: string; exercises: PlayerExercise[]; dateKey: string }) {
  const key = `bb.session.${dateKey}.${template}`;
  const initial = useMemo(() => exercises.map((e) => Array.from({ length: e.rx.sets }, (_, i) => ({ kg: e.rx.kg != null ? String(e.rx.kg) : "", reps: String(e.rx.reps[i] ?? e.cfg.lo), done: false, easy: false }))), [exercises]);
  const [rows, setRows] = useState<Row[][]>(initial);
  const [idx, setIdx] = useState(0);
  const [startedAt, setStartedAt] = useState<string>(() => new Date().toISOString());
  const [rest, setRest] = useState<Rest>(null);
  const [now, setNow] = useState(() => Date.now());
  const [prs, setPrs] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [phase, setPhase] = useState<"play" | "summary" | "saved">("play");
  const [fun, setFun] = useState(4);
  const [pending, start] = useTransition();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const loaded = useRef(false);

  // Restaurar sesión en curso (si sales de la app en el gym no pierdes nada)
  useEffect(() => {
    const s = store.get<{ rows: Row[][]; idx: number; startedAt: string; prs: string[] }>(key);
    if (s && s.rows?.length === initial.length) { setRows(s.rows); setIdx(s.idx); setStartedAt(s.startedAt); setPrs(s.prs ?? []); }
    loaded.current = true;
  }, [key, initial.length]);
  useEffect(() => { if (loaded.current && phase === "play") store.set(key, { rows, idx, startedAt, prs }); }, [key, rows, idx, startedAt, prs, phase]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  const restLeft = rest ? Math.max(0, (rest.end - now) / 1000) : 0;
  const fired = useRef(false);
  useEffect(() => {
    if (!rest) { fired.current = false; return; }
    if (restLeft <= 0 && !fired.current) { fired.current = true; beep(); setRest(null); }
  }, [rest, restLeft]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);

  const ex = exercises[idx];
  const totalSets = rows.flat().length;
  const doneSets = rows.flat().filter((r) => r.done).length;
  const elapsed = (now - new Date(startedAt).getTime()) / 1000;

  const update = (si: number, patch: Partial<Row>) => setRows((all) => all.map((r, i) => (i !== idx ? r : r.map((s, j) => (j === si ? { ...s, ...patch } : s)))));

  const toggleDone = useCallback((si: number) => {
    const row = rows[idx][si];
    const willDone = !row.done;
    update(si, { done: willDone });
    if (!willDone) return;
    const kg = Number(row.kg.replace(",", ".")), reps = Number(row.reps);
    if (kg > 0 && reps > 0 && ex.best > 0 && e1(kg, reps) > ex.best + 0.01 && !prs.includes(ex.id)) {
      setPrs((p) => [...p, ex.id]);
      setToast(`🏆 ¡Nuevo récord en ${ex.name}!`);
    }
    const isLastSetOfEx = rows[idx].filter((s, j) => j !== si && !s.done).length === 0;
    if (!(isLastSetOfEx && idx === exercises.length - 1)) setRest({ end: Date.now() + ex.cfg.rest * 1000, total: ex.cfg.rest });
    if (isLastSetOfEx && idx < exercises.length - 1) setTimeout(() => setIdx((i) => Math.min(i + 1, exercises.length - 1)), 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, idx, ex, prs, exercises.length]);

  const stepKg = (si: number, d: number) => {
    const inc = ex.rx.kg != null && ex.rx.kg >= 20 ? 2.5 : 1;
    const cur = Number(rows[idx][si].kg.replace(",", ".")) || 0;
    update(si, { kg: String(Math.max(0, Math.round((cur + d * inc) * 100) / 100)) });
  };

  const summary = useMemo(() => {
    let vol = 0;
    rows.forEach((r) => r.forEach((s) => { if (s.done) vol += (Number(s.kg.replace(",", ".")) || 0) * (Number(s.reps) || 0); }));
    const xp = doneSets * 10 + prs.length * 50 + (doneSets === totalSets ? 30 : 0);
    return { vol: Math.round(vol), xp };
  }, [rows, doneSets, totalSets, prs.length]);

  function save() {
    start(async () => {
      const res = await saveWorkout({
        template, startedAt, fun, xp: summary.xp,
        exercises: exercises.map((e, i) => ({ id: e.id, sets: rows[i].filter((s) => s.done).map((s) => ({ kg: s.kg ? Number(s.kg.replace(",", ".")) : null, reps: Number(s.reps) || 0, rir: s.easy ? 4 : 2 })) })).filter((e) => e.sets.length),
      });
      if (!res.ok) return setSaveMsg(res.error ?? "Error al guardar.");
      store.del(key);
      setSaveMsg(res.demo ? "Modo demo: el entreno no se guardó en la nube." : null);
      setPhase("saved");
    });
  }

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
    return (
      <Shell>
        <div className="flex-1 grid place-items-center text-center px-6 animate-rise">
          <div className="max-w-sm">
            <p className="text-7xl">🍌🔥</p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-ink">¡Entreno completado!</h1>
            <p className="mt-2 text-lg text-muted">+{summary.xp} XP · {summary.vol.toLocaleString("es-CR")} kg movidos</p>
            {saveMsg && <p className="mt-3 text-sm text-banana-ink">{saveMsg}</p>}
            <p className="mt-6 text-muted">Ahora: proteína en la próxima hora 🥩 y a dormir 7–9 h. Mañana el motor ajusta tus cargas.</p>
            <Link href="/app" className="btn-primary w-full mt-8">Volver a Hoy</Link>
          </div>
        </div>
      </Shell>
    );
  }

  if (phase === "summary") {
    return (
      <Shell>
        <div className="flex-1 overflow-y-auto px-5 py-8 animate-rise">
          <div className="mx-auto max-w-md">
            <button onClick={() => setPhase("play")} className="inline-flex items-center gap-1 text-sm font-semibold text-muted"><ChevronLeft className="size-4" />Volver al entreno</button>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink">Resumen 💪</h1>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[["⏱️", fmt(elapsed), "duración"], ["✅", `${doneSets}/${totalSets}`, "series"], ["🏋️", `${summary.vol.toLocaleString("es-CR")} kg`, "volumen"], ["⭐", `+${summary.xp}`, "XP"]].map(([i, v, l]) => (
                <div key={l} className="card p-4"><p>{i}</p><p className="mt-1 text-2xl font-extrabold text-ink tabular-nums">{v}</p><p className="text-xs font-semibold text-muted">{l}</p></div>
              ))}
            </div>
            {prs.length > 0 && (
              <div className="mt-3 rounded-[1.5rem] bg-banana p-4 flex gap-3 items-center"><Trophy className="size-6 text-ink" /><p className="font-bold text-ink">{prs.length} récord{prs.length > 1 ? "s" : ""} personal{prs.length > 1 ? "es" : ""}: {prs.map((p) => exercises.find((e) => e.id === p)?.name).join(", ")}</p></div>
            )}
            <div className="mt-6 card p-5">
              <p className="font-bold text-ink">¿Qué tan divertido estuvo?</p>
              <p className="text-sm text-muted">Si se pone aburrido, el motor mete más variedad y retos.</p>
              <div className="mt-4 grid grid-cols-5 gap-2">
                {["😴", "😐", "🙂", "😄", "🤩"].map((f, i) => (
                  <button key={f} onClick={() => setFun(i + 1)} className={`h-14 rounded-2xl text-2xl transition ${fun === i + 1 ? "bg-banana scale-105" : "bg-cream"}`} aria-label={`Diversión ${i + 1}`}>{f}</button>
                ))}
              </div>
            </div>
            {saveMsg && <p role="alert" className="mt-4 text-sm font-semibold text-bad">{saveMsg}</p>}
            <button onClick={save} disabled={pending || doneSets === 0} className="btn-primary w-full h-14 mt-6 text-base">{pending ? "Guardando…" : "Guardar entreno"}</button>
          </div>
        </div>
      </Shell>
    );
  }

  const rowsHere = rows[idx];
  const [badge, badgeCls] = RX_BADGE[ex.rx.type];
  const unit = unitLbl(ex.cfg.unit);
  const bodyweight = ex.bw;
  const allDoneHere = rowsHere.every((r) => r.done);

  return (
    <Shell>
      {/* Barra superior */}
      <header className="px-4 pt-3 pb-2 bg-paper/90 backdrop-blur border-b border-line/60">
        <div className="flex items-center justify-between gap-3">
          <Link href="/app" className="grid place-items-center size-10 rounded-full bg-white border border-line" aria-label="Salir (tu progreso se guarda)"><X className="size-5" /></Link>
          <div className="text-center min-w-0">
            <p className="font-extrabold text-ink truncate">{title}</p>
            <p className="text-xs font-semibold text-muted tabular-nums">{fmt(elapsed)} · {doneSets}/{totalSets} series</p>
          </div>
          <button onClick={() => setPhase("summary")} className="h-10 px-4 rounded-full bg-ink text-white text-sm font-bold">Terminar</button>
        </div>
        <div className="mt-3 flex gap-1">
          {exercises.map((e, i) => {
            const d = rows[i].filter((s) => s.done).length / rows[i].length;
            return (
              <button key={e.id} onClick={() => setIdx(i)} className={`h-1.5 flex-1 rounded-full overflow-hidden ${i === idx ? "bg-ink/20" : "bg-line"}`} aria-label={e.name}>
                <span className="block h-full bg-ink transition-all" style={{ width: `${d * 100}%` }} />
              </button>
            );
          })}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className={`mx-auto max-w-xl px-4 py-5 space-y-4 ${rest ? "pb-44" : ""}`}>
          <div className="flex items-center justify-between">
            <button disabled={idx === 0} onClick={() => setIdx(idx - 1)} className="grid place-items-center size-9 rounded-full disabled:opacity-30" aria-label="Anterior"><ChevronLeft className="size-5" /></button>
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Ejercicio {idx + 1} de {exercises.length}</p>
            <button disabled={idx === exercises.length - 1} onClick={() => setIdx(idx + 1)} className="grid place-items-center size-9 rounded-full disabled:opacity-30" aria-label="Siguiente"><ChevronRight className="size-5" /></button>
          </div>

          <section key={ex.id} className="rounded-[1.75rem] bg-banana p-5 animate-rise">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="chip bg-ink/10 text-ink">{ex.muscle}</span>
              <span className={`chip ${badgeCls} bg-white`}>{badge}</span>
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink leading-tight">{ex.name}</h1>
            <p className="mt-1 text-lg font-bold text-ink tabular-nums">
              {ex.rx.sets} × {ex.rx.reps[0]}{ex.rx.reps.some((r) => r !== ex.rx.reps[0]) ? "+" : ""} {unit}{ex.rx.kg != null ? ` · ${ex.rx.kg.toLocaleString("es-CR")} kg` : ""}
            </p>
            <p className="mt-2 text-sm text-ink/80">{ex.rx.note}</p>
            {ex.last && <p className="mt-2 text-xs font-semibold text-ink/60">Última vez: {ex.last}</p>}
          </section>

          <section className="card divide-y divide-line">
            <div className="grid grid-cols-[2rem_minmax(0,1.2fr)_minmax(0,1fr)_3rem] gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted">
              <span>Serie</span><span className="text-center">{bodyweight ? "Lastre kg" : "Kg"}</span><span className="text-center">{unit}</span><span />
            </div>
            {rowsHere.map((r, si) => {
              const active = !r.done && rowsHere.findIndex((x) => !x.done) === si;
              return (
                <div key={si} className={`px-4 py-3 transition-colors ${r.done ? "bg-banana-soft/40" : active ? "bg-cream" : ""}`}>
                  <div className="grid grid-cols-[2rem_minmax(0,1.2fr)_minmax(0,1fr)_3rem] gap-2 items-center">
                    <span className={`grid place-items-center size-8 rounded-full text-sm font-bold ${r.done ? "bg-ink text-white" : "bg-line text-ink"}`}>{si + 1}</span>
                    <div className="flex items-center rounded-xl bg-white border border-line h-12">
                      <button onClick={() => stepKg(si, -1)} className="grid place-items-center w-8 h-full text-muted" aria-label="Menos peso"><Minus className="size-4" /></button>
                      <input value={r.kg} onChange={(e) => update(si, { kg: e.target.value })} inputMode="decimal" placeholder={bodyweight ? "PC" : "—"} className="w-full min-w-0 text-center text-lg font-extrabold text-ink bg-transparent outline-none" aria-label={`Kg serie ${si + 1}`} />
                      <button onClick={() => stepKg(si, 1)} className="grid place-items-center w-8 h-full text-muted" aria-label="Más peso"><Plus className="size-4" /></button>
                    </div>
                    <input value={r.reps} onChange={(e) => update(si, { reps: e.target.value.replace(/\D/g, "") })} inputMode="numeric" className="w-full min-w-0 h-12 rounded-xl bg-white border border-line text-center text-lg font-extrabold text-ink outline-none focus:border-ink" aria-label={`${unit} serie ${si + 1}`} />
                    <button onClick={() => toggleDone(si)} className={`grid place-items-center size-12 rounded-2xl transition active:scale-90 ${r.done ? "bg-peel text-white" : "bg-ink text-white"}`} aria-label={r.done ? "Desmarcar serie" : "Completar serie"}><Check className="size-6" /></button>
                  </div>
                  {r.done && (
                    <label className="mt-2 ml-12 inline-flex items-center gap-2 text-xs font-semibold text-muted">
                      <input type="checkbox" checked={r.easy} onChange={(e) => update(si, { easy: e.target.checked })} className="accent-ink" />Me sobraron 4+ reps (muy fácil)
                    </label>
                  )}
                </div>
              );
            })}
          </section>

          <p className="text-center text-xs text-faint">Tempo 3-1-1 · deja 1–2 reps en reserva · descanso {ex.cfg.rest >= 120 ? `${ex.cfg.rest / 60} min` : `${ex.cfg.rest} s`}</p>
          {idx === exercises.length - 1 && cardio && <p className="card p-4 text-sm font-semibold text-ink">🚶 Al final: {cardio}</p>}
        </div>
      </main>

      <footer className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-line bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-xl">
          {idx < exercises.length - 1 ? (
            <button onClick={() => setIdx(idx + 1)} className={`w-full h-14 text-base ${allDoneHere ? "btn-primary" : "btn-ghost"}`}>Siguiente: {exercises[idx + 1].name} <ChevronRight className="size-5" /></button>
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
                <p className="text-sm font-semibold text-white/60">Descansa</p>
                <p className="font-bold truncate">Siguiente: {rowsHere.some((r) => !r.done) ? `serie ${rowsHere.findIndex((r) => !r.done) + 1} de ${ex.name}` : exercises[Math.min(idx + 1, exercises.length - 1)].name}</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setRest((r) => r && { ...r, end: r.end - 15000 })} className="h-9 px-3 rounded-full bg-white/10 text-sm font-bold">−15 s</button>
                  <button onClick={() => setRest((r) => r && { end: r.end + 15000, total: r.total + 15 })} className="h-9 px-3 rounded-full bg-white/10 text-sm font-bold">+15 s</button>
                  <button onClick={() => setRest(null)} className="h-9 px-4 rounded-full bg-banana text-ink text-sm font-bold ml-auto">Saltar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div role="status" className="fixed top-24 inset-x-0 z-[70] flex justify-center px-4 animate-rise"><p className="rounded-full bg-banana text-ink font-bold px-5 py-3 shadow-lift">{toast}</p></div>}
    </Shell>
  );
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
