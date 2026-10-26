"use client";
// "Tus primeros pasos" en Hoy: 6 o 7 cosas concretas para entender la app haciéndolas. Cada paso es un toque que lleva
// a la pantalla y se marca solo cuando la persona lo hace. Se ve hasta completarla (con una celebración) o cerrarla.
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Check, X } from "@/components/icons";
import { Monkey } from "@/components/icons/brand";
import { CoachPic } from "@/components/coach-pic";
import { Confetti } from "@/components/confetti";
import { Sheet, SheetTitle } from "@/components/sheet";
import { EnablePush } from "@/components/notifications/enable-push";
import { InstallHelper } from "@/components/install/install-helper";
import { PP_CELEBRATED, PP_HIDDEN, STEP_KEY, checklistState, nextStep, type FirstStep, type StepSignals } from "@/lib/primeros-pasos";
import { isNativeApp } from "@/lib/platform";
import { useLearnKeys } from "./learn-store";

/** Evento para abrir el ayudante de instalación de la LinkApp desde otra pieza. Si nadie lo atiende (preventDefault), se abre aquí. */
export const INSTALL_EVENT = "bb:instalar";

type Device = { pushSupported: boolean; mobile: boolean; standalone: boolean; pushOn: boolean };
function readDevice(): Device {
  // App de las tiendas: ya está instalada (sin paso de LinkApp) y sus avisos son nativos (llegan en la Fase 2 de la app).
  if (isNativeApp()) return { pushSupported: false, mobile: false, standalone: true, pushOn: false };
  try {
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    const mobile = ios || /android|mobile/i.test(ua) || window.matchMedia("(pointer: coarse) and (max-width: 1024px)").matches;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const push = "Notification" in window && "serviceWorker" in navigator;
    return { pushSupported: push || ios, mobile, standalone, pushOn: push && Notification.permission === "granted" };
  } catch { return { pushSupported: false, mobile: false, standalone: false, pushOn: false }; }
}

