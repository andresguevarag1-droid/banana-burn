"use client";
// Panel de la sesión guiada y del modo carrera dentro del tracker: tramo actual en grande, cuánto falta, ritmo objetivo
// contra el actual (con texto, nunca solo color), y la voz en español (Web Speech) con vibración opcional.
import { useCallback, useEffect, useRef, useState } from "react";
import { SpeakerHigh, SpeakerSlash } from "@/components/icons";
import { fmtDuration, fmtPace } from "@/lib/runs";
import { GUIDE_START, PACE_TEXT, advance, kmCue, paceCheck, paceCue, remaining, stepCue, type Guide, type GuideState } from "@/lib/run-guide";

const VOICE_KEY = "bb.correr.voz";
export function readVoicePref(): boolean { try { return localStorage.getItem(VOICE_KEY) !== "0"; } catch { return true; } }

/** Voz: español, una frase a la vez (la nueva corta la anterior si es un cambio de tramo). */
export function useVoice() {
  const [on, setOn] = useState(true);
  useEffect(() => { setOn(readVoicePref()); }, []);
  const voice = useRef<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const pick = () => { const vs = speechSynthesis.getVoices(); voice.current = vs.find((v) => /^es[-_](419|MX|US|CR|CO)/i.test(v.lang)) ?? vs.find((v) => /^es/i.test(v.lang)) ?? null; };
    pick();
    speechSynthesis.addEventListener?.("voiceschanged", pick);
    return () => speechSynthesis.removeEventListener?.("voiceschanged", pick);
  }, []);
  const say = useCallback((text: string, urgent = false) => {
    if (!on || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      if (urgent) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = voice.current?.lang ?? "es-419";
      if (voice.current) u.voice = voice.current;
      u.rate = 1.02;
      speechSynthesis.speak(u);
    } catch { /* sin voz en este navegador */ }
  }, [on]);
  const toggle = useCallback(() => setOn((x) => { try { localStorage.setItem(VOICE_KEY, x ? "0" : "1"); } catch {} return !x; }), []);
  return { on, say, toggle };
}

const buzz = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch {} };

export function GuidePanel({ guide, distM, timeS, pace, splits, active, say, voiceOn, toggleVoice }: {
  guide: Guide; distM: number; timeS: number; pace: number | null; splits: number[]; active: boolean;
  say: (t: string, urgent?: boolean) => void; voiceOn: boolean; toggleVoice: () => void;
}) {
  const [st, setSt] = useState<GuideState>(GUIDE_START);
  const announced = useRef(-1), kmSaid = useRef(0), lastPaceCue = useRef(0);
  // Primer tramo al empezar.
  useEffect(() => { if (active && announced.current < 0) { announced.current = 0; say(stepCue(guide.steps[0]), true); } }, [active, guide, say]);
  // Cambio de tramo.
  useEffect(() => {
    if (!active) return;
    const r = advance(guide.steps, st, distM, timeS);
    if (r.changed) {
      setSt(r.state);
      if (announced.current !== r.state.idx) { announced.current = r.state.idx; say(stepCue(r.state.done ? undefined : guide.steps[r.state.idx]), true); buzz([200, 100, 200]); }
    }
  }, [distM, timeS, active, guide, st, say]);
  // Cada km.
  useEffect(() => {
    if (!active || splits.length <= kmSaid.current) return;
    kmSaid.current = splits.length;
    const total = splits.reduce((a, b) => a + b, 0);
    say(kmCue(splits.length, splits[splits.length - 1], total, guide.race?.band));
    buzz(150);
  }, [splits, active, guide, say]);
  const step = st.done ? undefined : guide.steps[st.idx];
  const check = step?.kind === "trabajo" || step?.kind === "continuo" ? paceCheck(pace, step.paceS) : null;
  // Aviso de ritmo cada 60 s como mucho, solo en tramos de trabajo.
  useEffect(() => {
    if (!active || step?.kind !== "trabajo" || timeS - lastPaceCue.current < 60 || timeS - st.startTime < 20) return;
    const c = paceCue(check);
    if (c) { lastPaceCue.current = timeS; say(c); }
  }, [check, timeS, active, step, st.startTime, say]);
  const left = remaining(step, st, distM, timeS);
  const next = guide.steps[st.idx + 1];
  const row = guide.race?.band.find((r) => r.km > distM / 1000);
  const diff = guide.race && splits.length ? Math.round(splits.reduce((a, b) => a + b, 0) - (guide.race.band[splits.length - 1]?.cumS ?? 0)) : null;
  const tone = check === "en_ritmo" ? "bg-peel text-white" : check ? "bg-[var(--run)] text-white" : "bg-paper text-ink";
  return (
    <section className="card overflow-hidden" aria-label={`Sesión guiada: ${guide.title}`}>
      <div className="flex h-2 gap-0.5 bg-line" aria-hidden>{guide.steps.map((s, i) => <span key={i} className={`h-full flex-1 ${i < st.idx || st.done ? "bg-ink" : i === st.idx ? "bg-[var(--run)]" : "bg-transparent"}`} />)}</div>
      <div className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-muted">{guide.race ? "Modo carrera" : guide.title}{st.done ? "" : `. Tramo ${st.idx + 1} de ${guide.steps.length}`}</p>
          <button type="button" onClick={toggleVoice} aria-pressed={voiceOn} className="pressable -mt-1 inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-paper px-3 py-1.5 text-xs font-bold text-ink">
            {voiceOn ? <SpeakerHigh weight="duotone" className="size-4" /> : <SpeakerSlash weight="duotone" className="size-4" />}{voiceOn ? "Voz" : "Sin voz"}
          </button>
        </div>
        {step ? (
          <>
            <p className="text-3xl font-extrabold leading-tight text-ink" aria-live="polite">{step.label}</p>
            <p className="text-6xl font-extrabold tabular-nums tracking-tight text-ink">{left.m != null ? <>{left.m}<span className="ml-1 text-2xl text-muted">m</span></> : left.s != null ? fmtDuration(left.s) : ""}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-paper p-3"><p className="text-xs font-bold text-muted">Ritmo objetivo</p><p className="text-2xl font-extrabold tabular-nums text-ink">{step.paceS ? `${fmtPace(step.paceS)}` : "Suave"}</p></div>
              <div className={`rounded-2xl p-3 ${tone}`}><p className="text-xs font-bold opacity-80">Tu ritmo</p><p className="text-2xl font-extrabold tabular-nums">{fmtPace(pace)}</p>{check && <p className="text-xs font-bold">{PACE_TEXT[check]}</p>}</div>
            </div>
            {guide.race && row ? <p className="text-sm font-semibold text-ink">Km {Math.ceil(row.km)}: pasa en {fmtDuration(row.cumS)}{diff != null ? `. Vas ${Math.abs(diff) < 5 ? "justo en tu plan" : diff < 0 ? `${-diff} s adelante` : `${diff} s atrás`}` : ""}</p> : next ? <p className="text-sm text-body">Después: {next.label}</p> : null}
          </>
        ) : <p className="text-2xl font-extrabold text-ink">Sesión completa. Camina un poco y toca Terminar.</p>}
      </div>
    </section>
  );
}
