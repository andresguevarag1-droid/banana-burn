"use client";
// "Mi carrera objetivo": distancia, fecha, meta (terminarla o un tiempo), un resultado reciente para medir tu forma y si
// ya sigues tu propio plan de carrera. Guarda en /api/correr/objetivo.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch, Trash } from "@/components/icons";
import { RACE_KINDS, RACE_LABEL, RECENT_OPTIONS, fmtTime, type RaceKind } from "@/lib/run-fitness";
import { DOW_LONG, DOW_SHORT } from "@/lib/seasons";

export type GoalInitial = { name: string | null; raceDate: string; kind: RaceKind; distanceM: number; goalS: number | null; recentDistanceM: number | null; recentS: number | null; ownPlan: boolean; hardDays: number[] } | null;

const chip = (on: boolean) => `pressable min-h-12 px-4 rounded-2xl border-2 font-bold text-sm ${on ? "border-ink bg-banana text-ink" : "border-line bg-white text-muted"}`;

export function RaceGoalForm({ initial, today }: { initial: GoalInitial; today: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<RaceKind>(initial?.kind ?? "10k");
  const [trailKm, setTrailKm] = useState(initial?.kind === "trail" ? String(initial.distanceM / 1000) : "");
  const [raceDate, setRaceDate] = useState(initial?.raceDate ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [hasGoal, setHasGoal] = useState(!!initial?.goalS);
  const [goal, setGoal] = useState(initial?.goalS ? fmtTime(initial.goalS) : "");
  const [recentDist, setRecentDist] = useState<string>(RECENT_OPTIONS.find((r) => r.m === initial?.recentDistanceM)?.id ?? "");
  const [recentTime, setRecentTime] = useState(initial?.recentS ? fmtTime(initial.recentS) : "");
  const [ownPlan, setOwnPlan] = useState(initial?.ownPlan ?? false);
  const [hardDays, setHardDays] = useState<number[]>(initial?.hardDays ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = new Date(Date.parse(today + "T12:00:00Z") + 365 * 864e5).toISOString().slice(0, 10);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await fetch("/api/correr/objetivo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, trailKm, raceDate, name, goal: hasGoal ? goal : "terminar", recentDist: recentDist || null, recentTime: recentDist ? recentTime : null, ownPlan, hardDays }) }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (!res?.ok) { setError(j?.error ?? "No pudimos guardar tu carrera. Revisa tu conexión."); setBusy(false); return; }
    router.push("/app/correr");
    router.refresh();
  };
  const remove = async () => {
    setBusy(true);
    await fetch("/api/correr/objetivo", { method: "DELETE" }).catch(() => null);
    router.push("/app/correr");
    router.refresh();
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="text-lg font-extrabold text-ink">Distancia</legend>
        <div role="radiogroup" aria-label="Distancia" className="flex flex-wrap gap-2">
          {RACE_KINDS.map((k) => <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={chip(kind === k)}>{RACE_LABEL[k]}</button>)}
        </div>
        {kind === "trail" && <label className="block space-y-1"><span className="text-sm font-bold text-ink">Km del trail</span><input className="input" inputMode="decimal" value={trailKm} onChange={(e) => setTrailKm(e.target.value)} placeholder="25" required /></label>}
      </fieldset>
      <label className="block space-y-1"><span className="text-lg font-extrabold text-ink">Fecha</span><input type="date" className="input" min={today} max={max} value={raceDate} onChange={(e) => setRaceDate(e.target.value)} required /></label>
      <label className="block space-y-1"><span className="text-lg font-extrabold text-ink">Nombre <span className="text-sm font-semibold text-muted">(opcional)</span></span><input className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Mi primer 10K" /></label>
      <fieldset className="space-y-2">
        <legend className="text-lg font-extrabold text-ink">Tu meta</legend>
        <div role="radiogroup" aria-label="Tu meta" className="grid grid-cols-2 gap-2">
          <button type="button" role="radio" aria-checked={!hasGoal} onClick={() => setHasGoal(false)} className={chip(!hasGoal)}>Terminarla bien</button>
          <button type="button" role="radio" aria-checked={hasGoal} onClick={() => setHasGoal(true)} className={chip(hasGoal)}>Un tiempo</button>
        </div>
        {hasGoal && <label className="block space-y-1"><span className="text-sm font-bold text-ink">Tiempo meta</span><input className="input" inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={kind === "21k" || kind === "42k" ? "1:59:00" : "55:00"} required aria-describedby="goal-hint" /><span id="goal-hint" className="block text-xs text-muted">Como 55:00 o 1:59:00. Te decimos si es realista para el tiempo que queda.</span></label>}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-lg font-extrabold text-ink">Un resultado reciente <span className="text-sm font-semibold text-muted">(opcional)</span></legend>
        <p className="text-sm text-body">De los últimos 3 meses. Con él calculamos tus ritmos. Si no tienes, usamos tus carreras con GPS.</p>
        <div role="radiogroup" aria-label="Distancia del resultado reciente" className="flex flex-wrap gap-2">
          <button type="button" role="radio" aria-checked={!recentDist} onClick={() => setRecentDist("")} className={chip(!recentDist)}>No tengo</button>
          {RECENT_OPTIONS.map((r) => <button key={r.id} type="button" role="radio" aria-checked={recentDist === r.id} onClick={() => setRecentDist(r.id)} className={chip(recentDist === r.id)}>{r.label}</button>)}
        </div>
        {recentDist && <label className="block space-y-1"><span className="text-sm font-bold text-ink">Tu tiempo</span><input className="input" inputMode="numeric" value={recentTime} onChange={(e) => setRecentTime(e.target.value)} placeholder="26:30" required /></label>}
      </fieldset>
      <fieldset className="space-y-3 rounded-3xl border border-line bg-white p-4">
        <label className="flex items-start gap-3"><input type="checkbox" checked={ownPlan} onChange={(e) => setOwnPlan(e.target.checked)} className="mt-1 size-5 accent-ink" /><span><span className="block font-extrabold text-ink">Ya tengo plan de carrera</span><span className="block text-sm text-body">De tu club o tu entrenador. Banana Burn solo arma tu fuerza, movilidad y técnica alrededor de tus días, sin chocar.</span></span></label>
        {ownPlan && (
          <div className="space-y-1">
            <p className="text-sm font-bold text-ink">¿Qué días haces series o tempo?</p>
            <div role="group" aria-label="Días de series o tempo" className="grid grid-cols-7 gap-1.5">
              {DOW_SHORT.map((d, i) => <button key={d} type="button" aria-pressed={hardDays.includes(i)} aria-label={DOW_LONG[i]} onClick={() => setHardDays((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i].sort()))} className={`pressable h-12 rounded-2xl border-2 text-sm font-extrabold ${hardDays.includes(i) ? "border-ink bg-banana text-ink" : "border-line bg-white text-muted"}`}>{d}</button>)}
            </div>
          </div>
        )}
      </fieldset>
      {error && <p role="alert" className="rounded-2xl bg-bad/10 p-3 text-sm font-semibold text-bad">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary h-14 w-full text-base">{busy ? <CircleNotch weight="bold" className="size-5 animate-spin" /> : null}Guardar mi carrera</button>
      {initial && <button type="button" onClick={() => void remove()} disabled={busy} className="btn-ghost h-12 w-full"><Trash weight="duotone" className="size-5" />Ya no tengo esta carrera</button>}
    </form>
  );
}