export function FirstSteps({ server, coach }: {
  server: Omit<StepSignals, "pushSupported" | "mobile" | "standalone">;
  coach: { name: string; avatar: string | null };
}) {
  const { keys, ready, mark } = useLearnKeys(server.keys);
  const [dev, setDev] = useState<Device | null>(null);
  const [sheet, setSheet] = useState<"avisos" | "instalar" | null>(null);
  useEffect(() => { setDev(readDevice()); }, []);
  // Si quedó instalada mientras la tarjeta estaba abierta (volvió desde la pantalla de inicio), se marca sola.
  useEffect(() => { if (dev?.standalone && !keys.includes(STEP_KEY.instalar)) mark(STEP_KEY.instalar); }, [dev, keys, mark]);

  if (!ready || !dev) return null;
  const st = checklistState({ ...server, keys, push: server.push || dev.pushOn, pushSupported: dev.pushSupported, mobile: dev.mobile, standalone: dev.standalone }, coach.name);
  if (!st.visible) return null;
  const next = nextStep(st.steps);
  const pct = st.done / st.total;

  const open = (s: FirstStep, e: React.MouseEvent) => {
    if (s.id === "avisos") { e.preventDefault(); setSheet("avisos"); return; }
    if (s.id === "instalar") {
      e.preventDefault();
      const ev = new CustomEvent(INSTALL_EVENT, { cancelable: true });
      window.dispatchEvent(ev);
      if (!ev.defaultPrevented) setSheet("instalar");
    }
  };

  return (
    <section aria-labelledby="pp-t" className="relative overflow-hidden rounded-[1.75rem] bg-banana p-5 sm:p-6">
      {st.celebrate && <Confetti n={36} />}
      <div data-tour="hoy-pasos" className="flex items-start gap-3">
        {coach.avatar ? <CoachPic src={coach.avatar} size={56} className="size-14 shrink-0 rounded-2xl object-cover" /> : <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-ink text-banana"><Monkey className="size-9" /></span>}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-ink/75">{coach.name}</p>
          <h2 id="pp-t" className="text-xl font-extrabold leading-tight text-ink text-balance">{st.complete ? "Completaste tus primeros pasos" : "Tus primeros pasos"}</h2>
        </div>
        <Ring pct={pct} label={`${st.done} de ${st.total}`} />
        {!st.complete && (
          <button type="button" onClick={() => mark(PP_HIDDEN)} className="tap -mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-full text-ink/70 hover:text-ink" aria-label="Ocultar primeros pasos">
            <X weight="bold" className="size-5" />
          </button>
        )}
      </div>

      <p className="mt-3 text-[15px] text-ink/85 text-pretty">{st.complete ? "Ya sabes usar lo más importante. Ahora toca ser constante: tu plan se ajusta solo con lo que anotas." : "Hazlos en orden. Cada uno toma menos de 2 minutos y te enseña a usar la app."}</p>
      {st.complete ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/app/aprende" className="btn-primary h-12 px-5"><BookOpen weight="bold" className="size-5" />Aprende a entrenar</Link>
          <button type="button" onClick={() => mark(PP_CELEBRATED)} className="btn h-12 bg-white/70 px-5 text-ink hover:bg-white">Listo, ocultar</button>
        </div>
      ) : (
        <ol className="mt-3 space-y-2">
          {st.steps.map((s, i) => {
            const isNext = next?.id === s.id;
            return (
              <li key={s.id}>
                <Link href={s.href} onClick={(e) => open(s, e)} aria-current={isNext ? "step" : undefined}
                  className={`pressable flex items-center gap-3 rounded-2xl px-3.5 py-3 ${s.done ? "bg-white/45" : isNext ? "bg-white shadow-soft" : "bg-white/75"}`}>
                  <span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-extrabold tabular-nums ${s.done ? "bg-peel text-white" : isNext ? "bg-ink text-banana" : "bg-ink/10 text-ink"}`}>
                    {s.done ? <Check weight="bold" className="size-4" aria-label="Hecho" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block font-extrabold leading-tight text-ink ${s.done ? "line-through decoration-ink/40" : ""}`}>{s.title}</span>
                    {isNext && <span className="mt-0.5 block text-sm text-ink/75 text-pretty">{s.why}</span>}
                  </span>
                  {!s.done && <span className={`shrink-0 inline-flex items-center gap-1 text-sm font-bold ${isNext ? "text-ink" : "text-ink/60"}`}>{isNext ? s.cta : null}<ArrowRight weight="bold" className="size-4" /></span>}
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      {!st.complete && (
        <Link href="/app/aprende" className="tap mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
          <BookOpen weight="bold" className="size-4" />¿Primera vez entrenando? Aprende a entrenar en 5 minutos
        </Link>
      )}

      <Sheet open={sheet === "avisos"} onClose={() => setSheet(null)}>
        <SheetTitle className="text-xl font-extrabold text-ink">Activa los recordatorios</SheetTitle>
        <p className="mt-1 text-sm text-muted">Te avisamos los días que toca entrenar. Puedes cambiar la hora o apagarlos en Perfil.</p>
        <div className="mt-4"><EnablePush onChange={(on) => { if (on) { mark(STEP_KEY.avisos); setSheet(null); } }} /></div>
      </Sheet>
      <Sheet open={sheet === "instalar"} onClose={() => setSheet(null)}>
        <InstallSteps onDone={() => { mark(STEP_KEY.instalar); setSheet(null); }} />
      </Sheet>
    </section>
  );
}

function Ring({ pct, label }: { pct: number; label: string }) {
  const r = 20, c = 2 * Math.PI * r;
  return (
    <span className="relative grid size-14 shrink-0 place-items-center" role="img" aria-label={`Progreso: ${label}`}>
      <svg viewBox="0 0 48 48" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgb(27 21 5 / .12)" strokeWidth="5" />
        <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" className="text-ink transition-[stroke-dashoffset] duration-500 ease-[cubic-bezier(.23,1,.32,1)]" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <span className="text-xs font-extrabold text-ink tabular-nums">{label.replace(" de ", "/")}</span>
    </span>
  );
}

/** Instalar la LinkApp: el mismo ayudante de instalación que Hoy y Perfil (components/install). */
function InstallSteps({ onDone }: { onDone: () => void }) {
  return (
    <div>
      <SheetTitle className="text-xl font-extrabold text-ink">Instala tu LinkApp</SheetTitle>
      <p className="mt-1 mb-4 text-sm text-muted">Así abres Banana Burn con un toque desde tu pantalla de inicio, como cualquier app.</p>
      <InstallHelper where="primeros-pasos" />
      <button type="button" onClick={onDone} className="btn-ghost mt-5 h-12 w-full">Ya la instalé</button>
    </div>
  );
}
