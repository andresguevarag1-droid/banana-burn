"use client";
import { Portal } from "@/components/portal";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BananaFlame, BananaMedal, BrandIcon, CaretRight, Check, CircleNotch, Flag, PushPin, Shield, WarningCircle } from "@/components/icons";
import { checkInChallenge, joinChallenge, leaveChallenge, syncChallenges } from "@/app/actions/challenges";
import { ProgressBar } from "@/components/progress-bar";
import { ChallengeCover, coverInk } from "@/components/retos/cover";
import type { Challenge, CoverStyle } from "@/lib/challenges";
import { CHALLENGE_DAY_XP, MILESTONE_XP } from "@/lib/gamify";

type Cell = { n: number; iso: string; done: boolean; past: boolean; today: boolean };
export type ChallengeView = {
  ucId: string; c: Pick<Challenge, "id" | "title" | "icon" | "days" | "verify" | "color" | "xp" | "cover" | "badge">; task: string; day: number; completed: number; todayDone: boolean; cells: Cell[]; autoOk: boolean; hint: string;
  grace: number; graceLeft: number; need: number; pendingSync: boolean;
};
export type EndedView = { ucId: string; id: string; title: string; icon: string; days: number; outcome: "fallido" | "vencido"; completed: number; canRetry: boolean };

const n = (x: number) => x.toLocaleString("es-CO");

/** Días seguidos cumplidos hasta hoy (o hasta ayer si hoy aún no). */
export function cellStreak(cells: Cell[]) {
  const i0 = cells.findIndex((c) => c.today);
  let i = i0 < 0 ? cells.length - 1 : cells[i0].done ? i0 : i0 - 1;
  let s = 0;
  while (i >= 0 && cells[i].done) { s++; i--; }
  return s;
}

/** Próximo hito (días 7 y 14, y el final). */
function nextGoal(completed: number, days: number) {
  const m = [...[7, 14].filter((d) => d < days), days].find((d) => d > completed);
  return m ? { at: m, left: m - completed, final: m === days } : null;
}

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

