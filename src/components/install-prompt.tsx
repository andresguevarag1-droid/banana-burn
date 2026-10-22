"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Share, X } from "lucide-react";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Invita a instalar la app en el celular (Android: prompt nativo; iPhone: instrucciones). */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BIP | null>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("bb.installDismissed")) return;
      if (window.matchMedia("(display-mode: standalone)").matches) return;
    } catch { return; }
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    if (isIos) { setIos(true); const t = setTimeout(() => setShow(true), 4000); return () => clearTimeout(t); }
    const h = (e: Event) => { e.preventDefault(); setEvt(e as BIP); setShow(true); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  if (!show) return null;
  const close = () => { setShow(false); try { localStorage.setItem("bb.installDismissed", "1"); } catch { /* */ } };
  return (
    <div className="lg:hidden fixed inset-x-3 bottom-[calc(10rem+env(safe-area-inset-bottom))] z-40 animate-rise">
      <div className="flex items-center gap-3 rounded-3xl bg-ink text-white p-3 pl-4 shadow-lift">
        <Image src="/icons/icon-192.png" alt="" width={40} height={40} className="size-10 rounded-xl" />
        <div className="flex-1 min-w-0 text-sm">
          <p className="font-bold">Instala Banana Burn 🍌</p>
          <p className="text-white/70 text-xs">{ios ? <>Toca <Share className="inline size-3.5 -mt-0.5" /> y luego “Agregar a inicio”</> : "Ábrela como app, a pantalla completa."}</p>
        </div>
        {!ios && evt && <button onClick={async () => { await evt.prompt(); close(); }} className="h-9 px-4 rounded-full bg-banana text-ink text-sm font-bold">Instalar</button>}
        <button onClick={close} className="grid place-items-center size-8 rounded-full text-white/60" aria-label="Cerrar"><X className="size-4" /></button>
      </div>
    </div>
  );
}
