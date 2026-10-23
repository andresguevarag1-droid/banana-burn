"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Portal } from "@/components/portal";
import { Confetti } from "@/components/confetti";
import { Flask } from "@/components/icons";
import { markTesterSeen } from "@/app/actions/testers";
import { TESTER_DAYS } from "@/lib/testers";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long", year: "numeric" });

/**
 * Bienvenida única de "Eres tester de Banana Burn". El layout la pasa si la asignación vigente aún no se vio
 * (servidor, RLS). Al cerrar se marca vista en la base y no vuelve a salir en ningún dispositivo.
 * En demo sale con ?tester=demo, rotulada como demo y sin guardar nada.
 * Movimiento: igual que la ventana de regalo (entra en 280 ms desde .96, sale en 200 ms; con movimiento reducido,
 * solo fundido y sin confeti).
 */
export function TesterCelebration({ until, renewal = false, demo }: { until: string | null; renewal?: boolean; demo: boolean }) {
  const [show, setShow] = useState<{ until: string; renewal: boolean; demo: boolean } | null>(until ? { until, renewal, demo: false } : null);
  useEffect(() => {
    if (!demo) return;
    try { if (new URLSearchParams(window.location.search).get("tester") === "demo") setShow({ until: new Date(Date.now() + TESTER_DAYS * 864e5).toISOString(), renewal: false, demo: true }); } catch { /* sin URL */ }
  }, [demo]);
  if (!show) return null;
  return <TesterDialog {...show} onClose={() => { setShow(null); if (!show.demo) markTesterSeen().catch(() => {}); }} />;
}

function TesterDialog({ until, renewal, demo, onClose }: { until: string; renewal: boolean; demo: boolean; onClose: () => void }) {
  const [closing, setClosing] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const close = () => { if (closing) return; setClosing(true); setTimeout(onClose, 200); };
  useEffect(() => {
    btn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Portal>
      <div className="fixed inset-0 z-[80] grid place-items-center px-4" role="dialog" aria-modal="true" aria-labelledby="tester-dlg-t" aria-describedby="tester-dlg-d">
        <div className={`bb-backdrop absolute inset-0 bg-ink/50 ${closing ? "bb-out" : ""}`} onClick={close} aria-hidden />
        {!closing && <Confetti n={36} />}
        <div className={`bb-celebrate relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-banana text-ink shadow-lift ${closing ? "bb-out" : ""}`}>
          <div className="relative grid place-items-center bg-banana-soft pt-6">
            {demo && <span className="absolute left-4 top-4 chip bg-ink text-white">Demo</span>}
            <span className="absolute right-4 top-4 grid size-11 place-items-center rounded-2xl bg-ink text-banana shadow-sm" aria-hidden><Flask weight="fill" className="size-6" /></span>
            <Image src="/brand/mascota-sola.webp" alt="" width={176} height={176} priority className="relative -mb-2 size-40 object-contain drop-shadow-lg" />
          </div>
          <div className="px-6 pb-6 pt-5 text-center">
            <p className="text-sm font-bold text-banana-ink">{renewal ? "Seguimos contigo" : "Tester de la beta"}</p>
            <h2 id="tester-dlg-t" className="mt-1 text-[1.6rem] font-extrabold leading-tight tracking-tight text-balance">{renewal ? "Renovamos tu mes de tester" : "Eres tester de Banana Burn"}</h2>
            <p id="tester-dlg-d" className="mt-2 text-sm font-semibold text-ink/80 text-pretty">
              Como agradecimiento por ayudarnos a probar la beta, tienes Entreno + Nutrición gratis hasta el {fmt(until)}. Sin cobros y sin tarjeta.
            </p>
            <ul className="mt-4 space-y-1.5 rounded-2xl bg-white/70 px-4 py-3 text-left text-sm text-ink">
              <li className="flex gap-2"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-ink" aria-hidden />Usa la app como siempre: entrenos, comidas y coach.</li>
              <li className="flex gap-2"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-ink" aria-hidden />Si algo falla o tienes una idea, toca Reportar algo en Hoy.</li>
              <li className="flex gap-2"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-ink" aria-hidden />Tu insignia de tester sale en tu perfil y en la comunidad.</li>
            </ul>
            <div className="mt-5">
              <button ref={btn} type="button" onClick={close} className="btn-primary h-12 w-full">Empezar a probar</button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