/** Check que se dibuja al marcar el día (240 ms; sin animación con movimiento reducido). */
function DrawnCheck({ className = "size-4" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden className={`bb-check-draw ${className}`} fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"><polyline points="5 12.5 10 17.5 19 7.5" /></svg>;
}

export function ChallengeCard({ v, compact = false }: { v: ChallengeView; compact?: boolean }) {
  const router = useRouter();
  const [done, setDone] = useState(v.todayDone);
  const [justDone, setJustDone] = useState(false);
  const [cells, setCells] = useState(v.cells);
  const [showCal, setShowCal] = useState(!compact);
  const [leaving, setLeaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const completed = cells.filter((c) => c.done).length;
  const manual = v.c.verify === "manual";
  const streak = cellStreak(cells);
  const goal = nextGoal(completed, v.c.days);
  const ink = coverInk(v.c.cover as CoverStyle);
  useSyncOnce(`${v.ucId}.${cells.find((c) => c.today)?.iso ?? ""}`, v.pendingSync);

  function check() {
    setErr(null);
    setDone(true); setJustDone(true);
    setCells((cs) => cs.map((c) => (c.today ? { ...c, done: true } : c)));
    try { navigator.vibrate?.([30, 40, 60]); } catch { /* */ }
    start(async () => {
      const r = await checkInChallenge(v.ucId).catch(() => ({ ok: false, error: "Sin conexión. Intenta de nuevo." }));
      if (!r.ok) {
        setDone(false); setJustDone(false);
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
    <article className="overflow-hidden rounded-[1.5rem] border border-line/70 bg-white shadow-soft">
      <ChallengeCover c={{ id: v.c.id, cover: v.c.cover as CoverStyle, icon: v.c.icon }} className={compact ? "h-[5.5rem]" : "h-28"}>
        <div className={`absolute inset-x-0 bottom-0 flex items-end gap-3 p-4 ${compact ? "pl-[4.25rem] pt-3" : "pl-[4.25rem]"}`}>
          <div className="min-w-0 flex-1">
            <Link href={`/app/retos/${v.c.id}`} className={`block truncate font-extrabold leading-tight after:absolute after:inset-0 hover:underline ${ink} ${compact ? "text-base" : "text-lg"}`}>{v.c.title}</Link>
            <p className={`text-xs font-bold tabular-nums opacity-85 ${ink}`}>Día {v.day} de {v.c.days}</p>
          </div>
          <span className={`shrink-0 rounded-full bg-white/90 px-2.5 py-1 text-xs font-extrabold tabular-nums text-ink`} aria-hidden>{completed}/{v.c.days}</span>
        </div>
      </ChallengeCover>

      <div className="p-4">
        <ProgressBar value={completed / v.c.days} className="h-2" fill="bg-ink" label={`${completed} de ${v.c.days} días cumplidos`} />
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-ember/10 px-1 py-2"><dt className="sr-only">Racha</dt><dd className="flex items-center justify-center gap-1 text-base font-extrabold tabular-nums text-ember-ink"><BananaFlame weight={streak > 0 ? "fill" : "duotone"} className="size-4" />{streak}</dd><dd aria-hidden className="text-[11px] font-semibold text-muted">{streak === 1 ? "día seguido" : "días seguidos"}</dd></div>
          <div className="rounded-2xl bg-sky/10 px-1 py-2"><dt className="sr-only">Comodines</dt>
            <dd className="flex h-6 items-center justify-center gap-0.5"><span className="sr-only">{`${v.graceLeft} de ${v.grace} comodines`}</span>
              {v.grace === 0 ? <span className="text-sm font-extrabold text-sky">0</span> : v.grace <= 5 ? Array.from({ length: v.grace }, (_, i) => <Shield key={i} weight={i < v.graceLeft ? "fill" : "regular"} className={`size-4 ${i < v.graceLeft ? "text-sky" : "text-sky/35"}`} aria-hidden />) : <span className="text-base font-extrabold tabular-nums text-sky">{v.graceLeft}/{v.grace}</span>}
            </dd><dd aria-hidden className="text-[11px] font-semibold text-muted">comodines</dd></div>
          <div className="rounded-2xl bg-banana-soft px-1 py-2"><dt className="sr-only">Meta</dt><dd className="text-base font-extrabold tabular-nums text-banana-ink">{completed}/{v.need}</dd><dd aria-hidden className="text-[11px] font-semibold text-muted">para la medalla</dd></div>
        </dl>

        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-cream p-3">
          <p className="flex flex-1 gap-1.5 text-sm font-semibold text-ink"><PushPin weight="duotone" className="mt-0.5 size-4 shrink-0 text-ink/70" /><span>Hoy: {v.task}{!done && !manual && v.hint && <span className="mt-0.5 block text-xs font-semibold text-muted">{v.hint}</span>}</span></p>
          {done ? (
            <span className="relative inline-flex shrink-0 flex-col items-end gap-1">
              <span className={`chip h-10 bg-peel text-white ${justDone ? "bb-check-pop" : ""}`}>{justDone ? <DrawnCheck /> : <Check weight="bold" className="size-4" />}Hecho</span>
              {justDone && manual && <span className="bb-celebrate text-[11px] font-extrabold text-peel tabular-nums" role="status">+{CHALLENGE_DAY_XP} XP</span>}
            </span>
          ) : manual ? (
            <button onClick={check} disabled={pending} className="tap pressable inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-bold text-white hover:bg-black">Hecho <Check weight="bold" className="size-4" /></button>
          ) : null}
        </div>
        {err && <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-bad"><WarningCircle weight="fill" className="size-4 shrink-0" />{err}</p>}

        {goal && (
          <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-ink/80">
            {goal.final ? <BananaMedal className="size-5 shrink-0 text-banana-ink" /> : <Flag weight="duotone" className="size-4 shrink-0 text-ember-ink" />}
            <span>{goal.left === 1 ? "Falta 1 día" : `Faltan ${goal.left} días`} cumplidos para {goal.final ? <>la medalla <b>{v.c.badge}</b> (+{n(v.c.xp)} XP)</> : <>el hito del día {goal.at} (+{MILESTONE_XP} XP)</>}</span>
          </p>
        )}

        {compact && <button onClick={() => setShowCal((s) => !s)} className="tap mt-2 text-xs font-bold text-ink/75 hover:text-ink" aria-expanded={showCal}>{showCal ? "Ocultar calendario" : "Ver calendario"}</button>}
        {showCal && (
          <ol className="mt-3 grid grid-cols-7 gap-1 sm:grid-cols-10" aria-label="Calendario del reto">
            {cells.map((c) => {
              const ms = c.n === 7 || c.n === 14 || c.n === v.c.days;
              return (
                <li key={c.n} title={`Día ${c.n}`} className={`relative grid aspect-square place-items-center rounded-lg text-[11px] font-bold ${c.done ? `bg-ink text-banana ${c.today && justDone ? "bb-check-pop" : ""}` : c.today ? "border-2 border-ink bg-white text-ink" : c.past ? "bg-cream text-faint line-through" : "bg-paper text-ink/60"}`}>
                  {c.done ? (c.today && justDone ? <DrawnCheck className="size-3.5" /> : <Check weight="bold" className="size-3" />) : c.n}
                  {ms && !c.done && <span aria-hidden className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-ember ring-2 ring-white" />}
                  <span className="sr-only">{c.done ? " cumplido" : c.past ? " no cumplido" : ms ? " hito" : ""}</span>
                </li>
              );
            })}
          </ol>
        )}
        {!compact && <p className="mt-2 text-[11px] font-semibold text-muted">Los puntos naranjas marcan los hitos. {v.grace > 0 ? `Si fallas más de ${v.grace} ${v.grace === 1 ? "día" : "días"}, el reto termina y puedes reintentarlo.` : "Sin comodines: cada día cuenta."}</p>}
        {!compact && (leaving ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold text-ink">¿Seguro? Pierdes tu progreso.</span>
            <button onClick={leave} disabled={pending} className="tap px-2 font-bold text-bad underline">{pending ? "Saliendo…" : "Sí, abandonar"}</button>
            <button onClick={() => setLeaving(false)} className="tap px-2 font-bold text-ink underline">No</button></div>
        ) : <button onClick={() => setLeaving(true)} className="tap mt-2 text-xs font-semibold text-muted underline hover:text-ink">Abandonar reto</button>)}
      </div>
    </article>
  );
}

type JoinInfo = { cover: CoverStyle; icon: string; days: number; firstTask?: string };

/** Botón de unirse (o reintentar) con estado de carga, errores reales y una celebración corta al entrar. */
export function JoinButton({ id, title, label = "Unirme", className = "btn-primary h-11 px-5 text-sm", info }: { id: string; title: string; label?: string; className?: string; info?: JoinInfo }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [joined, setJoined] = useState<{ demo: boolean } | null>(null);
  const router = useRouter();
  return (
    <div>
      <button disabled={pending} aria-busy={pending} onClick={() => start(async () => {
        setMsg(null);
        const r = await joinChallenge(id).catch(() => ({ ok: false, error: "Sin conexión. Intenta de nuevo.", demo: false }));
        if (r.ok) {
          try { navigator.vibrate?.([20, 30, 50]); } catch { /* */ }
          if (info) setJoined({ demo: !!r.demo });
          else { setMsg({ ok: true, t: r.demo ? "Demo: no se guardó." : "Adentro. Tu reto empieza hoy." }); router.refresh(); }
        } else setMsg({ ok: false, t: r.error ?? "No pudimos unirte. Intenta de nuevo." });
      })} className={className} aria-label={`${label}: ${title}`}>
        {pending ? <><CircleNotch weight="bold" className="size-4 animate-spin motion-reduce:animate-none" />Uniéndote…</> : label}
      </button>
      {msg && <p className={`mt-1.5 text-xs font-semibold ${msg.ok ? "text-peel" : "text-bad"}`} role={msg.ok ? "status" : "alert"}>{msg.t}</p>}
      {joined && info && <JoinCelebration title={title} info={info} demo={joined.demo} onClose={() => { setJoined(null); router.refresh(); }} />}
    </div>
  );
}

/** "Estás dentro": entra en 280 ms desde .96 (nunca desde 0), sale en 200 ms. Con movimiento reducido solo funde. */
function JoinCelebration({ title, info, demo, onClose }: { title: string; info: JoinInfo; demo: boolean; onClose: () => void }) {
  const [closing, setClosing] = useState(false);
  const close = () => { setClosing(true); setTimeout(onClose, 200); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Portal>
    <div className="fixed inset-0 z-[80] grid place-items-end px-4 pb-6 sm:place-items-center" role="dialog" aria-modal="true" aria-labelledby="join-t">
      <div aria-hidden onClick={close} className={`bb-backdrop absolute inset-0 bg-ink/40 ${closing ? "bb-out" : ""}`} />
      <div className={`bb-celebrate relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-white shadow-lift ${closing ? "bb-out" : ""}`}>
        <ChallengeCover c={{ cover: info.cover, icon: info.icon }} className="h-28" />
        <div className="p-5 text-center">
          <p className="text-sm font-bold text-peel">{demo ? "Demo: no se guardó" : "Estás dentro"}</p>
          <h2 id="join-t" className="mt-0.5 text-2xl font-extrabold tracking-tight text-ink text-balance">{title}</h2>
          <p className="mt-2 text-sm text-muted">Día 1 de {info.days} empieza hoy.{info.firstTask ? ` Tu primera tarea: ${info.firstTask.charAt(0).toLowerCase()}${info.firstTask.slice(1)}.` : ""}</p>
          <button autoFocus onClick={close} className="btn-primary mt-5 h-12 w-full">Vamos <CaretRight weight="bold" className="size-4" /></button>
        </div>
      </div>
    </div>
    </Portal>
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
