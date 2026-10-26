"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowsLeftRight, ArrowUp, ArrowCounterClockwise, BananaCoin, CaretDown, DotsThree, Eye, BananaFlame, BananaTrophy, Barbell, Books, BrandIcon, CalendarCheck, CaretRight, Check, FlagCheckered, LevelIcon, Monkey, PersonArmsSpread, PersonSimpleWalk, Play, Plus, Repeat, Smiley, SmileyMeh, SmileySad, SpeakerHigh, SpeakerSlash, Target, Timer, TreePalm, X, Banana, MonkeyBanana, Lightning, WifiSlash } from "@/components/icons";
import { platesPerSide, prescribe, type Prescription, type SetLog, type SlotCfg } from "@/lib/engine";
import { nextTimeLine } from "@/lib/primeros-pasos";
import { learn } from "@/components/primeros-pasos/learn-store";
import { FULL_BONUS, SET_XP, levelCrossed, workoutXp } from "@/lib/gamify";
import type { Technique } from "@/lib/engine/technique";
import { ExerciseMotion } from "@/components/exercise-motion";
import { RichTip } from "@/components/rich-tip";
import { Sheet as BottomSheet, SheetTitle } from "@/components/sheet";
import { Toast } from "@/components/toast";
import { usePresence, useSticky } from "@/components/use-presence";
import { buzz, canSpeak, hush, say, sfx, store, unlockAudio, useHiddenAlarm, useNow, usePrefs, useWakeLock } from "@/components/workout/device";
import {
  EFFORTS, FUN_LABELS, PREP_SECONDS, advanceIntervals, beatsBest, bump, cap, clock, comboState, cooldownFor, effortOf, effortPatch, isIntervalPlan, isRushed, kgFmt, liveXp,
  loadsFor, nextCombo, nextPending, num, prsOf, readSaved, restLabel, rirOf, setXpGain, speechFor, stepFor, targetText, unitLbl, volumeOf, warmupFor, warmupText,
  type Effort, type IvClock, type LoadKind, type Row,
} from "@/components/workout/logic";
import { DoneRow, FocusSet } from "@/components/workout/focus-set";
import { ListSets } from "@/components/workout/list-sets";
import { RestPill, RestScreen, type RestInfo } from "@/components/workout/rest-screen";
import { IntervalScreen } from "@/components/workout/interval-screen";
import { SIDE_LABEL, advanceTimed, segLabel, pauseTimed, resumeTimed, segCue, skipTimed, startTimed as startTimed0, timedSegments, timedView, type TimedRun } from "@/components/workout/sides";
import { TimedBar } from "@/components/workout/timed-bar";
import { Recap } from "@/components/workout/recap";
import { CoachArtFill, CoachPic } from "@/components/coach-pic";
import { Tour, type TourStep } from "@/components/workout/tour";
import { BananaTrail, LevelMeter, LevelUpBurst, SessionRing, XpPop } from "@/components/workout/ui";
import { MILESTONES, expressRows, finishValue, lastVolume, levelGoal, levelGoalText, nextMilestone, pickFact, reachedMilestones, restFacts, volumeWithHistory, type LevelGoal } from "@/components/workout/motivation";
import type { SaveResult } from "./actions";
import { OUTBOX_EVENT, queueWorkout, sendQueued, type OutboxEvent } from "@/components/offline/outbox";
import { useOnline } from "@/components/offline/connection-status";
import { outboxId } from "@/lib/offline-queue";
import { hookLine } from "@/lib/engine";
import { DEFAULT_VOICE, effortHints, rxBadge, strengthCue, t, type Voice } from "@/lib/voice";

export type PlayerExercise = { id: string; name: string; muscle: string; cfg: SlotCfg; tech: Technique | null; /** Ilustración del coach del programa (Coach Platanita) haciendo el ejercicio. */ art?: string | null; bw: boolean; barbell: boolean; load: LoadKind | null; rx: Prescription; best: number; lastSets: SetLog[] | null };
/** `sex`: nombres de nivel para ella ("Mona fuerte"). */
export type Gam = { xp: number; streak: number; todayDone: boolean; sex?: string | null };
type Mode = "normal" | "suave" | "fuerte";
type Rest = { end: number; total: number } | null;
type Sheet = null | "tech" | "swap" | "exit" | "sound";
type Iv = IvClock & { paused: number | null };
/** Serie por tiempo en curso: sus tramos (preparación, trabajo y, por lado, cambio y segundo lado). */
type Work = { run: TimedRun; si: number; ex: number } | null;

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

