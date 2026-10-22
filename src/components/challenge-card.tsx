"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BrandIcon, Check, CircleNotch, PushPin, WarningCircle } from "@/components/icons";
import { checkInChallenge, joinChallenge, leaveChallenge, syncChallenges } from "@/app/actions/challenges";
import { ProgressBar } from "@/components/progress-bar";
import type { Challenge } from "@/lib/challenges";

type Cell = { n: number; iso: string; done: boolean; past: boolean; today: boolean };
export type ChallengeView = {
  ucId: string; c: Pick<Challenge, "id" | "title" | "icon" | "days" | "verify" | "color" | "xp">; task: string; day: number; completed: number; todayDone: boolean; cells: Cell[]; autoOk: boolean; hint: string;
  grace: number; graceLeft: number; need: number; pendingSync: boolean;
};
export type EndedView = { ucId: string; id: string; title: string; icon: string; days: number; outcome: "fallido" | "vencido"; completed: number; canRetry: boolean };

/** Guarda una vez por día y navegador lo que la tarjeta ya muestra como cumplido (retos automáticos). */
function useSyncOnce(key: string, on: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!on) return;
    const k = `bb.retos.sync.${key}`;
    try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, "1"); } catch { /* sin almacenamiento */ }
    syncChallenges().then((r) => { if (r.changed) router.refresh(); }).catch(() => {});
  }, [key, on, router]);
}

