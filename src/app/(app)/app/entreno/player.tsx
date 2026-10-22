"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowsLeftRight, ArrowUp, ArrowCounterClockwise, BananaCoin, BananaTrophy, Barbell, Books, BrandIcon, CalendarCheck, CaretRight, Check, FlagCheckered, Monkey, PersonArmsSpread, PersonSimpleWalk, Play, Plus, Repeat, Smiley, SmileyMeh, SmileySad, SpeakerHigh, SpeakerSlash, Target, Timer, TreePalm, X, Banana, MonkeyBanana, Lightning } from "@/components/icons";
import { platesPerSide, type Prescription, type SetLog, type SlotCfg } from "@/lib/engine";
import type { Technique } from "@/lib/engine/technique";
import { ExerciseMotion } from "@/components/exercise-motion";
import { RichTip } from "@/components/rich-tip";
import { Sheet as BottomSheet, SheetTitle } from "@/components/sheet";
import { Toast } from "@/components/toast";
import { usePresence, useSticky } from "@/components/use-presence";
import { buzz, canSpeak, hush, say, sfx, store, unlockAudio, useHiddenAlarm, useNow, usePrefs, useWakeLock } from "@/components/workout/device";
import {
  EFFORTS, FUN_LABELS, PREP_SECONDS, advanceIntervals, beatsBest, bump, cap, clock, comboState, cooldownFor, effortOf, effortPatch, isIntervalPlan, isRushed, kgFmt, liveXp,
  loadsFor, nextCombo, nextPending, num, prsOf, readSaved, restLabel, rirOf, setXpGain, speechFor, stepFor, targetText, timedPhase, unitLbl, volumeOf, warmupFor, warmupText,
  type Effort, type IvClock, type LoadKind, type Row,
} from "@/components/workout/logic";
import { DoneRow, FocusSet } from "@/components/workout/focus-set";
import { ListSets } from "@/components/workout/list-sets";
import { RestPill, RestScreen, type RestInfo } from "@/components/workout/rest-screen";
import { IntervalScreen } from "@/components/workout/interval-screen";
import { Recap } from "@/components/workout/recap";
import { Tour, type TourStep } from "@/components/workout/tour";
import { BananaTrail, SessionRing, XpPop } from "@/components/workout/ui";
import { saveWorkout, type SaveResult } from "./actions";

export type PlayerExercise = { id: string; name: string; muscle: string; cfg: SlotCfg; tech: Technique | null; bw: boolean; barbell: boolean; load: LoadKind | null; rx: Prescription; best: number; lastSets: SetLog[] | null };
export type Gam = { xp: number; streak: number; todayDone: boolean };
type Mode = "normal" | "suave" | "fuerte";
type Rest = { end: number; total: number } | null;
type Sheet = null | "tech" | "swap" | "exit" | "sound";
type Iv = IvClock & { paused: number | null };
type Work = { end: number; secs: number; si: number; ex: number } | null;

const RX_BADGE: Record<Prescription["type"], [string, string, React.ComponentType<{ className?: string; weight?: "bold" }>]> = {
  cal: ["Calibración", "text-sky", Target],
  up: ["Sube carga", "text-peel", ArrowUp],
  reps: ["+1 rep", "text-banana-ink", Plus],
  hold: ["Consolida", "text-banana-ink", Repeat],
  reset: ["Reinicio −10 %", "text-ember-ink", ArrowCounterClockwise],
  deload: ["Descarga", "text-sky", TreePalm],
};
const FUN = [SmileySad, SmileyMeh, Smiley, Banana, MonkeyBanana] as const;
const TOUR_KEY = "bb.tour.player.v1";
const TIP_COMBO = "bb.tip.combo.v1";
const TIP_XP = "bb.tip.xp.v1";

/** ¿Este ejercicio necesita un peso para poder marcar la serie? */
const needsLoad = (e: PlayerExercise) => !e.bw && e.load != null;
/** Series iniciales. En calibración se precarga un peso de partida razonable para el equipo. */
const rowsFor = (e: PlayerExercise): Row[] => {
  const start = e.rx.kg != null ? String(e.rx.kg) : needsLoad(e) ? String(loadsFor(e.load)?.start ?? "") : "";
  return Array.from({ length: e.rx.sets }, (_, i) => ({ kg: start, reps: String(e.rx.reps[i] ?? e.cfg.lo), done: false, easy: false }));
};
const cleared = (s: Row): Row => ({ kg: s.kg, reps: s.reps, done: false, easy: false });

