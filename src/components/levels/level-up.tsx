"use client";
import { Portal } from "@/components/portal";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Confetti } from "@/components/confetti";
import { LEVEL_PERKS, levelAt } from "@/lib/gamify";
import { LevelBadge } from "./level-badge";

/**
 * Celebración de subida de nivel en cualquier pantalla de la app. El layout pasa el nivel actual (calculado en el servidor
 * con el XP real); si es mayor que el último que esta persona vio en este navegador, se celebra una vez.
 * Entra en 280 ms (ease-out, desde .96, nunca desde 0), sale en 200 ms y respeta movimiento reducido.
 */
export function LevelWatcher({ uid, idx, sex = null }: { uid: string; idx: number; sex?: string | null }) {
  const [show, setShow] = useState<number | null>(null);
  useEffect(() => {
    const key = `bb.nivel.${uid}`;
    let seen: number | null = null;
    try { const raw = localStorage.getItem(key); seen = raw ? Number(raw) : null; localStorage.setItem(key, String(idx)); } catch { return; }
    if (seen !== null && Number.isFinite(seen) && idx > seen) setShow(idx);
  }, [uid, idx]);
  if (!show) return null;
  return <LevelUpDialog idx={show} sex={sex} onClose={() => setShow(null)} />;
}

export function LevelUpDialog({ idx, onClose, sex = null }: { idx: number; onClose: () => void; sex?: string | null }) {
  const [closing, setClosing] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const lv = levelAt(idx, sex);
  const perk = LEVEL_PERKS[idx - 1];
  const close = () => { setClosing(true); setTimeout(onClose, 200); };
  useEffect(() => {
    btn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Portal>
    <div className="fixed inset-0 z-[80] grid place-items-center px-5" role="dialog" aria-modal="true" aria-labelledby="lvup-t" aria-describedby="lvup-d">
      <div className={`bb-backdrop absolute inset-0 bg-ink/45 ${closing ? "bb-out" : ""}`} onClick={close} aria-hidden />
      {!closing && <Confetti n={36} />}
      <div className={`bb-celebrate relative w-full max-w-sm rounded-[2rem] bg-ink p-6 text-center text-white shadow-lift ring-2 ring-banana/60 ${closing ? "bb-out" : ""}`}>
        <span className="relative mx-auto grid w-fit place-items-center">
          <span aria-hidden className="bb-ring absolute inset-0 rounded-[1.75rem] ring-4 ring-banana" />
          <LevelBadge idx={idx} size="xl" sex={sex} />
        </span>
        <p className="mt-4 text-sm font-bold text-banana">Subiste al nivel {idx}</p>
        <h2 id="lvup-t" className="text-3xl font-extrabold tracking-tight">{lv.n}</h2>
        {perk && <p id="lvup-d" className="mt-3 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white/90">Desbloqueaste: {perk.text}</p>}
        <div className="mt-5 grid gap-2">
          <button ref={btn} onClick={close} className="btn-banana h-12 w-full">Seguir</button>
          <Link href="/app/niveles" onClick={close} className="tap inline-flex h-11 items-center justify-center text-sm font-bold text-white/80 underline-offset-2 hover:text-white hover:underline">Ver mis niveles</Link>
        </div>
      </div>
    </div>
    </Portal>
  );
}
