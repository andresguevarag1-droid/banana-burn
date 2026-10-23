"use client";
// Botones de la persona sobre un programa: empezar (con la regla de un solo activo), pausar, reanudar, dejar y cerrar.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleNotch, Flag, Pause, Play, SignOut } from "@/components/icons";
import { Sheet, SheetTitle } from "@/components/sheet";
import { finishProgram, leaveProgram, pauseProgram, startProgram, type ProgramResult } from "@/app/actions/programs";

const DEMO_NOTE = "Modo demo: no se guardó.";

function useRun() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const run = (fn: () => Promise<ProgramResult>, after?: (r: ProgramResult) => void) => {
    setErr(null); setNote(null);
    start(async () => {
      try {
        const r = await fn();
        if (r.demo) { setNote(DEMO_NOTE); return; }
        if (!r.ok && !r.conflict) { setErr(r.error ?? "No pudimos guardar el cambio."); return; }
        after?.(r);
        if (r.ok) router.refresh();
      } catch { setErr("Sin conexión. Intenta de nuevo."); }
    });
  };
  return { busy, err, note, run, router };
}

const Spin = () => <CircleNotch weight="bold" className="size-5 animate-spin motion-reduce:animate-none" />;

/** Empezar, reanudar o reiniciar. Si hay otro programa activo, pide confirmación para pausarlo (conserva su avance). */
export function StartProgramButton({ slug, title, label, className = "btn-primary h-12 w-full text-base" }: { slug: string; title: string; label: string; className?: string }) {
  const { busy, err, note, run, router } = useRun();
  const [conflict, setConflict] = useState<{ slug: string; title: string } | null>(null);
  const go = (pause: boolean) => run(() => startProgram(slug, pause), (r) => {
    if (r.conflict) { setConflict(r.conflict); return; }
    if (r.ok) { setConflict(null); router.push("/app"); }
  });
  return (
    <div>
      <button type="button" onClick={() => go(false)} disabled={busy} aria-busy={busy} className={className}>{busy && !conflict ? <><Spin />Preparando tu programa…</> : <><Play weight="fill" className="size-5" />{label}</>}</button>
      {err && <p role="alert" className="mt-2 text-sm font-semibold text-bad">{err}</p>}
      {note && <p role="status" className="mt-2 text-sm font-semibold text-muted">{note}</p>}
      <Sheet open={!!conflict} onClose={() => setConflict(null)} className="px-5">
        <SheetTitle className="text-xl font-extrabold text-ink">Ya tienes un programa activo</SheetTitle>
        <p className="mt-2 text-body">Tienes en curso <b>{conflict?.title}</b>. Solo puede haber un programa activo a la vez. Lo pausamos con su avance guardado y empiezas <b>{title}</b>. Puedes reanudarlo cuando quieras.</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => go(true)} disabled={busy} className="btn-primary h-12" data-autofocus>{busy ? <><Spin />Cambiando…</> : <>Pausar y empezar<ArrowRight weight="bold" className="size-5" /></>}</button>
          <button type="button" onClick={() => setConflict(null)} className="btn-ghost h-12">Cancelar</button>
        </div>
      </Sheet>
    </div>
  );
}

/** Pausar, dejar y cerrar con certificado (página de avance del programa). */
export function ProgramControls({ slug, title, status, canFinish }: { slug: string; title: string; status: "activo" | "pausado"; canFinish: boolean }) {
  const { busy, err, note, run } = useRun();
  const [leaving, setLeaving] = useState(false);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {canFinish && <button type="button" disabled={busy} onClick={() => run(() => finishProgram(slug))} className="btn-banana h-12 px-5"><Flag weight="duotone" className="size-5" />Cerrar y recibir mi certificado</button>}
        {status === "activo" && <button type="button" disabled={busy} onClick={() => run(() => pauseProgram(slug))} className="btn-ghost h-12 px-5"><Pause weight="duotone" className="size-5" />Pausar</button>}
        <button type="button" disabled={busy} onClick={() => setLeaving(true)} className="btn-ghost h-12 px-5"><SignOut weight="bold" className="size-5" />Dejar el programa</button>
      </div>
      {busy && <p role="status" className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-muted"><Spin />Guardando…</p>}
      {err && <p role="alert" className="mt-2 text-sm font-semibold text-bad">{err}</p>}
      {note && <p role="status" className="mt-2 text-sm font-semibold text-muted">{note}</p>}
      <Sheet open={leaving} onClose={() => setLeaving(false)} className="px-5">
        <SheetTitle className="text-xl font-extrabold text-ink">¿Dejar {title}?</SheetTitle>
        <p className="mt-2 text-body">Vuelves a tu rutina normal desde hoy. Tus entrenos y tus marcas quedan guardados. Si lo empiezas otra vez, arranca desde la semana 1. Si solo necesitas unos días, mejor páusalo.</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => { setLeaving(false); run(() => leaveProgram(slug)); }} className="btn h-12 bg-bad text-white hover:brightness-95">Dejar el programa</button>
          <button type="button" onClick={() => setLeaving(false)} className="btn-ghost h-12" data-autofocus>Seguir con el programa</button>
        </div>
      </Sheet>
    </div>
  );
}
