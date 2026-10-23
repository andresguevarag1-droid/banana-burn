"use client";
// Guía de la app: se abre sola una vez (primera visita a Hoy después de la bienvenida) y se vuelve a abrir desde Perfil
// o el menú con el evento `bb:guia`. Recuerda lo visto en el servidor (0031) y, en demo o sin la migración, en este
// dispositivo (localStorage, siempre con try/catch). Nunca bloquea la app: cerrar o saltar cuenta como vista.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { markGuideSeen, markTipSeen } from "@/app/actions/guide";
import { GUIDE_VERSION, demoGuideInput, guideSteps, isTipKey, shouldAutoOpen, type GuideInput, type TipKey } from "@/lib/guide";
import { betaDates } from "@/components/beta-notice";
import { GuideDialog } from "./guide-dialog";

/** Evento para abrir la guía desde cualquier parte (menú, Perfil). */
export const OPEN_GUIDE_EVENT = "bb:guia";
export const openGuide = () => { try { window.dispatchEvent(new Event(OPEN_GUIDE_EVENT)); } catch { /* */ } };

const LS_VERSION = "bb.guia.version";
const LS_TIPS = "bb.guia.consejos";

function readLocal(): { version: number | null; tips: TipKey[] } {
  try {
    const v = Number(localStorage.getItem(LS_VERSION));
    const raw = JSON.parse(localStorage.getItem(LS_TIPS) ?? "[]");
    return { version: Number.isFinite(v) && v > 0 ? v : null, tips: Array.isArray(raw) ? raw.filter(isTipKey) : [] };
  } catch {
    return { version: null, tips: [] };
  }
}
function writeLocal(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* modo privado o almacenamiento bloqueado */ } }

type Ctx = { open: () => void; guideOpen: boolean; tipSeen: (k: TipKey) => boolean; dismissTip: (k: TipKey) => void };
const GuideCtx = createContext<Ctx | null>(null);
export const useGuide = () => useContext(GuideCtx);

export function GuideProvider({ input, seenVersion, tips, persisted, locked, busy, demo, tz, children }: {
  input: GuideInput;
  seenVersion: number | null;
  tips: TipKey[];
  persisted: boolean;
  /** Muro de planes: la guía no se abre sola. */
  locked: boolean;
  /** Otra pantalla encima (regalo recibido): la guía espera a la próxima visita. */
  busy: boolean;
  demo: boolean;
  tz: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [override, setOverride] = useState<GuideInput | null>(null);
  // Hasta leer este dispositivo, ningún consejo se muestra (evita que parpadeen).
  const [local, setLocal] = useState<{ version: number | null; tips: TipKey[] } | null>(null);
  const [seenTips, setSeenTips] = useState<TipKey[]>(tips);
  const autoDone = useRef(false);

  useEffect(() => { setLocal(readLocal()); }, []);

  const remember = useCallback(() => {
    writeLocal(LS_VERSION, String(GUIDE_VERSION));
    if (persisted) markGuideSeen(GUIDE_VERSION).catch(() => {});
  }, [persisted]);

  // Se abre sola una vez. Se marca como vista al abrirse: si la persona cierra la pestaña, no vuelve a saltar.
  useEffect(() => {
    if (!local || autoDone.current) return;
    // Demo: /app?guia=entreno|completo|prueba|programa abre la guía con esa variante (solo para revisar las pantallas).
    if (demo) {
      const v = new URLSearchParams(window.location.search).get("guia");
      const o = demoGuideInput(input, v);
      if (o) { autoDone.current = true; setOverride(o); setOpen(true); return; }
    }
    if (shouldAutoOpen({ seenVersion, localVersion: local.version, locked, busy, path })) {
      autoDone.current = true;
      setOpen(true);
      remember();
    }
  }, [local, demo, input, seenVersion, locked, busy, path, remember]);

  useEffect(() => {
    const h = () => { setOverride(null); setOpen(true); };
    window.addEventListener(OPEN_GUIDE_EVENT, h);
    return () => window.removeEventListener(OPEN_GUIDE_EVENT, h);
  }, []);

  const close = useCallback(() => { setOpen(false); remember(); }, [remember]);

  const tipSeen = useCallback((k: TipKey) => !local || seenTips.includes(k) || local.tips.includes(k), [local, seenTips]);
  const dismissTip = useCallback((k: TipKey) => {
    setSeenTips((s) => (s.includes(k) ? s : [...s, k]));
    const cur = readLocal().tips;
    if (!cur.includes(k)) writeLocal(LS_TIPS, JSON.stringify([...cur, k]));
    if (persisted) markTipSeen(k).catch(() => {});
  }, [persisted]);

  const steps = useMemo(() => {
    const { lastFree, firstPaid } = betaDates();
    const day = (iso: string) => { try { return new Date(iso).toLocaleDateString("es-419", { day: "numeric", month: "long", timeZone: tz }); } catch { return ""; } };
    return guideSteps(override ?? input, { lastFree, firstPaid, day });
  }, [override, input, tz]);

  const ctx = useMemo<Ctx>(() => ({ open: () => { setOverride(null); setOpen(true); }, guideOpen: open, tipSeen, dismissTip }), [open, tipSeen, dismissTip]);

  return (
    <GuideCtx.Provider value={ctx}>
      {children}
      <GuideDialog open={open} steps={steps} input={override ?? input} onClose={close} />
    </GuideCtx.Provider>
  );
}