export function ChallengeCard({ v, compact = false }: { v: ChallengeView; compact?: boolean }) {
  const router = useRouter();
  const [done, setDone] = useState(v.todayDone);
  const [cells, setCells] = useState(v.cells);
  const [showCal, setShowCal] = useState(!compact);
  const [leaving, setLeaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const completed = cells.filter((c) => c.done).length;
  const manual = v.c.verify === "manual";
  useSyncOnce(`${v.ucId}.${cells.find((c) => c.today)?.iso ?? ""}`, v.pendingSync);

  function check() {
    setErr(null);
    setDone(true);
    setCells((cs) => cs.map((c) => (c.today ? { ...c, done: true } : c)));
    try { navigator.vibrate?.([30, 40, 60]); } catch { /* */ }
    start(async () => {
      const r = await checkInChallenge(v.ucId).catch(() => ({ ok: false, error: "Sin conexión. Intenta de nuevo." }));
      if (!r.ok) {
        setDone(false);
        setCells((cs) => cs.map((c) => (c.today ? { ...c, done: false } : c)));
        setErr(r.error ?? "No pudimos marcar el día. Intenta de nuevo.");
      } else router.refresh();
    });
  }
  function leave() {
    setErr(null);
    start(async () => {
      const r = await leaveChallenge(v.ucId).catch(() => ({ ok: false, error: "Sin conexión. Intenta de nuevo." }));
      if (r.ok) router.refresh();
      else { setErr(r.error ?? "No pudimos salir del reto. Intenta de nuevo."); setLeaving(false); }
    });
  }

  return (
    <div className={`rounded-[1.5rem] border border-line/70 p-4 sm:p-5 ${v.c.color}`}>
      <div className="flex items-start gap-3">
        <span className="grid place-items-center size-12 shrink-0 rounded-2xl bg-white text-banana-ink shadow-soft"><BrandIcon name={v.c.icon} className="size-7" /></span>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-ink leading-tight">{v.c.title}</p>
          <p className="text-xs font-semibold text-ink/75 tabular-nums">Día {v.day} de {v.c.days}{v.grace > 0 && <>, {v.graceLeft === 1 ? "te queda 1 comodín" : `te quedan ${v.graceLeft} comodines`}</>}</p>
          <ProgressBar value={completed / v.c.days} className="mt-2 h-2" track="bg-white/70" label={`${completed} de ${v.c.days} días cumplidos`} />
        </div>
        <span className="text-sm font-extrabold text-ink tabular-nums" aria-hidden>{completed}/{v.c.days}</span>
      </div>
      <div className="mt-3 rounded-2xl bg-white/80 p-3 flex items-center gap-3">
        <p className="flex-1 flex gap-1.5 text-sm font-semibold text-ink"><PushPin weight="duotone" className="mt-0.5 size-4 shrink-0 text-ink/70" /><span>Hoy: {v.task}{!done && !manual && v.hint && <span className="mt-0.5 block text-xs font-semibold text-muted">{v.hint}</span>}</span></p>
        {done ? (
          <span className="chip h-9 bg-peel text-white"><Check weight="bold" className="size-4" />Hecho</span>
        ) : manual ? (
          <button onClick={check} disabled={pending} className="tap pressable inline-flex items-center gap-1.5 h-11 px-4 rounded-full bg-ink text-white text-sm font-bold hover:bg-black">Hecho <Check weight="bold" className="size-4" /></button>
        ) : null}
      </div>
      {err && <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-bad"><WarningCircle weight="fill" className="size-4 shrink-0" />{err}</p>}
      {compact && <button onClick={() => setShowCal((s) => !s)} className="tap mt-2 text-xs font-bold text-ink/75 hover:text-ink" aria-expanded={showCal}>{showCal ? "Ocultar calendario" : "Ver calendario"}</button>}
      {showCal && (
        <ol className="mt-3 grid grid-cols-10 gap-1" aria-label="Calendario del reto">
          {cells.map((c) => (
            <li key={c.n} title={`Día ${c.n}`} className={`aspect-square grid place-items-center rounded-md text-[10px] font-bold ${c.done ? "bg-ink text-banana" : c.today ? "border-2 border-ink text-ink bg-white" : c.past ? "bg-white/40 text-faint line-through" : "bg-white/60 text-ink/60"}`}>
              {c.done ? <Check weight="bold" className="size-3" /> : c.n}<span className="sr-only">{c.done ? " cumplido" : c.past ? " no cumplido" : ""}</span>
            </li>
          ))}
        </ol>
      )}
      {!compact && v.grace > 0 && <p className="mt-2 text-[11px] font-semibold text-ink/70">Para ganar la medalla: {v.need} de {v.c.days} días. Si fallas más de {v.grace}, el reto termina y puedes reintentarlo.</p>}
      {!compact && (leaving ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold text-ink">¿Seguro? Pierdes tu progreso.</span>
          <button onClick={leave} disabled={pending} className="tap px-2 font-bold text-bad underline">{pending ? "Saliendo…" : "Sí, abandonar"}</button>
          <button onClick={() => setLeaving(false)} className="tap px-2 font-bold text-ink underline">No</button></div>
      ) : <button onClick={() => setLeaving(true)} className="tap mt-2 text-xs font-semibold text-ink/75 underline hover:text-ink">Abandonar reto</button>)}
    </div>
  );
}

/** Botón de unirse (o reintentar) con estado de carga y errores reales. */
export function JoinButton({ id, title, label = "Unirme", className = "btn-primary h-11 px-5 text-sm" }: { id: string; title: string; label?: string; className?: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const router = useRouter();
  return (
    <div>
      <button disabled={pending} aria-busy={pending} onClick={() => start(async () => {
        setMsg(null);
        const r = await joinChallenge(id).catch(() => ({ ok: false, error: "Sin conexión. Intenta de nuevo.", demo: false }));
        if (r.ok) { setMsg({ ok: true, t: r.demo ? "Demo: no se guardó." : "Adentro. Tu reto empieza hoy." }); router.refresh(); }
        else setMsg({ ok: false, t: r.error ?? "No pudimos unirte. Intenta de nuevo." });
      })} className={className} aria-label={`${label}: ${title}`}>
        {pending ? <><CircleNotch weight="bold" className="size-4 animate-spin motion-reduce:animate-none" />Uniéndote…</> : label}
      </button>
      {msg && <p className={`mt-1.5 text-xs font-semibold ${msg.ok ? "text-peel" : "text-bad"}`} role={msg.ok ? "status" : "alert"}>{msg.t}</p>}
    </div>
  );
}

/** Reto que terminó sin medalla (fallido o vencido), con opción de reintentar. */
export function EndedChallengeCard({ e }: { e: EndedView }) {
  return (
    <div className="rounded-[1.5rem] border border-line bg-white p-4 sm:p-5 flex items-start gap-3">
      <span className="grid place-items-center size-12 shrink-0 rounded-2xl bg-cream text-muted"><BrandIcon name={e.icon} className="size-7" /></span>
      <div className="flex-1 min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-extrabold text-ink leading-tight">{e.title}<span className={`chip h-6 ${e.outcome === "fallido" ? "bg-bad/10 text-bad" : "bg-line text-muted"}`}>{e.outcome === "fallido" ? "No se logró" : "Venció"}</span></p>
        <p className="mt-0.5 text-sm text-muted">{e.outcome === "fallido" ? "Se acabaron los comodines." : "Terminó el plazo sin llegar a la meta."} Cumpliste {e.completed} de {e.days} días.</p>
        {e.canRetry && <div className="mt-3"><JoinButton id={e.id} title={e.title} label="Reintentar" className="btn-ghost h-11 px-4 text-sm" /></div>}
      </div>
    </div>
  );
}