export function Player({ template, title, icon, cardio, options, dateKey, mode = "normal", doneToday = false, repeat = false, gam }: {
  template: string; title: string; icon: string; cardio?: string; options: PlayerExercise[][]; dateKey: string; mode?: Mode; doneToday?: boolean; repeat?: boolean; gam: Gam;
}) {
  // Una sesión por día y plantilla; el modo (suave/fuerte) va dentro, así cambiar de modo no esconde lo que llevas.
  const key = `bb.session.v2.${dateKey}.${template}`;
  const router = useRouter();
  const [choice, setChoice] = useState<number[]>(() => options.map(() => 0));
  const exercises = useMemo(() => options.map((o, i) => o[choice[i]] ?? o[0]), [options, choice]);
  const [rows, setRows] = useState<Row[][]>(() => options.map((o) => rowsFor(o[0])));
  const [idx, setIdx] = useState(0);
  const [startedAt, setStartedAt] = useState<string>(() => new Date().toISOString());
  const [sessMode, setSessMode] = useState<Mode>(mode);
  const [gate, setGate] = useState(doneToday && !repeat);
  const [rest, setRest] = useState<Rest>(null);
  const [restOpen, setRestOpen] = useState(true);
  const [restInfo, setRestInfo] = useState<RestInfo | null>(null);
  const [work, setWork] = useState<Work>(null);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [lastAt, setLastAt] = useState<number | undefined>();
  const [warmDone, setWarmDone] = useState(false);
  const [toast, setToast] = useState<{ t: string; kind: "pr" | "swap" | "done" } | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [swapAsk, setSwapAsk] = useState<number | null>(null);
  const [phase, setPhase] = useState<"play" | "summary" | "saved">("play");
  const [endedAt, setEndedAt] = useState<number | null>(null);
  /** Serie sobre la que se pregunta el esfuerzo en el resumen (la última, que no tuvo descanso). */
  const [askLast, setAskLast] = useState<{ ex: number; si: number } | null>(null);
  const [fun, setFun] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState<SaveResult | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pop, setPop] = useState<{ ex: number; si: number; xp: number; k: number } | null>(null);
  const [fresh, setFresh] = useState<number | null>(null);
  const [live, setLive] = useState("");
  const [tour, setTour] = useState(false);
  const [iv, setIv] = useState<Iv>({ phase: "ready", end: 0, total: 0, paused: null });
  const [prefs, setPrefs] = usePrefs();
  const loaded = useRef(false);
  const tickRef = useRef<number | null>(null);
  const ivFired = useRef(0);
  const restTarget = useRef<{ ex: number; si: number } | null>(null);
  const shownSheet = useSticky(sheet);
  const restP = usePresence(!!rest && restOpen, 200);
  const shownRest = useSticky(rest);
  const shownInfo = useSticky(restInfo);
  const now = useNow(250);
  const interval = isIntervalPlan(exercises);
  // Repetir la misma plantilla el mismo día se guarda, pero no suma XP (el servidor aplica la misma regla).
  const noXp = doneToday;

  useWakeLock(phase === "play" && !gate);

  // Restaurar sesión en curso (acepta el formato anterior)
  useEffect(() => {
    const s = readSaved(store.get(key), options.length);
    const started = !!s?.rows.flat().some((r) => r.done);
    if (s) {
      setRows(s.rows); setIdx(s.idx); setStartedAt(s.startedAt); setChoice(s.choice);
      setCombo(s.combo ?? 0); setBestCombo(s.best ?? 0); setLastAt(s.lastAt); setWarmDone(!!s.warm);
      if (s.mode === "suave" || s.mode === "fuerte" || s.mode === "normal") setSessMode(s.mode);
      if (started || s.repeat) setGate(false);
    }
    loaded.current = true;
    if (!started && !store.get(TOUR_KEY) && !isIntervalPlan(options.map((o) => o[0]))) setTour(true);
  }, [key, options]);
  useEffect(() => {
    if (loaded.current && phase === "play" && !gate) store.set(key, { rows, idx, startedAt, choice, combo, best: bestCombo, lastAt, warm: warmDone, mode: sessMode, ...(doneToday ? { repeat: true } : {}) });
  }, [key, rows, idx, startedAt, choice, combo, bestCombo, lastAt, warmDone, phase, sessMode, gate, doneToday]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);
  useEffect(() => () => hush(), []);

  const ex = exercises[idx];
  const totalSets = rows.flat().length;
  const doneSets = rows.flat().filter((r) => r.done).length;
  const startMs = new Date(startedAt).getTime();
  // Al entrar al resumen el reloj se congela: el tiempo, los XP y la tarjeta usan ese mismo instante.
  const elapsed = ((endedAt ?? now) - startMs) / 1000;
  const here = rows[idx] ?? [];
  const activeSet = here.findIndex((r) => !r.done);
  const prs = useMemo(() => prsOf(rows, exercises), [rows, exercises]);
  const xpNow = noXp ? { xp: 0, prs: 0, rushed: false } : liveXp({ doneSets, totalSets, prs: prs.length, seconds: elapsed });
  const bananas = { got: rows.filter((r) => r.length && r.every((s) => s.done)).length, total: rows.length };
  const setWord = interval ? "intervalos" : "series";

  /* ---------- Voz y sonido ---------- */
  const speak = useCallback((t: string, interrupt = false) => { if (prefs.voice) say(t, { interrupt }); }, [prefs.voice]);
  const ping = useCallback((k: keyof typeof sfx) => { if (prefs.sound) sfx[k](); }, [prefs.sound]);
  const announce = (t: string) => setLive(t);

  // Presenta cada ejercicio al llegar a él (solo con la voz encendida)
  const introFor = useCallback((e: PlayerExercise, r: Row | undefined) => speechFor("exercise", { name: e.name, sets: e.rx.sets, target: r ? targetText(r, { unit: e.cfg.unit, bw: e.bw }) : undefined, cue: e.tech?.cues[0] }), []);
  const spokeFor = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== "play" || gate || interval || !prefs.voice || !ex) return;
    const id = `${idx}:${ex.id}`;
    if (spokeFor.current === id) return;
    spokeFor.current = id;
    if (!rest) speak(introFor(ex, here[Math.max(0, activeSet)]), true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, ex?.id, phase, prefs.voice, interval, gate]);

  const toSummary = useCallback((ask: { ex: number; si: number } | null = null) => {
    setEndedAt(Date.now()); setAskLast(ask); setRest(null); setRestInfo(null); setWork(null); setSheet(null); setPhase("summary");
  }, []);
  /** Al terminar a mano: se pregunta por la última serie con reps solo si quedó sin responder. */
  const finishNow = () => {
    let last: { ex: number; si: number; at: number } | null = null;
    rows.forEach((r, i) => r.forEach((s, j) => { if (s.done && s.at && (!last || s.at > last.at)) last = { ex: i, si: j, at: s.at }; }));
    const l = last as { ex: number; si: number; at: number } | null;
    toSummary(l && !exercises[l.ex].cfg.unit && !effortOf(rows[l.ex][l.si]) ? { ex: l.ex, si: l.si } : null);
  };
  const backToPlay = () => { setEndedAt(null); setSaveMsg(null); setPhase("play"); };
  const leave = () => { store.del(key); hush(); router.push("/app"); };

  /* ---------- Descanso: marcas de tiempo, 3-2-1 y fin ---------- */
  const restLeft = rest ? Math.max(0, (rest.end - now) / 1000) : 0;
  useEffect(() => {
    if (!rest) { tickRef.current = null; return; }
    const whole = Math.ceil(restLeft);
    if (restLeft <= 0) {
      setRest(null); setRestInfo(null); tickRef.current = null; restTarget.current = null;
      ping("go"); buzz([200, 100, 200]);
      const t = nextPending(rows, idx);
      if (t) {
        const e = exercises[t.ex];
        const lastOne = rows.flat().filter((r) => !r.done).length === 1;
        const msg = lastOne ? speechFor("last") : t.ex !== idx || t.si === 0 ? introFor(e, rows[t.ex][t.si]) : speechFor("go", { set: t.si + 1, sets: rows[t.ex].length });
        speak(msg, true);
        announce(`Descanso terminado. ${lastOne ? "Última serie" : `Serie ${t.si + 1} de ${rows[t.ex].length}`}`);
      }
      return;
    }
    if (whole !== tickRef.current) {
      const prev = tickRef.current;
      tickRef.current = whole;
      if (prev == null || prev - whole > 1) return; // al volver de otra app no recita la cuenta atrasada
      if (whole <= 3 && whole >= 1) { if (prefs.voice) say(String(whole), { interrupt: true, rate: 1.15 }); else ping("tick"); buzz(40); }
      if (whole === 10) announce("Quedan 10 segundos de descanso");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rest, restLeft]);

  /* ---------- Serie por tiempo (plancha, etc.) fuera del modo exprés ---------- */
  const tp = work ? timedPhase(work, now) : null;
  useEffect(() => {
    if (work && now >= work.end) { const w = work; setWork(null); ping("go"); buzz([200, 100, 200]); if (w.ex === idx && !rows[idx][w.si].done) complete(w.si); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [work, now]);

  /* ---------- Editar series ---------- */
  const setRowsAt = (ei: number, si: number, patch: Partial<Row>) => setRows((all) => all.map((r, i) => (i !== ei ? r : r.map((s, j) => (j === si ? { ...s, ...patch } : s)))));
  const step = (si: number, field: "kg" | "reps", d: number) => {
    const cur = num(here[si][field]);
    const next = bump(cur, d * stepFor(field, { unit: ex.cfg.unit, barbell: ex.barbell, cur }));
    // al cambiar kg de una serie pendiente, propaga a las siguientes pendientes
    setRows((all) => all.map((r, i) => (i !== idx ? r : r.map((s, j) => (j === si || (field === "kg" && j > si && !s.done) ? { ...s, [field]: String(next) } : s)))));
  };
  const change = (si: number, field: "kg" | "reps", v: string) => setRows((all) => all.map((r, i) => (i !== idx ? r : r.map((s, j) => (j === si || (field === "kg" && j > si && !s.done && s.kg === here[si].kg) ? { ...s, [field]: v } : s)))));
  const pickKg = (si: number, kg: number) => { setRows((all) => all.map((r, i) => (i !== idx ? r : r.map((s, j) => (j >= si && !s.done ? { ...s, kg: String(kg) } : s))))); buzz(10); };
  const copy = (si: number, kg: string, reps: string) => { setRows((all) => all.map((r, i) => (i !== idx ? r : r.map((s, j) => (j === si ? { ...s, kg, reps } : j > si && !s.done ? { ...s, kg } : s))))); buzz(10); };
  const setEffort = (ei: number, si: number, e: Effort) => { setRowsAt(ei, si, effortPatch(e)); setRestInfo((r) => (r && restTarget.current?.ex === ei && restTarget.current.si === si ? { ...r, effort: e } : r)); buzz(12); };
  const cancelRest = () => { setRest(null); setRestInfo(null); restTarget.current = null; hush(); };

  /** Deshace una serie: el récord, el combo y el descanso que venían de ella se van con ella. */
  function undo(si: number) {
    const nextRows = rows.map((r, i) => (i !== idx ? r : r.map((s, j) => (j === si ? cleared(s) : s))));
    setRows(nextRows);
    const cs = comboState(nextRows);
    setCombo(cs.combo); setLastAt(cs.lastAt); setBestCombo(cs.best);
    if (rest && restTarget.current?.ex === idx && restTarget.current.si === si) cancelRest();
    buzz(10);
    announce(`Serie ${si + 1} desmarcada`);
  }

  /** Marca una serie como hecha: XP (si el ritmo es real), combo, récord, banana y descanso. */
  function complete(si: number, opts: { silentRest?: boolean } = {}) {
    const row = here[si];
    if (!row || row.done) return;
    if (needsLoad(ex) && num(row.kg) <= 0) return;
    unlockAudio();
    const t = Date.now();
    const seconds = (t - startMs) / 1000;
    const kg = num(row.kg), reps = num(row.reps);
    const isPr = beatsBest(kg, reps, ex.best) && !prs.some((p) => p.id === ex.id);
    const xp = noXp ? 0 : setXpGain({ doneBefore: doneSets, totalSets, prsBefore: prs.length, prsAfter: prs.length + (isPr ? 1 : 0), seconds });
    const rushed = isRushed(doneSets + 1, seconds);
    const gap = lastAt ? (t - lastAt) / 1000 : null;
    const c = rushed ? combo : nextCombo(combo, gap, ex.cfg.rest);
    const nextRows = rows.map((r, i) => (i !== idx ? r : r.map((s, j) => (j === si ? { ...s, done: true, at: t, c } : s))));
    setRows(nextRows); setLastAt(t); setCombo(c); setBestCombo((b) => Math.max(b, c));
    buzz(30); ping("done");
    if (xp) { setPop({ ex: idx, si, xp, k: t }); setTimeout(() => setPop((p) => (p?.k === t ? null : p)), 1100); }
    if (isPr && !rushed) { setTimeout(() => ping("pr"), 180); buzz([40, 60, 40, 60, 120]); }
    const finishedEx = nextRows[idx].every((s) => s.done);
    if (finishedEx) { setFresh(idx); setTimeout(() => setFresh(null), 900); }
    const target = nextPending(nextRows, idx);
    if (!target) {
      // Última serie del día: directo al cierre (ahí se pregunta cómo se sintió)
      if (isPr && !rushed) setToast({ t: `Récord en ${ex.name}`, kind: "pr" });
      speak(speechFor("done"), true);
      announce("Entreno completado");
      setTimeout(() => toSummary(ex.cfg.unit ? null : { ex: idx, si }), 900);
      return;
    }
    const tex = exercises[target.ex];
    const pendingLeft = nextRows.flat().filter((r) => !r.done).length;
    const isNew = target.ex !== idx;
    if (finishedEx && isNew) setIdx(target.ex);
    if (opts.silentRest) return;
    // Pistas de una línea la primera vez que aparecen el XP y el combo
    const tipXp = !noXp && xp > 0 && !store.get(TIP_XP);
    const tipCombo = c >= 2 && !store.get(TIP_COMBO);
    if (tipXp) store.set(TIP_XP, 1);
    if (tipCombo) store.set(TIP_COMBO, 1);
    setToast(null);
    setRestInfo({
      setNo: ex.cfg.unit === "s" ? null : si + 1, effort: null, xp, xpKey: t, combo: c, pr: isPr && !rushed ? ex.name : null,
      rushed: rushed && !noXp, tip: tipCombo ? "combo" : tipXp ? "xp" : null,
      finished: finishedEx ? ex.name : null, bananas: { got: nextRows.filter((r) => r.every((s) => s.done)).length, total: nextRows.length },
      next: {
        title: isNew ? tex.name : `Serie ${target.si + 1} de ${nextRows[target.ex].length}`,
        detail: isNew ? `${nextRows[target.ex].length} series, ${targetText(nextRows[target.ex][target.si], { unit: tex.cfg.unit, bw: tex.bw })}` : targetText(nextRows[target.ex][target.si], { unit: tex.cfg.unit, bw: tex.bw }),
        anim: tex.tech?.anim || undefined, isNew, last: pendingLeft === 1,
      },
    });
    restTarget.current = { ex: idx, si };
    setRest({ end: t + ex.cfg.rest * 1000, total: ex.cfg.rest });
    setRestOpen(true);
    tickRef.current = null;
    speak(speechFor("rest", { rest: ex.cfg.rest }), true);
    announce(`Serie ${si + 1} hecha${xp ? `, más ${xp} XP` : ""}. Descanso de ${restLabel(ex.cfg.rest)}`);
  }

  function toggle(si: number) {
    if (here[si].done) { undo(si); return; }
    complete(si);
  }

  /** Cambia el ejercicio actual. Tocar el que ya está solo cierra; si hay series hechas, primero se confirma. */
  function swap(to: number, confirmed = false) {
    if (to === choice[idx]) { setSheet(null); setSwapAsk(null); return; }
    if (!confirmed && here.some((r) => r.done)) { setSwapAsk(to); return; }
    const nextRows = rows.map((r, i) => (i === idx ? rowsFor(options[idx][to]) : r));
    setChoice((c) => c.map((v, i) => (i === idx ? to : v)));
    setRows(nextRows);
    const cs = comboState(nextRows);
    setCombo(cs.combo); setLastAt(cs.lastAt); setBestCombo(cs.best);
    if (restTarget.current?.ex === idx) cancelRest();
    if (work?.ex === idx) setWork(null);
    setSheet(null); setSwapAsk(null);
    setToast({ t: `Cambiado a ${options[idx][to].name}`, kind: "swap" });
    spokeFor.current = null;
  }

  /* ---------- Modo intervalos (exprés) ---------- */
  const ivLeft = iv.paused != null ? iv.paused / 1000 : Math.max(0, (iv.end - now) / 1000);
  const ivTarget = nextPending(rows, idx);
  useEffect(() => {
    if (!interval || phase !== "play" || iv.phase === "ready" || iv.paused != null) return;
    const whole = Math.ceil(ivLeft);
    if (ivLeft > 0) {
      if (whole !== tickRef.current) {
        const prev = tickRef.current; tickRef.current = whole;
        if (prev != null && prev - whole <= 1 && whole <= 3 && whole >= 1) { if (prefs.voice) say(String(whole), { interrupt: true, rate: 1.15 }); else ping("tick"); buzz(40); }
      }
      return;
    }
    if (ivFired.current === iv.end) return;
    ivFired.current = iv.end;
    tickRef.current = null;
    // Encadena las fases desde el final exacto de la anterior: si la pestaña estuvo oculta, se ponen al día todas.
    const res = advanceIntervals(iv, rows, idx, exercises.map((e) => ({ hi: e.cfg.hi, rest: e.cfg.rest })), Date.now());
    let nextRows = res.rows;
    if (res.marked.length) {
      let c = combo, la = lastAt, b = bestCombo;
      const cOf = new Map<string, number>();
      for (const m of res.marked) { c = nextCombo(c, la ? (m.at - la) / 1000 : null, exercises[m.ex].cfg.rest); la = m.at; b = Math.max(b, c); cOf.set(`${m.ex}:${m.si}`, c); }
      nextRows = nextRows.map((r, i) => r.map((s, j) => (cOf.has(`${i}:${j}`) ? { ...s, c: cOf.get(`${i}:${j}`) } : s)));
      setRows(nextRows); setLastAt(la); setCombo(c); setBestCombo(b);
    }
    setIdx(res.idx);
    ping("go"); buzz([200, 100, 200]);
    if (res.finished) { speak(speechFor("done"), true); announce("Entreno completado"); setIv({ phase: "ready", end: 0, total: 0, paused: null }); setTimeout(() => toSummary(), 600); return; }
    setIv({ ...res.iv, paused: null });
    if (res.iv.phase === "work") {
      const name = exercises[res.idx].name;
      speak(speechFor("work", { name }), true);
      announce(`Trabaja: ${name}, ${res.iv.total} segundos`);
    } else {
      const nx = nextPending(nextRows, res.idx);
      const name = nx ? exercises[nx.ex].name : "";
      speak(`Descansa. Sigue ${name}.`, true);
      announce(`Descansa ${res.iv.total} segundos. Sigue ${name}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval, phase, iv, ivLeft]);

  /* ---------- Avisos con la pestaña oculta ---------- */
  const ivNextName = ivTarget ? exercises[ivTarget.ex]?.name ?? "" : "";
  const alarm = interval
    ? (iv.phase === "prep" || iv.phase === "rest") && iv.paused == null ? { at: iv.end, t: "A trabajar", b: ivNextName } : { at: null, t: "", b: "" }
    : rest ? { at: rest.end, t: "Descanso terminado", b: ivNextName ? `Sigue: ${ivNextName}` : "Vuelve a la app para seguir" }
    : work ? { at: work.end, t: "Serie terminada", b: "Vuelve a la app para seguir" } : { at: null, t: "", b: "" };
  useHiddenAlarm(phase === "play" ? alarm.at : null, alarm.t, alarm.b);

  /* ---------- Resumen y guardado ---------- */
  const summary = useMemo(() => ({ vol: volumeOf(rows), ...(noXp ? { xp: 0, prs: 0, rushed: false } : liveXp({ doneSets, totalSets, prs: prs.length, seconds: elapsed })) }), [rows, doneSets, totalSets, prs.length, elapsed, noXp]);
  const prNames = prs.map((p) => p.name);
  function save() {
    start(async () => {
      let res: SaveResult;
      try {
        res = await saveWorkout({
          template, startedAt, fun, total: totalSets, title, icon,
          exercises: exercises.map((e, i) => ({ id: e.id, sets: rows[i].filter((s) => s.done).map((s) => ({ kg: s.kg ? num(s.kg) : null, reps: num(s.reps), rir: rirOf(s) })) })).filter((e) => e.sets.length),
        });
      } catch {
        res = { ok: false, error: typeof navigator !== "undefined" && !navigator.onLine ? "Sin conexión. Tu entreno sigue guardado en este teléfono: intenta de nuevo cuando tengas señal." : "No pudimos guardar. Intenta de nuevo." };
      }
      if (!res.ok) return setSaveMsg(res.error ?? "No pudimos guardar. Intenta de nuevo.");
      store.del(key);
      setSaved(res);
      setSaveMsg(res.demo ? "Modo demo: este entreno no se guardó en la nube." : null);
      setPhase("saved");
      buzz([60, 40, 60, 40, 200]);
      fetch("/api/coach/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        title, done: doneSets, total: totalSets, prs: res.prNames ?? prNames, volume: summary.vol,
        mins: Math.round(elapsed / 60), fun: fun ?? 0, easy: rows.flat().filter((r) => effortOf(r) === "f").length, streak: gam.todayDone ? gam.streak : gam.streak + 1,
      }) }).then((r) => r.json()).then((j) => setFeedback(j.text || null)).catch(() => setFeedback("Buen trabajo hoy. Cuando vuelva la conexión te dejo un análisis más fino."));
    });
  }

  const finishTour = useCallback(() => {
    setTour(false); store.set(TOUR_KEY, 1);
    // El recorrido desplaza la pantalla para mostrar cada parte: al terminar, vuelve al ejercicio
    document.querySelector('[aria-label="Series del ejercicio"]')?.scrollTo({ top: 0 });
  }, []);

  /* ---------- Pantallas especiales ---------- */
  if (!exercises.length) {
    return (
      <Shell>
        <div className="flex-1 grid place-items-center text-center px-6">
          <div><span className="mx-auto grid place-items-center size-24 rounded-[2rem] bg-banana-soft text-banana-ink"><TreePalm weight="duotone" className="size-14" /></span><h1 className="mt-4 text-3xl font-extrabold text-ink">Hoy toca descanso activo</h1><p className="mt-2 text-muted">{cardio}</p><Link href="/app" className="btn-primary mt-6">Volver a Hoy</Link></div>
        </div>
      </Shell>
    );
  }

  if (gate) {
    return (
      <Shell>
        <div className="flex-1 grid place-items-center px-6 animate-enter">
          <div className="max-w-sm text-center">
            <span className="mx-auto grid place-items-center size-24 rounded-[2rem] bg-peel/15 text-peel"><CalendarCheck weight="duotone" className="size-14" /></span>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink">Ya hiciste {title} hoy</h1>
            <p className="mt-2 text-body">Buen trabajo. El músculo crece mientras descansas. Si igual quieres repetirlo, queda en tu historial pero no suma XP.</p>
            <div className="mt-6 space-y-2">
              <Link href="/app" className="btn-primary w-full h-13">Volver a Hoy</Link>
              <button type="button" onClick={() => setGate(false)} className="btn-ghost w-full h-13"><Repeat weight="bold" className="size-5" />Repetir (no suma XP)</button>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  if (phase === "saved") {
    return <Recap title={title} icon={icon} xpBefore={gam.xp} xp={saved?.xp ?? summary.xp} rushed={summary.rushed} streak={gam.todayDone ? gam.streak : gam.streak + 1} seconds={elapsed}
      done={doneSets} total={totalSets} unit={setWord} volume={summary.vol} prs={summary.rushed ? [] : saved?.prNames ?? prNames} bananas={bananas} repeat={noXp || !!saved?.repeat} saveMsg={saveMsg} feedback={feedback} />;
  }

  if (phase === "summary") {
    const cool = cooldownFor(exercises.map((e) => e.muscle));
    const empty = doneSets === 0;
    const lastSet = askLast;
    const last = lastSet ? rows[lastSet.ex]?.[lastSet.si] : null;
    return (
      <Shell>
        <div className="flex-1 overflow-y-auto px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 animate-enter">
          <div className="mx-auto max-w-md">
            <button onClick={backToPlay} className="tap inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft weight="bold" className="size-4" />Volver al entreno</button>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink">{empty ? "Aún no empiezas" : doneSets === totalSets ? "Lo lograste" : "¿Terminamos?"}</h1>
            <p className="text-muted tabular-nums">{doneSets} de {totalSets} {setWord} en {clock(elapsed)}</p>
            {empty ? (
              <p className="mt-4 rounded-2xl bg-cream p-4 text-[15px] text-body">Todavía no marcas {interval ? "ningún intervalo" : "ninguna serie"}, así que no hay nada que guardar. Vuelve al entreno o sal sin guardar.</p>
            ) : (
              <>
                <dl className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { big: `+${summary.xp}`, small: noXp ? "XP (repetición)" : "XP", icon: <BananaCoin className="size-5 text-banana-ink" /> },
                    { big: `${bananas.got}/${bananas.total}`, small: "bananas", icon: <Banana weight="duotone" className="size-5 text-banana-ink" /> },
                    { big: bestCombo > 1 ? `x${bestCombo}` : "x1", small: "mejor combo", icon: <Lightning weight="duotone" className="size-5 text-ember-ink" /> },
                  ].map((s) => (
                    <div key={s.small} className="flex flex-col items-center rounded-2xl bg-white border border-line/70 py-3">
                      <span aria-hidden>{s.icon}</span>
                      <dt className="order-last text-[11px] font-semibold text-muted">{s.small}</dt>
                      <dd className="mt-0.5 text-xl font-extrabold text-ink tabular-nums">{s.big}</dd>
                    </div>
                  ))}
                </dl>
                {noXp && <p className="mt-3 rounded-2xl bg-cream p-3 text-sm text-body">Ya habías hecho este entreno hoy: esta repetición queda en tu historial, pero no suma XP.</p>}
                {doneSets < totalSets && <p className="mt-3 rounded-2xl bg-banana-soft/60 p-3 text-sm font-semibold text-banana-ink">Te faltan {totalSets - doneSets} {setWord}. Puedes terminar igual; el motor lo toma en cuenta.</p>}
                {last && lastSet && (
                  <fieldset className="mt-3 card p-5">
                    <legend className="sr-only">Esfuerzo de la última serie</legend>
                    <p className="font-bold text-ink">¿Cómo se sintió la última serie?</p>
                    <p className="text-sm text-muted">{exercises[lastSet.ex].name}, {targetText(last, { unit: exercises[lastSet.ex].cfg.unit, bw: exercises[lastSet.ex].bw })}. Con esto ajusto el peso de la próxima vez.</p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {EFFORTS.map((e) => {
                        const on = effortOf(last) === e.id;
                        return (
                          <button key={e.id} type="button" onClick={() => setEffort(lastSet.ex, lastSet.si, e.id)} aria-pressed={on}
                            className={`pressable flex flex-col items-center justify-center gap-0.5 min-h-16 rounded-2xl px-1 text-center ${on ? "bg-ink text-white" : "bg-cream text-ink hover:bg-banana-soft"}`}>
                            <span className="inline-flex items-center gap-1 text-[15px] font-extrabold">{on && <Check weight="bold" className="size-4" />}{e.label}</span>
                            <span className={`text-[11px] font-semibold leading-tight ${on ? "text-white/75" : "text-muted"}`}>{e.hint}</span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                )}
                <div className="mt-3 flex gap-3 rounded-[1.5rem] bg-white border border-line/70 p-4">
                  <PersonSimpleWalk weight="duotone" className="size-6 shrink-0 text-banana-ink" />
                  <div><p className="font-bold text-ink">Para cerrar</p><p className="text-sm text-body">{cardio ? `${cardio}. Luego ` : ""}{cardio ? cool.text[0].toLowerCase() + cool.text.slice(1) : cool.text}</p></div>
                </div>
                <fieldset className="mt-3 card p-5">
                  <legend className="sr-only">Diversión del entreno</legend>
                  <p className="font-bold text-ink">¿Qué tan divertido estuvo?</p>
                  <p className="text-sm text-muted">Opcional. Si se pone aburrido, metemos más variedad y retos.</p>
                  <div className="mt-4 grid grid-cols-5 gap-1.5">
                    {FUN.map((F, i) => {
                      const on = fun === i + 1;
                      return (
                        <button key={i} type="button" onClick={() => { setFun(on ? null : i + 1); buzz(15); }} aria-pressed={on}
                          className={`pressable flex flex-col items-center justify-center gap-1 min-h-[72px] rounded-2xl px-0.5 ${on ? "bg-banana text-ink shadow-soft" : "bg-cream text-ink/70 hover:bg-banana-soft"}`}>
                          <F weight={on ? "fill" : "duotone"} className="size-7" />
                          <span className="text-[11px] font-bold leading-tight text-center">{FUN_LABELS[i]}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </>
            )}
            {saveMsg && <p role="alert" className="mt-4 text-sm font-semibold text-bad">{saveMsg}</p>}
          </div>
        </div>
        <footer className="px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-line bg-white/95">
          {empty ? (
            <div className="mx-auto flex max-w-md gap-2">
              <button onClick={leave} className="btn-ghost flex-1 h-16 text-base">Salir sin guardar</button>
              <button onClick={backToPlay} className="btn-banana flex-1 h-16 text-base font-extrabold">Volver al entreno</button>
            </div>
          ) : (
            <button onClick={save} disabled={pending} className="btn-banana mx-auto flex w-full max-w-md h-16 text-lg font-extrabold">{pending ? "Guardando…" : doneSets === totalSets ? "Guardar y celebrar" : "Guardar entreno"}</button>
          )}
        </footer>
      </Shell>
    );
  }

  /* ---------- Exprés ---------- */
  if (interval) {
    const exAt = (i: number, si: number) => ({ name: exercises[i].name, anim: exercises[i].tech?.anim || undefined, setNo: si + 1, sets: rows[i].length, exNo: i + 1, exTotal: exercises.length });
    const cur = ivTarget ? exAt(ivTarget.ex, ivTarget.si) : null;
    const after = ivTarget ? nextPending(rows.map((r, i) => (i !== ivTarget.ex ? r : r.map((s, j) => (j === ivTarget.si ? { ...s, done: true } : s)))), ivTarget.ex) : null;
    // En descanso y preparación, "lo que sigue" es la serie pendiente actual
    const nextShown = iv.phase === "work" ? (after ? exAt(after.ex, after.si) : null) : cur;
    return (
      <>
        <IntervalScreen title={title} phase={iv.phase} left={iv.phase === "ready" ? 0 : ivLeft} total={iv.total} paused={iv.paused != null} cur={cur} next={nextShown}
          plan={exercises.map((e, i) => ({ name: e.name, anim: e.tech?.anim || undefined, sets: rows[i].length, done: rows[i].filter((s) => s.done).length }))}
          done={doneSets} all={totalSets} elapsed={elapsed} workSec={exercises[0].cfg.hi} restSec={exercises[0].cfg.rest}
          onStart={() => { unlockAudio(); tickRef.current = null; setIv({ phase: "prep", end: Date.now() + 5000, total: 5, paused: null }); speak(`Prepárate. Empiezas con ${exercises[ivTarget?.ex ?? 0].name}.`, true); }}
          onPause={() => { setIv((v) => ({ ...v, paused: Math.max(0, v.end - Date.now()) })); hush(); announce("En pausa"); }}
          onResume={() => { tickRef.current = null; setIv((v) => ({ ...v, end: Date.now() + (v.paused ?? 0), paused: null })); }}
          onSkip={() => setIv((v) => (v.paused != null ? v : { ...v, end: Date.now() }))}
          onExit={() => { setIv((v) => (v.phase === "ready" || v.paused != null ? v : { ...v, paused: Math.max(0, v.end - Date.now()) })); setSheet("exit"); }}
          onFinish={() => toSummary()} />
        <p aria-live="polite" className="sr-only">{live}</p>
        <ExitSheet open={sheet === "exit"} onClose={() => setSheet(null)} doneSets={doneSets} totalSets={totalSets} unit={setWord} onFinish={() => toSummary()} />
      </>
    );
  }

  /* ---------- Reproductor ---------- */
  const [badge, badgeCls, BadgeIcon] = RX_BADGE[ex.rx.type];
  const unit = unitLbl(ex.cfg.unit);
  const allDoneHere = here.every((r) => r.done);
  const plates = ex.barbell && activeSet >= 0 ? platesPerSide(num(here[activeSet].kg)) : null;
  const alts = options[idx].length - 1;
  const timed = ex.cfg.unit === "s";
  const warmIdx = exercises.findIndex((e) => warmupFor({ kg: num(rowsFor(e)[0]?.kg), barbell: e.barbell, bw: e.bw, unit: e.cfg.unit }));
  const warm = !warmDone && idx === warmIdx && !here.some((r) => r.done) ? warmupFor({ kg: num(here[0]?.kg), barbell: ex.barbell, bw: ex.bw, unit: ex.cfg.unit }) : null;
  const focus = prefs.view === "focus";
  const nextEx = nextPending(rows.map((r, i) => (i === idx ? r.map((s) => ({ ...s, done: true })) : r)), idx);
  const timerOn = !!work && work.si === activeSet && work.ex === idx;
  const startTimed = () => { unlockAudio(); const n = num(here[activeSet].reps) || ex.cfg.hi; setWork({ end: Date.now() + (n + PREP_SECONDS) * 1000, secs: n, si: activeSet, ex: idx }); buzz(20); speak(`${n} segundos. Prepárate.`, true); };
  const loads = loadsFor(ex.load);
  const missingKg = needsLoad(ex) && activeSet >= 0 && num(here[activeSet].kg) <= 0;
  const chips = activeSet >= 0 && needsLoad(ex) && loads && (ex.rx.type === "cal" || missingKg) ? loads.chips : null;
  const tourSteps: TourStep[] = [
    timed
      ? { target: "done", title: "Empieza la serie", body: "Toca Iniciar: cuenta 3 segundos para que te acomodes y luego el tiempo de trabajo. Al terminar se marca sola." }
      : { target: "done", title: "Marca la serie", body: "Haz las reps y toca Hecho. Si levantaste otro peso, cámbialo antes con los botones grandes." },
    { target: "rest", title: "Descansa", body: "Al marcar arranca el descanso con cuenta regresiva. Te avisamos con sonido y vibración cuando toca seguir." },
    { target: "swap", title: "¿Máquina ocupada?", body: "Toca Cambiar y elige otro ejercicio del mismo patrón. Tus series se ajustan solas." },
  ];

  return (
    <Shell>
      <div className="contents" inert={!!rest && restOpen}>
      <header data-tour-anchor className="px-4 pt-[max(.75rem,env(safe-area-inset-top))] pb-2 bg-paper/95 backdrop-blur border-b border-line/60">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <button onClick={() => setSheet("exit")} className="tap pressable grid place-items-center size-11 shrink-0 rounded-full bg-white border border-line hover:bg-cream" aria-label="Salir del entreno"><X weight="bold" className="size-5" /></button>
          <div className="flex-1 min-w-0 text-center">
            <p className="flex items-center justify-center gap-1.5 font-extrabold text-ink min-w-0"><BrandIcon name={icon} className="size-5 shrink-0 text-banana-ink" /><span className="truncate">{title}</span></p>
            <p className="flex items-center justify-center gap-3 text-xs font-semibold text-muted tabular-nums">
              <span className="inline-flex items-center gap-1"><Timer weight="bold" className="size-3.5" aria-hidden /><span className="sr-only">Tiempo </span>{clock(elapsed)}</span>
              {noXp ? <span className="inline-flex items-center gap-1"><Repeat weight="bold" className="size-3.5" aria-hidden />Sin XP</span> : <span className="inline-flex items-center gap-1"><BananaCoin className="size-3.5 text-banana-ink" />{xpNow.xp} XP</span>}
              {sessMode === "suave" && <span className="text-sky">Modo suave</span>}
              {combo >= 2 && <span className="inline-flex items-center gap-1 text-ember-ink"><Lightning weight="fill" className="size-3.5" aria-hidden />Combo x{combo}</span>}
            </p>
          </div>
          <button onClick={() => setSheet("sound")} className="tap pressable grid place-items-center size-11 shrink-0 rounded-full bg-white border border-line hover:bg-cream" aria-label={`Sonido y voz: ${prefs.voice ? "coach de voz encendido" : prefs.sound ? "pitidos encendidos" : "silencio"}`}>
            {prefs.sound || prefs.voice ? <SpeakerHigh weight={prefs.voice ? "fill" : "bold"} className="size-5" /> : <SpeakerSlash weight="bold" className="size-5" />}
          </button>
          <SessionRing value={doneSets / Math.max(1, totalSets)} />
        </div>
        <div className="mx-auto mt-2 max-w-xl">
          <BananaTrail items={exercises.map((e, i) => ({ name: e.name, done: rows[i].filter((s) => s.done).length, total: rows[i].length }))} current={idx} fresh={fresh} onPick={(i) => { setIdx(i); setWork(null); }} />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overflow-x-hidden" role="region" aria-label="Series del ejercicio">
        <div className={`mx-auto max-w-xl px-4 pt-4 ${rest && !restOpen ? "pb-28" : "pb-6"}`}>
          {/* Ejercicio: el mosaico abre la técnica; el único botón al lado es Cambiar */}
          <section key={ex.id} className="flex gap-3 items-stretch animate-enter">
            <button onClick={() => setSheet("tech")} className="pressable relative shrink-0 w-[88px] min-h-[104px] rounded-3xl bg-banana overflow-hidden" aria-label={`Ver técnica de ${ex.name}`}>
              {ex.tech?.anim ? <ExerciseMotion anim={ex.tech.anim} label={false} className="absolute inset-x-1 top-1 bottom-5" /> : <Barbell weight="duotone" className="absolute inset-0 m-auto size-11 text-ink/80" />}
              <span className="absolute bottom-1.5 inset-x-0 text-[10px] font-bold text-ink/75">Ver técnica</span>
            </button>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="flex items-center gap-2 text-xs font-semibold text-muted min-w-0"><span className="truncate">Ejercicio {idx + 1} de {exercises.length}, {ex.muscle.toLowerCase()}</span><span className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2 h-5 text-[11px] font-bold ring-1 ring-line ${badgeCls}`}><BadgeIcon weight="bold" className="size-3" />{badge}</span></p>
              <h1 className="mt-0.5 text-[22px] leading-tight font-extrabold tracking-tight text-ink line-clamp-2">{ex.name}</h1>
              {alts > 0 && (
                <div className="mt-1.5">
                  <button data-tour="swap" onClick={() => { setSwapAsk(null); setSheet("swap"); }} className="chip h-11 px-4 bg-white border border-line text-ink"><ArrowsLeftRight weight="bold" className="size-4" />Cambiar ejercicio</button>
                </div>
              )}
            </div>
          </section>
          <p className="mt-3 text-[13px] leading-snug text-muted">{ex.rx.note}</p>

          {warm && (
            <div className="mt-3 flex items-start gap-3 rounded-[1.5rem] bg-banana-soft/70 p-3.5">
              <Monkey className="size-7 shrink-0 text-banana-ink" />
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-ink">Calienta primero</p>
                <p className="text-sm text-body">{warmupText(warm, ex.barbell)} No se anotan.</p>
              </div>
              <button onClick={() => setWarmDone(true)} className="tap pressable shrink-0 h-11 px-4 rounded-full bg-ink text-white text-sm font-bold">Ya calenté</button>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-muted tabular-nums">{here.filter((r) => r.done).length} de {here.length} series</h2>
            <div role="radiogroup" aria-label="Vista" className="inline-flex rounded-full bg-white border border-line p-0.5">
              {(["focus", "list"] as const).map((v) => (
                <button key={v} role="radio" aria-checked={prefs.view === v} onClick={() => setPrefs({ view: v })} className={`tap pressable h-11 px-4 rounded-full text-sm font-bold ${prefs.view === v ? "bg-ink text-white" : "text-muted hover:text-ink"}`}>{v === "focus" ? "Foco" : "Lista"}</button>
              ))}
            </div>
          </div>

          <div className="mt-2.5">
            {focus && activeSet >= 0 ? (
              <FocusSet rows={here} active={activeSet} bw={ex.bw} unit={ex.cfg.unit} restSec={ex.cfg.rest} plates={plates} prev={ex.lastSets?.[activeSet]}
                chips={chips} onPickKg={pickKg} onStep={step} onChange={change} onCopy={copy} onUndo={undo} />
            ) : focus ? (
              <div className="space-y-2">
                {here.map((x, si) => <DoneRow key={si} si={si} row={x} unit={ex.cfg.unit} bw={ex.bw} onUndo={undo} />)}
              </div>
            ) : (
              <ListSets rows={here} active={activeSet} bw={ex.bw} unit={ex.cfg.unit} unitLabel={unit} plates={plates} last={here.map((_, si) => ex.lastSets?.[si])} needsKg={needsLoad(ex)}
                pop={pop && pop.ex === idx ? pop : null} onStep={step} onChange={change} onToggle={toggle} onEffort={(si, e) => setEffort(idx, si, e)}
                timedSlot={timed && !rest ? (
                  <div className="px-3 pb-3">
                    {timerOn && tp ? (
                      <div className="flex items-center gap-3 rounded-2xl bg-peel text-white p-3" role="timer" aria-label="Serie por tiempo">
                        <span className="w-20 text-center leading-tight">{tp.prep ? <><span className="block text-[11px] font-bold text-white/80">Prepárate</span><span className="text-2xl font-extrabold tabular-nums">{Math.ceil(tp.prepLeft)}</span></> : <span className="text-3xl font-extrabold tabular-nums">{Math.ceil(tp.workLeft)}</span>}</span>
                        <div aria-hidden className="flex-1 h-2 rounded-full bg-white/30 overflow-hidden"><div className="h-full w-full rounded-full bg-white" style={{ transform: `translateX(${-tp.frac * 100}%)`, transition: "transform .25s linear" }} /></div>
                        <button onClick={() => setWork(null)} className="tap pressable h-11 px-4 rounded-full bg-white/20 text-sm font-bold">Parar</button>
                      </div>
                    ) : (
                      <button onClick={startTimed} className="pressable w-full h-12 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-peel text-white font-extrabold"><Play weight="fill" className="size-4" />Iniciar {num(here[activeSet]?.reps) || ex.cfg.hi} s</button>
                    )}
                  </div>
                ) : undefined} />
            )}
          </div>

          {!focus && <p className="mt-3 text-center text-xs text-muted">{ex.cfg.unit ? `Técnica limpia, descanso ${restLabel(ex.cfg.rest)}` : `Tempo 3-1-1, 1 a 2 reps en reserva, descanso ${restLabel(ex.cfg.rest)}`}</p>}
          {focus && !ex.cfg.unit && <p className="mt-3 text-center text-xs text-muted">Tempo 3-1-1: baja en 3 s, pausa 1, sube en 1. Deja 1 o 2 reps en reserva.</p>}
          {nextEx === null && cardio && <p className="mt-3 card p-4 flex items-center gap-2.5 text-sm font-semibold text-ink"><PersonSimpleWalk weight="duotone" className="size-5 shrink-0 text-banana-ink" />Al final: {cardio}</p>}
        </div>
      </div>

      <footer className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-xl">
          {focus && activeSet >= 0 ? (
            timed ? (
              timerOn && tp ? (
                <div className="flex items-center gap-3 h-[72px] rounded-[1.75rem] bg-peel text-white px-4" role="timer" aria-label="Serie por tiempo">
                  {tp.prep
                    ? <span className="w-24 text-center leading-tight"><span className="block text-xs font-bold text-white/80">Prepárate</span><span className="text-3xl font-extrabold tabular-nums">{Math.ceil(tp.prepLeft)}</span></span>
                    : <span className="text-4xl font-extrabold tabular-nums w-24 text-center">{Math.ceil(tp.workLeft)}</span>}
                  <div aria-hidden className="flex-1 h-2.5 rounded-full bg-white/30 overflow-hidden"><div className="h-full w-full rounded-full bg-white" style={{ transform: `translateX(${-tp.frac * 100}%)`, transition: "transform .25s linear" }} /></div>
                  <button onClick={() => setWork(null)} className="tap pressable h-11 px-4 rounded-full bg-white/20 text-sm font-bold">Parar</button>
                </div>
              ) : (
                <button data-tour="done" onClick={startTimed} disabled={missingKg} className="pressable w-full h-[72px] inline-flex items-center justify-center gap-2 rounded-[1.75rem] bg-banana text-ink text-xl font-extrabold shadow-[0_6px_16px_-8px_rgb(138_98_0/.5)] disabled:bg-line disabled:text-muted disabled:shadow-none"><Play weight="fill" className="size-6" />{missingKg ? "Elige un peso" : `Iniciar ${num(here[activeSet]?.reps) || ex.cfg.hi} s`}</button>
              )
            ) : (
              <button data-tour="done" onClick={() => complete(activeSet)} disabled={missingKg} className="relative pressable w-full h-[72px] inline-flex items-center justify-center gap-2.5 rounded-[1.75rem] bg-banana text-ink text-xl font-extrabold shadow-[0_6px_16px_-8px_rgb(138_98_0/.5)] hover:brightness-95 disabled:bg-line disabled:text-muted disabled:shadow-none disabled:hover:brightness-100" aria-describedby="serie-actual">
                {pop && pop.ex === idx && <XpPop k={pop.k} xp={pop.xp} />}
                {missingKg ? "Elige un peso para marcar" : <><Check weight="bold" className="size-7" />Hecho</>}
              </button>
            )
          ) : nextEx && (allDoneHere || !focus) ? (
            <button onClick={() => setIdx(nextEx.ex)} className={`w-full h-14 text-base ${allDoneHere ? "btn-primary" : "btn-ghost"}`}>Siguiente: <span className="truncate">{exercises[nextEx.ex].name}</span> <CaretRight weight="bold" className="size-5 shrink-0" /></button>
          ) : (
            <button onClick={finishNow} className="btn-banana w-full h-14 text-base"><FlagCheckered weight="duotone" className="size-5" />Terminar entreno</button>
          )}
        </div>
      </footer>
      </div>

      {/* Descanso */}
      {restP.mounted && shownRest && shownInfo && (
        <RestScreen left={rest ? restLeft : 0} total={shownRest.total} info={shownInfo} closing={restP.closing}
          onEffort={(e) => restTarget.current && setEffort(restTarget.current.ex, restTarget.current.si, e)}
          onAdjust={(d) => setRest((r) => r && (d > 0 ? { end: r.end + d * 1000, total: r.total + d } : { ...r, end: r.end + d * 1000 }))}
          onSkip={cancelRest}
          onMinimize={() => setRestOpen(false)} />
      )}
      {rest && !restOpen && <RestPill left={restLeft} onOpen={() => setRestOpen(true)} onSkip={cancelRest} />}

      {/* Hojas */}
      <BottomSheet open={!!sheet && sheet !== "exit"} onClose={() => { setSheet(null); setSwapAsk(null); }} label={shownSheet === "tech" && !ex.tech ? "Técnica" : undefined} className="max-h-[88dvh] overflow-y-auto">
        <div className="px-5">
          {shownSheet === "tech" && !ex.tech && (
            <div className="space-y-4">
              <SheetTitle className="text-2xl font-extrabold text-ink">{ex.name}</SheetTitle>
              <p className="text-muted">Movimiento controlado, rango completo y sin rebotes. Si duele (no es esfuerzo, es dolor), para y cámbialo.</p>
              <button onClick={() => setSheet(null)} className="btn-primary w-full">Entendido</button>
            </div>
          )}
          {shownSheet === "tech" && ex.tech && (
            <div className="space-y-4">
              {ex.tech.anim && <div className="rounded-[1.5rem] bg-banana/90 px-4 pt-6 pb-2"><ExerciseMotion anim={ex.tech.anim} mus={ex.tech.mus} cues={ex.tech.cues.length ? ex.tech.cues : undefined} className="mx-auto h-64 sm:h-80 max-w-[360px]" /></div>}
              <SheetTitle className="text-2xl font-extrabold text-ink">{ex.name}</SheetTitle>
              {ex.tech.mus && <p className="text-sm text-muted">{ex.tech.mus}</p>}
              {ex.tech.how.length > 0 && <ol className="space-y-2">{ex.tech.how.map((h, i) => <li key={i} className="flex gap-2.5"><span className="grid place-items-center size-6 shrink-0 rounded-full bg-banana text-xs font-bold text-ink">{i + 1}</span><span>{h}</span></li>)}</ol>}
              {ex.tech.cues.length > 0 && <div className="flex flex-wrap gap-2">{ex.tech.cues.map((c) => <span key={c} className="chip bg-peel/10 text-peel"><Check weight="bold" className="size-3.5" />{c}</span>)}</div>}
              {ex.tech.err.length > 0 && <div className="space-y-1">{ex.tech.err.map((c) => <p key={c} className="flex gap-1.5 text-sm text-ember-ink"><X weight="bold" className="mt-0.5 size-4 shrink-0" />{c}</p>)}</div>}
              {ex.tech.mono && <p className="flex gap-2.5 rounded-2xl bg-white p-3 text-sm"><Monkey className="size-6 shrink-0 text-banana-ink" /><span><RichTip text={ex.tech.mono} /></span></p>}
              {canSpeak() && ex.tech.how.length > 0 && <button onClick={() => say([ex.name, ...ex.tech!.how].join(". "), { interrupt: true })} className="btn-ghost w-full"><SpeakerHigh weight="bold" className="size-5" />Escuchar los pasos</button>}
              <button onClick={() => setSheet(null)} className="btn-primary w-full">Entendido</button>
            </div>
          )}
          {shownSheet === "swap" && (
            <div>
              <SheetTitle className="text-2xl font-extrabold text-ink">Cambiar ejercicio</SheetTitle>
              <p className="text-sm text-muted">¿Máquina ocupada o sin equipo? Mismo patrón, mismas series.</p>
              {swapAsk != null ? (
                <div className="mt-4 rounded-[1.5rem] bg-ember/10 p-4" role="alert">
                  <p className="font-extrabold text-ink">¿Descartar {here.filter((r) => r.done).length === 1 ? "la serie hecha" : `las ${here.filter((r) => r.done).length} series hechas`}?</p>
                  <p className="mt-1 text-sm text-body">Ya registraste series de {ex.name}. Si cambias a {options[idx][swapAsk].name}, se borran y empiezas de cero con el nuevo ejercicio.</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => setSwapAsk(null)} data-autofocus className="btn-ghost flex-1 h-12">Mejor no</button>
                    <button type="button" onClick={() => swap(swapAsk, true)} className="btn-primary flex-1 h-12">Cambiar igual</button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {options[idx].map((o, i) => {
                    const on = choice[idx] === i;
                    const start = o.rx.kg == null && !o.bw ? loadsFor(o.load)?.start : undefined;
                    const meta = [cap(o.muscle), i === 0 ? "plan original" : "", o.rx.kg != null ? `sugerido ${kgFmt(o.rx.kg)} kg` : start ? `para empezar ${kgFmt(start)} kg` : ""].filter(Boolean).join(", ");
                    return (
                      <button key={o.id} onClick={() => swap(i)} aria-current={on || undefined} className={`pressable w-full flex items-center gap-3 rounded-2xl border p-3 text-left ${on ? "bg-banana border-banana" : "bg-white border-line hover:border-ink"}`}>
                        <span className="grid place-items-center size-12 shrink-0 rounded-xl bg-cream text-ink/80">{o.barbell ? <Barbell weight="duotone" className="size-6" /> : o.bw ? <PersonArmsSpread weight="duotone" className="size-6" /> : <BrandIcon name="gorilla" className="size-6" />}</span>
                        <span className="flex-1 min-w-0"><span className="block font-bold text-ink">{o.name}</span><span className={`flex flex-wrap items-center gap-x-1 text-xs ${on ? "text-ink/80" : "text-muted"}`}><span>{meta}</span>{o.id.startsWith("ds:") && <span className="inline-flex items-center gap-1"><Books weight="duotone" className="size-3.5" />De la biblioteca</span>}</span></span>
                        {on ? <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-ink"><Check weight="bold" className="size-5" />Actual</span> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {shownSheet === "sound" && (
            <div>
              <SheetTitle className="text-2xl font-extrabold text-ink">Sonido y voz</SheetTitle>
              <p className="text-sm text-muted">La pantalla se mantiene encendida mientras entrenas.</p>
              <div className="mt-4 space-y-2">
                <Switch on={prefs.sound} onChange={(v) => { setPrefs({ sound: v }); if (v) { unlockAudio(); sfx.done(); } }} title="Pitidos y vibración" body="Cuenta 3, 2, 1 y aviso al terminar el descanso." />
                <Switch on={prefs.voice && canSpeak()} disabled={!canSpeak()} onChange={(v) => { setPrefs({ voice: v }); if (v) say("Listo. Te voy guiando.", { interrupt: true }); else hush(); }}
                  title="Coach de voz" body={canSpeak() ? "Te dice el ejercicio, la meta, el descanso y la cuenta regresiva." : "Este navegador no tiene voz. Prueba con Chrome o Safari."} />
              </div>
              <button onClick={() => setSheet(null)} className="btn-primary w-full mt-5">Listo</button>
            </div>
          )}
        </div>
      </BottomSheet>
      <ExitSheet open={sheet === "exit"} onClose={() => setSheet(null)} doneSets={doneSets} totalSets={totalSets} unit={setWord} onFinish={finishNow} />

      {/* El aviso flotante nunca tapa el descanso (ahí está la pregunta de esfuerzo) ni una hoja abierta */}
      <Toast side="top">{toast && !(rest && restOpen) && !sheet && <>{toast.kind === "pr" ? <BananaTrophy weight="fill" className="size-5 shrink-0 text-banana" /> : <ArrowsLeftRight weight="bold" className="size-5 shrink-0 text-banana" />}{toast.t}</>}</Toast>
      <p aria-live="polite" className="sr-only">{live}</p>

      {tour && phase === "play" && !rest && !sheet && (
        <Tour onDone={finishTour} steps={tourSteps} extra={canSpeak() ? (
          <button onClick={() => setPrefs({ voice: !prefs.voice })} aria-pressed={prefs.voice} className={`mt-3 w-full chip h-11 justify-center text-sm ${prefs.voice ? "bg-ink text-white" : "bg-white border border-line text-ink"}`}>
            {prefs.voice ? <Check weight="bold" className="size-4" /> : <SpeakerHigh weight="bold" className="size-4" />}{prefs.voice ? "Coach de voz activado" : "Activar coach de voz"}
          </button>
        ) : undefined} />
      )}
    </Shell>
  );
}

function ExitSheet({ open, onClose, doneSets, totalSets, unit, onFinish }: { open: boolean; onClose: () => void; doneSets: number; totalSets: number; unit: string; onFinish: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-5 space-y-3">
        <SheetTitle className="text-2xl font-extrabold text-ink">¿Salir del entreno?</SheetTitle>
        <p className="text-muted">Llevas {doneSets} de {totalSets} {unit}. Tu progreso queda guardado en este teléfono.</p>
        <button onClick={onClose} className="btn-primary w-full h-13">Seguir entrenando</button>
        {doneSets > 0 && <button onClick={onFinish} className="btn-ghost w-full h-13">Terminar y guardar</button>}
        <Link href="/app" className="btn w-full h-13 text-muted">Salir por ahora</Link>
      </div>
    </BottomSheet>
  );
}

function Switch({ on, onChange, title, body, disabled }: { on: boolean; onChange: (v: boolean) => void; title: string; body: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)} className="pressable w-full flex items-center gap-3 rounded-2xl bg-white border border-line p-4 text-left disabled:opacity-60">
      <span className="flex-1 min-w-0"><span className="block font-bold text-ink">{title}</span><span className="block text-sm text-muted">{body}</span></span>
      <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-(--dur-fast) ${on ? "bg-ink" : "bg-line"}`}>
        <span className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow-soft transition-transform duration-(--dur-fast) ease-out ${on ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex flex-col bg-paper">{children}</div>;
}