export function Player({ template, title, icon, cardio, options, dateKey, mode = "normal", doneToday = false, repeat = false, gam, preswap, voice = DEFAULT_VOICE, hook, mins, coach = null, ballast = true, intro: introText }: {
  /** Presentación propia de la sesión (la coach del programa); manda sobre el gancho del motor. */
  intro?: string;
  /** Campo de lastre en los ejercicios con el peso corporal. Un programa de equipo fijo (pilates, dominadas) no lo usa. */
  ballast?: boolean;
  /** Coach del programa activo (Coach Platanita): presenta el entreno y firma el feedback. Sin ella, Coach Banana. */
  coach?: { name: string; avatar: string } | null;
  /** "Cómo te hablo": registro del lenguaje (mismos números en los tres). */
  voice?: Voice;
  /** Línea de Coach Banana que presenta el entreno y sus minutos. */
  hook?: string; mins?: number | null;
  template: string; title: string; icon: string; cardio?: string; options: PlayerExercise[][]; dateKey: string; mode?: Mode; doneToday?: boolean; repeat?: boolean; gam: Gam;
  /** Cambio pedido desde la biblioteca ("Cambiar por este"): ejercicio `slot` pasa a la opción `option`. */
  preswap?: { slot: number; option: number } | null;
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
  /** "Más opciones": lo secundario (nota técnica, XP, vista Lista, nivel) queda a un toque, no a la vista. */
  const [more, setMore] = useState(false);
  const [toast, setToast] = useState<{ t: string; kind: "pr" | "swap" | "done" | "level" | "express"; idx?: number } | null>(null);
  /** Hitos ya mostrados en esta sesión: deshacer y volver a marcar no los repite. */
  const [seen, setSeen] = useState<string[]>([]);
  /** Series del plan original si se pasó a modo exprés (el bono de completo se mide contra el plan). */
  const [plan, setPlan] = useState<number | null>(null);
  const [levelUp, setLevelUp] = useState<{ idx: number; n: string; k: number } | null>(null);
  const restCount = useRef(0);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [swapAsk, setSwapAsk] = useState<number | null>(null);
  const [phase, setPhase] = useState<"play" | "summary" | "saved">("play");
  const [endedAt, setEndedAt] = useState<number | null>(null);
  /** Serie sobre la que se pregunta el esfuerzo en el resumen (la última, que no tuvo descanso). */
  const [askLast, setAskLast] = useState<{ ex: number; si: number } | null>(null);
  const [fun, setFun] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  /** El entreno quedó en la bandeja del teléfono (sin señal) y se sube solo al volver la conexión. */
  const [queued, setQueued] = useState(false);
  const online = useOnline();
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
    // El ejercicio elegido se guarda por id: si era uno de la biblioteca que esta lista no trae, se vuelve a pedir por URL.
    if (s && started && s.choiceIds) {
      const miss = s.choiceIds.findIndex((id, i) => id.startsWith("ds:") && !options[i]?.some((o) => o.id === id));
      if (miss >= 0 && !(preswap && preswap.slot === miss)) {
        const q = new URLSearchParams(window.location.search);
        q.set("cambiar", options[miss][0].id); q.set("por", s.choiceIds[miss]);
        router.replace(`${window.location.pathname}?${q.toString()}`);
        return;
      }
    }
    const savedChoice = s ? options.map((o, i) => { const at = s.choiceIds ? o.findIndex((x) => x.id === s.choiceIds![i]) : -1; return at >= 0 ? at : Math.min(s.choice[i] ?? 0, o.length - 1); }) : null;
    if (s && savedChoice && (started || s.repeat)) {
      // Sesión empezada: se retoma tal cual (series, modo y cambios).
      setRows(s.rows); setIdx(s.idx); setStartedAt(s.startedAt); setChoice(savedChoice);
      setCombo(s.combo ?? 0); setBestCombo(s.best ?? 0); setLastAt(s.lastAt); setWarmDone(!!s.warm);
      const doneN = s.rows.flat().filter((r) => r.done).length;
      setSeen(s.ms ?? reachedMilestones(doneN, s.plan ?? s.rows.flat().length)); setPlan(s.plan ?? null);
      if (s.mode === "suave" || s.mode === "fuerte" || s.mode === "normal") setSessMode(s.mode);
      setGate(false);
    } else if (s && savedChoice) {
      // Abierta pero sin series: se respetan los cambios de ejercicio, y las series salen del modo de hoy.
      setChoice(savedChoice);
      setRows(options.map((o, i) => rowsFor(o[savedChoice[i]] ?? o[0])));
    }
    // Cambio pedido desde la biblioteca: se aplica si ese ejercicio aún no tiene series hechas.
    if (preswap && options[preswap.slot]?.[preswap.option]) {
      const base = started && s ? s.rows : options.map((o, i) => rowsFor(o[savedChoice?.[i] ?? 0] ?? o[0]));
      if (!base[preswap.slot]?.some((r) => r.done)) {
        setChoice((c) => c.map((v, i) => (i === preswap.slot ? preswap.option : v)));
        setRows(base.map((r, i) => (i === preswap.slot ? rowsFor(options[preswap.slot][preswap.option]) : r)));
        setToast({ t: `Cambiado a ${options[preswap.slot][preswap.option].name}`, kind: "swap" });
      }
    }
    loaded.current = true;
    if (!started && !store.get(TOUR_KEY) && !isIntervalPlan(options.map((o) => o[0]))) setTour(true);
  }, [key, options]); // eslint-disable-line react-hooks/exhaustive-deps -- preswap se aplica solo al cargar
  useEffect(() => {
    if (loaded.current && phase === "play" && !gate) store.set(key, { rows, idx, startedAt, choice, choiceIds: exercises.map((e) => e.id), combo, best: bestCombo, lastAt, warm: warmDone, mode: sessMode, ms: seen, ...(plan ? { plan } : {}), ...(doneToday ? { repeat: true } : {}) });
  }, [key, rows, idx, startedAt, choice, exercises, combo, bestCombo, lastAt, warmDone, phase, sessMode, gate, doneToday, seen, plan]);
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
  // En modo exprés el bono de completo se sigue midiendo contra el plan original (no se gana recortando).
  const planTotal = Math.max(plan ?? 0, totalSets);
  const xpNow = noXp ? { xp: 0, prs: 0, rushed: false } : liveXp({ doneSets, totalSets: planTotal, prs: prs.length, seconds: elapsed });
  const xpState = (done: number, seconds: number) => ({ doneSets: done, totalSets: planTotal, doable: totalSets, prs: prs.length, seconds });
  const goal: LevelGoal | null = noXp ? null : levelGoal(gam.xp, xpState(doneSets, elapsed), gam.sex);
  const streakNext = gam.todayDone ? gam.streak : gam.streak + 1;
  const bananas = { got: rows.filter((r) => r.length && r.every((s) => s.done)).length, total: rows.length };
  const setWord = interval ? "intervalos" : "series";
  const hints = effortHints(voice);

  /* ---------- Voz y sonido ---------- */
  const speak = useCallback((t: string, interrupt = false) => { if (prefs.voice) say(t, { interrupt }); }, [prefs.voice]);
  const ping = useCallback((k: keyof typeof sfx) => { if (prefs.sound) sfx[k](); }, [prefs.sound]);
  const announce = (t: string) => setLive(t);

  // Presenta cada ejercicio al llegar a él (solo con la voz encendida)
  const introFor = useCallback((e: PlayerExercise, r: Row | undefined) => speechFor("exercise", { name: e.name, sets: e.rx.sets, target: r ? targetText(r, { unit: e.cfg.unit, bw: e.bw, perSide: e.cfg.perSide }) : undefined, cue: e.tech?.cues[0] }), []);
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
  // Por lado: lado derecho, 5 s para cambiar y lado izquierdo; la serie se marca (y empieza el descanso) al final.
  const tp = work ? timedView(work.run, now) : null;
  const sideTick = useRef<number | null>(null);
  useEffect(() => {
    if (!work) { sideTick.current = null; return; }
    const res = advanceTimed(work.run, now);
    if (res.finished) { const w = work; setWork(null); ping("go"); buzz([200, 100, 200]); if (w.ex === idx && !rows[idx][w.si].done) complete(w.si); return; }
    if (res.entered.length) {
      setWork({ ...work, run: res.run });
      sideTick.current = null;
      // Al volver de otra app con varios tramos pasados, solo se avisa el actual.
      const cue = segCue(res.run.segs[res.entered[res.entered.length - 1]]);
      if (cue) { ping("go"); buzz(res.run.segs[res.run.i].kind === "switch" ? [200, 100, 200] : 60); speak(cue.say, true); announce(cue.live); }
      return;
    }
    // 3, 2, 1 antes de empezar el segundo lado (igual que al final del descanso)
    const v = timedView(work.run, now);
    if (v.seg.kind !== "switch" || v.paused) return;
    const whole = Math.ceil(v.left);
    if (whole === sideTick.current) return;
    const prev = sideTick.current;
    sideTick.current = whole;
    if (prev != null && prev - whole === 1 && whole <= 3 && whole >= 1) { if (prefs.voice) say(String(whole), { interrupt: true, rate: 1.15 }); else ping("tick"); buzz(40); }
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
    const xp = noXp ? 0 : setXpGain({ doneBefore: doneSets, totalSets: planTotal, prsBefore: prs.length, prsAfter: prs.length + (isPr ? 1 : 0), seconds });
    // ¿Esta serie sube de nivel? Mismo cálculo que el servidor, antes y después de la serie.
    const xpBefore = noXp ? 0 : workoutXp({ doneSets, totalSets: planTotal, prs: prs.length, seconds }).xp;
    const lvUp = xp ? levelCrossed(gam.xp + xpBefore, gam.xp + xpBefore + xp, gam.sex) : null;
    const ms = nextMilestone(doneSets + 1, totalSets, seen);
    if (ms.seen.length !== seen.length) setSeen(ms.seen);
    const rushed = isRushed(doneSets + 1, seconds);
    const gap = lastAt ? (t - lastAt) / 1000 : null;
    const c = rushed ? combo : nextCombo(combo, gap, ex.cfg.rest);
    const nextRows = rows.map((r, i) => (i !== idx ? r : r.map((s, j) => (j === si ? { ...s, done: true, at: t, c } : s))));
    setRows(nextRows); setLastAt(t); setCombo(c); setBestCombo((b) => Math.max(b, c));
    buzz(30); ping("done");
    if (xp) { setPop({ ex: idx, si, xp, k: t }); setTimeout(() => setPop((p) => (p?.k === t ? null : p)), 1100); }
    if (isPr && !rushed) { setTimeout(() => ping("pr"), 180); buzz([40, 60, 40, 60, 120]); }
    if (lvUp) {
      setLevelUp({ idx: lvUp.idx, n: lvUp.n, k: t }); setTimeout(() => setLevelUp((l) => (l?.k === t ? null : l)), 1150);
      if (!isPr) { setTimeout(() => ping("pr"), 180); buzz([30, 50, 30, 50, 90]); }
    }
    const finishedEx = nextRows[idx].every((s) => s.done);
    if (finishedEx) { setFresh(idx); setTimeout(() => setFresh(null), 900); }
    const target = nextPending(nextRows, idx);
    if (!target) {
      // Última serie del día: directo al cierre (ahí se pregunta cómo se sintió)
      if (lvUp) setToast({ t: `Subiste a ${lvUp.n}`, kind: "level", idx: lvUp.idx });
      else if (isPr && !rushed) setToast({ t: `Récord en ${ex.name}`, kind: "pr" });
      speak(lvUp ? `${speechFor("done")} Subiste a ${lvUp.n}.` : speechFor("done"), true);
      announce(lvUp ? `Entreno completado. Subiste a ${lvUp.n}` : "Entreno completado");
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
    setToast(lvUp ? { t: `Logro: subiste a ${lvUp.n}`, kind: "level", idx: lvUp.idx } : null);
    // Motivación del descanso: meta de nivel, lo que vale terminar y un dato real que rota
    const after = { doneSets: doneSets + 1, totalSets: planTotal, doable: totalSets, prs: prs.length + (isPr && !rushed ? 1 : 0), seconds };
    const g = noXp ? null : levelGoal(gam.xp, after, gam.sex);
    const fin = noXp ? null : finishValue(after);
    const nextRow = nextRows[target.ex][target.si];
    const facts = restFacts({
      next: { name: tex.name, best: tex.best, reps: num(nextRow.reps), step: stepFor("kg", { unit: tex.cfg.unit, barbell: tex.barbell, cur: num(nextRow.kg) }), kg: !tex.bw && !tex.cfg.unit && num(nextRow.kg) > 0,
        last: isNew || target.si === 0 ? tex.lastSets : null },
      volToday: volumeWithHistory(nextRows, exercises.map((e) => !!e.lastSets?.length)), volLast: lastVolume(exercises.map((e) => e.lastSets)),
      doneSets: doneSets + 1, volTotal: volumeOf(nextRows), streak: gam.streak, todayDone: gam.todayDone, streakShown: !noXp,
    });
    const fact = pickFact(facts, restCount.current++);
    const finishLine = fin && fin.left > 0
      ? `Terminar completo vale +${fin.xp} XP${fin.bonus ? ` (bono de +${fin.bonus} incluido)` : ""} y tu racha ${gam.todayDone ? `de ${streakNext} ${streakNext === 1 ? "día" : "días"} ya está a salvo` : `sube a ${streakNext} ${streakNext === 1 ? "día" : "días"}`}.`
      : null;
    const msText = ms.show ? MILESTONES[ms.show].text : null;
    setRestInfo({
      levelUp: lvUp ? { idx: lvUp.idx, n: lvUp.n } : null, milestone: msText, fact, finish: finishLine,
      goal: g ? { idx: g.level.idx, progress: g.level.progress, text: levelGoalText(g, setWord) } : null,
      setNo: ex.cfg.unit === "s" ? null : si + 1, effort: null, hints, xp, xpKey: t, combo: c, pr: isPr && !rushed ? ex.name : null,
      rushed: rushed && !noXp, tip: tipCombo ? "combo" : tipXp ? "xp" : null,
      finished: finishedEx ? ex.name : null, bananas: { got: nextRows.filter((r) => r.every((s) => s.done)).length, total: nextRows.length },
      next: {
        title: isNew ? tex.name : `Serie ${target.si + 1} de ${nextRows[target.ex].length}`,
        detail: isNew ? `${nextRows[target.ex].length} series, ${targetText(nextRows[target.ex][target.si], { unit: tex.cfg.unit, bw: tex.bw, perSide: tex.cfg.perSide })}` : targetText(nextRows[target.ex][target.si], { unit: tex.cfg.unit, bw: tex.bw, perSide: tex.cfg.perSide }),
        anim: tex.tech?.anim || undefined, isNew, last: pendingLeft === 1,
      },
    });
    restTarget.current = { ex: idx, si };
    setRest({ end: t + ex.cfg.rest * 1000, total: ex.cfg.rest });
    setRestOpen(true);
    tickRef.current = null;
    // El hito se dice antes del descanso; la "última serie" la dice el coach al terminar el descanso.
    const msSay = ms.show && ms.show !== "last" ? `${MILESTONES[ms.show].say} ` : "";
    speak(`${lvUp ? `Subiste a ${lvUp.n}. ` : ""}${msSay}${speechFor("rest", { rest: ex.cfg.rest })}`, true);
    announce(`Serie ${si + 1} hecha${xp ? `, más ${xp} XP` : ""}.${lvUp ? ` Subiste a ${lvUp.n}.` : ""}${msText ? ` ${msText}.` : ""} Descanso de ${restLabel(ex.cfg.rest)}`);
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

  /** Modo exprés al salir: 1 serie por ejercicio sin empezar. El bono de completo sigue midiéndose contra el plan. */
  const express = useMemo(() => expressRows(rows), [rows]);
  function applyExpress() {
    if (!express) return;
    const saved = express.flat().filter((r) => !r.done).length;
    setPlan((p) => p ?? totalSets);
    setRows(express);
    const cs = comboState(express);
    setCombo(cs.combo); setLastAt(cs.lastAt); setBestCombo(cs.best);
    cancelRest(); setWork(null); setSheet(null);
    const t = nextPending(express, idx);
    if (!t) { toSummary(); return; }
    setIdx(t.ex); spokeFor.current = null;
    setToast({ t: `Modo exprés: ${saved === 1 ? "queda 1 serie" : `quedan ${saved} series`}`, kind: "express" });
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
    const res = advanceIntervals(iv, rows, idx, exercises.map((e) => ({ hi: e.cfg.hi, rest: e.cfg.rest, perSide: e.cfg.perSide })), Date.now());
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
      const side = res.iv.side ? SIDE_LABEL[res.iv.side] : null;
      speak(side ? `${res.iv.side === 1 ? `${name}. ` : ""}${side}. Ya.` : speechFor("work", { name }), true);
      announce(`Trabaja: ${name}${side ? `, ${side.toLowerCase()}` : ""}, ${res.iv.total} segundos`);
    } else if (res.iv.phase === "switch") {
      speak("Cambia de lado.", true);
      announce(`Cambia de lado: ${res.iv.total} segundos`);
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
    ? (iv.phase === "prep" || iv.phase === "rest" || iv.phase === "switch") && iv.paused == null ? { at: iv.end, t: iv.phase === "switch" ? "Cambia de lado" : "A trabajar", b: ivNextName } : { at: null, t: "", b: "" }
    : rest ? { at: rest.end, t: "Descanso terminado", b: ivNextName ? `Sigue: ${ivNextName}` : "Vuelve a Banana Burn para seguir" }
    : work && work.run.paused == null ? (() => {
      const nx = work.run.segs[work.run.i + 1];
      return { at: work.run.end, t: !nx ? "Serie terminada" : nx.kind === "switch" ? "Cambia de lado" : nx.side ? SIDE_LABEL[nx.side] : "A trabajar", b: !nx ? "Vuelve a Banana Burn para seguir" : nx.kind === "switch" ? "Sigue con el lado izquierdo" : "Vuelve a Banana Burn para seguir" };
    })() : { at: null, t: "", b: "" };
  useHiddenAlarm(phase === "play" ? alarm.at : null, alarm.t, alarm.b);

  /* ---------- Resumen y guardado ---------- */
  // Lo que cambia la próxima vez, con los mismos números que usará el motor (prescribe) con lo que se anotó hoy.
  const nextTime = useMemo(() => exercises.flatMap((e, i) => {
    if (e.id.startsWith("ds:") || e.cfg.unit) return [];
    const sets = rows[i].filter((s) => s.done).map((s) => ({ kg: s.kg ? num(s.kg) : null, reps: num(s.reps), rir: rirOf(s) }));
    if (!sets.length) return [];
    const line = nextTimeLine(prescribe(e.id, e.cfg, e.lastSets?.length ? [e.lastSets, sets] : [sets]), e.cfg.lo);
    return line ? [{ name: e.name, line }] : [];
  }).slice(0, 4), [exercises, rows]);
  const summary = useMemo(() => ({ vol: volumeOf(rows), ...(noXp ? { xp: 0, prs: 0, rushed: false } : liveXp({ doneSets, totalSets: planTotal, prs: prs.length, seconds: elapsed })) }), [rows, doneSets, planTotal, prs.length, elapsed, noXp]);
  const prNames = prs.map((p) => p.name);
  const outId = outboxId({ template, startedAt });
  const sending = useRef(false);
  const savedOnce = useRef(false);
  function onSaved(res: SaveResult) {
    if (!res.ok) { setQueued(false); setSaveMsg(res.error ?? "No pudimos guardar. Intenta de nuevo."); return; }
    if (savedOnce.current) return;
    savedOnce.current = true;
    setQueued(false);
    store.del(key);
    setSaved(res);
    setSaveMsg(res.demo ? "Modo demo: este entreno no se guardó en la nube." : null);
    setPhase("saved");
    learn("pp-entreno"); // Primeros pasos: primer entrenamiento hecho.
    buzz([60, 40, 60, 40, 200]);
    fetch("/api/coach/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(20_000), body: JSON.stringify({
      title, done: doneSets, total: planTotal, prs: res.prNames ?? prNames, volume: summary.vol,
      mins: Math.round(elapsed / 60), fun: fun ?? 0, easy: rows.flat().filter((r) => effortOf(r) === "f").length, streak: gam.todayDone ? gam.streak : gam.streak + 1,
    }) }).then((r) => r.json()).then((j) => setFeedback(j.text || null)).catch(() => setFeedback("Buen trabajo hoy. Cuando vuelva la conexión te dejo un análisis más fino."));
  }
  function save() {
    if (pending) return; // doble toque: el botón ya está guardando
    // Primero al teléfono (bandeja de salida), luego al servidor: si se cae la señal o se cierra la app, el entreno no se pierde.
    const item = queueWorkout({
      template, startedAt, finishedAt: new Date(endedAt ?? Date.now()).toISOString(), fun, total: planTotal, title, icon,
      exercises: exercises.map((e, i) => ({ id: e.id, sets: rows[i].filter((s) => s.done).map((s) => ({ kg: s.kg ? num(s.kg) : null, reps: num(s.reps), rir: rirOf(s) })) })).filter((e) => e.sets.length),
    }, key);
    setSaveMsg(null);
    sending.current = true;
    start(async () => {
      const res = await sendQueued(item).finally(() => { sending.current = false; });
      if (res === null) {
        setQueued(true);
        setSaveMsg(typeof navigator !== "undefined" && !navigator.onLine
          ? "Sin señal. Tu entreno quedó guardado en este teléfono y se sube solo cuando vuelva la conexión."
          : "No pudimos conectar. Tu entreno quedó guardado en este teléfono: lo intentamos de nuevo solo, o toca Reintentar.");
        return;
      }
      onSaved(res);
    });
  }
  // Si la sincronización global (al volver la señal) sube este entreno mientras sigues en el resumen, se celebra aquí.
  useEffect(() => {
    if (phase !== "summary") return;
    const h = (e: Event) => { const d = (e as CustomEvent<OutboxEvent>).detail; if (!sending.current && d?.id === outId && d.result) onSaved(d.result); };
    window.addEventListener(OUTBOX_EVENT, h);
    return () => window.removeEventListener(OUTBOX_EVENT, h);
  }); // sin dependencias a propósito: se vuelve a suscribir en cada render con el estado más reciente

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
    return <Recap next={nextTime} sex={gam.sex} title={title} icon={icon} xpBefore={gam.xp} xp={saved?.xp ?? summary.xp} rushed={summary.rushed} streak={gam.todayDone ? gam.streak : gam.streak + 1} seconds={elapsed}
      done={doneSets} total={planTotal} unit={setWord} volume={summary.vol} perWorkout={planTotal * SET_XP + FULL_BONUS} prs={summary.rushed ? [] : saved?.prNames ?? prNames} bananas={bananas} repeat={noXp || !!saved?.repeat} saveMsg={saveMsg} feedback={feedback} voice={voice} coach={coach} />;
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
            <p className="text-muted tabular-nums">{doneSets} de {totalSets} {setWord} en {clock(elapsed)}{plan ? ` (modo exprés, plan de ${plan})` : ""}</p>
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
                {doneSets < totalSets && <p className="mt-3 rounded-2xl bg-banana-soft/60 p-3 text-sm font-semibold text-banana-ink">Te faltan {totalSets - doneSets} {setWord}. Puedes terminar igual; {coach?.name ?? "Coach Banana"} lo toma en cuenta.</p>}
                {last && lastSet && (
                  <fieldset className="mt-3 card p-5">
                    <legend className="sr-only">Esfuerzo de la última serie</legend>
                    <p className="font-bold text-ink">¿Cómo se sintió la última serie?</p>
                    <p className="text-sm text-muted">{exercises[lastSet.ex].name}, {targetText(last, { unit: exercises[lastSet.ex].cfg.unit, bw: exercises[lastSet.ex].bw, perSide: exercises[lastSet.ex].cfg.perSide })}. Con esto ajusto el peso de la próxima vez.</p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {EFFORTS.map((e) => {
                        const on = effortOf(last) === e.id;
                        return (
                          <button key={e.id} type="button" onClick={() => setEffort(lastSet.ex, lastSet.si, e.id)} aria-pressed={on}
                            className={`pressable flex flex-col items-center justify-center gap-0.5 min-h-16 rounded-2xl px-1 text-center ${on ? "bg-ink text-white" : "bg-cream text-ink hover:bg-banana-soft"}`}>
                            <span className="inline-flex items-center gap-1 text-[15px] font-extrabold">{on && <Check weight="bold" className="size-4" />}{e.label}</span>
                            <span className={`text-[11px] font-semibold leading-tight ${on ? "text-white/75" : "text-muted"}`}>{hints[e.id]}</span>
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
          </div>
        </div>
        <footer className="px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-line bg-white/95">
          {empty ? (
            <div className="mx-auto flex max-w-md gap-2">
              <button onClick={leave} className="btn-ghost flex-1 h-16 text-base">Salir sin guardar</button>
              <button onClick={backToPlay} className="btn-banana flex-1 h-16 text-base font-extrabold">Volver al entreno</button>
            </div>
          ) : (
            <>
            {/* Junto al botón (no al final del resumen): quien toca Guardar ve de inmediato qué pasó. */}
            {saveMsg && <p role="alert" className={`mx-auto mb-2 max-w-md text-sm font-semibold text-pretty ${queued ? "text-ink" : "text-bad"}`}>{saveMsg}</p>}
            <button onClick={save} disabled={pending} aria-busy={pending} className="btn-banana mx-auto flex w-full max-w-md h-16 text-lg font-extrabold disabled:opacity-80">{pending ? "Guardando…" : queued ? "Reintentar ahora" : doneSets === totalSets ? "Guardar y celebrar" : "Guardar entreno"}</button>
            {queued && <Link href="/app" className="btn-ghost mx-auto mt-2 flex w-full max-w-md h-12">Salir: se sube solo al volver la señal</Link>}
            </>
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
        <IntervalScreen title={title} phase={iv.phase} side={iv.side} left={iv.phase === "ready" ? 0 : ivLeft} total={iv.total} paused={iv.paused != null} cur={cur} next={nextShown}
          plan={exercises.map((e, i) => ({ name: e.name, anim: e.tech?.anim || undefined, sets: rows[i].length, done: rows[i].filter((s) => s.done).length, perSide: !!e.cfg.perSide }))}
          done={doneSets} all={totalSets} elapsed={elapsed} workSec={exercises[0].cfg.hi} restSec={exercises[0].cfg.rest}
          onStart={() => { unlockAudio(); tickRef.current = null; setIv({ phase: "prep", end: Date.now() + 5000, total: 5, paused: null }); speak(`Prepárate. Empiezas con ${exercises[ivTarget?.ex ?? 0].name}.`, true); }}
          onPause={() => { setIv((v) => ({ ...v, paused: Math.max(0, v.end - Date.now()) })); hush(); announce("En pausa"); }}
          onResume={() => { tickRef.current = null; setIv((v) => ({ ...v, end: Date.now() + (v.paused ?? 0), paused: null })); }}
          onSkip={() => setIv((v) => (v.paused != null ? v : { ...v, end: Date.now() }))}
          onExit={() => { setIv((v) => (v.phase === "ready" || v.paused != null ? v : { ...v, paused: Math.max(0, v.end - Date.now()) })); setSheet("exit"); }}
          onFinish={() => toSummary()} />
        <p aria-live="polite" className="sr-only">{live}</p>
        <ExitSheet open={sheet === "exit"} onClose={() => setSheet(null)} doneSets={doneSets} totalSets={totalSets} unit={setWord} onFinish={() => toSummary()} goal={goal} />
      </>
    );
  }

  /* ---------- Reproductor ---------- */
  const [, badgeCls, BadgeIcon] = RX_BADGE[ex.rx.type];
  const badge = rxBadge(voice, ex.rx.type, ex.cfg.unit);
  const intro = introText ?? hookLine(hook, mins);
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
  const perSide = timed && !!ex.cfg.perSide;
  const sideWord = perSide ? " por lado" : "";
  const startTimed = () => {
    unlockAudio(); const n = num(here[activeSet].reps) || ex.cfg.hi;
    // La cuenta regresiva se pinta sobre el movimiento: se sube a la vista aunque la persona haya bajado.
    document.querySelector<HTMLElement>('[data-tour="tech"]')?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    setWork({ run: startTimed0(timedSegments(n, perSide, PREP_SECONDS), Date.now()), si: activeSet, ex: idx }); buzz(20);
    speak(perSide ? `${n} segundos por lado. Prepárate: empiezas con el ${SIDE_LABEL[1].toLowerCase()}.` : `${n} segundos. Prepárate.`, true);
    if (perSide) announce(`${n} segundos por lado. Empiezas con el ${SIDE_LABEL[1].toLowerCase()}`);
  };
  const timerCtl = {
    onPause: () => { setWork((w) => w && { ...w, run: pauseTimed(w.run, Date.now()) }); hush(); announce("En pausa"); },
    onResume: () => { setWork((w) => w && { ...w, run: resumeTimed(w.run, Date.now()) }); announce("Sigue"); },
    onSkip: () => setWork((w) => w && { ...w, run: skipTimed(w.run, Date.now()) }),
    onStop: () => { setWork(null); hush(); },
  };
  const loads = loadsFor(ex.load);
  const missingKg = needsLoad(ex) && activeSet >= 0 && num(here[activeSet].kg) <= 0;
  const chips = activeSet >= 0 && needsLoad(ex) && loads && (ex.rx.type === "cal" || missingKg) ? loads.chips : null;
  // Primer entreno: cada parte se explica en el momento, en frases cortas (lo que ve, qué tocar y qué pasa después).
  const tourSteps: TourStep[] = [
    { target: "tech", title: "Mira cómo se hace", body: "Aquí ves el movimiento en grande. Tócalo para verlo paso a paso antes de tu primera serie." },
    { target: "sets", title: "Tu meta en esta serie", body: needsLoad(ex) ? "Aquí ves el peso y cuántas repeticiones hacer. La primera vez, elige un peso con el que te queden 2 repeticiones de sobra." : "Aquí ves cuántas repeticiones o segundos hacer. Hazlas con buena técnica, sin apurarte." },
    timed
      ? { target: "done", title: "Empieza la serie", body: perSide ? "Toca Iniciar: cuenta 3 segundos para que te acomodes, el tiempo del lado derecho, 5 segundos para cambiar de lado y el del izquierdo. Al terminar se marca sola." : "Toca Iniciar: cuenta 3 segundos para que te acomodes y luego el tiempo de trabajo. Al terminar se marca sola." }
      : { target: "done", title: "Marca la serie", body: t(voice, { basico: "Haz las repeticiones y toca Terminé la serie. Si usaste otro peso, cámbialo antes con los botones + y −.", intermedio: "Haz las reps y toca Terminé la serie. Si levantaste otro peso, cámbialo antes con + y −.", tecnico: "Completa la serie y toca Terminé la serie. Ajusta antes la carga real si cambió." }) },
    { target: "rest", title: "Descansa", body: "Al marcar arranca el descanso con cuenta regresiva. Te avisamos con sonido y vibración cuando toca seguir." },
    { target: "swap", title: "¿Máquina ocupada?", body: "Toca Cambiar y elige otro ejercicio que trabaja lo mismo. Tus series se ajustan solas." },
    { target: "trail", title: "Tus ejercicios de hoy", body: "Aquí ves todos. Al terminar el último, te mostramos tu resumen y lo que cambia la próxima vez." },
  ];

  return (
    <Shell>
      <div className="contents" inert={!!rest && restOpen}>
      {/* Encabezado delgado: salir, qué entreno es, el tiempo total (secundario), sonido y avance. */}
      <header data-tour-anchor className="px-4 pt-[max(.5rem,env(safe-area-inset-top))] pb-1.5 bg-paper/95 backdrop-blur border-b border-line/60">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <button onClick={() => setSheet("exit")} className="tap pressable grid place-items-center size-12 shrink-0 rounded-full bg-white border border-line hover:bg-cream" aria-label="Salir del entreno"><X weight="bold" className="size-5" /></button>
          <div className="flex-1 min-w-0 text-center">
            <p className="flex items-center justify-center gap-1.5 text-[15px] leading-tight font-extrabold text-ink min-w-0"><BrandIcon name={icon} className="size-5 shrink-0 text-banana-ink" /><span className="truncate">{title}</span></p>
            <p className="flex items-center justify-center gap-3 text-sm font-semibold text-muted tabular-nums">
              <span className="inline-flex items-center gap-1"><Timer weight="bold" className="size-4" aria-hidden /><span className="sr-only">Tiempo total </span>{clock(elapsed)}</span>
              {sessMode === "suave" && <span className="text-sky">Modo suave</span>}
              {!online && <span role="status" className="inline-flex items-center gap-1 whitespace-nowrap text-ink"><WifiSlash weight="bold" className="size-4" aria-hidden />Sin señal<span className="sr-only">: puedes seguir, guardamos todo en este teléfono</span></span>}
            </p>
          </div>
          <button onClick={() => setSheet("sound")} className="tap pressable grid place-items-center size-12 shrink-0 rounded-full bg-white border border-line hover:bg-cream" aria-label={`Sonido y voz: ${prefs.voice ? "coach de voz encendido" : prefs.sound ? "pitidos encendidos" : "silencio"}`}>
            {prefs.sound || prefs.voice ? <SpeakerHigh weight={prefs.voice ? "fill" : "bold"} className="size-5" /> : <SpeakerSlash weight="bold" className="size-5" />}
          </button>
          <SessionRing value={doneSets / Math.max(1, totalSets)} />
        </div>
        <div className="mx-auto mt-1.5 max-w-xl land:hidden">
          <div data-tour="trail"><BananaTrail items={exercises.map((e, i) => ({ name: e.name, done: rows[i].filter((s) => s.done).length, total: rows[i].length }))} current={idx} fresh={fresh} onPick={(i) => { setIdx(i); setWork(null); }} /></div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overflow-x-hidden" role="region" aria-label="Ejercicio y series">
        <div className={`mx-auto max-w-xl land:max-w-4xl px-4 pt-3 ${rest && !restOpen ? "pb-28" : "pb-6"}`}>
          {/* Lo primero que se ve: el movimiento en grande y el nombre del ejercicio. En horizontal, lado a lado. */}
          <div className="land:grid land:grid-cols-2 land:items-start land:gap-4">
          <section key={ex.id} className="animate-enter">
            <button data-tour="tech" onClick={() => setSheet("tech")} className={`pressable relative block w-full h-[clamp(190px,36dvh,440px)] [@media(min-height:800px)]:h-[clamp(200px,42dvh,480px)] land:h-[54dvh]! rounded-[2rem] overflow-hidden ${ex.art ? "bg-[#F3E8FF]" : "bg-banana"}`}>
              <span aria-hidden className="contents">{(() => {
                const still = ex.tech?.anim ? <ExerciseMotion anim={ex.tech.anim} label={false} className="absolute inset-x-4 top-4 bottom-14" /> : <Barbell weight="duotone" className="absolute inset-0 m-auto size-24 text-ink/80" />;
                return ex.art ? <CoachArtFill src={ex.art} sizes="(min-width: 640px) 576px, 100vw" className="object-contain pb-12" fallback={still} /> : still;
              })()}</span>
              <span aria-hidden className="absolute top-3 left-3 inline-flex items-center h-8 px-3 rounded-full bg-white/90 text-sm font-bold text-ink tabular-nums">Ejercicio {idx + 1} de {exercises.length}</span>
              {!(timerOn && tp) && <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-ink text-white text-sm font-bold"><Eye weight="bold" className="size-4" aria-hidden />Ver cómo se hace<span className="sr-only"> {ex.name}</span></span>}
              {timerOn && tp && <span className="sr-only">Ver cómo se hace {ex.name}</span>}
              {/* Serie por tiempo en marcha: la cuenta regresiva es lo más grande de la pantalla (encima del movimiento). */}
              {timerOn && tp && (
                <span aria-hidden className={`absolute inset-x-0 bottom-0 flex items-end gap-3 p-4 pt-16 text-left ${tp.seg.kind === "switch" ? "bg-ink/85" : "bg-gradient-to-t from-ink/85 via-ink/55 to-transparent"} text-white`}>
                  <span className="text-[96px] leading-[.85] font-extrabold tracking-tight tabular-nums">{Math.ceil(tp.left)}</span>
                  <span className="pb-2 text-lg font-extrabold leading-tight">{tp.paused ? "En pausa" : segLabel(tp.seg)}</span>
                </span>
              )}
            </button>
          </section>

          <div className="land:pt-1">
            <h1 className="mt-3 land:mt-0 text-[clamp(28px,8.4vw,34px)] leading-[1.1] font-extrabold tracking-tight text-ink line-clamp-2 text-balance">{ex.name}</h1>
            {ex.tech?.cues[0] && <p className="mt-1 text-[17px] leading-snug font-semibold text-body text-pretty">{cap(ex.tech.cues[0])}</p>}

            <div data-tour="sets" className="mt-4">
            {focus && activeSet >= 0 ? (
              <FocusSet rows={here} active={activeSet} bw={ex.bw} noBallast={!ballast} unit={ex.cfg.unit} perSide={perSide} restSec={ex.cfg.rest} plates={plates} prev={ex.lastSets?.[activeSet]}
                chips={chips} onPickKg={pickKg} onStep={step} onChange={change} onCopy={copy} onUndo={undo} />
            ) : focus ? (
              <div className="space-y-2">
                {here.map((x, si) => <DoneRow key={si} si={si} row={x} unit={ex.cfg.unit} perSide={perSide} bw={ex.bw} onUndo={undo} />)}
              </div>
            ) : (
              <ListSets rows={here} active={activeSet} bw={ex.bw} noBallast={!ballast} unit={ex.cfg.unit} unitLabel={`${unit}${sideWord}`} plates={plates} last={here.map((_, si) => ex.lastSets?.[si])} needsKg={needsLoad(ex)}
                pop={pop && pop.ex === idx ? pop : null} onStep={step} onChange={change} onToggle={toggle} onEffort={(si, e) => setEffort(idx, si, e)}
                timedSlot={timed && !rest ? (
                  <div className="px-3 pb-3">
                    {timerOn && tp ? (
                      <TimedBar view={tp} size="sm" {...timerCtl} />
                    ) : (
                      <button onClick={startTimed} className="pressable w-full h-12 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-peel text-white font-extrabold"><Play weight="fill" className="size-4" />Iniciar {num(here[activeSet]?.reps) || ex.cfg.hi} s{sideWord}</button>
                    )}
                  </div>
                ) : undefined} />
            )}
          </div>

          {/* Calentamiento: debajo de la meta de la serie, para que lo primero siga siendo qué hacer. */}
          {warm && (
            <div className="mt-3 flex items-center gap-3 rounded-[1.5rem] bg-banana-soft/70 p-3">
              <Monkey className="size-7 shrink-0 text-banana-ink" />
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-ink">Calienta primero</p>
                <p className="text-sm text-body">{warmupText(warm, ex.barbell)} No se anotan.</p>
              </div>
              <button onClick={() => setWarmDone(true)} className="tap pressable shrink-0 h-12 px-4 rounded-full bg-ink text-white text-sm font-bold">Ya calenté</button>
            </div>
          )}

          {/* Lo secundario a un toque: cambiar el ejercicio o ver más opciones. */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {alts > 0 && <button data-tour="swap" onClick={() => { setSwapAsk(null); setSheet("swap"); }} className="chip justify-center h-12 px-3 bg-white border border-line text-ink text-[15px]"><ArrowsLeftRight weight="bold" className="size-5" />Cambiar<span className="sr-only"> ejercicio</span></button>}
            <button onClick={() => setMore((m) => !m)} aria-expanded={more} aria-controls="mas-opciones" className={`chip justify-center h-12 px-3 bg-white border border-line text-ink text-[15px] ${alts > 0 ? "" : "col-span-2"}`}>
              <DotsThree weight="bold" className="size-5" />Más opciones<CaretDown weight="bold" className={`size-4 transition-transform duration-(--dur-base) ease-out ${more ? "rotate-180" : ""}`} />
            </button>
          </div>

          {more && (
            <div id="mas-opciones" className="mt-3 space-y-3 rounded-[1.5rem] bg-white border border-line/70 p-4 animate-enter">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted">
                <span>{cap(ex.muscle.toLowerCase())}</span>
                <span className={`inline-flex items-center gap-1 rounded-full bg-cream px-2.5 h-7 text-[13px] font-bold ${badgeCls}`}><BadgeIcon weight="bold" className="size-3.5" />{badge}</span>
                {noXp ? <span className="inline-flex items-center gap-1"><Repeat weight="bold" className="size-4" aria-hidden />Sin XP</span> : <span className="inline-flex items-center gap-1 tabular-nums"><BananaCoin className="size-4 text-banana-ink" />{xpNow.xp} XP hoy</span>}
                {combo >= 2 && <span className="inline-flex items-center gap-1 text-ember-ink"><Lightning weight="fill" className="size-4" aria-hidden />Combo x{combo}</span>}
              </p>
              <p className="text-[15px] leading-snug text-body">{ex.rx.note}</p>
              {doneSets === 0 && intro && (
                <div className="flex items-center gap-3 rounded-[1.25rem] bg-ink p-3 pr-4 text-white">
                  {coach ? <CoachPic src={coach.avatar} size={44} className="size-11 shrink-0 rounded-xl object-cover" />
                    : <span aria-hidden className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-banana">
                      <Image src="/brand/mascota-sola.webp" alt="" fill sizes="128px" className="object-cover origin-[52%_4%] scale-[2.5]" />
                    </span>}
                  <p className="min-w-0"><span className="block text-[11px] font-extrabold uppercase tracking-[.12em] text-banana">{coach?.name ?? "Coach Banana"}</span><span className="block text-sm font-bold leading-snug text-pretty">{intro}</span></p>
                </div>
              )}
              {doneSets === 0 && !noXp && (() => {
                const fin = finishValue(xpState(0, 0));
                return (
                  <p className="flex items-start gap-2.5 text-sm text-body">
                    <BananaFlame weight="duotone" className="size-5 shrink-0 text-ember-ink" />
                    <span>Completo, este entreno vale <span className="font-extrabold text-ink tabular-nums">+{fin.xp} XP</span> (bono de +{fin.bonus} por terminarlo) y {gam.todayDone ? `tu racha de ${streakNext} ${streakNext === 1 ? "día" : "días"} ya está a salvo hoy` : `lleva tu racha a ${streakNext} ${streakNext === 1 ? "día" : "días"}`}.</span>
                  </p>
                );
              })()}
              {goal && <LevelMeter idx={goal.level.idx} progress={goal.level.progress} text={levelGoalText(goal, setWord)} className="px-1" />}
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-muted">Cómo ver las series</span>
                <div role="radiogroup" aria-label="Vista" className="inline-flex rounded-full bg-cream border border-line p-0.5">
                  {(["focus", "list"] as const).map((v) => (
                    <button key={v} role="radio" aria-checked={prefs.view === v} onClick={() => setPrefs({ view: v })} className={`tap pressable h-11 px-4 whitespace-nowrap rounded-full text-sm font-bold ${prefs.view === v ? "bg-ink text-white" : "text-muted hover:text-ink"}`}>{v === "focus" ? "Una a la vez" : "Todas"}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          </div>
          </div>
          {!focus && <p className="mt-3 text-center text-xs text-muted">{strengthCue(voice, { rest: ex.cfg.rest, unit: ex.cfg.unit })}</p>}
          {focus && !ex.cfg.unit && <p className="mt-3 text-center text-xs text-muted">{strengthCue(voice)}</p>}
          {nextEx === null && cardio && <p className="mt-3 card p-4 flex items-center gap-2.5 text-sm font-semibold text-ink"><PersonSimpleWalk weight="duotone" className="size-5 shrink-0 text-banana-ink" />Al final: {cardio}</p>}
        </div>
      </div>

      <footer className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-xl">
          {focus && activeSet >= 0 ? (
            timed ? (
              timerOn && tp ? (
                <TimedBar view={tp} {...timerCtl} />
              ) : (
                <button data-tour="done" onClick={startTimed} disabled={missingKg} className="pressable w-full h-[72px] land:h-14 inline-flex items-center justify-center gap-2 rounded-[1.75rem] bg-banana text-ink text-xl font-extrabold shadow-[0_6px_16px_-8px_rgb(138_98_0/.5)] disabled:bg-line disabled:text-muted disabled:shadow-none"><Play weight="fill" className="size-6" />{missingKg ? "Elige un peso" : `Iniciar ${num(here[activeSet]?.reps) || ex.cfg.hi} s${sideWord}`}</button>
              )
            ) : (
              <button data-tour="done" onClick={() => complete(activeSet)} disabled={missingKg} className="relative pressable w-full h-[72px] land:h-14 inline-flex items-center justify-center gap-2.5 rounded-[1.75rem] bg-banana text-ink text-xl font-extrabold shadow-[0_6px_16px_-8px_rgb(138_98_0/.5)] hover:brightness-95 disabled:bg-line disabled:text-muted disabled:shadow-none disabled:hover:brightness-100" aria-describedby="serie-actual">
                {pop && pop.ex === idx && <XpPop k={pop.k} xp={pop.xp} />}
                {missingKg ? "Elige un peso para marcar" : <><Check weight="bold" className="size-7" />Terminé la serie</>}
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
          minimizeLabel={ex.bw && !ex.load ? "Ajustar la serie" : "Ajustar pesos"}
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
              {(() => {
                const motion = ex.tech.anim ? <div className="rounded-[1.5rem] bg-banana/90 px-4 pt-6 pb-2"><ExerciseMotion anim={ex.tech.anim} mus={ex.tech.mus} cues={ex.tech.cues.length ? ex.tech.cues : undefined} className="mx-auto h-64 sm:h-80 max-w-[360px]" /></div> : null;
                return ex.art ? <CoachArtFill src={ex.art} alt={`Así se hace: ${ex.name}`} sizes="360px" className="object-contain" fallback={motion} wrap="mx-auto aspect-square w-full max-w-[360px] overflow-hidden rounded-[1.5rem] bg-[#F3E8FF]" />
                  : motion;
              })()}
              <SheetTitle className="text-2xl font-extrabold text-ink">{ex.name}</SheetTitle>
              {ex.tech.mus && <p className="text-sm text-muted">{ex.tech.mus}</p>}
              {ex.tech.how.length > 0 && <ol className="space-y-2">{ex.tech.how.map((h, i) => <li key={i} className="flex gap-2.5"><span className="grid place-items-center size-6 shrink-0 rounded-full bg-banana text-xs font-bold text-ink">{i + 1}</span><span>{h}</span></li>)}</ol>}
              {ex.tech.cues.length > 0 && <div className="flex flex-wrap gap-2">{ex.tech.cues.map((c) => <span key={c} className="chip bg-peel/10 text-peel"><Check weight="bold" className="size-3.5" />{c}</span>)}</div>}
              {ex.tech.err.length > 0 && <div className="space-y-1">{ex.tech.err.map((c) => <p key={c} className="flex gap-1.5 text-sm text-ember-ink"><X weight="bold" className="mt-0.5 size-4 shrink-0" />{c}</p>)}</div>}
              {ex.tech.mono && <p className="flex gap-2.5 rounded-2xl bg-white p-3 text-sm"><Monkey className="size-6 shrink-0 text-banana-ink" /><span><RichTip text={coach ? ex.tech.mono.replaceAll("Coach Banana", coach.name) : ex.tech.mono} /></span></p>}
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
      <ExitSheet open={sheet === "exit"} onClose={() => setSheet(null)} doneSets={doneSets} totalSets={totalSets} unit={setWord} onFinish={finishNow} goal={goal}
        bonus={!noXp && !plan ? FULL_BONUS : 0} onExpress={express ? applyExpress : undefined} />

      {/* El aviso flotante nunca tapa el descanso (ahí está la pregunta de esfuerzo) ni una hoja abierta */}
      <Toast side="top">{toast && !(rest && restOpen) && !sheet && <>{toast.kind === "pr" ? <BananaTrophy weight="fill" className="size-5 shrink-0 text-banana" /> : toast.kind === "level" ? <LevelIcon idx={toast.idx ?? 1} className="size-5 shrink-0 text-banana!" /> : toast.kind === "express" ? <Lightning weight="fill" className="size-5 shrink-0 text-banana" /> : <ArrowsLeftRight weight="bold" className="size-5 shrink-0 text-banana" />}{toast.t}</>}</Toast>
      {levelUp && <LevelUpBurst idx={levelUp.idx} name={levelUp.n} k={levelUp.k} />}
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

/**
 * Salir a medias: muestra lo que queda en la mesa sin culpa, con seguir como acción principal.
 * "Salir sin guardar" no borra nada: lo hecho queda en el teléfono por hoy, por si vuelves.
 */
function ExitSheet({ open, onClose, doneSets, totalSets, unit, onFinish, goal, bonus = 0, onExpress }: {
  open: boolean; onClose: () => void; doneSets: number; totalSets: number; unit: string; onFinish: () => void;
  goal?: LevelGoal | null; bonus?: number; onExpress?: () => void;
}) {
  const left = Math.max(0, totalSets - doneSets);
  const one = unit === "series" ? "serie" : "intervalo";
  const word = (n: number) => (n === 1 ? one : unit);
  const levelUp = goal?.level.next && goal.sets != null && goal.sets <= left ? goal.level.next.n : null;
  // Lo concreto que falta: el bono, el nivel o ambos
  const table = left > 0 && (bonus > 0 || levelUp)
    ? `Te ${left === 1 ? "falta" : "faltan"} ${left} ${word(left)} para ${[bonus > 0 ? `el bono de +${bonus} XP` : "", levelUp ? `subir a ${levelUp}` : ""].filter(Boolean).join(" y ")}.`
    : null;
  const keep = goal?.sets != null && goal.sets < left && goal.sets <= 4 ? goal.sets : left > 0 && left <= 4 ? left : null;
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-5 space-y-3">
        <SheetTitle className="text-2xl font-extrabold text-ink">¿Salir del entreno?</SheetTitle>
        <p className="text-body">Llevas {doneSets} de {totalSets} {unit}.{table ? ` ${table}` : ""}{doneSets > 0 ? " Lo que hiciste ya cuenta para tu racha." : ""}</p>
        {keep != null && levelUp && keep < left && <p className="flex items-center gap-2 rounded-2xl bg-banana-soft/70 p-3 text-sm font-semibold text-banana-ink"><LevelIcon idx={goal!.level.idx + 1} className="size-5 shrink-0" />Con {keep} {word(keep)} más subes a {levelUp}.</p>}
        <button onClick={onClose} data-autofocus className="btn-primary w-full h-13">{keep != null ? `Seguir ${keep} ${word(keep)} más` : "Seguir entrenando"}</button>
        {doneSets > 0 && <button onClick={onFinish} className="btn-ghost w-full h-13">Guardar lo que hice</button>}
        {onExpress && (
          <button onClick={onExpress} className="pressable w-full flex items-center gap-3 rounded-2xl bg-white border border-line p-3.5 text-left hover:border-ink/40">
            <Lightning weight="duotone" className="size-6 shrink-0 text-ember-ink" />
            <span className="min-w-0"><span className="block font-bold text-ink">Modo exprés</span><span className="block text-sm text-muted">¿Sin tiempo? Termina ahora con 1 serie por ejercicio que falta. Cada serie suma igual{bonus > 0 ? ", sin el bono de completo" : ""}.</span></span>
          </button>
        )}
        <Link href="/app" className="btn w-full h-13 text-muted">Salir sin guardar</Link>
        {doneSets > 0 && <p className="-mt-1 text-center text-xs text-muted">Lo que llevas queda en este teléfono por hoy, por si vuelves.</p>}
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
